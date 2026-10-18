# Project Design Standards — LUCKI Archive

Use the Apple Design Skill as the standard for **all future UX and visual changes** to this project:
- Skill: https://github.com/dickwu/apple-design-skill/blob/main/SKILL.md
- Reference directory: https://github.com/dickwu/apple-design-skill/tree/main/references

## Scope

This is a WebGL-powered **web experience**, not a native iOS/macOS application. Apply the skill's eight principles and five audit lenses, particularly accessibility, layout, color, typography, motion, content, feedback, and craft. Do **not** transplant native Apple tab bars, system-menu conventions, or Liquid Glass solely for appearance.

## Product thesis

An unofficial, navigable museum of LUCKI's 17 musical eras (2013–2026). Official album artwork and verified music context are the subject. The 3D scenes are the signature interaction; interface chrome stays subordinate. Protect historical accuracy, the ability to explore songs, and artist-specific atmosphere.

## Before changing UI

1. Read the upstream SKILL.md and relevant HIG reference pages, not just this summary. Start with accessibility.md, layout.md, typography.md, color.md, then choose motion.md, buttons.md, loading.md, branding.md, writing.md and others relevant to the change.
2. Review the current screenshot and code. State the single user goal, affected interaction path, and whether the design is truly specific to LUCKI.
3. Fix accessibility and failure recovery before aesthetics. Provide DOM-accessible, keyboard/touch equivalents for WebGL interactions. Manage focus and inertness for drawers and overlays.
4. Use legible text sizing: body copy generally 14–16 CSS px or more; utility labels at least 12 px when feasible. Preserve zoom/text enlargement. Measure text/background contrast (4.5:1 for regular text, 3:1 for large text). Ensure comfortable control hit regions (target at least 44 CSS px on touch). These are project targets, not a claim that Apple's pt sizes directly equal CSS pixels.
5. Respect prefers-reduced-motion and reduced-transparency/high-contrast preferences. Motion must have a purpose, be interruptible, and never be required to discover content. Prevent unsolicited audio; give users a preview choice and stop control.
6. Keep imagery, typography, and 3D artifacts rooted in real eras and sourced covers. No random geometric filler, unnecessary generic glassmorphism, or repeating acid-green UI decorations. Reserve editorial flourish for one or two focal moments.
7. Test mouse, keyboard, touch, narrow viewport, browser zoom, disabled/failed WebGL, unavailable media, and low-end performance. Do not describe a simulated Three.js test as a real GPU test.

## Development rules

- Canonical editable files: index.template.html, style.css, data.js, app.js. build.py creates the root index.html for GitHub Pages. Update sources first, then rebuild and verify the generated file.
- Keep the current 17 eras and licensed/official preview-only music policy unless explicitly changed.
- Run syntax checks, exercise intro/navigation/album/song flows, and do not change the published lucki-archive branch without clear instruction.
- Review findings must cite real sources: source path/line and a read HIG reference by filename and heading. Separate guideline-backed problems from subjective design judgment.

Review baseline: see DESIGN_REVIEW_APPLE.md in this branch.
