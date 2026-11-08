---
name: storyteller
description: Written and paper-like gifts: cards, letters, poems in fixed forms, short stories, zines, fake documents (certificates, menus, newspapers), and interactive fiction. Typography guidance and how to use the story renderers in kit/story.
license: MIT
---

# Storyteller

Words are the cheapest medium and the easiest to do badly. The bar: the recipient should feel that this text could not have been written for anyone else, or that it is simply good enough to reread.

## Forms

| Form | When | Kit |
|---|---|---|
| Card | A short message with one strong image or motif; front and inside | `kit/story/card.js`, `kit/templates/greeting-card.html` |
| Letter | Something to say that takes 150–400 words; tone intimate, specific | `kit/story/letter.js` |
| Poem in a form | Sonnet, villanelle, haiku sequence, limerick chain, acrostic of the recipient's door number or a shared word | plain `card.js` or paper text (format C) |
| Short story | 600–1500 words, one scene, one turn; the recipient (or their world) may appear only through shared facts | `letter.js` or `booklet.js` |
| Zine | 8 pages, one topic, mixed text and drawing; printable fold | `booklet.js`, `kit/templates/zine.html`, `kit/art/print.js` |
| Fake document | Certificate, museum label, train ticket, menu, newspaper front page, patent | hand-built HTML with `type.js` styles |
| Interactive fiction | 8–30 nodes, meaningful choices, at least one ending worth finding; undo and restart | `kit/story/fiction.js` |

## Craft rules

- Decide the one feeling the piece leaves (amused, moved, curious) before writing a word. Cut everything that does not serve it.
- Concrete nouns over adjectives. "The kettle, the blue one with the dent" beats "your cosy kitchen".
- A poem in a form must keep the form. Count syllables and check the rhyme scheme before packaging. A broken villanelle is worse than a good free-verse poem.
- Personal facts: only from the brief. If you know nothing, write about the season, the hour, the door, the act of opening a small envelope. That is universal and true.
- Humour: one good joke per piece, placed late. Never jokes about the recipient's `dislikes` or `avoid` topics.
- Language: the brief's `language`. If you write a form that depends on sound (rhyme, meter), write natively in that language rather than translating.
- Fake documents must be obviously playful (absurd issuer, impossible dates) so they cannot be mistaken for real paperwork. No real logos, no real institutions' names presented as issuers.
- Interactive fiction: every choice changes something visible; no "continue" buttons disguised as choices; dead ends say so with grace; the ending screen offers "Start again". Keep the full story reachable in under 10 minutes.

## Typography

- Display: a serif stack (`Georgia, 'Iowan Old Style', 'Palatino Linotype', serif`). Body: `-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif` or a readable serif at 18–20 px with 1.5–1.6 line height, 60–70 characters per line.
- Handwriting: `kit/story/type.js` gives font stacks such as `'Caveat', 'Bradley Hand', 'Segoe Print', cursive`. **No font files are bundled** and gifts must not load fonts from the network: these are system-font stacks with graceful fallbacks. Never link Google Fonts.
- Paper: warm background (`--milk #FFFAF0`), ink `--ink #243A32`, soft shadow, 2–8 px radius. `kit/tokens.css` has the palette; any style is allowed.
- Print: for cards and zines include `@media print` rules from `kit/art/print.js` and test "Print to PDF" mentally: page size, margins, no buttons on paper.

## Packaging

- A plain text or markdown gift (format C) needs no HTML: the calendar renders it on paper. First line `# Title`.
- An HTML card or letter is `interactive-html` with `primary: index.html`; use kind `card` for the manifest artifact if it is a card, `document` for a long letter or zine (optionally with a PDF).
- Fake document images: `image` with an `alt`.
- Put a short `note`: why this piece, how to read it (print, read aloud, read on the 24th).

## Self-check

Read the whole piece aloud in your head once. Fix anything you stumble on. Confirm form constraints (syllables, rhyme, page count), that no invented fact slipped in, and that nothing in `dislikes`/`avoid` appears.
