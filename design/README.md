# GEKI Academy — Design Deliverable

This folder is an interactive **design prototype**, not the production Next.js/Express application. It preserves the agreed stack and implementation plan by keeping design exploration separate.

## Review

- Open `index.html` directly in a browser, or run `node design/serve.cjs` from the repository root.
- Local preview: http://127.0.0.1:4173/
- Use the **Design index** button to navigate all 40 screens and states.
- Foundations: http://127.0.0.1:4173/#/system
- Components: http://127.0.0.1:4173/#/components
- Motion: http://127.0.0.1:4173/#/motion
- Student player: http://127.0.0.1:4173/#/lesson
- Admin subtitles: http://127.0.0.1:4173/#/admin/subtitles

No build step or runtime package install is required. Google Fonts requires an internet connection; local system fonts provide fallback.

## Figma

File: https://www.figma.com/design/s44SOnDJib43TUdtvoBGGP

Use the four boards named **GEKI-FINAL-1440**, **GEKI-FINAL-1280**, **GEKI-FINAL-768**, and **GEKI-FINAL-390**. These contain the final 40-screen presentation at each requested breakpoint, including browser framing. `figma-final-placements.json` records their exact imported node IDs.

Earlier individually imported sheets are superseded by those final boards. They were retained because the connector's Starter-plan limit prevented cleanup through the canvas API. The limit also prevented native Figma component/variable construction, prototype wiring, and post-import screenshot inspection. The browser route could not open the canvas because WebGL was unavailable.

The import tool confirmed successful SVG placement. SVGs contain text, vectors, and reusable content-image references rather than flattened screenshots of entire screens. They are **not native auto-layout components, variable-bound design-system assets, or wired Figma prototypes**. Review and adjust text/font rendering in Figma when canvas access is available. Native component conversion and Figma-specific QA remain unfinished.

Actual motion and interactive behaviors are implemented in the local browser prototype. `HANDOFF.md` documents timings and limitations.

## Package contents

| File/folder | Purpose |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | Responsive interactive design prototype |
| `serve.cjs` | Optional dependency-free local server |
| `tokens.json` | Portable visual token source for later implementation |
| `HANDOFF.md` | Design rules, screen inventory, motion, validation and limitations |
| `assets/` | Local concept photography |
| `previews/` | Representative rendered screenshots |
| `figma-import/GEKI-FINAL-*.svg` | Four final editable SVG presentation boards |
| `figma-import/GEKI-*-*.svg` | Smaller source sheets, eight screens each |
| `figma-import/manifest.json` | Screen dimensions, responsive scan and export results |
| `figma-final-placements.json` | Final Figma upload receipts and node IDs |
| `export-design.cjs` | SVG export tooling; requires Playwright for regeneration |

## Editorial and product boundaries

- No real payments, authentication, DRM, account operations, emails, or video uploads occur.
- Form and administrative interactions simulate feedback only.
- Prices, payment provider, support contacts, instructor names and credentials are not invented.
- Sample learning records and statistics are illustrative.
- Burmese copy demonstrates typography and requires native-language review; the full interface is not translated yet.
- Fitness is not presented as available at launch.
- Active members see open lessons. Preview/expired states explain membership restrictions.
- Reference photography must be replaced by GEKI-owned or appropriately licensed Kyokushin assets before production.

## Asset sources

- Hero mood reference: https://images.unsplash.com/photo-1656653121526-a1458317b790
- Kyokushin instructional reference: https://www.iko-kwa.org/ — image https://images.cdn-files-a.com/uploads/8156079/2000_6494ec745c6af.jpg
- Dojo reference: https://kyokushin-kaikan.info/adult/basic.html — image https://kyokushin-kaikan.info/img/adult/basic/ippan_kihon_course02.png

These assets are included for concept review, not as verified GEKI people or endorsements. Authenticity, rights and final production suitability require approval.
