# GEKI Academy — Design Handoff

## Creative direction

Dark athletic energy with Japanese editorial restraint. Charcoal layers, warm white text, disciplined spacing, restrained martial red, cinematic desaturated photography, and purposeful motion.

Adapted from the supplied Lumora reference: oversized type, asymmetry, cinematic imagery, line reveals, pill compositions, tactile hovers, and overlay transitions. Avoid artificial loading delays. A liquid cursor effect is documented as an optional future marketing experiment and is not implemented.

## Foundations

- Colors: Obsidian `#0A0A0A`, Charcoal `#151515`, Elevated `#202020`, Martial Red `#D71920`, Crimson `#991B1B`, White `#FFFFFF`, Warm White `#F5F4F0`, Muted Gray `#929292`, Border `#303030`.
- Practical secondary text uses a brighter neutral where necessary. Small instructional text should not rely on low-contrast gray.
- Fonts: Geist for English, Noto Sans Myanmar for Burmese, Noto Sans JP for limited Japanese marks. Font rendering must be reviewed in Figma after import.
- Spacing: 4, 8, 12, 16, 24, 32, 48, 64, 96px.
- Radii: controls 6–9px; cards 12–18px; circular icon controls and status rings.
- Breakpoints reviewed: 1440, 1280, 768, 390px.
- Desktop: full sidebar and multi-column learning layout.
- Tablet: compact navigation rail, reduced columns, stacked player and curriculum.
- Mobile web: single column, bottom navigation, collapsible curriculum, scrollable administrative tables.

## Screen inventory

| Route | Screen |
| --- | --- |
| `/` | Cinematic public landing page |
| `/library` | Course discovery, search and category filtering |
| `/course` | Course detail, curriculum, instructor credit and progress |
| `/preview` | Public first Kihon lesson, no registration required |
| `/signin` | Email/password and Google sign-in design |
| `/signup` | Adult/parent-managed signup design |
| `/verify` | Email verification |
| `/forgot` | Reset-link request |
| `/reset` | Password reset |
| `/recovery` | Account recovery guidance |
| `/dashboard` | Continue Learning dashboard |
| `/lesson` | Protected-player concept and curriculum |
| `/my-learning` | In-progress and completed course states |
| `/quiz` | Multiple-choice assessment |
| `/quiz-results` | Passing result and answer explanations |
| `/quiz-retry` | Failed result and retry guidance |
| `/pricing` | Monthly/annual membership options |
| `/membership` | Active membership and payment history |
| `/membership-expired` | Expired membership with retained progress |
| `/checkout` | Neutral checkout with unapproved price/provider placeholders |
| `/payment-pending` | Pending payment |
| `/payment-success` | Payment received |
| `/payment-failed` | Payment failed |
| `/membership-activated` | Access activated |
| `/settings` | Profile, guardian account type, language, security and notifications |
| `/devices` | Two-device limit, removal and stream-transfer dialogs |
| `/notifications` | Read/unread account and membership updates |
| `/admin` | Administrative overview |
| `/admin/courses` | Course management |
| `/admin/course-editor` | Course/section editor, reusable videos, ordering, publish review |
| `/admin/videos` | Video upload/processing concepts |
| `/admin/subtitles` | English/Burmese subtitle review and timing editor |
| `/admin/students` | Learner/membership directory |
| `/admin/student` | Learner details and audited-operation confirmations |
| `/admin/quizzes` | Quiz authoring |
| `/admin/audit` | Super Admin permissions and audit history |
| `/system` | Brand, color, type, layout and screen index |
| `/components` | Shared visual patterns and state specimens |
| `/states` | Empty, error, loading and success states |
| `/motion` | Working motion samples and implementation direction |

The local application uses hash routes, e.g. `#/lesson`. All 40 screen/state routes have exports at all four requested widths: 160 responsive compositions total.

## Shared patterns

Navigation, mobile navigation, course cards, lesson rows, video controls, progress bars/rings, pricing/membership cards, quiz answer states, buttons, fields, search, chips, dropdowns, tabs, dialogs, drawer concept, notifications/toasts, skeletons, empty/error states, administrative tables and pagination.

