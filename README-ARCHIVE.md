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

## ERA WORLDS — 3D moving song artwork

Each of the 17 eras has a different collection of original, artist-related interactive relics, with its own matching installation: from early Lucki Eck$ Chicago photocopies, `X` emblems and analog Freewave cassettes, through photographic Days B4 contact sheets, blue Almost There highway markers, WAKE UP LUCKI radio hardware, chrome FLAWLESS LIKE ME tokens, purple editorial SMD graphics, mirrored GEMINI panels, pink `10` archive labels, and Last Laugh's recovered year-by-year sleeves. Purple and pink elements are stylized graphic references rather than depictions of drugs.

Album covers remain the centerpiece. Songs are distributed **around both sides**, above, and in front of the album at different depths. They follow **continuous individually phased 3D orbital paths**; hovering slows the selected relic and reveals that song's title and short official preview when offered by Apple. Clicking focuses the relic and offers the album detail drawer. Different pages of tracks each have their own relics; the Last Laugh vault offers all 12 tracks at once.

The website renders original sculptural objects, not boxes of song titles. All music streams are official short previews only and their absence is shown clearly. Keyboard users can browse the album's accessible song index through the release drawer. Relics are loaded as eras are explored; 256px background poster textures limit GPU memory, while the selected interactive relic uses a sharper texture. Reduced-motion settings keep the objects still.

## Sharp captions

Labels beneath 3D cover objects are real high-resolution HTML text projected from their 3D anchor points rather than low-resolution canvas textures. They follow the scene's camera and remain interactive.

## Limitations

Public streaming-catalog APIs and the Three.js module are external resources; availability varies by browser or network restrictions. The main archive has a CSS-based fallback if WebGL is disabled or unavailable. Audio playback can require an explicit user click depending on browser autoplay policy.

Data sources include publicly available Apple Music/iTunes metadata, the artist's verified releases, and original Son of Sam listings. The graphics are creative fan-made interpretations and are not represented as official artist artwork.
