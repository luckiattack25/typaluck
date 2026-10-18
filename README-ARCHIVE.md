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

## Songs in the 3D world

Each era now has an interactive song installation **inside the actual Three.js gallery**. Song panels are physical raycastable 3D meshes, while their projected HTML captions stay crisp. Hover over a floating song panel to request its official preview; moving away stops playback, and clicking plays or stops it when browser autoplay rules require a gesture. Albums with more than eight tracks provide previous/next controls in the scene. Last Laugh uses its 12 floating vinyl artifacts for the same hover/click interactions. Missing preview URLs are identified as unavailable rather than substituted. Navigation and overlays stop audio.

## Sharp captions

Labels beneath 3D cover objects are real high-resolution HTML text projected from their 3D anchor points rather than low-resolution canvas textures. They follow the scene's camera and remain interactive.

## Limitations

Public streaming-catalog APIs and the Three.js module are external resources; availability varies by browser or network restrictions. The main archive has a CSS-based fallback if WebGL is disabled or unavailable. Audio playback can require an explicit user click depending on browser autoplay policy.

Data sources include publicly available Apple Music/iTunes metadata, the artist's verified releases, and original Son of Sam listings. The graphics are creative fan-made interpretations and are not represented as official artist artwork.