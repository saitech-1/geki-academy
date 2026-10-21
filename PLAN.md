> **Commercial model update — October 21, 2026:** Individual courses are sold separately through one-time purchases with ongoing access. This supersedes membership/subscription sections below. The implemented model and current payment limitations are documented in README.md. Historical membership data remains preserved.

# GEKI Academy — Implementation Plan

Status: agreed product scope; implementation has not started.
Planning date: October 19, 2026.
Public paid launch target: November 30, 2026.

## 1. Product and launch scope

Build one complete paid learning journey first:

**Preview a lesson → sign in → purchase membership → watch protected content → save progress → pass a course quiz.**

GEKI Academy v1 serves existing dojo students in Myanmar, ages 12 and above. Learners aged 12–17 use parent-managed accounts. Each paid membership covers one learner profile.

### Included

- Responsive web application, English and Burmese interface.
- Kyokushin content first, approximately 40 English-language videos.
- Monthly and annual membership unlocking the full library and all courses.
- Free first Kihon video, available without signing up.
- Geki Kihon Package: Kihon explanations, Kihon Ido, basic Kumite, and Kata.
- All lessons accessible immediately during active membership.
- Automatic playback-position saving and lesson/course progress.
- One final multiple-choice quiz per course: 80% pass mark, unlimited retries, answer explanations.
- English and Burmese subtitles, generated automatically and reviewed by an admin.
- DRM-backed streaming and identifying watermark.
- Two registered devices, one active stream, two device replacements per rolling 30 days, admin override.
- Student, Admin, and Super Admin permissions.
- Admin content publishing, memberships, account controls, device resets, and audit history.
- Account verification/recovery, payment status, and membership expiry notifications.

Expired memberships lose access to paid videos and quizzes. Accounts, progress, and quiz results remain available for renewal.

### Excluded

- Expo mobile apps at launch.
- Fitness launch content.
- Community, seminar bookings, coaching, and certificates.
- Offline video downloads.
- Instructor publishing portal. Invited instructors are credited on content.

Next priorities after launch: Expo mobile apps and Fitness content.

## 2. Delivery schedule

Six weeks is tight for one founder working with AI assistance. Provider validation, payment decisions, and content preparation must run alongside development.

| Dates | Work | Completion milestone |
| --- | --- | --- |
| Oct 19–25 | Validate DRM, Myanmar playback, subtitles, hosting costs, and Facebook-to-browser handoff. Define data model/API contracts and design direction. | One real GEKI video plays securely on Android Chrome and iPhone Safari with both subtitle tracks. |
| Oct 26–Nov 1 | Authentication, learner profiles, roles, device registration, bilingual shell, initial admin content management. | Admin organizes content; student signs in and manages devices. |
| Nov 2–8 | Library, courses, player, progress, stream restrictions, publishing workflow. | Complete learning journey works using a test membership. |
| Nov 9–15 | Approved payment integration, monthly/annual access, expiry, quizzes, transactional notifications. | Real payment activates access; expiry removes it. |
| Nov 16–22 | Content ingestion, premium UI polish, bilingual review, real-device student pilot. | Release candidate passes launch checklist. |
| Nov 23–29 | Defect fixes, backup restoration, deployment/rollback rehearsal, support documentation. | Production launch approved against evidence. |
| Nov 30 | Publish paid access and monitor sign-in, payments, playback, and errors. | Public launch. |

### Proposed decision deadlines

- October 25: select video provider and receive brand guidelines.
- November 1: settle payment mechanics and membership prices.
- Payment integration must not assume a provider or an unapproved manual-payment workaround.

## 3. Architecture

Keep the agreed stack:

| Component | Technology and responsibility |
| --- | --- |
| Web | Next.js, React, TypeScript, Tailwind CSS; public website, student experience, admin dashboard |
| Central API | Node.js, Express, TypeScript, REST; authorization, memberships, content access, progress, quizzes, devices, integrations |
| Database | PostgreSQL and Prisma; application records and business state |
| Authentication | Firebase Authentication; identity and sign-in |
| Video | Specialist managed provider; video storage, processing, DRM streaming |
| Background worker | Subtitle generation, processing checks, notifications, bounded retries |
| Future mobile | Expo, React Native, NativeWind; same central API |

Use one repository with web, API, worker, and shared packages for API schemas, types, validation, and translations. Create the Expo client after web launch.

Next.js may render pages and forward authenticated requests. Membership and learning rules belong in Express so mobile receives identical behavior.

Use managed hosting and PostgreSQL. Directly managed AWS services are excluded; vendors using AWS internally are acceptable.

Upload video directly to the selected provider using server-authorized uploads. Store provider references and metadata in PostgreSQL, not video binaries. Avoid routing large uploads through the application server.

### Version policy

- Proposed runtime baseline: Node.js 24 LTS.
- Proposed API baseline: Express 5.
- Before scaffolding, resolve exact compatible stable patch versions for Next.js, React, Prisma, TypeScript, Tailwind, and supporting libraries.
- Verify official documentation and hosting compatibility, then commit the lockfile.
- Exact versions are not yet approved or pinned; do not treat these major-version recommendations as a completed compatibility check.

