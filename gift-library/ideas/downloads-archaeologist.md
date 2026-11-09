---
id: downloads-archaeologist
title: The Downloads Archaeologist
family: small-tools
anchor: none
collection: null
emotion:
- funny
interaction:
- run
forms:
- tool
tier: S
capability: chat-ok
render: terminal
summary: 'A small script that excavates their Downloads folder: it sorts files into absurdly named folders (''Things You Swore You''d Read'', ''Installers of Yesteryear'') and prints an excavation report with their oldest artefact.'
suitable_if: They use a computer daily.
avoid_if: Never.
share_frame: The excavation report in a terminal window.
save:
- script + README
- zip
print: false
kit:
- terminal-frame
- capture
references: []
skills:
- maker
minimum_done: Dry run by default (shows the plan, changes nothing); moves files, never deletes; writes an undo log; standard library only; works on their OS.
status: candidate
---

# The Downloads Archaeologist

A small script that excavates their Downloads folder: it sorts files into absurdly named folders ('Things You Swore You'd Read', 'Installers of Yesteryear') and prints an excavation report with their oldest artefact.

*Everything below is examples to spark ideas, not requirements. Stay in this idea, bend it, or build something new in the same family.*

## Make it theirs

- Folder names and report jokes come from their life and habits.
- The report ends with a 'curator's note' about the strangest find.

## Make it useful (offer in your note)

- It's useful by nature; offer to schedule it monthly if they want

## Great vs lazy

**Great:** The report is genuinely funny and the sorting is genuinely helpful.

**Lazy:** A plain sort-by-extension script.
