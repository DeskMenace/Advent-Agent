# Arcade: great vs lazy

## Action toy
- **Great:** "Catch the ornaments": one basket, one mechanic, ornaments fall faster over time, score and best score in memory, a message at 24 points that ties into the season, Escape pauses, R resets, swipe on touch, particles off under reduced motion. Fits 360×640.
- **Lazy:** A platformer with jump, double jump, shooting and three enemy types; the second enemy type throws an error, there is no touch control and the canvas is fixed at 1024 px.

## Puzzle
- **Great:** A 4×4 sliding puzzle of a generative image drawn with the kit, shuffled by a seeded solvable permutation (parity checked), move counter, one "I give up" button that solves it with an animation.
- **Lazy:** Random shuffle that is unsolvable half the time, no counter, no way out.

## Quiz
- **Great:** "How well do you know your own December?" Ten questions about earlier doors and shared hobbies, each wrong answer funny on its own, three result tiers with distinct text, keyboard 1–4.
- **Lazy:** Ten trivia questions copied from general knowledge, results screen says "You scored 7/10".

## Crossword / word search
- **Great:** 12 words from the recipient's shared hobbies and the season's motifs, clues written as small riddles, "check" and "reveal a letter" buttons, numbering consistent with the placements.
- **Lazy:** A word search with 30 generic words, several unplaced words silently dropped, no way to check.

## Escape room
- **Great:** One room, four locks (code, riddle, sequence, colour order), every clue in the illustration, hints after 60 seconds, answers normalised so accents and case do not matter, a satisfying door animation and a sentence at the end.
- **Lazy:** A text input that compares `===` with "Snow", no hints, and the page reloads on a wrong answer.

## Toy
- **Great:** A snow globe: shake by dragging or pressing Space, snow settles with simple physics, a tiny scene seeded with the day number so it is unique to this door, quiet by default with a wind toggle.
- **Lazy:** A `requestAnimationFrame` loop that spawns confetti forever, no pause, no reduced-motion check, no interaction.