References checked during planning:

- [Node.js releases](https://nodejs.org/en/about/previous-releases)
- [Express 5 migration documentation](https://expressjs.com/en/guide/migrating-5/)
- [Prisma system requirements](https://docs.prisma.io/docs/orm/reference/system-requirements)

## 4. Data model

| Records | Key rules |
| --- | --- |
| Account, learner profile | Unique Firebase identity; one learner per membership; guardian-managed account for minors |
| Membership plan, membership | Monthly/annual duration; explicit start, expiry, status |
| Payment, payment event | Unique provider reference; duplicate events cannot grant access twice |
| Video, subtitle track | Provider asset ID, processing status, language, review status |
| Course, section, lesson | Ordered sections/lessons; lessons reference reusable videos |
| Video progress | Unique learner/video record; position, watched progress, completion |
| Quiz, question, attempt | API grades answers; preserve submitted results |
| Registered device, replacement event | At most two active registrations; rolling replacement limit |
| Playback session | One active stream per account; heartbeat, expiry, revocation |
| Job, audit event, notification | Retry state, administrative change history, delivery state |

Store timestamps in UTC and display appropriately. Keep payment records separate from memberships so provider changes do not rewrite learning access.

Proposed defaults requiring confirmation before implementation:

- A 95% watched threshold completes a lesson.
- Course completion requires all lessons watched and a passing final quiz.
- Seeking directly to the end does not count as watching a lesson.

## 5. Authentication and access controls

Support email/password and Google sign-in through Firebase Authentication. Express verifies identity and applies application authorization.

Every protected playback request checks:

1. Valid authenticated account.
2. Account is active.
3. Registered device is permitted.
4. Membership is active, unless this is a public preview.
5. Existing playback session permits playback, or the user explicitly transfers it.
6. Video is published and ready.

Only then issue short-lived provider playback authorization.

### Device and stream behavior

- A third device displays existing registrations and requires removing one.
- Removing a device revokes its application access.
- Enforce two replacements per rolling 30 days, with audited admin override.
- A new stream offers an explicit transfer from the previous stream.
- Heartbeats and expiring sessions recover from closed tabs and lost connections.
- Define browser-installation identity and behavior after cookies are cleared; physical-device identity is not guaranteed by browser registration.
- Validate provider authorization lifetime and revocation. Application device limits alone cannot guarantee immediate cancellation of an issued DRM license.
- Use a pseudonymous account identifier in watermarks rather than exposing a child's name/email.
- DRM cannot guarantee prevention of every recording or external-camera copy.

## 6. Content and subtitle workflow

**Draft → upload → video processing → English transcription → Burmese translation → terminology/timing review → preview → explicit publication.**

Admin capabilities:

- Upload progress and processing status.
- Bilingual titles, descriptions, and subtitle tracks.
- Subtitle editing/replacement and approval.
- Course/section/lesson ordering and reusable videos.
- Explicit selection of preview lessons.
- Useful errors and retry controls.
- Publication checks requiring both subtitle tracks approved.

Background jobs have bounded retries and duplicate protection. Subtitle failures must not require video re-upload. Verify provider callbacks and reconcile processing state when callbacks are missed.

Start with one representative recording containing Japanese technique names. Build a reviewed terminology glossary before processing the remaining content.

Potential subtitle support to evaluate, not a selected provider:

- [Google Speech-to-Text language support](https://docs.cloud.google.com/speech-to-text/docs/speech-to-text-supported-languages)
- [Google Translation language support](https://docs.cloud.google.com/translate/docs/languages)

## 7. Student experience and visual design

Visual direction: premium charcoal/dark athletic styling, restrained red accents, disciplined Japanese-inspired composition, and subtle motion. Final brand guidelines remain pending.

Establish shared typography, spacing, buttons, cards, forms, loading/error states, keyboard focus, contrast, and reduced-motion behavior. Test English and Burmese typography together.

### Screen implementation order

1. Lesson player and mobile layout.
2. Course overview.
3. Continue Learning dashboard.
4. Creative public homepage and free preview.
5. Membership and account/device screens.
6. Admin screens.

### Core screen behavior

- Homepage introduces GEKI and prioritizes watching a free lesson.
- Dashboard prioritizes Continue Learning, the Kihon course, and progress.
- Lesson screen includes a large player, ordered lesson list, subtitles, short explanation, and Next Lesson.
- Library offers title search and section filters.
- Keep motion restrained during learning; use richer motion for navigation/discovery.

### Facebook browser

Most students may arrive inside Facebook. Browse/preview there where supported, and provide an external Chrome/Safari handoff when authentication or DRM requires it.

Preserve the intended lesson URL through the handoff. Test actual Android/iPhone behavior and do not assume login state transfers between browsers.

## 8. Payments and memberships

Payment provider, methods, prices, and operational process remain undecided at the user's request. No manual-transfer fallback is approved.

Build membership rules independently, then connect the approved payment process.

Required payment behavior:

- Handle successful, pending, failed, duplicate, and refunded transactions.
- Verify provider events and reconcile missing updates.
- Define refund-related access revocation.
- Define how renewals extend existing memberships.
- Prevent duplicate events from granting access twice.

Monthly/annual access does not imply automatic recurring billing; that depends on the selected local payment method.

Enforce expiry during access checks. Reminder jobs inform students but do not enforce expiry.

## 9. Costs and capacity

Working sizing assumptions:

| Metric | Estimate |
| --- | --- |
| Paying members | 200 |
| Videos | 40 |
| Average video duration | 15 minutes, provisional |
| Stored video duration | Approximately 10 hours |
| Viewing per paying member | 5 hours/month, provisional |
| Total viewing | Approximately 1,000 hours/month |

At an assumed average delivered bitrate of 1–2 Mbps, traffic is approximately 450–900 GB/month before overhead. This is a sizing calculation, not a provider quote.

Budget target: US$50–150/month. Use US$150 as the initial ceiling when evaluating:

- Web/API hosting, database, backups, worker.
- Video storage, delivery, DRM licenses, watermarking.
- Transactional email and monitoring.
- Subtitle generation for initial content and subsequent uploads.

Separate annual prepayments and initial processing costs from recurring monthly costs. Provider pricing, account eligibility, and Myanmar performance remain unvalidated. The DRM pricing page could not be verified during planning.

Add usage/spend alerts. Do not silently interrupt paid students when a soft budget threshold is reached; obtain an explicit decision if the selected protection and usage exceed budget.

## 10. Environments, testing, and observability

Use separate local, staging, and production environments. Keep production credentials/data out of preview deployments.

CI runs type checks, linting, critical tests, and builds. Use reviewed database migrations and a documented deployment/rollback procedure.

### Automated tests

- Expired/suspended accounts cannot obtain paid playback access.
- Duplicate payment events cannot duplicate membership grants.
- Device/single-stream limits survive concurrent requests.
- Device replacement revokes application access.
- Quiz grading and progress remain correct across retries.
- Draft content and unapproved subtitle assets remain private.
- Admin operations enforce role permissions.

### End-to-end and real-device verification

- Complete purchase-to-learning journey.
- Account verification and recovery.
- Android Chrome and iPhone Safari.
- Facebook-to-browser handoff.
- Slow connections, interrupted playback, resume, and stream transfer.
- English/Burmese layouts and accessibility basics.
- Real Myanmar network playback.

### Production monitoring

- Sign-in failures, API errors, and job failures.
- Payment failures and membership activation discrepancies.
- Playback authorization/DRM failures and video startup problems.
- Device-limit denials and support-relevant audit events.
- Database backups, storage, video usage, and spending.

Exclude tokens, payment secrets, and unnecessary personal information from logs. Keep progress records in PostgreSQL; the browser may show optimistic progress but must reconcile with API state.

## 11. Launch gates

- [ ] Production payment activation, renewal, expiry, and refund behavior verified.
- [ ] DRM/provider budget and Myanmar playback validated.
- [ ] Device limits, stream transfer, and revocation tested.
- [ ] All launch videos and bilingual subtitles reviewed.
- [ ] Progress and quiz rules verified.
- [ ] Chrome/Safari and Facebook handoff verified on real devices.
- [ ] Database restoration rehearsed successfully.
- [ ] Error monitoring and payment/playback alerts operational.
- [ ] Admin accounts protected with stronger authentication.
- [ ] Guardian consent, privacy, retention, and support processes resolved with appropriate jurisdiction-specific review.
- [ ] Deployment and rollback rehearsed.
- [ ] User-facing failure/empty/loading states reviewed.

## 12. Scope protection and responsibilities

If time slips, simplify decorative motion, homepage sections, dashboard detail, and admin reporting first. Preserve payment correctness, protected playback, access controls, bilingual usability, progress reliability, and recovery.

Founder responsibilities: payment/business decisions, provider accounts and billing, brand assets, content ownership, subtitle/quiz review, student pilot coordination, and launch acceptance.

AI-assisted implementation responsibilities: architecture, implementation, integration, automated verification, documentation, and defect resolution. Provider provisioning and business approval remain explicit tasks rather than assumed completion.

## 13. Open decisions and risks

- Payment method/provider, prices, recurring versus manual renewal, refunds, reconciliation.
- Video provider, DRM behavior, watermark support, browser coverage, Myanmar availability, and price.
- Exact framework/library versions and hosting services.
- Total registered accounts beyond the 200 paying-member estimate.
- Exact video durations and actual viewing usage.
- Completion thresholds and course-completion policy.
- Guardian consent, data retention/deletion, and account recovery details.
- Brand guidelines and readiness of all content/subtitles/quizzes.
- One-founder delivery capacity against the November 30 deadline.

## First implementation milestone

**A real sample lesson with DRM, reviewed English/Burmese subtitles, and reliable Chrome/Safari playback from Myanmar.**

Use that evidence to select providers, validate costs, and proceed with the rest of the build.
