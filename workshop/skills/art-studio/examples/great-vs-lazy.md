# Art Studio: great vs lazy

## Illustration
- **Great:** An SVG of a lit window in a dark house, three colours plus gold, the recipient's door number as the house number, text contrast checked, `alt` written.
- **Lazy:** 40 random circles, five rainbow gradients, no focal point, no `alt`.

## Generative art
- **Great:** A noise-field snow drift seeded with the day; a "regenerate" button changes the seed and shows it; the first seed is the door number so the piece is unique and reproducible.
- **Lazy:** `Math.random()` everywhere, unreproducible, the button reloads the page.

## Wallpaper
- **Great:** One renderer, exports at 1170×2532 and 2560×1440 with the clock area left quiet, download buttons per size, the main PNG declared as an `image` with `role: download`.
- **Lazy:** A 800×600 PNG labelled "wallpaper", stretched.

## Printable
- **Great:** A4 colouring page with 2 mm lines, 10 mm margins, `@page` set, UI hidden in print, tested as a PDF.
- **Lazy:** A screen page with buttons that print too and a background that drains a cartridge.

## Pixel art
- **Great:** A 32×32 fox in 9 colours (a motif from door 3), exported at 16× with `image-rendering: pixelated`, plus an animated 2-frame idle.
- **Lazy:** A 32×32 blur scaled with smoothing to 512 px, 200 colours.

## Comic
- **Great:** Four panels, one gag about the shared hobby, text set as HTML (searchable, readable), each panel an SVG with consistent characters.
- **Lazy:** One panel with text baked into a tiny canvas, unreadable on a phone.

## Diorama
- **Great:** Five SVG layers with pointer parallax, static under reduced motion, one tiny moving detail (smoke) that loops seamlessly.
- **Lazy:** Parallax that jitters, no reduced-motion fallback, layers misaligned at other aspect ratios.

## Trading card
- **Great:** "Common Sparrow, Rarity: Everyday", with stats that are jokes grounded in shared facts, a generated portrait, a holographic CSS tilt that respects reduced motion.
- **Lazy:** A rectangle with "Attack 50 Defense 50".

## Loop (GIF/WebM)
- **Great:** A 5-second seamless snowfall loop at 30 fps, recorded to WebM with `recorder.js`, with a fallback message when MediaRecorder is missing and the live animation still playing.
- **Lazy:** A 20-second recording that stutters, no seam, and the page is blank when MediaRecorder is unsupported.
