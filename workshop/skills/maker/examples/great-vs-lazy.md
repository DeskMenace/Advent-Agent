# Maker: great vs lazy

## Generator
- **Great:** "Sourdough name generator" (shared hobby: baking): seeded names, a copy button, a "keep this one" list stored locally with export, a tiny self-test for the seed function, works with keyboard only.
- **Lazy:** `Math.random()` picking from 10 words, no copy, no state, a page that breaks under 400 px.

## Mini-tool
- **Great:** A knitting gauge converter with verified formulas, inputs with units, results that update live, an "about the maths" fold-out, state remembered locally with a visible "stays on this device" line.
- **Lazy:** A converter with one factor wrong and an alert() on invalid input.

## Dashboard
- **Great:** The recipient shared a reading log in an allowed folder: the gift embeds a copy of the titles (no notes, no private text), sorts by month, draws a small bar per month in SVG, totals, and the note says exactly what was copied.
- **Lazy:** A chart over invented data presented as the recipient's own, or a tool that reads their folder live and writes a "cleaned" file back into it.

## Cheat sheet
- **Great:** One A4 page of the shortcuts the recipient said they forget, grouped, big keys, print CSS tested, a blank row to add their own.
- **Lazy:** A wall of text copied from documentation, three pages when printed, keys and descriptions misaligned.

## Tracker
- **Great:** A January habit grid, one tap per cell, stored locally, export as JSON, a streak counter that does not shame ("3 days, keep going").
- **Lazy:** A grid that loses everything on reload because `localStorage` threw on the opaque origin and nobody caught it.
