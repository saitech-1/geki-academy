# Course Library and Resend implementation report

## Repository findings

The app is a single full-stack Next.js 16.4.2 application at the repository root. Native API route handlers run the existing server endpoints. PostgreSQL/Prisma remain the source of truth, Firebase remains the identity provider, and protected video playback still checks active course purchases on the server. The existing private Job table supports a durable email outbox.

Before this change, Academy Course Library opened the public catalog, My Learning reused the dashboard, completed totals could include unowned/preview records, and course detail always started the first lesson. Gmail SMTP was unfinished and rejected authentication. Payment review already created purchases atomically, checked bank references, denied self-review, and retained payment/audit history; those controls were preserved.

## Implemented experience

- `/courses`: public discovery, unchanged entry point.
- `/academy/courses`: authenticated catalog of published courses; locked, awaiting payment, pending review, rejected, enrolled and completed states.
- `/my-learning`: only active purchases/grants on published courses; revoked and unpaid courses excluded by the API.
- `/purchases`: owned-course library plus existing payment and purchase history.
- Server-calculated completion and resume links use the course's published lessons and persisted progress. Preview/unrelated history cannot unlock access or inflate owned-course totals.
- Search/category filters, dynamic categories, thumbnails, instructor/descriptions, progress, accessible controls, skeletons, meaningful empty/error states, retry, subtle motion and reduced-motion support.
- Three-column-capable responsive cards; a single course becomes a wider desktop feature card. Mobile stays intentionally stacked.
- Visible pages poll course access every 15 seconds and refresh on focus. Newly approved access also refreshes the auth account snapshot. Course detail uses server access/progress and the correct resume lesson.

## Payment and email behavior

Submission, approval and rejection each queue separate admin and learner templates. Approval still grants one ongoing purchase atomically; notifications never grant access. Rejection keeps the record and enables safe resubmission. Review reason is an internal audit note; a separate optional learner message defaults to a safe standard explanation.

Resend replaces the unsuccessful Gmail SMTP implementation. Its API key is server-only. Testing is the default and routes every payment email to `saizaybhonehlawn@gmail.com`, clearly labeling intended recipients. There is no Gmail sender impersonation or silent SMTP fallback. Production mode requires a verified-domain sender and explicit configuration.

The existing Job outbox deduplicates by order, revision, event and audience; worker leases prevent concurrent sends. Resend idempotency keys protect ordinary retries. Previously attempted messages older than 23 hours are stopped for provider review before retrying outside the provider window. Delivery errors never roll back approval. Admin UI shows counts, recent delivery history and retry controls. Accepted messages retain provider IDs; accepted is not described as inbox-delivered.

See [email setup and operational limits](PAYMENT_EMAILS.md).

## Files

New:

- `src/components/academy-library.tsx`: Academy catalog/owned cards, filters, loading/error states and refresh.
- `src/lib/course-learning.ts`, `src/lib/course-learning.test.ts`: progress/status calculation and tests.
- `src/server/course-library.ts`: authenticated, purchase-filtered course summaries.
- `src/server/email-service.ts`, `src/server/payment-email-templates.ts`, `src/server/payment-email.ts`, `src/server/payment-email.test.ts`: Resend configuration/routing, six templates, outbox and tests.
- `src/app/api/internal/payment-emails/route.ts`: authenticated fallback worker.
- `scripts/check-payment-email.ts`, `scripts/payment-email-test.ts`, `scripts/prepare-academy-library.ts`, `scripts/academy-library-browser.cjs`: provider check, durable-queue tests, disposable local UI fixture and browser verification.
- `docs/PAYMENT_EMAILS.md`, this report.

Updated:

- `src/components/catalog.tsx`, `student.tsx`, `experience.tsx`, `shell.tsx`, `qr-payments.tsx`: detail resume/access, dashboard totals, Academy routing/navigation, payment history/review and delivery UX.
- `src/server/app.ts`, `qr-payments.ts`, `src/app/api/[...path]/route.ts`: authenticated library endpoint, transactional event hooks, safe learner messages, admin delivery operations and post-response worker.
- `src/lib/types.ts`, `translations.ts`, `src/app/globals.css`: typed summaries, Burmese interface strings and responsive GEKI styling.
- `.env.production.example`, `README.md`, `vercel.json`, `.github/workflows/ci.yml`, `scripts/ci-integration.mjs`, `integration-test.ts`, `qr-payments-test.ts`: configuration, deployment/CI and regression coverage.
- `next.config.ts`: cap build workers at two for the laptop/CI memory budget.

Existing motion work under `apps/motion` and its root convenience scripts were preserved. No unrelated brand asset replacement was performed. No new runtime dependency remains; the temporary SMTP dependencies were removed.

## Database and deployment

No schema migration is needed: existing CoursePurchase, Progress, PaymentOrder, AuditEvent, Notification and Job relationships are reused. Never run the seed or fixture scripts against the hosted database. Keep the `geki` schema private.

Required server settings: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAIL`, `PAYMENT_NOTIFICATION_MODE`, `EMAIL_APP_URL`, and `CRON_SECRET`; see the example and email guide. Configure Vercel Production separately and redeploy after adding secrets. No credentials are committed or exposed through client variables.

Actual email delivery remains unverified until an authenticated Resend account/key is available. The account-owner test inbox restriction applies until a domain is verified. Code is not pushed or deployed by this task.

## Validation

- 42 unit tests passed; TypeScript passed.
- Real local database outbox integration passed: state validation, rollback, deduplication, retries, concurrency, preserved enrollment on failure, and ambiguous-send recovery.
- Payment API regression passed: exact prices, receipt-only submission, authorization, rejection/resubmission, atomic duplicate approval, library visibility and revocation.
- 16 existing authenticated integration groups passed, including saved watch progress, completion, protected streaming, devices and quizzes; owned-library completion assertions also passed.
- QR payment browser flow passed with no browser errors.
- Academy browser checks passed at 1440, 768 and 390px: owned-only visibility, 50% progress after reload, correct resume action, catalog states, search/categories, empty results, skeletons, API failure/retry and admin denial. Local verification screenshots are under `.local/academy-library-*.png`.
- CI now runs authenticated library browser checks with disposable PostgreSQL and Firebase Emulator. No real emails are sent by fixtures.

There is no configured lint script; TypeScript, unit/integration/browser checks and formatting checks provide the current quality gate. The optimized production build passed, including Next.js TypeScript and route generation. Formatting and Node syntax checks also passed.
