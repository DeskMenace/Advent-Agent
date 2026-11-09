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
summary: 'A command that digs through their Downloads folder and writes a funny excavation report about what it finds, then sorts the finds into absurdly named folders, moving files and never deleting them.'
suitable_if: They use a computer daily.
avoid_if: Never.
share_frame: The demo terminal.
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
minimum_done: The gift page has a short animated terminal demo dig on a sample folder, clearly labelled, and the one command to run it on their own Downloads (dry run first); the command itself writes the real report; dry run by default (shows the plan, changes nothing); moves files, never deletes; writes an undo log; standard library only; works on their OS.
status: candidate
---

# The Downloads Archaeologist

A command that digs through their Downloads folder and writes a funny excavation report about what it finds, then sorts the finds into absurdly named folders, moving files and never deleting them.

*Everything below is examples to spark ideas, not requirements. Stay in this idea, bend it, or build something new in the same family.*

## The gift page

You cannot see their Downloads folder, so the page cannot show a real report. Do not invent one. The page is:

1. One line saying what it is.
2. A short animated terminal demo dig on a **sample** folder you made up, with the label "demo dig" clearly visible. Use the `terminal-frame` block. The sample files and jokes are yours; none of it claims to be their folder.
3. The one command that runs it on their own Downloads (a dry run first), copy-ready.

The real report appears when they run the command. The demo terminal is the share frame. Keep every safety rule: dry run by default, move files never delete them, undo log, standard library only, one-line uninstall.

## Make it theirs

- Folder names and report jokes come from their life and habits.
- The report ends with a 'curator's note' about the strangest find.

## Make it useful (offer in your note)

- It's useful by nature; offer to schedule it monthly if they want

## Great vs lazy

**Great:** The report is genuinely funny and the sorting is genuinely helpful.

**Lazy:** A plain sort-by-extension script.
