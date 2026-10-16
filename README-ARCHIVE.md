# LUCKI — THE ARCHIVE

An unofficial, fan-made interactive artist archive covering 2013–2026. An editorial dark-chrome website with a custom WebGL sculpture, an 11-era explorer, the October 16, 2026 **Last Laugh (archive tape)** interactive 12-record vault, searchable/filterable discography, saved favorites, a command-based archive terminal, and a then/now era comparison.

## GitHub Pages publishing

This site is intentionally **static** and deployable without Node.js or a build. On GitHub open **Settings → Pages → Build and deployment**, set **Source: Deploy from a branch**, **Branch: lucki-archive**, **Folder: / (root)**, then **Save**. Once Pages finishes publishing, the URL should be `https://luckiattack25.github.io/typaluck/`. (GitHub Pages settings must be changed by a repository administrator; the connected GitHub app cannot modify this setting.)

This is a dedicated `lucki-archive` branch and does **not** modify the existing `main` site. Enabling Pages for this branch will change the repository's published Pages site if one is already configured for the repository.

## Running locally

Serve the folder using any static HTTP server, e.g. `python3 -m http.server 8000`, then visit `http://localhost:8000/`. Opening `index.html` directly with `file://` is not guaranteed to work because the JavaScript uses ES modules.

## Files

- `index.html` — semantic content and responsive page structure.
- `style.css` — responsive art direction, layouts, transitions and original visual effects.
- `app.js` — DOM interactions, WebGL geometry, navigation, filtering, saved favorites, optional storefront artwork fetching.
- `data.js` — source-backed chronology, catalog, and Last Laugh track durations.
- `.nojekyll` — avoids Jekyll transformation for Pages.

## Sources and limitations

Primary references: [Apple Music artist page](https://music.apple.com/us/artist/lucki/589757880), [Last Laugh (archive tape)](https://music.apple.com/us/album/last-laugh-archive-tape/6821145872), [MusicBrainz LUCKI artist](https://musicbrainz.org/artist/9ccaca30-60aa-4890-ae6c-ab55225ee274), [MusicBrainz releases](https://musicbrainz.org/artist/9ccaca30-60aa-4890-ae6c-ab55225ee274/releases), and [AllMusic](https://www.allmusic.com/artist/lucki-mn0003887247).

Last Laugh's track names, sequence, durations, release date, runtime and label were checked against Apple Music on October 16, 2026. Historical era commentary is editorial interpretation, not a claim of specific studio dates. Discography is a **curated selection**, not a complete catalog of every single or every credit. No unverifiable release history or alleged recording dates are assigned to Last Laugh tracks. Optional album artwork is loaded at runtime from the public iTunes storefront API; if unavailable, original abstract layouts appear, clearly distinguished from official art. No copyrighted tracks, leaks or lyrics are hosted. Streaming buttons link to official storefronts. The 3D sculpture uses Three.js through a CDN with a usable no-WebGL fallback; it is not a separate fully modeled 3D scene for each era. Mobile and reduced-motion modes have purposeful fallbacks.

This fan archive is not affiliated with LUCKI, EMPIRE, or their representatives. Names and titles remain property of their respective holders.