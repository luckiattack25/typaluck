# LUCKI — THE ARCHIVE / IMMERSIVE 3D EXPERIENCE

An independent, unofficial fan-made digital museum of LUCKI's releases from 2013–2026.

## What this build contains

- Eleven spatial gallery chapters (2013–2026), each with distinct Three.js installations and movable camera paths.
- Actual floating, raycast-clickable 3D album sleeves. The public iTunes Search API is used to identify official album cover images and official Apple Music listing URLs; covers not retrievable are displayed as visibly generated archive placeholders rather than invented official art.
- Last Laugh's twelve selectable 3D vinyl-style records with an accessible documented track list in the record drawer.
- Mouse-look / click-and-drag camera influence; wheel, arrow keys, Page Up/Down, Home, End, and touch swipe travel across the 11 eras.
- A responsive record-inspection drawer, comprehensive searchable album-art gallery, and locally saved favorite releases.
- A distinct fall-back gallery if Three.js, WebGL, or public artwork APIs cannot load; reduced-motion support.

## Publishing

GitHub Pages — deploy from branch `lucki-archive`, folder `/ (root)`. The root `index.html` **bundles its own CSS, data, and interaction code** to avoid the asset-loading problem seen in the earlier version. Three.js itself loads as a modern ES module from `https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js`, which requires browser network access to that CDN.

Edit `style.css`, `data.js`, and `app.js`, then run `python build.py` to regenerate the committed `index.html` bundle before deploying. No Node build step is required. Don't edit bundled JS manually.

## Controls

- Desktop: enter, mouse drag to look, scroll or use the bottom arrows to move to an adjacent chapter, select any hovering cover/record to inspect it, select any date on the rail to jump.
- Keyboard: arrows, Page Up/Down, Home/End for navigation; `A` opens artwork gallery; Escape closes overlays.
- Mobile: swipe horizontally/vertically between chapters or use buttons; tap record labels/drawer controls.

## Sources and limitations

The project and its visual installations are fan-made, not endorsed by LUCKI or any record label. Track titles, release sequence, and basic historical descriptions are stored in `data.js` and compiled into the release. Music metadata and cover-art previews are queried from Apple's public iTunes catalog at runtime. Release information has been checked against the official artist catalog and the Last Laugh Apple Music listing. Album artwork remains copyrighted to its rights owners. The site links to official music catalog pages and does not host full audio, lyrics, unauthorized downloads or leaks. Three.js requires WebGL-capable browser and public CDN access; other UI remains functional if unavailable.

References:
- https://music.apple.com/us/artist/lucki/589757880
- https://music.apple.com/us/album/last-laugh-archive-tape/6821145872
- https://musicbrainz.org/artist/9ccaca30-60aa-4890-ae6c-ab55225ee274