Relevant specimens include default, hover, selected, focus, disabled, loading, success and error. In Figma these are editable imported specimens, not native variant sets. Production implementation and later native component conversion must preserve their relationships.

## Motion specification

| Interaction | Behavior | Duration |
| --- | --- | --- |
| Hero image | Settle from scale 1.08 to 1.02 | 1500ms |
| Hero headline | Opacity + 24–28px rise; 120ms line stagger | 900ms target |
| Supporting entrance | Short stagger after headline | 700–800ms |
| Scroll reveal | Once only, opacity + 22px rise | 800ms |
| Course hover | Lift 6px, border emphasis, image scale 1.045 | 350–700ms |
| Primary button | Lift 2px and darker red | 250ms |
| Dialog | Opacity, 16px rise, scale .98 to 1 | 250ms |
| Progress | One entrance fill; no continuous loop | 800ms |
| Skeleton | Restrained surface shimmer | 1600ms loop |

Primary easing: `cubic-bezier(.22, 1, .36, 1)`.

Reduced motion removes translation, scaling, staggers and shimmer. No ambient animation distracts from lessons or quiz answers. The prototype demonstrates CSS transitions and keyframe samples; it does not claim native Figma timeline playback.

## Interaction behavior

- Design index navigates all routes.
- Course library search and filters work on the illustrative content.
- Course sections expand/collapse.
- Quiz answers select, require a selection to advance, and support progression through a ten-question interaction sample. Results are illustrative, not a real assessment engine.
- Subtitle menu changes sample English/Burmese captions.
- Password visibility, form validation and recovery confirmations demonstrate intended feedback.
- Device removal and playback transfer explain impact before confirmation.
- Admin destructive operations request reasons and explain audit behavior.
- File selection remains local; it does not upload video.
- Checkout confirmation remains disabled because business pricing/payment setup is unresolved.
- Representative responsive tables scroll inside their containers on mobile.

## Verification evidence

- Chromium rendered 40 routes at 1440, 1280, 768 and 390px.
- Export scan: zero page-level horizontal overflows, broken content images, or JavaScript page errors.
- Search smoke check: searching `kata` leaves one matching card.
- Stream-transfer dialog opens and cancels correctly.
- Quiz advance blocks without selection and moves to question two after selection.
- Reduced-motion smoke check: headline animation resolves to `none`.
- Representative HTML and editable SVG renders were visually inspected; typography fallback, icon paint and mobile footer overflow were corrected.
- Import API receipts confirm final SVG placement in Figma.

## Remaining limitations / review requirements

1. Starter-plan connector limits blocked native Figma variable/component construction, prototype wiring, cleanup and screenshot inspection. Browser canvas fallback was blocked by WebGL availability. Final SVGs are editable geometry imports; native auto-layout, component properties and bindings remain unfinished.
2. Final Figma rendering requires inspection when canvas access is restored. Local SVG review cannot establish exact Figma text shaping, font fallback, or image-clip behavior.
3. Earlier imported sheets are superseded by four named FINAL boards; exact node IDs are in `figma-final-placements.json`.
4. Photography is concept material; replace with approved GEKI Kyokushin media and instructor identities before launch.
5. Burmese sample text requires native editorial review. Full bilingual UI copy is not complete.
6. Prototype form submissions and status transitions simulate outcomes. No production provider is connected.
7. Player controls, DRM, watermark enforcement, device binding and payment renewal must be validated against selected providers during implementation.
8. Interactive confirmation dialogs are available in the browser prototype; static exports document representative screens, not every possible dialog/state permutation.
9. Visual accessibility affordances are included; formal screen-reader, browser and WCAG audits remain implementation work.

## Product rules to preserve

- Both plans unlock the same content; no invented discounts or auto-renewal promises.
- One paid membership covers one learner.
- Ages 12–17 use parent-managed accounts.
- Two registered devices, two replacements per 30 days, one active stream.
- Active members may open any lesson; progress does not lock curriculum.
- First Kihon video is publicly available.
- Expiry locks paid content while preserving learning records.
- No certificates, leaderboards, community, seminars, coaching or live Fitness offering in v1.
