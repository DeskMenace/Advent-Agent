---
name: arcade
description: Small games, puzzles, quizzes, crosswords and word grids, escape rooms and toys as a single HTML page. How to use the Arcade kit (loop, input, collision, physics, particles, score, UI, wordgrid, quiz, locks), keyboard plus touch, reduced motion, reset, and how to test before submitting.
license: MIT
---

# Arcade

A gift game is a toy, not a product. Aim for 2–5 minutes of fun that works the first time, on a phone and on a laptop, with no instructions longer than one sentence.

## Pick a shape

| Shape | Good scope | Kit |
|---|---|---|
| Action toy (catch, dodge, bounce, stack) | One mechanic, one screen, score, restart | `loop.js`, `input.js`, `collision.js`, `physics.js`, `particles.js`, `score.js`, `ui.js` |
| Puzzle (sliding, matching, logic grid) | 1–3 hand-made levels you have solved yourself | `input.js`, `ui.js`, `locks.js` |
| Quiz | 8–12 questions with a point of view and a funny results screen | `quiz.js` |
| Crossword / word search | 8–15 words on a theme the recipient shared; clues written by you | `wordgrid.js` |
| Escape room | 3–5 locks in one or two scenes, every clue visible in the page | `locks.js`, `ui.js` |
| Toy (no goal) | Snow globe, music box, kaleidoscope, fidget | `loop.js`, `input.js`, `particles.js`, `kit/art/*` |

Scope rule: if you cannot describe the whole game in two sentences, cut it.

## Non-negotiables

- **Keyboard and touch.** Arrows/WASD plus Space/Enter for action; on-screen buttons or tap/swipe for the same actions. `input.js` unifies both; still test with the keyboard only and with taps only.
- **Reduced motion.** `loop.js` exposes `reducedMotion()`; when true, cut particles, screen shake and parallax, slow nothing that affects fairness. Never flash more than three times per second.
- **Pause and reset.** Visible pause button and `Escape`; a reset that restores a clean state without reloading. `ui.js` has overlay helpers with real `<button>`s and focus management.
- **Scale.** Fit a 360×640 phone viewport and a 1280×800 laptop. Use CSS `aspect-ratio` and `max-width`, or scale the canvas with `devicePixelRatio`.
- **No autoplay audio.** Sound starts after the first tap or key. Offer a mute toggle.
- **Deterministic fairness.** Seed randomness with `kit/art/prng.js` when the puzzle must be solvable; verify solvability in code before showing it.
- **Readable.** Text at least 16 px, contrast at least 4.5:1, no colour as the only signal.

## Workflow

1. `advent-agent progress thinking`: choose shape, mechanic, theme, win and lose conditions, and one surprise (a message at 50 points, a hidden door).
2. `advent-agent progress making`: copy only the kit modules you need into one `<script type="module">` (or plain `<script>`; drop `export`). Write the game; keep state in one object; make `reset()` rebuild it.
3. `advent-agent progress testing`: open the file mentally and walk through: load, first input, score, lose, reset, pause, resize, keyboard only, touch only, reduced motion. If you can run code, run the pure logic (grid generation, quiz scoring) in Node.
4. `advent-agent progress wrapping`: manifest with `primary: index.html`, kind `interactive-html`, a `note` with the one-sentence controls, `incomplete` for anything cut.

## Quizzes

Write questions that could only come from this season: about the recipient's shared interests, about the earlier doors (callbacks), about the world. Each answer set has one correct answer and funny wrong ones. Results screen: at least three tiers, each with its own line. `quiz.js` handles scoring, keyboard (1–4 and arrow keys) and a summary.

## Word grids

`wordgrid.js` places words with crossings and fills the rest; it reports what it could not place so you can choose shorter words. Clues are the gift: write them with wit. Provide "reveal letter" and "check" buttons.

## Escape rooms

`locks.js` normalises answers (case, accents, spaces, punctuation) so "Sankt Gallen" and "sankt-gallen" both open the lock. Every clue must be visible in the page; no external search needed. Offer a hint after 60 seconds, and a "give me the answer" after three wrong tries: a gift never traps.

## Packaging

Single file, inline everything, no CDN, under 5 MB. `kind: interactive-html`. Test that the manifest `primary` points to the file.
