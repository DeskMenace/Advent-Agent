# Gift Workshop kit

Vanilla JS/CSS building blocks for gifts. MIT. No network, no dependencies, no build step.

## The inlining rule

A gift must be self-contained: **copy the code you use into the gift file** (paste the module body into a `<script type="module">`, or drop the `export` keywords and use a plain `<script>`). Gifts never `import` from the workshop at runtime, never load a CDN, never fetch fonts. Each file here imports nothing from its siblings; where a helper is shared (e.g. `downloadBlob`), it is repeated in each file on purpose so a single paste works. Every file starts with an MIT header and a 10-line usage example.

All modules can be imported in Node without a DOM (tests do this): browser APIs are touched only inside functions.

Every block is touch + mouse + keyboard where it makes sense, respects `prefers-reduced-motion`, and **sound never autoplays** (audio starts on a user gesture, with a mute control).

`INDEX.json` (`advent-agent/kit-index@1`) maps every kit name used in `gift-library/ideas/*.md` to its files, with `status: built | planned`. A `planned` block does not exist yet: build it from scratch in the gift (the library allows this).

## capture/ (the share contract)
- `capture.js`: `register({ still, loop })` defines `window.adventCapture = { async prepare(kind) }` (kind `"still"` 1080×1350 or `"loop"` 1080×1920, 3–10 s); a missing kind falls back to the other handler. While preparing, `<html>` has the class `advent-capturing` (hide hints with `.advent-hide-on-capture`). `markPrivate(el | selector | list)` sets `data-advent-private` so the privacy preview can blur it. `ready()` deferred (thenable) plus `ready.dom/fonts/images/all`; `waitFrames`, `withTimeout`. `canvasToPNG`, `fitToShare`, `recordCanvas` (WebM, clamped 3–10 s, null when unsupported), `downloadBlob`. `SHARE_MARK` and `overlapsShareMark(rect)`: keep the bottom-right 160×48 px clear; never add logos, watermarks, links or hashtags (the calendar adds its mark).

## paper/
- `pop-up-card.js`: CSS-3D card that opens on click/drag (or Enter/Space), layered pop-up elements that stand up as it opens, paper texture without image files.
- `envelope.js`: CSS-3D envelope: flap opens, the letter slides out; keyboard and reduced-motion states.

## toys/
- `snow-globe.js`: canvas 2D glass globe with highlight and base, snow with inertia, shake by drag velocity, `enableMotion()` (devicemotion after permission) or Space; object slots take emoji, SVG strings or images. Pure `stepSnow()`.
- `jelly.js`: volume-preserving mass-spring ring (edge springs + pressure + shape memory), translucent glossy rendering, drag to stretch, release wobble. Pure `createJellyBody`, `stepJelly`, `polygonArea`, `squash`, `impulse` (tested: area stays within ±15 %).
- `bloom.js`: seeded procedural flowers (bezier petals) that unfold on touch with easing. Pure `flowerGeometry(seed)`.
- `holo-card.js`: tilt with pointer or gyro (`enableGyro()` after permission), holographic sheen, flip to the back. Our own implementation.
- `sticker-peel.js`: drag a corner to peel and reveal the back; release sticks back or peels off. Our own implementation.
- `aquarium.js`, `crystal.js`: CSS-3D tank and faceted crystal, drag to rotate; inspired by CSS 3D Lab (MIT, credited in the file header).
- `confetti.js`: `burst()` uses the vendored canvas-confetti when it is inlined (`window.confetti`), else a tiny built-in canvas burst; fewer or no particles under reduced motion.
- `scratch.js`: scratch-off canvas over any content, reports the % revealed, auto-reveals at a threshold, and offers a Reveal button for keyboard users.

## characters/
- `character-rig.js`: SVG rig with `idle`, `look` (eyes follow the pointer), `react` (click/Enter), `sleep` (after inactivity) and randomised blinking; pass your own SVG parts or use the default blob creature.

## document/
- `layouts.js` + `document.css`: deadpan layouts played completely straight: certificate, newspaper, annual report, patent, award, museum label. All inputs HTML-escaped; print CSS with `@page`.

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
- `karaoke.js`: lyrics highlighted word by word in time with a `score.json` (same format as `score.js`), minimal inline synth, play/pause/restart, mute. No autoplay.
- `cassette.js`: cassette player: reels spin while playing (and wind from one to the other), drag to scrub/seek, side A/B tracklist; tracks are scores or audio files.

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
`greeting-card.html`, `slide-deck.html`, `poster-wallpaper.html`, `zine.html`, `trading-card.html`, `real-world-proposal.html` (states "Prepared for you. Buying or booking is yours to decide."), `iou-coupon.html`, `video-short.html` (scenes → canvas → WebM).

## vendor/
Offline copies of three.js 0.187.0 (`three.module.min.js`, MIT), matter-js 0.20.0 (`matter.min.js`, MIT) and canvas-confetti 1.9.4 (`confetti.browser.js`, ISC), each with its licence file next to it; see `vendor/README.md` for provenance and `gift.json` credits. Never load them from a CDN: inline or copy them with the gift.

## Planned blocks
Named by library ideas but not built yet (see `INDEX.json` for a one-line brief each): `wheel`, `map`, `countdown`, `scroll-scenes`, `pop`, `ticket`, `bracket`, `balloon`, `glass`, `charts`, `css-3d-box`, `stars`, `shake`, `water`, `stage`, `gallery`. Build them from scratch in the gift; reuse patterns from the blocks above.

## tokens.css
The calendar's palette and type stacks as CSS variables, so gifts can match the calendar. Optional: any style is welcome.
