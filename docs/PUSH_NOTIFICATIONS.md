# Payment push notifications

GEKI uses standards-based Web Push independently of Resend email. Payment approval remains a manual bank-verification action.

## Audience and experience

- Admins receive new payment screenshot alerts linking to `/admin/payments`.
- Students receive approval alerts linking to `/my-learning`.
- The reviewing admin receives a confirmation after approving.
- Rejection updates remain in the student's notification history; private audit notes are never sent to the student.
- The header bell shows unread updates. Notification preferences appear on the dashboard, notification center and payment review page.

The notification inbox only displays unread items. Marking one as read removes that item; marking all as read clears the inbox and badge across the page and notification center. Read records stay in the database for history and deduplication. Pending push jobs for already-read items are skipped.

Each browser must opt in using **Enable notifications** and grant its browser permission. Notifications are tied to an existing registered device and preserve the two-device account limit. Signing out clears the local account binding, unsubscribes the browser and closes its displayed alerts. Changing accounts requires a fresh opt-in. Revoked devices and suspended users are excluded during delivery.

When a new browser signs in with both device slots occupied, the authenticated workspace and checkout show a device-limit screen linking to My Devices. Removing an old device registers the new browser and restores the original destination. Existing replacement limits still apply. Notification controls also link to My Devices instead of prompting for push permission while device slots are full. `npx tsx scripts/device-entry-test.ts` verifies this flow against local services.

## Configuration and release

Keep one stable VAPID key pair in server-only environment variables:

```
WEB_PUSH_PUBLIC_KEY=<public VAPID key>
WEB_PUSH_PRIVATE_KEY=<private VAPID key>
WEB_PUSH_SUBJECT=mailto:saizaybhonehlawn@gmail.com
CRON_SECRET=<existing notification worker secret>
```

The public key is returned by the authenticated status endpoint; no private key is exposed. Never commit real keys. Rotating the pair requires browsers to opt in again.

Apply `20261029081323_browser_push` using the existing Prisma migration workflow before releasing the new application. `PushSubscription` belongs to the private `geki` schema with RLS and no public Data API access. This is an additive migration; no student records are replaced.

Production must have the keys configured before deployment. Local automatic delivery is paused by default to avoid messaging real people from test runs. Set `PUSH_DELIVERY_ENABLED=true` explicitly to enable real delivery during development. Integration tests inject a transport and generate temporary keys without contacting a provider.

## Delivery and privacy

Payment state, in-app notification and push outbox jobs are committed in the same database transaction. Deterministic event/subscription IDs prevent duplicate jobs. Workers claim a two-minute lease, retry failures up to six attempts, suppress stale payment states, and discard jobs older than 24 hours. Provider 404/410 removes expired subscriptions. Push payloads exclude learner names, email addresses, payment amounts and receipt URLs.

Next.js `after()` drains jobs after payment responses. The existing authenticated daily notification cron is a recovery pass, not a guarantee of immediate retry. Delivery failure never reverses a payment approval or course purchase. In-app history remains available even without push permission.

The service worker handles notifications only; it does not cache protected video, pages or API responses. It checks the local account binding and suppresses duplicate notification IDs. Notification destinations are allowlisted.

## Platform limits

HTTPS is required in deployment; localhost/loopback works for development. Each device needs permission. On iPhone/iPad, install GEKI to the Home Screen using Safari before enabling Web Push (iOS/iPadOS 16.4 or later). Facebook's embedded browser may require opening GEKI in a supported external browser. Browser settings, OS focus modes, network restrictions and disabled background operation can delay or prevent delivery.

## Verification

- `npx tsx scripts/push-test.ts`: loopback-only PostgreSQL fixtures, encrypted VAPID request construction, atomic deduplication, worker concurrency, approval audiences, retries, stale-event suppression and expired subscriptions.
- `node scripts/push-browser.cjs`: isolated Chrome context, real service worker, native background notifications, account isolation, deduplication and sign-out cleanup; DevTools supplies the push event rather than an external vendor.
- Final physical phone/provider delivery requires opt-in and an actual payment event on the deployed HTTPS origin.

## Implementation checkpoint — November 1, 2026

The additive migration is applied locally and to the hosted GEKI database. Verified: RLS enabled, runtime CRUD allowed, `anon`/`authenticated` SELECT denied, and Supabase security advisors report no findings. Production Vercel variables for the stable VAPID pair, subject and notification cron secret are configured. Application source changes still require a Git push/deployment before the new functionality appears on the public site.

Passed: 42 unit tests; 16 existing authorization/device/playback integration groups; screenshot-payment API and browser flow; email outbox failure tests with injected delivery; push worker and authenticated subscription API tests; real Chrome service-worker notification lifecycle; payment UI at 1280/768/390px; course library at 1440/768/390px; and the optimized production build. Resend email delivery is a separate integration and is not implied by successful Web Push verification.
