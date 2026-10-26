# GEKI Academy

GEKI is one full-stack Next.js 16.4.2 application using React 19.3.1, TypeScript 5.9.3, PostgreSQL/Prisma 7.10.1, Firebase Authentication and VdoCipher. Next.js serves both the website and the REST API on port 3000. There is no Express server or separate web/API deployment.

## Source layout

- `src/app`: pages and the Node.js API Route Handler at `src/app/api/[...path]/route.ts`.
- `src/server`: server-side authentication, authorization, course/payment handlers, media and database access. The endpoint groups share existing business handlers; Next.js owns the HTTP server and native Request/Response lifecycle.
- `src/components` and `src/lib`: the existing interface, localization and Firebase browser SDK.
- `packages/contracts`: shared validation contracts, retained for future mobile clients.
- `prisma`: the database schema and existing migrations. No learning or purchase records are migrated or reset by the application refactor.
- `public`: public brand images and the intentionally public KBZPay QR. Private videos and receipts never belong here.
- `design`: the original design prototype, separate from the application.

## Local development

Use Node 24.20.0 and Java 21+ for the Firebase Auth Emulator.

```sh
npm ci --include=dev
npm run setup:local
npm run db:generate
```

Start PostgreSQL and Firebase in separate terminals with `npm run db:local` and `npm run auth:emulator`. Then run:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://127.0.0.1:3000. The same server provides http://127.0.0.1:3000/api/health. After first setup, `npm run dev:all` starts PostgreSQL, Firebase and Next.js together. No port 4000/4001 or API proxy is needed.

Local seed accounts are admin@geki.local and student@geki.local, password GekiLocal!2026. These exist only in the emulator. The seed refuses hosted databases and real Firebase. It creates a draft course, not invented teaching content. Keep local database volumes and emulator snapshots between runs.

## Production configuration

Vercel Root Directory must be the repository root (blank). Framework: Next.js; install command: `npm ci --include=dev`; build: `npm run build`. Deploy one application. There is no `API_INTERNAL_URL` setting.

Configure these through Vercel environment settings, not Git:

| Variable                                                                                                                     | Visibility / purpose                                                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_APP_ID | Public Firebase browser configuration; available at build time                                                                                              |
| DATABASE_URL                                                                                                                 | Server secret; runtime database role only                                                                                                                   |
| DATABASE_SSL_CA                                                                                                              | Public PEM CA certificate as a multiline environment value; keeps TLS certificate and hostname verification and avoids a laptop-specific certificate path   |
| FIREBASE_PROJECT_ID                                                                                                          | Server Firebase project                                                                                                                                     |
| FIREBASE_CHECK_REVOKED                                                                                                       | Current deployment uses false; signed tokens remain valid until expiry after Firebase revocation. Database suspension is checked on every protected request |
| BOOTSTRAP_OWNER_EMAIL                                                                                                        | Only the configured verified owner is eligible for bootstrap                                                                                                |
| MEDIA_MODE                                                                                                                   | vdocipher for protected streaming                                                                                                                           |
| VDOCIPHER_API_SECRET, MEDIA_TICKET_SECRET                                                                                    | Server secrets                                                                                                                                              |
| WEB_ORIGINS                                                                                                                  | Comma-separated additional trusted browser origins; same-origin requests work directly                                                                      |

Never configure FIREBASE*AUTH_EMULATOR_HOST or NEXT_PUBLIC_AUTH_EMULATOR_URL in Production. Never prefix database/provider secrets with NEXT_PUBLIC*. Production settings are already stored in the GEKI Vercel project; a fresh deployment is required to apply browser variables. Add the final domain in Firebase Authentication → Settings → Authorized domains for Google sign-in.

The private Supabase schema is `geki` in project msrvghakwqyjwwjcravk. Firebase remains the identity provider; Supabase Auth is not used. The runtime role `geki_api` has no migration privileges. Run `npm run db:migrate:live` separately with the ignored migration credentials before releasing schema changes. Never run the seed or integration fixtures against the live database.

For a local real-Firebase build, keep configuration in ignored root `.env.production.local` and run `npm run build` then `npm run start:live`. Development settings belong in `.env.development.local`; do not put emulator defaults in a generic `.env` that production would also load. Browser and server settings share the environment's root file. Existing private uploads remain in the same root `.local/uploads` directory.

## Learning and commerce

Courses are one-time purchases with ongoing access. A purchase unlocks only that course; historical memberships grant no access. The first explicitly marked preview can be public. Every learner, including administrators using the learner player, needs a purchase for paid footage. Private administrator source previews remain separate.

The Kihon course is 50,000 MMK. The first 50 paying Kihon learners receive 30% off (35,000 MMK). Checkout reserves an available founding place for 24 hours; submitted payments retain their quote until reviewed. Course-row locking prevents concurrent checkouts from overselling the offer. KBZPay checkout displays the exact server-priced amount and the supplied QR, accepts only a receipt photo from the learner (no typed transaction ID), then requires manual review of the incoming transfer in KBZPay. The administrator records the actual incoming bank reference before approval to prevent the same transfer paying twice. A screenshot never unlocks a course automatically. Approval and purchase creation are atomic and idempotent; reused transaction IDs/evidence are rejected, self-review is forbidden, and access revocation is preserved. Admin → Payment Reviews handles submissions. Do not approve without verifying actual funds.

Learning preserves watched coverage and resume position, two account-bound devices, one active stream with explicit transfer, quiz passing at 80% and unlimited retries. No certificates, community or seminar bookings are included. English/Burmese localization remains in `src/lib/translations.ts`; editorial review is still needed.

## Private media and deployment limitations

Local/self-hosted uploads stream MP4/WebM and receipt files to private disk with size and signature checks. Admin source preview uses short-lived signed URLs and role checks. Existing VdoCipher assets provide protected student playback; approved EN/MM subtitles must be synchronized before publishing.

Vercel has no persistent private filesystem. Disk uploads remain rejected on Vercel with DIRECT_UPLOAD_REQUIRED instead of pretending to save a permanent file. Video source uploads still need a private direct-upload integration. Receipts now support a private Supabase Storage bucket via signed browser uploads, authenticated receipt reads, ownership-bound expiring upload tickets, file checks and duplicate evidence checks. Configure and verify it using the instructions in [docs/payments-and-devices.md](docs/payments-and-devices.md). Existing local source files are not automatically copied to Vercel. Do not release paid checkout until receipt uploads have a working durable storage path. Screen-recording prevention is platform-dependent and cannot be guaranteed universally.

Additional request throttles are per Next.js instance; payment submission limits, purchase uniqueness and device/stream limits also have durable database enforcement. Distributed throttling remains a production follow-up. Progress/payment API responses are private and not cached.

## Validation and release

```sh
npm run build:verified
npm run test:ci
```

The second command requires the isolated `geki_ci` PostgreSQL database, Firebase Auth Emulator and the environment used in GitHub Actions. It starts its own Next.js server on port 3000 and refuses hosted databases. See [CI/CD](docs/ci-cd.md), [implementation status](IMPLEMENTATION_STATUS.md), [plan](PLAN.md) and [protected streaming](PROTECTED_STREAMING.md).

Protect main and require the GitHub Release gate in Vercel Deployment Checks. A passing workflow alone does not configure those account settings or make private cloud uploads production-ready.
