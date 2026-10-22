# Build and release checks

## What runs automatically

`.github/workflows/ci.yml` runs on pushes, pull requests and manual dispatches.
It uses Node 24.20.0, the committed npm lockfile, pinned GitHub Actions and
read-only repository permissions. No production secrets are required.

The two jobs run independently:

- `Typecheck, unit tests and production build` generates Prisma, checks both
  applications, runs unit tests and compiles the production Next.js app.
- `Auth, paid access and QR payment regression tests` provisions disposable
  PostgreSQL, applies all migrations and database security, starts Firebase's
  Auth Emulator and the Express API, then runs the existing API and payment
  tests. These include paid-video access, device limits, quiz grading, receipt
  privacy, duplicate evidence, manual approval and revoked access.

`Release gate` succeeds only when both jobs succeed. A failed, cancelled or
skipped dependency fails the gate. Production data, video-provider credentials
and real payment transactions are never used by these tests. Provider contract
unit tests use mocked responses; they do not prove live DRM or banking works.

## Connect the gate to continuous deployment

A passing GitHub job alone does **not** prevent Vercel from releasing a Git
deployment. Complete these settings after the workflow is pushed and has run:

1. In GitHub repository settings, protect `main` with a ruleset requiring a
   pull request and the `Release gate` status check. Apply it to administrators
   too if direct administrator pushes must be blocked.
2. In the Vercel project, open **Settings → Build and Deployment → Deployment
   Checks**, select GitHub, and require `Release gate` for production. Keep
   production domain auto-assignment enabled; Vercel holds assignment until
   the required check passes. Do not force-promote a failed check.
3. Retain Vercel's Git integration for preview and production builds. No Vercel
   deployment token needs to be stored in this CI workflow.

Account settings have not been changed by adding these files. Access to the
Vercel team's detailed logs and settings is currently denied by the connected
account. Check availability of Deployment Checks in the team's plan; if they
are unavailable, keep production promotion manual until the equivalent release
gate can be configured. Do not assume branch protection blocks direct pushes
unless the repository ruleset is actually enabled.

Reference: https://vercel.com/docs/deployment-checks

## The TypeScript build failure

The reported TS5102 error comes from `baseUrl` in `apps/web/tsconfig.json`.
It has been removed; `@/*` still maps explicitly to `./src/*` through `paths`.
TypeScript build checks remain enabled.

The repository-root `vercel.json` uses `npm ci --include=dev`, keeping the
lockfile authoritative and ensuring the pinned TypeScript/build tools are
installed even when the environment otherwise omits development dependencies.
Do not override this with an install command that omits them.

To reproduce the compile checks locally:

```sh
npm ci --include=dev
npm run build:verified
```

CI itself starts with a clean checkout and no `.env` files. Its Firebase values
are public placeholders for compilation only. Real Vercel deployments still
need the project's public Firebase web configuration; never set the Auth
Emulator URL in production.

## Hosting work still required

This change adds build checks and the reported TypeScript fix. It does not
finish hosting the Express API, move local source uploads/payment receipts to
persistent private storage, configure production credentials, or authorize the
production domain in Firebase. Keep those items in the deployment checklist;
a green frontend build does not establish that the full app is ready to launch.
