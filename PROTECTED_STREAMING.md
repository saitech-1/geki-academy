# Protected streaming connection

## Current status

The VdoCipher integration is implemented, but live activation requires your own provider account and API secret. No provider account has been created or paid plan purchased. Production streaming remains disabled until connected and tested. Local source previews are private admin previews, not student DRM playback.

## Connect your account

1. Create an account at https://www.vdocipher.com/dashboard/register and verify your email.
2. Obtain the server API secret from the VdoCipher dashboard. Put it in the existing ignored root `.env.production.local` file:

   ```dotenv
   VDOCIPHER_API_SECRET=your_private_api_secret
   MEDIA_MODE=vdocipher
   ```

   Never add `NEXT_PUBLIC_` to the secret, paste it into chat, or commit it. Keep the existing database, Firebase and other settings.
3. Restart `npm run start:api:live`. The web client does not need the secret. Sign in at http://localhost:3001/signin?next=%2Fadmin.
4. Open **Admin → Videos**, select a saved source, then **Send saved source for protection**. Keep the window open while transfer completes. This sends the private local file from the server to the provider; it does not expose a public source URL.
5. Use **Check processing status** until the provider reports `ready`. Processing is not instant. No automatic provider polling or background retry is currently implemented.
6. Review and approve both subtitle tracks, then **Sync approved subtitles**. Burmese is mapped from GEKI's `mm` locale to the provider's ISO language `my`. Only replaced, deletable VTT tracks of the same language are removed, after the new upload succeeds; posters and other languages are preserved.
7. Publish the video, attach it to a course lesson, and publish the course. Publication checks encoding readiness and a fingerprint of the current approved captions. Changing captions or provider asset requires a fresh sync.
8. Test the first public Kihon preview and a member-only lesson with your real account. Verify captions, resume, device limits, single-stream transfer, Chrome, Safari and Facebook's in-app browser. Where the embedded browser cannot play protected media, use the external-browser flow. Confirm supported recording protection with VdoCipher on each target platform; web DRM cannot promise universal screen-record prevention.

## Recovery and operational limits

- The asset ID is persisted before sending the large file, so an uncertain transfer is not silently retried and charged twice. If transfer fails, inspect that asset in the provider dashboard and upload its source there if necessary, then check processing in GEKI.
- To use a video uploaded directly through the provider dashboard, set its asset ID in GEKI's existing video editor, approve the tracks again, check status and sync captions.
- A process crash during transfer can leave a video in `PROCESSING`. Complete the saved asset's upload in the provider dashboard, then check status in GEKI; `ready` returns it to review. Do not create another asset until the first is inspected.
- Keep original files on persistent private server storage. The current transfer is request-based, capped at 30 minutes, and should run behind a proxy allowing that duration. Large-scale resumable transfer and multi-instance subtitle-operation locking need further work before scaling beyond one API instance.
- Deleting a local GEKI video does not automatically delete the remote provider asset. Review unused assets in the provider dashboard to manage storage and avoid accidental remote data loss.
- An API secret being present is configuration, not proof of account health. The first successful status request and real playback test verify credentials and service availability. Provider authentication, quota and network failures block publishing safely.

## Validation

Provider contract tests mock HTTP; they validate request construction, server-only authorization, URL restrictions, caption replacement and sync fingerprints. They do not constitute a live DRM test. No real provider credential was available during implementation.

Official references: [upload credentials](https://www.vdocipher.com/docs/server/upload/credentials/), [file transfer](https://www.vdocipher.com/docs/server/upload/file/), [encoding status](https://www.vdocipher.com/docs/server/upload/status/), [captions](https://www.vdocipher.com/docs/server/videomanagement/files/upload-captions/).
