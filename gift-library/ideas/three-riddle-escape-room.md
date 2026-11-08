---
id: three-riddle-escape-room
title: Three-Riddle Escape Room
group: B  # A–H as in the bank
summary: A miniature escape-room page where three puzzles unlock a gift or message.
suitable_if: The recipient likes puzzles and there is a message or small reveal worth locking behind them.
avoid_if: Puzzle fatigue after recent puzzle gifts; no good payoff for the final unlock.
forms: [interactive-html, mini-game]
minimum_done: A room page with three working locks, each a distinct puzzle type, hints, and a final reveal; keyboard and touch work.
personalization_hooks: ["favourite settings (library, cabin, spaceship)", shared references for clues]
skills: [gift-director, arcade, art-studio, storyteller]
effort: high  # low | medium | high (token band hint only)
real_world: none  # none | suggest (agent never purchases)
quality_checks: [opens, interaction-works, content-complete]
variations:
  - A snowed-in cabin room
  - "A one-screen \"locked desk drawer\" version"
status: candidate  # candidate | approved
---
Three distinct mechanics (observation, logic, wordplay) keep it fresh.
Great: an illustrated cabin with clickable objects, a combination padlock, a sliding tile and a riddle, each with a progressive hint, opening a letter.
Lazy: three text inputs on a blank page.
Pitfall: hidden state that breaks on reload; keep it recoverable.
