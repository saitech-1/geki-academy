# Payment notification emails

GEKI uses Resend's HTTPS API, with no Gmail SMTP fallback or additional service SDK. `saizaybhonehlawn@gmail.com` is the admin recipient, not the sending address.

## Configuration

Server-only variables:

```env
RESEND_API_KEY=<server sending key>
RESEND_FROM_EMAIL="GEKI Academy <onboarding@resend.dev>"
ADMIN_NOTIFICATION_EMAIL=saizaybhonehlawn@gmail.com
PAYMENT_NOTIFICATION_MODE=testing
EMAIL_APP_URL=https://geki-academy.vercel.app
CRON_SECRET=<random persistent secret>
```

Testing is the default. All admin/student payment templates are routed to the admin inbox at send time and labeled with the intended recipient. There are no CC/BCC recipients. This also protects older queued messages.

The Resend test sender can send only to its account owner's email. Use a Resend account associated with the admin inbox. See [test-sender restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain). For real student delivery, verify a domain in Resend, replace `RESEND_FROM_EMAIL` with an address on it, and explicitly set mode to `production`. Personal Gmail senders, invalid modes, and production use of the test sender fail closed. Resend enforces actual account/domain verification.

Store keys only in ignored environment files and Vercel Production settings, then redeploy. Never use `NEXT_PUBLIC_`. Development/test does not automatically send mail unless `EMAIL_DELIVERY_ENABLED=true` is explicitly set; do not enable that for fixtures.

Validate configuration without sending:

```sh
node --env-file=.env.production.local --import tsx scripts/check-payment-email.ts
```

Append `--send-test` to send a labeled connection test to the admin. A returned provider ID proves acceptance, not inbox delivery; check the provider dashboard and recipient inbox/spam folder.

## Events and safety

Each persisted event creates two templates:

| Event | Admin | Student |
| --- | --- | --- |
| SUBMITTED | New Payment Awaiting Review; learner, course, exact amount, method, available reference, timestamp, review link | Payment Received; approval pending, no access yet |
| APPROVED | Payment Approved; learner/course, amount, verified reference, timestamp, payment ID | Your Course Is Ready; enrollment active, Start Learning links to `/my-learning` |
| REJECTED | Payment Rejected; internal audit reason and payment details | Payment Update; separate safe learner message and resubmission link |

Templates share a responsive table-based GEKI layout, with English/Burmese learner copy. User content is escaped. Student messages omit internal notes and bank references. No receipt files, private Storage URLs or authentication tokens are emailed. Screenshot-only payment submission remains supported; absent references are labeled receipt-only.

The existing private `geki.Job` table is the outbox; no migration is needed. Deterministic IDs include order, revision, event and audience. Queue insertion is atomic with the payment update. Approval messages require a persisted approval; concurrent approvals create one purchase and one message per audience. Configuration errors and provider failures cannot reverse an approved enrollment.

Workers atomically lease jobs for five minutes, retry up to six times with backoff, and retain safe error codes plus provider acceptance IDs. Resend receives a stable idempotency key per job/mode. Its deduplication window is 24 hours: [official documentation](https://resend.com/docs/dashboard/emails/idempotency-keys). Previously attempted messages older than 23 hours, and exhausted crashed leases, stop with `PROVIDER_REVIEW_REQUIRED`. The normal retry button excludes these; inspect Resend before manual recovery, avoiding blind duplicates after the window expires.

Next.js `after()` drains up to three due messages after successful payment API responses, including admin payment/email-status views. The daily Vercel Cron fallback at 02:00 UTC (08:30 Myanmar time) drains up to five. This supports a daily Hobby schedule; after an outage an idle site may wait for the daily fallback. The cron route requires `Authorization: Bearer CRON_SECRET` and fails closed without it.

Admin Payment Reviews shows pending payment count, testing/production mode, queued/failed counts, recent event/audience states, attempts, safe errors and provider IDs. SENT means **Accepted by email provider**, not delivered; no delivery-webhook claim is made. Only verified admins may inspect or retry. Retry/email links never change payment or course access.

Keep `geki` private and apply a retention policy to old sent payloads, which contain personal/account information.

## Verification

- `npm test`: all templates, routing, configuration, idempotency headers, error handling, protected cron and course progress.
- `node --import tsx scripts/payment-email-test.ts`: loopback Postgres only; rollback, state validation, deduplication, backoff, concurrent claims, enrollment preserved on failure and expired-idempotency protection. No real email is sent.
- QR payment API/browser tests verify submission, rejection, resubmission, approval and access enforcement.
- Academy library browser checks verify owned-only visibility, saved progress, filters, responsive layouts, skeletons and API-error recovery.
- CI uses disposable Postgres and Firebase Auth Emulator; it receives no real email credentials.
