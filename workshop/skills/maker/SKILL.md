---
name: maker
description: Useful mini-tools as gifts: generators, planners, dashboards over data the recipient gave, cheat sheets, converters, little utilities. How to use kit/maker (shell, storage, clipboard, cheatsheet). Never touches the recipient's real files; any change to their work is proposed as a diff, never applied.
license: MIT
---

# Maker

Some people are happiest with a small tool that removes a small pain. The gift is the thoughtfulness of noticing the pain and the polish of the tool.

## Forms

| Form | Example | Kit |
|---|---|---|
| Generator | Name generator for their hobby, excuse generator, menu planner, seeded workout | `shell.js`, `kit/art/prng.js`, `clipboard.js` |
| Mini-tool | Unit converter for their craft, timer with their intervals, tip calculator in their currency | `shell.js`, `storage.js` |
| Dashboard | A one-screen view of data they shared (a reading list, a training log) with sorting and totals | `shell.js`, `storage.js` |
| Cheat sheet | Keyboard shortcuts, conjugations, knitting abbreviations, chess openings; printable | `cheatsheet.js`, `kit/art/print.js` |
| Tracker | Habit grid for January, countdown, "days since" | `storage.js`, `shell.js` |

## Rules

- **Never touch the recipient's real files.** You may read inspiration folders when the brief allows it. You never write, move, format or "fix" anything outside your workspace. If you notice something worth changing in their project, write it as a **proposed diff** in a document inside the gift ("here is a patch you could apply"); never apply it.
- **Local-only data.** Tools store state in the browser only. `storage.js` wraps `localStorage` with an in-memory fallback, because gifts run on an opaque origin where `localStorage` may throw. Say in the UI that data stays on this device.
- **No network.** No fetch, no CDN, no analytics, no fonts from outside. If a tool needs data, embed it.
- **Correctness.** A converter with a wrong factor is worse than no gift. Verify every constant and formula; add a tiny self-test in the file that runs on load and logs mismatches.
- **No personal data baked in.** Pre-fill nothing private. Shared hobbies may shape the tool; names, addresses, calendars, credentials never appear.
- **Honest scope.** A dashboard over data the recipient did not share is a demo: say so in the note and fill it with obviously sample data.

## Craft

- `shell.js`: header, optional sidebar, main panel, footer; responsive under 600 px; focus styles; a `setStatus()` line for messages.
- Keyboard first: every action reachable by Tab/Enter; shortcuts listed in a help panel (`?`).
- Empty states say what to do. Errors say what went wrong in one sentence.
- Export: `clipboard.js` gives `copyText()` with a fallback and `downloadText()`/`downloadJSON()`; a tool that keeps data must let the recipient export it.
- Cheat sheets: `cheatsheet.js` lays out groups of key/value rows in columns, with print CSS; 1 page A4/Letter; large keys, small descriptions.

## Workflow

1. Thinking: the pain, the single screen that removes it, the data it needs (embedded or typed in).
2. Making: shell plus one feature; add the second only when the first is tested.
3. Testing: happy path, empty input, absurd input, reload (state persists or clearly does not), keyboard only, narrow screen, print if printable.
4. Wrapping: `interactive-html`, `note` says what it does in one sentence and that nothing leaves the device.

## Packaging

Single HTML file under 2 MB. If the gift includes a proposal for the recipient's own project, add it as a `document` artifact (`proposal.md` or `.patch`) and say in the note: "This is a suggestion, nothing has been changed."
