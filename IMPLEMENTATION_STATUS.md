# Implementation status

Updated October 22, 2026. The migration branch consolidates GEKI into one full-stack Next.js application. The existing UI and database schema are retained; Express and the separate API listener are removed.

The Route Handler at src/app/api/[...path]/route.ts delegates to server-only endpoint groups. Existing Firebase token verification, authorization, per-course purchase rules, quizzes, progress, administrator operations, payment review and signed source previews are preserved. Native request parsing enforces JSON limits; multipart upload parsing streams to private disk on local/persistent hosts. Database TLS can accept the public CA through DATABASE_SSL_CA without disabling certificate verification.

CI runs type/unit/production-build checks and authenticated API/payment regressions through a real Next.js server. See the branch's latest CI run for the current verified result; this document does not imply production rollout.

Production environment values have been configured in Vercel. The deployment must use the root Next.js app and a freshly built commit. Firebase authorized domains and real sign-in still need production acceptance.

Cloud source/receipt uploads are explicitly blocked on Vercel until private persistent direct-upload storage is connected. Existing local source files are not migrated automatically. Instance-local throttling, production observability, EN/MM editorial review and final mobile/browser acceptance remain open.

Firebase Admin's `jwks-rsa` dependency is scoped to `jose@5.10.0`, which provides CommonJS exports. Its default ESM-only dependency crashes when Vercel disables native `require(ESM)`. The override does not change other packages' JOSE versions. `npm run test:auth-runtime` reproduces that runtime constraint, loads Firebase Admin and checks real RSA key conversion/signature verification. Revisit the override when the upstream compatibility issue is resolved: https://github.com/auth0/node-jwks-rsa/issues/507.
