---
name: art-studio
description: Visual gifts: SVG and canvas illustration, generative art, wallpapers at real device sizes, printables, pixel art, comics, dioramas, and GIF/WebM loops. How to use kit/art (svg, prng, palette, wallpaper, print, pixel, export, recorder) and the poster, trading-card and video-short templates.
license: MIT
---

# Art Studio

You cannot paint, but you can design and compute. The best visual gifts come from a strong idea, restraint, and code that makes something the recipient can keep: a wallpaper on their phone, a print on their fridge, a loop they send to a friend.

## Forms

| Form | Deliverable | Kit |
|---|---|---|
| Illustration | SVG scene, 1–3 colours plus one accent, a title | `svg.js`, `palette.js` |
| Generative art | Seeded piece; the seed is the day or a shared word; "regenerate" button | `prng.js`, `svg.js`/canvas, `export.js` |
| Wallpaper | PNG at real sizes, phone and desktop, with safe areas | `wallpaper.js`, `kit/templates/poster-wallpaper.html` |
| Printable | A4/Letter card, postcard, poster, colouring page, zine | `print.js`, `kit/templates/greeting-card.html`, `zine.html` |
| Pixel art | 16–64 px sprite or scene, palette-limited, exported at 8× or 16× | `pixel.js`, `export.js` |
| Comic | 3–6 panels, text set in the page, one gag | `kit/story/comic.js`, `svg.js` |
| Diorama | Layered SVG with parallax on pointer move; static under reduced motion | `svg.js`, `prng.js` |
| Trading card | One card with stats and flavour text about a shared motif | `kit/templates/trading-card.html` |
| Loop (GIF/WebM) | 3–8 second animated canvas, recorded in-browser to WebM, or an animated SVG | `recorder.js`, `kit/templates/video-short.html` |

## Craft rules

- One idea per piece. Decide the subject, the mood and the palette before writing code.
- Palettes: `palette.js` has festive and non-festive sets. Three to five colours. Check text contrast (4.5:1) on every background.
- Composition: rule of thirds, a clear focal point, generous margins. Fill space with structure (grids, repetition, noise), not with clutter.
- Seeds: `prng.js` (`mulberry32`, `valueNoise2D`). Seed from `day` or a shared word, so the piece is reproducible and unique to this door. Show the seed somewhere small.
- Wallpapers: export at exact device sizes from `wallpaper.js` (`1170×2532`, `1284×2778`, `1080×2400`, `1920×1080`, `2560×1440`, `3840×2160`, `2880×1800`). Keep the top 12% and bottom 15% of phone sizes quiet for the clock and the dock. Offer each size as a download button; also declare the main PNG as an `image` artifact with `role: download` and an `alt`.
- Printables: `print.js` gives `@page` CSS for A4/Letter, postcard and zine fold. Use CMYK-friendly colours (avoid pure saturated RGB), 10 mm margins, no UI on paper (`@media print { .ui { display: none } }`).
- Pixel art: `image-rendering: pixelated`, integer scaling, a palette of 8–16 colours. Export at 8× or more for crispness.
- Loops: 3–8 seconds, seamless (ease in and out to the same state), 24–30 fps. `recorder.js` records the canvas to WebM through MediaRecorder; when unsupported it tells the user and the animation still plays live in the page. Also keep the live animation as the primary experience; the file is a bonus.
- Accessibility: every image needs an `alt` that says what is in it; animations pause under `prefers-reduced-motion`; provide a static frame.
- Never embed photographs of real people, logos or stock imagery. Everything is original and generated in the page.

## Workflow

1. Thinking: subject, mood, palette, size targets, seed.
2. Making: build in SVG or canvas; expose a `draw(ctx|svg, size, seed)` function so wallpapers and exports reuse one renderer.
3. Testing: render at the smallest and the largest target sizes; check contrast; check the loop seam; check reduced motion; check that downloads produce files with the right dimensions.
4. Wrapping: a live page as `primary` plus exported PNG/WebM as `image`/`video` artifacts with `alt`; `note` tells where to put the wallpaper or how to print.

## Packaging

Images under 2 MB each, PNG for flat art, JPEG for noisy gradients. WebM under 10 MB. Total package under the gate limits. If a render is slow, show a progress line; never a frozen page.
