---
id: forgotten-feature
title: The Forgotten Feature
group: F  # A–H as in the bank
summary: A sandboxed demo or proposal for a neglected feature; coding-context only.
suitable_if: "Coding-context only: a neglected feature or issue of the recipient's own project is known."
avoid_if: No coding context; the project is not the recipient's; the feature touches secrets or production data.
forms: [sandboxed-demo, proposal-diff, interactive-html]
minimum_done: A sandboxed demo of the feature (or a clearly labelled proposal with a diff and rationale), never applied to the real repository.
personalization_hooks: [stale issues, TODO comments, the feature they keep mentioning]
skills: [gift-director, maker]
effort: high  # low | medium | high (token band hint only)
real_world: none  # none | suggest (agent never purchases)
quality_checks: [opens, interaction-works, content-complete, no-private-info]
variations:
  - A mock-up of the feature's UI with a walkthrough
  - A design note with three possible approaches
status: candidate  # candidate | approved
---
Show, do not merge. A working sandbox demo is a gift; an unreviewed PR is a chore.
Great: a standalone page demonstrating the "dark mode" issue from 2024, with the proposed diff beside it and a note on tricky parts.
Lazy: "You should add dark mode."
Pitfall: pasting code that leaks internal names or keys.
