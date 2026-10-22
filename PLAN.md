# GEKI Academy — current implementation and delivery plan

Updated October 22, 2026. Paid launch target: November 30, 2026.

## Architecture decision

The user has explicitly replaced the separate Express API architecture with a single full-stack Next.js application. This supersedes the earlier web/API workspace plan. One origin serves the existing UI and REST endpoints through Next.js Node.js Route Handlers. Server logic is in src/server, pages in src/app, browser components in src/components and shared contracts in packages/contracts. Existing database records and API paths are preserved.

Next.js 16.4.2, React 19.3.1, TypeScript 5.9.3, Prisma 7.10.1, PostgreSQL, Firebase Authentication and VdoCipher remain in use. Firebase is identity; Supabase hosts private PostgreSQL data. No Supabase Auth or direct AWS account is introduced. Future Expo clients can call the same REST endpoints.

## Launch scope

- Kyokushin courses: Kihon, Kihon Ido, basic Kumite and Kata. Fitness comes later.
- One-time course purchases with ongoing access; no monthly/annual membership sales.
- Public designated preview, paid lesson locks, reliable course progress and quizzes with 80% passing and unlimited retries.
- English/Burmese interface and reviewed subtitles; minimum learner age 12 with guardian-managed accounts where required.
- Two devices, one playback stream, audited administrative overrides.
- Admin course/video/quiz CRUD, student access management and payment reviews.
- Premium dark athletic UI and restrained motion, respecting reduced-motion preferences.

Out of scope: certificates, community, seminar booking, offline downloads, rankings, personalized AI coaching and native mobile launch.

## Preserved business rules

CoursePurchase is the source of paid access. Historical memberships do not unlock lessons. Administrators using the learner player must also own the course. Backend checks protect playback and quiz access; UI locks alone are insufficient. Receipt and transaction-ID reuse are rejected. KBZPay QR checkout requires manual verification of funds; approval creates the purchase transactionally. No bank webhook or automatic QR validation has been invented.

## Migration delivery sequence

1. Consolidate web and server files into the root Next.js app; remove Express, cross-process proxying and obsolete workspace commands.
2. Preserve existing handlers behind native Next.js Request/Response handling, multipart validation, error mapping and non-cacheable responses.
3. Run type/unit/build checks and the authenticated API/payment regressions through the Next.js HTTP server. Push the migration on its review branch.
4. Change Vercel Root Directory to the repository root and deploy the tested commit with the already configured Production environment. Confirm Firebase authorized domains and sign-in, catalog, paid access, progress and administrator roles against production.
5. Connect persistent private direct-upload storage for cloud source videos and receipts before enabling the complete paid checkout/upload workflow on Vercel. Migrate any required existing private source assets explicitly.
6. Complete editorial EN/MM content review, guardian and privacy acceptance, live provider/browser checks, failure handling, release protection and production observability before the paid launch.

## Remaining risks

- Vercel private disk uploads are deliberately disabled until a persistent object-storage/direct-upload path exists. Do not claim the cloud upload flow is finished.
- Additional request throttles are instance-local; distributed rate enforcement is a follow-up. Critical purchase/device constraints remain database-backed.
- DRM behavior depends on browser/platform; universal screen-recording prevention cannot be promised.
- FIREBASE_CHECK_REVOKED=false permits a revoked Firebase token until expiry; application suspension is checked immediately. Immediate Firebase revocation needs privileged server credentials and explicit configuration.
- Production and Preview must not share live database secrets by default. Build checks are distinct from live payment/provider acceptance.

Operational commands and release checks are maintained in README.md and docs/ci-cd.md. Earlier plans remain available in Git history.
