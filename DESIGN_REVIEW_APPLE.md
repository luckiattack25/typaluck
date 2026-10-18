# Apple Design Skill Review — LUCKI: The Archive

Date: 2026-10-18
Scope: Source review of the live GitHub Pages `lucki-archive` branch at commit `593c3fd79ee687c45202e4ce8cd2dfb16ede0df0`; previously shared screenshots used for visual context. This is a **static/source audit**, not a verified real-GPU or screen-reader run.
Reference skill: https://github.com/dickwu/apple-design-skill/blob/main/SKILL.md

## Summary

**Rating: Critical issues (accessibility); distinctive visual direction worth retaining.** The product thesis is a cinematic, explorable timeline of 17 LUCKI eras. Its standout idea is the navigable 3D album museum, not the labels, lines, and interface effects around it. The next iteration should strengthen usability and artist-specific craft, not add more decoration.

## Critical

### 1. Interactive WebGL song targets lack a keyboard/screen-reader equivalent
- **What:** `index.template.html:34` marks the canvas area `aria-hidden`, while `app.js:362-366` relies on raycasted pointer move/up to hover and focus song artifacts. There are no corresponding DOM song buttons tied to each spatial target. The separate release drawer is a partial alternate way to access tracks, but it doesn't make spatial song discovery equally operable.
- **Why:** `references/hig/accessibility.md › Mobility / Vision` calls for usable accessible controls and multiple ways to perceive and interact.
- **Fix:** Sync real, labeled DOM song buttons with the scene and its current track page. Tab/arrow focus should highlight the associated 3D object; Enter/Space should focus/select and explicitly play a preview. Keep a simple song-list mode available when WebGL is unavailable.

### 2. Closed drawer remains potentially focusable
- **What:** `app.js:116-117` slides the drawer out and changes `aria-hidden` but never uses `inert`, `hidden`, or focus restoration; `.drawer` is translated offscreen in `style.css:6`. Hidden offscreen controls can remain in the tab sequence, and closing from Escape can leave focus inside the now-inaccessible region.
- **Why:** `references/hig/accessibility.md › Mobility` and the skill's accessibility lens require meaningful keyboard operation.
- **Fix:** Use `inert` while closed, restore focus to the triggering control, and manage focus consistently while open. If modal, use proper dialog semantics and contain focus.

## Improvements

### High — Utility labels are too small
- **What:** `style.css:1,3-5,17-18,26-27,35-38,48-51` includes frequent 6–10px text: base `.mono` 10px, eyebrow 10px, bottom metadata 9px, world pager small 8px, and artwork captions 9px. Core descriptions can shrink to 11px.
- **Why:** `references/hig/typography.md › Ensuring legibility`; `references/hig/accessibility.md › Vision` emphasize legible type in context.
- **Fix:** Establish responsive type tokens with 14–16px reading copy, 12–13px metadata, and display type separate. Test 200% browser zoom and text enlargement with no content loss.

### High — Tiny era hit targets
- **What:** `style.css:5` gives `.year-stop` only 4px vertical padding around an 11px dot; that is approximately 19px high where it is not enlarged by other content.
- **Why:** `references/hig/accessibility.md › Mobility` and `references/hig/buttons.md › Content` prioritize comfortably sized, purposeful controls.
- **Fix:** Set minimum touch targets to 44x44 CSS px and desktop controls approximately 32px or greater; retain generous spacing. Check overlay collision at narrow widths.

### High — Expensive scene startup risks responsiveness
- **What:** `app.js:352-359` builds all 17 stage environments before initial entry, `app.js:368-390` runs a continuous render loop, and `app.js:162` chooses a potentially expensive pixel ratio. Content is hidden until loaders resolve, though a watchdog and fallback exist.
- **Why:** `references/hig/loading.md › Best practices` says show usable content early and load large assets unobtrusively; `references/hig/motion.md › Platform considerations` emphasizes appropriate performance.
- **Fix:** Lazily construct current and adjacent eras, cap geometry/texture budgets by device, pause render activity when tab is hidden, and progressively hydrate artwork and song previews.

### Medium — UI styling approaches a generic archive-template aesthetic
- **What:** `style.css:1-8` combines near-black, one lime accent, tiny monospace labels, many hairline rules, and frequent 01/17 numbering. The chronology numbers are meaningful, but surrounding decorative metadata competes with the actual music artifacts.
- **Why:** `SKILL.md › Lens 3: Visual design and craft` explicitly cautions against near-black/acid-green + broadsheet hairline-rule defaults. `references/hig/branding.md › Best practices` says branding should defer to content.
- **Fix:** Keep the purposeful timeline numbering, but reduce incidental labels and borders. Let sourced album artwork and each era's authentic visual language generate the dominant color and composition; keep navigation understated.
- **Note:** This is studio design judgment informed by the skill's craft lens, not a rule that dark backgrounds or lime accents are forbidden.

### Medium — Hover audio needs user agency
- **What:** `app.js:316-318` attempts a song preview after a 260ms hover once a playable preview exists. Browser autoplay policies may block it; a Stop button is provided.
- **Why:** `SKILL.md › Agency / Responsibility` and `references/hig/motion.md › Best practices` support user control and avoiding disruptive feedback.
- **Fix:** Offer a clear 'Enable hover previews' switch after the first intentional interaction, remember the choice locally, and keep click-to-preview plus persistent stop controls.

### Medium — Drawer, navigation, and overlay copy could be clearer
- **What:** `index.template.html:58` calls the full searchable album catalog 'ALL ARTWORK'; `index.template.html:65` calls song pages 'MEMORY CONSTELLATION'. These labels convey mood more than action.
- **Why:** `references/hig/writing.md › Best practices` and `references/hig/buttons.md › Content` emphasize clear purpose and predictable result.
- **Fix:** Prefer 'Browse albums' and 'More songs', retaining the archival language as secondary decoration.

## Craft notes

Make the *album artwork and music* the hero. The current UI has strong world-building potential, but the visual stage can breathe more without duplicated chrome. Don't replace the user's favorite 3D experience with an ordinary Apple-style music app or apply Liquid Glass across the content surface.

## What works

- 17 era chapters and source-based releases (`data.js`), organized around a recognizable artist history.
- WebGL gallery plus an alternate HTML fallback (`index.template.html:34-37`).
- Clear navigation progress and a searchable discography (`index.template.html:55-90`).
- Official short music previews with explicit stop control rather than hosting full tracks (`app.js:21-46`, `index.template.html:81`).
- `prefers-reduced-motion` checks in JS and CSS, a boot watchdog, and recovery when the 3D renderer or catalog fails (`app.js:403-428`).
- Several core text colors already have strong measured contrast against the base background: #8c9892 on #050607 is **6.78:1**, and #d5ee9d on #050607 is **15.98:1**. Contrast over variable WebGL imagery still requires runtime verification.

## Platform notes

This is a **web** experience. Apply Apple's purpose, agency, accessibility, flexibility, simplicity, craft, and delight principles, plus the relevant HIG foundations. Do not treat iOS tab bars, native macOS window menus, or Liquid Glass as required for a website. Run separate keyboard/screen-reader, 320px mobile, 200–400% zoom, reduced-motion, high-contrast, and real-device WebGL tests before declaring compliance.

Source references: https://github.com/luckiattack25/typaluck/tree/lucki-archive ; https://github.com/dickwu/apple-design-skill/tree/main/references/hig
