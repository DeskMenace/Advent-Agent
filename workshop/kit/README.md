# Gift Workshop kit

Vanilla JS/CSS building blocks for gifts. MIT. No network, no dependencies, no build step.

## The inlining rule

A gift must be self-contained: **copy the code you use into the gift file** (paste the module body into a `<script type="module">`, or drop the `export` keywords and use a plain `<script>`). Gifts never `import` from the workshop at runtime, never load a CDN, never fetch fonts. Each file here imports nothing from its siblings; where a helper is shared (e.g. `downloadBlob`), it is repeated in each file on purpose so a single paste works. Every file starts with an MIT header and a 10-line usage example.

All modules can be imported in Node without a DOM (tests do this): browser APIs are touched only inside functions.

## arcade/
- `loop.js`: fixed-step game loop with pause/resume/toggle, `tick()` for manual stepping, `reducedMotion()`, pause-when-hidden.
- `input.js`: keyboard + pointer + touch unified into actions (left/right/up/down/action/pause), swipe, on-screen button binding, gamepad-lite polling.
- `collision.js`: AABB, circles, circle–rect, point tests, minimum translation vector.
- `physics.js`: bodies with velocity, gravity, friction, bounce inside bounds, circle–circle response.
- `particles.js`: pooled emitter with burst/emit, gravity, drag, canvas draw.
- `score.js`: score with combo multiplier and an in-memory high-score table.
- `ui.js`: accessible overlay dialog (focus trap), `<button>` helper with `aria-pressed`, live-region HUD, base styles.
- `wordgrid.js`: crossword/word-search engine: seeded placement with crossings, numbering, clues, fill, answer and selection checks, HTML grid.
- `quiz.js`: quiz engine with points, tiers, summary, keyboard handling, question HTML.
- `locks.js`: `normalize()` (case, accents, punctuation), code lock, riddle lock (with hints and near-miss), sequence lock, room progress.

## art/
- `svg.js`: `el`, `svg`, `path`, `polygon`, `star`, `gradient`, `serialize`, `toDataURI`, DOM-free `svgString`.
- `prng.js`: `mulberry32`, `hashSeed`, `valueNoise2D`, `fbm2D`, `pick`, `shuffle`, `range`, `gaussian`.
- `palette.js`: festive (advent, candlelight, frost, gingerbread, nordic) and non-festive (ocean, meadow, ink, dusk, mono) palettes; contrast, readable ink, mix, alpha.
- `wallpaper.js`: `SIZES` (1170×2532, 1284×2778, 1080×2400, 1920×1080, 2560×1440, 3840×2160, 2880×1800), safe areas, render and export per size.
- `print.js`: `@page` CSS presets (A4/Letter card, postcard, A5, poster, zine fold), zine page order, print-safe rules.
- `pixel.js`: pixel-art buffer with palette, rect/line/circle/fill/flip, crisp canvas and SVG export, PNG download.
- `export.js`: canvas → PNG/JPEG blob and download, SVG → PNG rasterise, SVG download, data URL helper.
- `recorder.js`: canvas → WebM through MediaRecorder with feature detection and a graceful null when unsupported.

## sound/
- `synth.js`: Web Audio voices `musicbox`, `pad`, `pluck`, `bass`, `kick`, `snare`, `hat` with ADSR, master gain, mute; lazy AudioContext.
- `score.js`: the score JSON format: `validate`, `totalBeats`, `schedule`, `lyricsAt`, `transpose`, `seq`, `EXAMPLE`.
- `player.js`: accessible player (play/pause/stop, progress, lyric line, keyboard). No autoplay.
- `wav.js`: `encodeWav`, `renderScore` (OfflineAudioContext), `synthesizeScoreToWav` (pure JS, works in Node), `isWav`.
- `sing.js`: "Robot rendition" through `speechSynthesis`, lyrics grouped into phrases and timed to beats; feature-detected and labelled.
- `ambient.js`: procedural rain, fire, wind, snow with a slider mixer and presets.

## story/
- `card.js`: greeting card (front/inside) with flip and print CSS; `cardHTML` string builder.
- `letter.js`: letter on paper with optional typewriter reveal (skipped under reduced motion).
- `booklet.js`: zine/booklet pager with keyboard, swipe, print of all pages.
- `comic.js`: comic grid with panels, speech bubbles, captions.
- `fiction.js`: interactive-fiction engine (`createStory`, flags, undo, restart, `validateStory`) and an accessible renderer.
- `type.js`: typography stacks (handwriting, serif, display, sans, mono, typewriter). **No font files bundled**; system stacks only.

## maker/
- `shell.js`: mini-app shell (header, actions, optional sidebar, panels, status line, help dialog on `?`).
- `storage.js`: local-only storage with in-memory fallback (gift iframes have an opaque origin; `localStorage` may throw).
- `clipboard.js`: copy with fallback, download text/JSON/blob, self-resetting copy button, file picker.
- `cheatsheet.js`: grouped key/value cheat sheet in columns with `<kbd>` keys and print CSS.

## templates/
Self-contained starting layouts, each with an embedded `<script type="application/advent-gift+json">` manifest and `TODO` markers:
`greeting-card.html`, `slide-deck.html`, `poster-wallpaper.html`, `zine.html`, `trading-card.html`, `real-world-proposal.html` (states "Nothing has been ordered or booked."), `iou-coupon.html`, `video-short.html` (scenes → canvas → WebM).

## tokens.css
The calendar's palette and type stacks as CSS variables, so gifts can match the calendar. Optional: any style is welcome.
