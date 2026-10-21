# GEKI Academy

A working Next.js web application, Express REST API, PostgreSQL/Prisma database and Firebase Authentication integration. The original design presentation remains in `design/`; application code lives in `apps/`.

## Run locally

Requires Node.js 24 and Java 21+ for the Firebase Auth Emulator. Chrome is used by the browser checks.

```powershell
npm ci
npm run setup:local
npm run db:generate
```

Start these in separate terminals:

```powershell
npm run db:local
npm run auth:emulator
```

Once both are ready:

```powershell
npm run db:migrate
npm run db:seed
npm run dev
```

Open **http://127.0.0.1:3000**. API: `http://127.0.0.1:4000/api/health`. The Auth Emulator API runs on port 9099; its UI is disabled. After initialization, `npm run dev:all` starts the four services together.

The Auth Emulator launcher imports the last `.local/firebase-auth` snapshot when present and exports on a graceful Ctrl+C shutdown. This keeps local identities associated with the same database learning records between sessions. Abrupt process termination cannot guarantee an export.

Local accounts, valid only against the emulator:

| Account        | Email              | Password       |
| -------------- | ------------------ | -------------- |
| Super Admin    | admin@geki.local   | GekiLocal!2026 |
| Active student | student@geki.local | GekiLocal!2026 |

The seed creates a **draft** Kihon package with four sections. Publish actual GEKI content through the admin workspace. Browser/integration tests create clearly labeled development videos and courses; these are not teaching material. No sample users or test videos are seeded into Supabase.

Windows embedded PostgreSQL uses `.local/postgres`, port 5433 and a UTF-8 database. `docker compose up -d` is an alternative; use the database name/credentials from `docker-compose.yml`. The existing developer instance uses `geki_utf8`; `.env` already points there. Fresh setups create `geki` in UTF-8. Keep database volumes between runs.

## What works

- Email/password and Google sign-in, sign-up, verification, password reset and account recovery through Firebase SDKs. Adult/guardian learner onboarding and verified-email gates are enforced by the API.
- Responsive public pages, course catalog/detail, guest preview, student dashboard, native video playback in development, resume/progress, quizzes and saved results.
- Server-side membership checks, two account-bound browser registrations, one playback session, explicit stream transfer, two device replacements per rolling 30 days and admin override.
- Admin course/section/lesson CRUD, reusable videos, lesson ordering, private source uploads and previews, EN/MM WebVTT editing/review, publishing guards, quiz editing, student membership/suspension/device actions, roles and audit history.
- Profile/language preference, notifications and membership/payment history backed by PostgreSQL.
- Reduced-motion styling, keyboard focus, labeled controls, responsive layouts and mobile navigation.

## Live Supabase and Firebase configuration

