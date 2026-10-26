# Course checkout and device control

## Pricing

Prices remain server-authoritative in minor units: 50,000 MMK = 5,000,000 minor units. The `geki-kihon-package` course, when priced at 50,000 MMK, offers the first 50 paying learners 35,000 MMK (30% off). Other courses charge their configured price.

Confirmed Kihon purchases consume founding places permanently. Unpaid discounted orders reserve a place for 24 hours; submitted receipts retain their quoted place until reviewed. Expired unpaid orders release their reservation. Renewing an expired order recalculates the price before displaying a usable QR. If someone has already paid after expiry, they must contact support before paying again. All checkout allocation and payment review paths lock the course row to protect the final place during concurrent requests. Existing completed/submitted payments retain their original amounts.

Release note: the hosted Kihon record was observed with a 35,000 MMK base price. At release, set that course’s regular price to 50,000 MMK in Admin → Courses along with this code deployment. Do not change submitted orders or existing purchases. The founding policy activates only for the Kihon course configured at 50,000 MMK. The database price has not been changed automatically during local testing.

## Receipt-only learner flow

Open checkout while signed in → exact-price order and QR appear automatically → scan/save KBZPay QR → pay → upload PNG/JPEG screenshot (5 MB maximum) → manual review → course unlocked. The learner types no transaction ID. Approval still requires the administrator to verify actual incoming funds, record the incoming KBZPay reference, and provide a review reason. References are unique across purchases; image hashes and submission history prevent receipt reuse. Photos alone never grant access.

## Private cloud storage setup

Set **server-only** `SUPABASE_URL` and `SUPABASE_SECRET_KEY` in ignored `.env.production.local` and in the production hosting environment. Use the Supabase project secret/service-role key, not a publishable/anon key or database password. Never prefix this key with `NEXT_PUBLIC_`.

Run:

```powershell
node --env-file=.env.production.local --import tsx scripts/setup-receipt-storage.ts
```

This creates the dedicated private `geki-payment-receipts` bucket if absent, with a 5 MB limit and PNG/JPEG MIME allowlist. It tests a disposable signed upload and private read, confirms that anonymous public access fails, then deletes its test object. It refuses a public bucket. Configure the same settings on an existing bucket before using it. Restart/redeploy after setting environment variables.

The browser uploads directly to a short-lived, non-overwriting signed URL, avoiding Vercel request-size and disk-persistence limits. The API accepts a server-signed ticket bound to the buyer, order and object. It downloads and validates file signatures before saving the private object path. Receipt viewing checks buyer/admin permissions and proxies a private read; no public bucket or permanent public URL is used. Failed or abandoned uploads can leave private orphan objects; periodically remove objects older than the ticket lifetime only after checking they are not referenced by payment orders or audit history. Never delete submitted payment evidence solely because of object age.

Without Storage credentials, local emulator development continues using private disk. Vercel checkout fails before showing a new payable order if Storage is unconfigured. Production Storage connection/bucket verification is a release requirement; a passing mock/unit test does not prove that a real bucket is configured. Video source uploads retain their existing separate cloud restriction.

## Devices

Each Firebase sign-in registers the current browser before loading the account UI. Labels distinguish Windows, Android, iPhone/iPad and common browsers. A browser-specific key is stored per Firebase user; different browsers or cleared site data count separately. Browsers inside Facebook may therefore count separately from Safari/Chrome on the same physical phone.

My Devices shows the current browser, updates on focus/visibility and every 15 seconds, and allows retrying registration after removing another device. Two active browser registrations and one active paid video stream remain enforced by the API. A third browser can reach device management to remove a device but cannot register or start paid playback while the limit is reached. Revocations and the rolling two-replacement limit are preserved.

## Verification

With loopback PostgreSQL/Firebase Auth Emulator and Next.js on port 3000:

```powershell
npm run test:payments
node scripts/qr-payments-browser.cjs
node scripts/devices-browser.cjs
```

The payment fixture provides separate accounts for checkout and device browser tests. Re-run the API fixture generator before repeating the browser suites. These tests use synthetic receipts and isolated local test users; never run them against live payment records.

## Interface languages

English and Burmese interface copy now covers the public homepage/catalog, authentication and recovery, student dashboard, lesson/quiz controls, course checkout, payment review, account settings, device management and common feedback components. Authentication pages include a language selector. Burmese typography uses the Myanmar font fallback and increased heading/label line spacing; the GEKI wordmark and payment amounts retain their original presentation. Course titles, descriptions, assessment content, and admin-written announcements use their provided translations and are not machine-translated by the UI. Further Burmese editorial review is still appropriate before launch.

Run `npm run test:localization` after regenerating local payment fixtures with `npm run test:payments`. This uses emulator accounts to verify Burmese language persistence and the QR/screenshot payment flow without moving real money. There is no KBZPay API/gateway integration: the signed direct upload transports only the private screenshot to Storage.
