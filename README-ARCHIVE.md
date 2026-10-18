# LUCKI — THE ARCHIVE

An **unofficial** interactive LUCKI career museum spanning 17 eras and 18 releases, with a separate 3D environment for each era and a searchable album gallery.

## Hosting

`index.html` is fully self-contained for GitHub Pages (includes data, CSS and application logic). GitHub Pages should be configured to deploy `lucki-archive` → `/ (root)`.

For development, edit `data.js`, `app.js`, `style.css`, or `index.template.html` and regenerate the self-contained page with:

```bash
python build.py
```

## Tracks and short previews

Open any record in the 3D museum or album gallery to access its **Track Index**. The site requests song metadata using each album's exact public Apple/iTunes collection ID. If an older ID is retired, it tries a strictly matching album-title lookup and rechecks that collection's track IDs and artist before displaying results. Hovering a song starts its publicly supplied short preview; moving away pauses it. Click works as a fallback if your browser blocks sound on hover. Playback is stopped when leaving a record or hiding the tab.

For releases unavailable from Apple's lookup, the site never displays guessed tracks or substitutes audio from a different artist. `Son of Sam` uses its independently published seven-track listing, and `Last Laugh` has its established 12-track list as a fallback. If no official short preview is returned, that track is displayed as unavailable for on-page playback and visitors can open the streaming release link instead. No full songs are hosted.

## SOUND RELICS — 3D song constellation

The 17 gallery chapters now use **procedural Three.js sound artifacts** in place of song-name boxes. Every song appears as a drifting three-dimensional object linked to its album cover through understated constellation paths. Vinyl objects, cassette fragments, light-drawn waveforms, glass memory shards with official cover fragments (when available), chrome orbital nodes and crystalline shapes vary by era and song.

Titles remain hidden until discovery. Hovering reveals the song's title and triggers an official short preview where available; clicking pins a focused song view, holds preview playback, and offers an album detail link. Albums longer than eight songs can cycle through different artifacts. The *Last Laugh* vault shows twelve differently positioned vinyl-inspired objects simultaneously.

Objects are constructed lazily and released on era changes to avoid filling all seventeen environments with expensive geometry at once. Reduced-motion settings minimize animation. If a preview URL is unavailable, the object remains inspectable but no unlicensed audio is substituted.

## Sharp captions

Labels beneath 3D cover objects are real high-resolution HTML text projected from their 3D anchor points rather than low-resolution canvas textures. They follow the scene's camera and remain interactive.

## Limitations

Public streaming-catalog APIs and the Three.js module are external resources; availability varies by browser or network restrictions. The main archive has a CSS-based fallback if WebGL is disabled or unavailable. Audio playback can require an explicit user click depending on browser autoplay policy.

Data sources include publicly available Apple Music/iTunes metadata, the artist's verified releases, and original Son of Sam listings. The graphics are creative fan-made interpretations and are not represented as official artist artwork.

## Usability and accessibility (October 2026)

- **Browse songs** is a keyboard-accessible companion to the 3D sound artifacts, and is available when WebGL is unavailable. Press **S** while exploring to toggle it.
- Hover audio is off by default. Enable it deliberately in Browse songs. Clicking an available song plays its official short preview; the preview HUD always has Stop.
- Drawers/overlays trap focus and return it when dismissed; Escape closes them.
- Font sizes and touch controls have been increased. Reduced motion, high contrast and reduced transparency are supported; the About panel includes a reduced graphics setting.
- Detailed changes and remaining testing limitations are documented in `DESIGN_IMPLEMENTATION.md`. Refer to `AGENTS.md` and `DESIGN_REVIEW_APPLE.md` for the project design standard.
