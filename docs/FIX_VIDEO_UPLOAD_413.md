# Video upload 413 investigation and fix

## Confirmed root cause — November 2, 2026

The production host is Vercel, serving a full-stack Next.js application. There is no Express/Multer or Nginx upload layer in this repository. A differential request to the reported production endpoint `/api/admin/videos/cmvzety2g000908jq1ofzn8yj/upload` confirmed:

| Request | Observed response |
| --- | --- |
| 1 byte, no authentication | 401, GEKI JSON `UNAUTHENTICATED` |
| 5,242,880 bytes, no authentication | 413, `x-vercel-error: FUNCTION_PAYLOAD_TOO_LARGE` |

The large request is rejected before application authorization. [Vercel Functions have a 4.5 MB request/response payload limit](https://vercel.com/docs/functions/limitations). Application multipart limits cannot raise it.

Before the fix, `src/components/admin.tsx` called `uploadVideo()` in `src/lib/api.ts`, which posted the whole video as multipart data to GEKI. `src/server/app.ts` handled that route with `receiveUpload()` in `src/server/uploads.ts`: a bounded Busboy stream to local disk, with a 500 MB video limit and header verification. It was not a whole-file memory buffer. That helper explicitly rejects Vercel disk uploads, but the infrastructure rejects large requests earlier. The separate `src/server/protected-video.ts` transfer to VdoCipher happened only after the local upload.

## New architecture and files

- `src/server/video-upload-sessions.ts`: admin upload authorization, persistent sessions, restricted provider policy validation, provider verification, cancellation and orphan cleanup.
- `src/lib/api.ts`: small JSON session requests, direct browser-to-provider multipart transfer, real progress, abort and retry. No Firebase bearer token is sent to the provider.
- `src/components/admin.tsx` and `src/components/video-upload-status.tsx`: filename/size, duplicate-click protection, cancellation, retry, and separate upload/encoding/ready states.
- `src/server/app.ts`: mounts authenticated upload endpoints and finalizes active sessions before publication checks.
- `src/server/admin-content.ts`: integrates the existing provider-status action with session verification.
- `src/app/api/internal/payment-emails/route.ts`: adds recovery cleanup to the existing authenticated daily cron.
- `scripts/ci-integration.mjs`: runs the new database and browser regression scripts.
- `src/lib/video-direct-upload.test.ts`, `src/server/video-upload-sessions.test.ts`, `scripts/video-upload-test.ts`, `scripts/video-upload-browser.ts`, `scripts/check-video-provider.ts`: verification.

Production flow:

1. An authenticated admin selects an MP4/WebM (application limit: 500 MB). The browser reads duration and hashes only the first 64 KB for retry matching.
2. `POST /api/admin/videos/:id/upload-session` validates metadata and a format-header preflight, checks existing source/progress/publication state, reserves the video and asks VdoCipher for upload authorization.
3. The server validates the HTTPS provider destination, policy expiry and exact object-key restriction. Only delegated upload fields reach the browser; the provider API secret remains server-only.
4. The browser sends the actual file directly to VdoCipher's signed destination, with the file as the last multipart field. No video bytes traverse Vercel Functions. This uses VdoCipher's existing storage infrastructure; no additional storage service or AWS account is introduced.
5. `POST .../upload-session/complete` and `GET .../upload-session` read the provider's status. A browser 201 alone cannot mark a video ready. Queued encoding is stored as `PROCESSING`; only provider `ready` plus a supported provider-confirmed duration moves the record to `REVIEW`.
6. Subtitle approval/sync and explicit publication remain required. Existing player, paid course access and lesson associations are preserved. Published/watched footage cannot be overwritten through this workflow.

Sessions use the existing private Prisma `Job` table with kind `VIDEO_DIRECT_UPLOAD`; identifiers, metadata and state are stored there. No schema migration is needed. Credentials are removed after transfer confirmation/cleanup. Row locks serialize authorization, cancellation and completion. Repeated completion cannot create duplicate publication or completion audit events. Re-selecting the same file reuses a still-valid session; a different file requires cancellation first.

## Expiry, cleanup and limits

- Application authorization expires after at most 20 minutes, further bounded by the provider policy expiry. Provider-delegated credentials retain the provider's own expiry; GEKI cannot re-sign or shorten them.
- The application's 500 MB checks cover browser selection and declared metadata. The signed provider policy controls the hard storage-side limit; a trusted admin modifying metadata does not alter the provider's signed limit. Actual format/decodability and duration are verified through successful provider encoding, not by trusting a client completion flag or file extension.
- VdoCipher's documented signed multipart POST flow does not expose byte-range resume. Interrupted transfers restart from byte zero using a valid session. Processing/status recovery survives page reloads without uploading the file again.
- Cancellation detaches an unused in-progress asset and restores the prior draft/local-source metadata. Provider deletion is limited to that session's asset and is blocked while another video references it. Failed cleanup remains queued for retry. Expired unused sessions are reclaimed by the existing daily cron. Existing completed assets are not deleted by expiration cleanup.
- A provider timeout during allocation before an asset identifier is returned can require manual review for an empty pre-upload asset in the VdoCipher dashboard. No client can finalize such an unknown asset.
- Trial quota, provider/network availability, the provider's policy/CORS settings, and admin permissions still apply. DRM playback on a learner's physical device was not newly verified by this change; existing local playback/access regressions were run.

## Configuration and deployment

No body-size increase, new Vercel function setting, reverse-proxy reload or new paid service is required. Existing server variables remain:

```
MEDIA_MODE=vdocipher
VDOCIPHER_API_SECRET=<server-only provider secret>
CRON_SECRET=<existing server-only notification/cleanup worker secret>
```

Database/Firebase configuration stays unchanged. Local emulator development with `MEDIA_MODE=local` retains the streamed local upload path; production does not fall back to local disk. No deployment has been claimed or performed as part of this fix.

Release steps:

1. Run `npm ci --include=dev` and `npm run build:verified`.
2. Run the isolated CI workflow (`npm run test:ci` with its documented disposable database/Auth Emulator configuration). Optional live provider verification: `node --env-file=.env.production.local --import tsx scripts/check-video-provider.ts --upload-test`; it creates and removes only its own short verification asset.
3. Commit the files listed above and this report, then push the reviewed commit to `main`. Keep private environment files and unrelated motion-study work out of the commit.
4. Let the connected Vercel Git deployment finish. Confirm it uses `MEDIA_MODE=vdocipher`, the existing API secret and cron secret. No migration command is required.
5. In Admin → Videos, choose a video larger than 4.5 MB. DevTools must show small `/upload-session` and `/complete` JSON requests and the large multipart request going directly to the provider's signed host. It must not show a large POST to GEKI's `/upload` route.
6. Verify encoding transitions to ready/review, approve and sync subtitles, publish, then open the associated lesson as a legitimately enrolled learner. Test the intended Chrome/Safari/phone DRM environments.
7. Interrupt one transfer and retry the same file; confirm only one GEKI video record/session is used. Cancel a separate unused upload and check cleanup status. The old `/upload` route can still return Vercel 413 if manually sent a large body; it is no longer the production browser upload path.

## Verification results

- TypeScript and 55 unit tests passed, including a real 6 MB `File` through the direct-upload client, progress ordering, network failure, cancellation, and signed policy safety.
- `npm run build:verified` passed, including Firebase Admin runtime verification and the optimized production build. One earlier concurrent build ran out of local memory; rerunning the build alone with bounded worker/heap settings passed.
- The repository has no separate lint script. Targeted Prettier formatting and `git diff --check` were used alongside TypeScript.
- Database session tests passed for small/large metadata, format/size rejection, session reuse, duplicate prevention, concurrent/idempotent completion, provider-confirmed status, course association, expiry, provider failure, cancellation and cleanup retries.
- Browser UI test passed with a 6 MB file and injected provider transport: admin-only authorization, metadata-only app requests, failed transfer/retry, no duplicate video, no legacy upload call, processing/ready UI and no browser errors.
- All 16 existing authorization, paid access, local media playback, subtitles, device/session and quiz integration groups passed.
- Live VdoCipher verification passed: actual signed policy validation, actual browser direct upload returned 201, and the provider confirmed `ready` with a three-second duration. The verification-only asset was deleted afterward. This is not a claim that an application deployment or full learner DRM-device playback test has completed.

Provider references: [browser upload](https://www.vdocipher.com/docs/server/upload/browser/), [credentials](https://www.vdocipher.com/docs/server/upload/credentials/), [status](https://www.vdocipher.com/docs/server/upload/status/), [asset deletion](https://www.vdocipher.com/docs/server/videomanagement/deleting/).
