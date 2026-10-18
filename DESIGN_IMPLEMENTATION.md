# Apple Design Skill — Implementation Notes

Date: 2026-10-18  
Scope: `lucki-archive` GitHub Pages website. Based on the baseline findings in `DESIGN_REVIEW_APPLE.md` and `AGENTS.md`.

## Implemented

| Baseline finding | Implementation |
|---|---|
| WebGL lacks keyboard equivalents | `index.template.html` adds a visible **Browse songs** companion panel to the interactive scene. `app.js` mirrors current-era track data into real, focusable buttons with explicit accessible names, keyboard activation, and 3D object highlighting when WebGL is available. The list works without WebGL. Shortcut `S` toggles the explorer while navigating the world. |
| Offscreen drawer remains keyboard-focusable | Drawer starts inert, opens as a dialog, temporarily disables underlying controls, traps Tab/Shift+Tab, closes on Escape, and restores focus. The album and info overlays share the focus manager. |
| Tiny typography | Explicit responsive type rules raise reading copy and utility label sizes, enlarge captions, and make focus rings stronger. Readability is prioritized over cinematic microtype. |
| Small navigation targets | Era rail and controls receive larger hit regions; coarse-pointer targets default to at least 44px where feasible. |
| Heavy scene startup | Initial creation builds the first environment only. Every other heavy environment builds on entering its era. Idle stage animations are skipped, rendering is paused for hidden tabs, and pixel ratio is capped on low-memory devices. The About view also offers a **Reduced graphics** option. |
| Generic decoration competes with artwork | Duplicate marginal labels and decorative brackets were removed. The main album artwork, 17-era timeline, and overall cinematic composition remain untouched. The song explorer is closed by default and doesn't replace the 3D art. |
| Unsolicited audio on hover | Hover previews are opt-in, stored locally and off by default. Song click/tap still plays an officially published short preview when available, and there is a persistent stop control. |
| Vague labels | Navigation says **Browse albums**, **Browse songs**, **View era releases**, and **Songs in this room**, with archival atmosphere relegated to supporting copy. |
| Loading and failure cases | Non-blocking web fonts, existing boot watchdog, WebGL fallback art, and accessible album links work independently of external previews. Missing tracks are explained rather than showing fictitious audio. |
| Appearance adaptation | High-contrast, reduced-transparency and forced-color CSS; reduced-motion handling; fluid mobile layout and text sizing. |

## Verification completed

- `node --check app.js` and `node --check data.js` passed.
- `python build.py` regenerated a self-contained `index.html` containing both styles and app logic.
- `python tests/smoke.py` passed in local headless Chromium with a **simulated Three.js module** and mocked catalog track data. Tested desktop, mobile and reduced-motion flows: load, enter, browse songs, audio option, keyboard focus, dialog focus trap and restoration, release browsing, era navigation, and Last Laugh.
- Local no-WebGL browser checks passed at 320px, 390px and 1024px, with no script exceptions and no document horizontal overflow; album details remain accessible when the song catalog is unavailable.

## Real-device verification still necessary

This is not a claim of fully certified Apple HIG/WCAG compliance or full accessibility. Verify real GPU WebGL performance, an actual keyboard + screen reader, browser zoom / user text enlargement, Chrome/Firefox/Safari audio autoplay restrictions, and external Apple Music availability on end-user devices. The browser checks here used a simulated renderer because the full library was not available in the testing sandbox.

**Design choice:** the artist's album art and 3D space remain primary, not Apple's native visual components. Apple Design Skill foundations guide *usability and craft* of this web project, not a literal iOS redesign.
