# CI/CD workflow

GEKI deploys one Next.js application from the repository root. The previous apps/web and apps/api workspaces and Express listener have been removed.

## GitHub Actions

App checks runs on pushes, pull requests and manual dispatch. It uses Node 24.20.0, the npm lockfile, pinned Actions, read-only repository access, timeouts and cancellation of superseded runs.

1. **Typecheck, unit tests and production build** installs locked build dependencies, generates Prisma, checks Firebase Admin module loading with native CommonJS-to-ESM loading disabled, verifies an RSA key/signature round trip, typechecks the full app, runs unit tests and builds Next.js. Static builds do not need production database credentials: API modules load at request time.
2. **Auth, paid access and QR payment regression tests** provisions PostgreSQL and Firebase Auth Emulator, applies all existing migrations and database security, and starts Next.js on port 3000. Existing API/payment tests call the real Next.js Route Handler. Test identities, receipts and orders remain isolated from live services.
3. **Release gate** fails if either dependency fails, is skipped or cancelled.

The old isolated web-workspace check is no longer needed: the root manifest now owns the compiler, browser and server dependencies together.

## Release settings

- Vercel Root Directory: blank/repository root. Framework: Next.js. Install: npm ci --include=dev. Build: npm run build. One deployment serves pages and /api/\*.
- Select Release gate under Vercel Settings → Build and Deployment → Deployment Checks → GitHub, if available in the team's plan.
- Protect main with a pull-request rule and required Release gate status. Ensure administrator bypass rules match the intended policy.
- Keep production domain auto-assignment enabled when Deployment Checks gate assignment. Do not force-promote failed checks.
- Git integration handles previews and production. No Vercel deployment token is stored in this workflow.
- Configure production values only in Vercel settings. Do not copy live credentials into CI or Preview. Browser Firebase values require rebuilding; server secrets remain unprefixed.
- Apply reviewed database migrations separately using the migrator role. Do not run destructive migrations or seeds automatically at build time.

These repository files do not configure branch protection or required Vercel checks by themselves. Confirm those account settings independently. Cloud private uploads remain blocked until durable direct-upload storage is configured; a green build is not proof of the complete paid checkout experience.

## Local checks

Run npm run build:verified. Integration tests require a loopback database named geki_ci, FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099, FIREBASE_PROJECT_ID=demo-geki-academy, MEDIA_MODE=local, NODE_ENV=test, HOST=127.0.0.1, PORT=3000 and UPLOAD_DIR=.local/ci-uploads. Run migrations, then firebase emulators:exec --only auth --project demo-geki-academy "npm run test:ci". The harness seeds test accounts, starts Next.js and stops it afterward.

Reference: https://vercel.com/docs/deployment-checks
