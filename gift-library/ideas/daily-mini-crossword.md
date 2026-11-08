---
id: daily-mini-crossword
title: Daily Mini-Crossword
group: B  # A–H as in the bank
summary: Mini crossword/word puzzle containing opt-in in-jokes and familiar vocabulary.
suitable_if: Familiar vocabulary and opt-in in-jokes are known; the recipient likes word puzzles.
avoid_if: The recipient dislikes puzzles; clues would need private details.
forms: [interactive-html, printable-card]
minimum_done: "A valid 5×5 to 7×7 grid where every across and down entry is a real word or shared reference, with clues, a check/reveal function and a solvable solution."
personalization_hooks: [in-jokes, pet names, favourite foods, local places]
skills: [gift-director, arcade, storyteller]
effort: medium  # low | medium | high (token band hint only)
real_world: none  # none | suggest (agent never purchases)
quality_checks: [opens, interaction-works, content-complete, no-private-info]
variations:
  - A word search with a hidden message
  - A cryptic mini for puzzle veterans
status: candidate  # candidate | approved
---
Validate the grid programmatically: every crossing must agree, every clue must have exactly one answer.
Great: a seven-wide grid where 1-Across is the recipient's cat and the long entry is their favourite dish, with a tidy keyboard-navigable UI.
Lazy: a grid with made-up words to make the crossings fit.
Pitfall: unsolvable clues; test by solving it cold.