The new Supabase project is **geki-academy**, `msrvghakwqyjwwjcravk`, in the GEKI organization, Singapore. [Open the project](https://supabase.com/dashboard/project/msrvghakwqyjwwjcravk). Its private `geki` schema contains 18 application tables. Firebase remains the identity provider; Supabase Auth is not used.

The server-only runtime login `geki_api` has application-table CRUD access and no schema migration privileges. Its random password is stored in the ignored `.env.production.local`. Data API roles have no schema access; all application tables have RLS and restrictive deny policies. Express performs per-user authorization using Firebase ID tokens. Never expose the database URL to a browser.

The IPv4 session pooler is configured with `sslmode=verify-full` and `sslrootcert`. The public trust certificate in `certificates/supabase-ca.crt` comes from the Supabase dashboard. If relocating this checkout, update the absolute certificate path inside the private database URL. Do not disable certificate verification.

```powershell
npm run check:live-db
npm run build
npm run start:api:live
# Separate terminal:
npm run start:web:live
```

Open **http://localhost:3001** for the real Firebase / Supabase build. The API runs on port 4001. Use `localhost` because it is an authorized Firebase domain. Local test accounts do not exist in the real Firebase project. Production catalog is intentionally empty until the draft launch course has reviewed, published teaching content.

Your supplied Firebase web configuration is installed in ignored `apps/web/.env.production.local`. Standard Firebase signature, issuer, audience and expiry verification is configured with `FIREBASE_CHECK_REVOKED=false`. This works without a private Admin key; revoked Firebase sessions remain valid until token expiry. Database suspension is checked immediately on protected API calls.

The server has a one-time `BOOTSTRAP_OWNER_EMAIL` invitation configured for the owner's explicitly provided email. The matching **verified** Firebase sign-in receives Super Admin, with a database audit record and concurrent-request protection. An unverified email, another email or an emulator token cannot accept it. The consumed invitation does not override later role changes. No live user role was assigned before that real sign-in.

For an existing account explicitly chosen by the operator, role bootstrap can also use the trusted local command without a privileged Firebase key:

```powershell
node --env-file=.env.production.local --import tsx scripts/grant-admin.ts --email YOUR_OWNER_EMAIL --existing-account
```

The account must already exist from a verified-token API sign-in. Admin API access still requires Firebase email verification. For privileged Firebase user management and immediate Firebase revocation checks, supply Application Default Credentials or a private service-account JSON file **outside this repository**, set `GOOGLE_APPLICATION_CREDENTIALS` and enable `FIREBASE_CHECK_REVOKED=true`. Never paste the JSON into chat. The original Firebase Admin lookup bootstrap remains available:

```powershell
node --env-file=.env.production.local --import tsx scripts/grant-admin.ts --email YOUR_VERIFIED_OWNER_EMAIL
```

The bootstrap records the role change in the audit log. Only the server-configured owner or explicitly selected account is eligible. The real project successfully returns a Google authorization URI; an email/password provider probe returned a credential error rather than a disabled-provider error. A real user's completed sign-in and email delivery still require acceptance testing. Add the final deployment domain to Firebase Authorized Domains before release.

## Admin uploads and content operations

Course create/edit/delete, section rename/delete, lesson edit/remove and video create/edit/delete now persist through the REST API. Deleting a course keeps reusable source videos; deleting a video is blocked while it has lesson links or student progress. Courses with quiz attempts must be unpublished rather than deleted. Delete/unpublish operations require an audit reason.

Choose a local MP4/WebM in **Admin → Videos → Add video** to detect its duration, create the database record and upload the source. The UI displays upload progress. Admins can preview uploaded sources through five-minute signed links. The server rechecks the admin role and account suspension on media requests, validates file signatures and handles byte ranges. Replacing footage requires no existing watched progress and clears subtitle approvals; delete cleans up the private source file.

Private source uploads are accepted even when production paid streaming is disabled. Store `UPLOAD_DIR` on a private persistent volume when deploying; Next.js/public assets are not used for these sources. Set a shared random `MEDIA_TICKET_SECRET` for multiple API instances. Production student playback/publishing still needs the configured protected provider. Plain source uploads do not promise universal recording prevention.

Dialogs are portaled to the document body, centered across laptop sizes, and scroll internally. Motion includes page entrances, staggered metrics, public scroll reveals, modal entrance/exit and hover feedback, with reduced-motion support.

## Database migrations

`prisma/schema.prisma` is the schema source. `npm run db:migrate` deploys checked-in Prisma migrations and applies `database-security.sql` using an owner connection. The runtime login deliberately cannot perform DDL.

The cloud schema was checked against Prisma with no difference detected and both existing foundation migrations are now baselined. The separate `geki_migrator` login owns only the private application schema. Its connection is stored in ignored `.env.migrations.local`; the runtime API continues using its more limited login. Run `npm run db:migrate:live` to apply reviewed, checked-in migrations and private-schema policies. Do not replay the foundation SQL or reset the cloud database. Back up before production migrations and review generated SQL. Never use `prisma migrate dev` against production.

## Membership reminders and languages

The existing notification center now receives in-app expiry reminders from a separate worker:

```powershell
npm run reminders:once
# Or keep a local worker running:
npm run reminders:worker
# Explicitly against the cloud database:
npm run start:reminders:live
```

The worker checks every 15 minutes by default (`REMINDER_INTERVAL_MS`, minimum 60000). It creates notices at seven days, one day and shortly after expiry, considers contiguous renewals, skips suspended accounts and uses a unique database key to prevent duplicate delivery across retries/concurrent workers. It sends no external email. Deploy it as a supervised worker or invoke `--once` from the chosen host's scheduler; it is not automatically running in production.

The EN/မြန်မာ selector works on public and learner navigation. Guest choices persist in browser storage; account choices persist through `/api/me/preferences` without modifying onboarding consent. Burmese course titles/descriptions are shown when supplied, and search includes both languages. Missing translations use English. The dictionary is `apps/web/src/lib/translations.ts`; complete Burmese content and UI copy still require editorial review before launch.

## Checks

```powershell
npm run typecheck
npm test
npm run build
# With the local services running:
npm run test:browser
npm run test:reminders
npm run test:admin
npm run test:owner
npm audit --omit=dev
```

`test:browser` creates a three-second test fixture, runs real API/database checks and verifies login, admin authorization, playback/resume, quiz persistence and mobile device management in Chrome. It only permits local emulator/Postgres services. Screenshots and reports are under ignored `.local/`.

## Release work still required

This is a functional development application with a connected cloud database, **not a paid-launch deployment**. See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for tested coverage and remaining release requirements. Payment collection, DRM service activation, approved teaching content, automated subtitle processing and a public deployment require further configuration/work. They are not simulated as completed.
# Protected streaming setup

See [PROTECTED_STREAMING.md](PROTECTED_STREAMING.md) for VdoCipher account connection, saved-source transfer, processing checks, subtitle sync, publication requirements and recovery. Live provider credentials and a real DRM playback test are still required. The web proxy now permits 500 MiB source uploads plus multipart overhead.

