# Art Studio: great vs lazy

## Illustration
- **Great:** An SVG of their lit kitchen window at night, three colours plus gold; dragging across it turns the lights on room by room, and the last room holds the cat they mentioned. Emotion `cute`, interaction `drag`. The share frame is the fully lit house.
- **Lazy:** A flat PNG of a snowy landscape with a poem in a script font on top. Nothing to touch, nothing that could only be theirs.

## Generative art
- **Great:** A noise-field snow drift seeded with a word they type; the first seed is their door number; a "regenerate" button shows the seed; the share frame is their word's drift with the seed in small type.
- **Lazy:** `Math.random()` everywhere, unreproducible, the button reloads the page.

## Wallpaper
- **Great:** One renderer, exports at 1170×2532 and 2560×1440 with the clock area left quiet, each size in `downloads`; the page lets them nudge the composition before saving; the share frame shows it on a phone outline.
- **Lazy:** A 800×600 PNG labelled "wallpaper", stretched.

## Sticker sheet
- **Great:** Nine stickers of their in-jokes, each peels off the sheet with a curl and a soft sound (muted by default); a print PDF with 3 mm bleed in `downloads`; three real print services that ship to their country in `print`, each with price, currency and today's date.
- **Lazy:** A grid of clip-art emoji, no peel, a 72 dpi PNG and a line saying "print it somewhere".

## Printable
- **Great:** A4 colouring page of their street with 2 mm lines, 10 mm margins, `@page` set, UI hidden in print, tested as a PDF.
- **Lazy:** A screen page with buttons that print too and a background that drains a cartridge.

## Pixel art
- **Great:** A 32×32 fox in 9 colours (a motif from door 3), exported at 16× with `image-rendering: pixelated`; tap it and it does a 2-frame hop.
- **Lazy:** A 32×32 blur scaled with smoothing to 512 px, 200 colours.

## Comic
- **Great:** Four panels, one gag about the shared hobby, text set as HTML (readable on a phone), the last panel only appears when they click the door in panel 3.
- **Lazy:** One panel with text baked into a tiny canvas, unreadable on a phone.

## Diorama
- **Great:** Five SVG layers with pointer and tilt parallax, static under reduced motion, one tiny moving detail (smoke) that loops seamlessly; the loop share frame is a slow 6-second pan.
- **Lazy:** Parallax that jitters, no reduced-motion fallback, layers misaligned at other aspect ratios.

## Holo card
- **Great:** "Common Sparrow, Rarity: Everyday", stats that are jokes grounded in shared facts, a generated portrait, holographic tilt; the capture hook sets a 12° tilt so the foil catches the light.
- **Lazy:** A rectangle with "Attack 50 Defense 50" and the still showing it flat.

## Loop (GIF/WebM)
- **Great:** A 5-second seamless snowfall over their city's skyline at 30 fps, declared as `share.loop` with a capture request, with `recorder.js` as the in-page download and a still frame under reduced motion.
- **Lazy:** A 20-second recording that stutters, no seam, and the page is blank when MediaRecorder is unsupported.
