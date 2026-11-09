---
id: commit-celebrations
title: Commit Celebrations
family: small-tools
anchor: none
collection: null
emotion:
- funny
- ridiculous
interaction:
- run
forms:
- tool
tier: S
capability: coding-agent
render: terminal
summary: A git hook that celebrates their commits with tiny terminal animations and absurd achievements ('Committed before coffee', 'Fixed a typo you introduced 4 minutes ago').
suitable_if: They write code.
avoid_if: They don't use git.
share_frame: A terminal with an achievement unlocked.
save:
- hook script + README
print: false
kit:
- terminal-frame
- capture
references: []
skills:
- maker
minimum_done: Installs per repo or globally with one command; never blocks or slows a commit; easy uninstall.
status: candidate
---

# Commit Celebrations

A git hook that celebrates their commits with tiny terminal animations and absurd achievements ('Committed before coffee', 'Fixed a typo you introduced 4 minutes ago').

*Everything below is examples to spark ideas, not requirements. Stay in this idea, bend it, or build something new in the same family.*

## Make it theirs

- Achievements come from their real habits and repos (if you know them).

## Make it useful (offer in your note)

- A December-only mode, then a quieter one

## Great vs lazy

**Great:** Rare achievements, a streak counter, a final achievement on the 24th.

**Lazy:** Prints 'Nice commit!'.
