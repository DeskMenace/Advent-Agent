# Gift Workshop and idea library

The workshop gives agents **building blocks and judgement**, not templates of the day. The agent chooses and makes the gift. It may ignore the library and the components entirely.

## 1. Skills (`workshop/skills/<name>/SKILL.md`, Agent Skills format)

Each skill has a short description in its frontmatter (loaded always), a body (loaded when used), and `references/` and `examples/` (loaded on demand).

| Skill | Must contain |
|---|---|
| **gift-director** (always first) | The giver's role; reading the brief; using context honestly (no invented personal facts; a universal delight beats a forced reference); varying medium and tone; callbacks and optional threads; budget sense ("one polished modest gift beats an ambitious broken one"); D1 no-purchase rule; secrecy rule; how to pick tools; how to package, check and submit; how to write the **note** (warm, specific, varied, no stock phrasing, no chain-of-thought) |
| **storyteller** | Cards, letters, poems in forms, stories, zines, fake documents, interactive fiction; typography guidance; using the Storyteller renderers |
| **arcade** | Small games, puzzles, quizzes, crosswords, escape rooms, toys; using the Arcade kit; keyboard + touch + reduced motion; reset; testing |
| **art-studio** | SVG/canvas illustration, generative art, wallpapers at real device sizes, printables, pixel art, comics, dioramas, GIF/WebM loops |
| **sound-studio** | Writing songs and soundscapes; the score format; using the player; the render-it-yourself sheet (§3) |
| **maker** | Useful mini-tools, dashboards, generators, cheat sheets; never touching the user's real files; proposals as diffs only |
| **concierge** | Real products, books, experiences, hut nights: verifying they exist, live price and date checked, real links, constraints, "what's left for you"; never claiming a purchase (D1) |
| **quality-and-packaging** | Per-type checklists, `advent-agent check`, fixing gate errors, secret hygiene, the manifest |

Every skill has an `examples/` folder with **one great and one lazy** execution note per form, so agents calibrate quality without copying a template.

## 2. Building blocks (`workshop/kit/`, vanilla JS/CSS, MIT, no network)

Each block must be **inlineable** (agents copy it into a self-contained gift) and documented with a 10-line usage example. All of it is tested in the repo.

- **arcade/**: game loop, input (keyboard, touch, pointer, gamepad-lite), collision, simple physics, particles, scoring, high scores kept in memory, pause/reset UI, crossword/word-grid engine, quiz engine, escape-room lock primitives.
- **art/**: SVG helpers, seeded PRNG + noise, palettes, wallpaper exporter (common phone and desktop sizes), print templates (A4/Letter card, postcard, zine fold), pixel-art canvas, canvas → PNG export, **canvas → WebM recorder** (MediaRecorder) for video-like gifts.
- **sound/**: Web Audio synth + music-box + simple drum voices; **score JSON** (tempo, key, tracks, notes, lyrics aligned to notes); player UI (accessible, no autoplay); WAV export through OfflineAudioContext; optional browser voice "singing" through `speechSynthesis` (labelled as a robot rendition); ambient soundscape mixer (procedural rain, fire, wind, snow).
- **story/**: paper card renderer, letter, booklet/zine pager, comic panel layout, interactive-fiction runner (choices JSON), handwritten-style typography (bundled open-licence fonts only).
- **maker/**: mini-app shell, local-only storage wrapper (in-memory fallback), copy/download helpers, cheat-sheet layout.
- **templates/**: starting layouts (not daily templates) for a **video/animated short** (scenes → canvas → WebM), **slide deck** (keyboard-paged HTML + print-to-PDF CSS), **greeting card**, **poster/wallpaper**, **zine**, **trading card**, **real-world proposal** (product, book, experience/hut: structured page with price, date checked, links, "what's left"), **IOU coupon**.

The calendar's renderers (ARCHITECTURE §8) and the kit share visual tokens, so gifts feel at home, but agents may use any style.

## 3. Music without paid services (D9)

A song gift contains:
1. `score.json`, played in the gift page by Sound Studio (music box, synth, or optional robot voice).
2. `song.wav` exported from the score (the quality gate checks it decodes).
3. `render-it-yourself.md`, rendered as a card with copy buttons:
   - full lyrics with section labels;
   - style or genre tags, tempo, key, mood, vocal description;
   - one **ready-to-paste prompt** for any text-to-music tool, plus a shorter variant;
   - a note that the user can render it in the music generator of their choice.

   Name no provider.

If the advanced settings have a music key configured **and** paid use is enabled with a cap, the agent may render through the narrow adapter `generate_audio(params)` (exposed as an MCP tool and CLI command, never as a raw key) and include the result as well.

## 4. Idea library format (single format; D2, D3)

Convert `AI_Advent_Calendar_Gift_Idea_Bank.md` into `gift-library/ideas/<id>.md`, one file per idea, 78 in total, keeping the source's wording and its group (A–H). Generate `gift-library/INDEX.json` and `INDEX.md` with a script (`npm run library:index`); CI fails if they're stale.

```markdown
---
id: museum-of-abandoned-ideas
title: The Museum of Abandoned Ideas
group: A            # A–H as in the bank
summary: Virtual museum of unfinished ideas, hobbies or projects; can be nontechnical.
suitable_if: The agent genuinely knows about shelved ideas, hobbies or projects.
avoid_if: No real context; the topic is sensitive.
forms: [written-catalog, illustrated-gallery, interactive-html]
minimum_done: A complete viewable gift; any promised interaction works.
personalization_hooks: [abandoned projects, old hobbies]
skills: [storyteller, art-studio, arcade]
effort: medium      # low | medium | high (token band hint only)
real_world: none    # none | suggest (agent never purchases)
quality_checks: [opens, content-complete, no-private-info]
variations:
  - A printed-style exhibition catalogue with wall labels
status: candidate   # candidate | approved (Noémie's review, TEST_PLAN §6)
---
Free-form creative notes, great-vs-lazy examples, pitfalls. Optional.
```

Fields that the source doesn't give (forms, hooks, effort…) are filled in thoughtfully and kept short. `suitable_if` and `avoid_if` must carry the conditional rules from the bank, e.g. "developer-context only", "only if pet context exists". Ideas are inspiration. Nothing in the code may select, rotate or quota them.

`CONTRIBUTING.md` explains how to add an idea (copy a file, run `npm run library:index`, open a PR).

## 5. Advanced: user-provided APIs (collapsed in Settings)

The user can optionally add providers for music, image, speech and video, with a per-provider explanation (what it enables, who charges, what data is sent). Keys live in the OS keychain only. Adapters expose narrow operations (`generate_audio`, `generate_image`, `synthesize_speech`, `generate_video`). Paid use is off until enabled with a per-gift and season cap. Usage goes to `ledger.jsonl`. Ship the adapter framework with **one** generic OpenAI-compatible image adapter as the reference implementation, plus a documented interface so contributors can add more. No provider is featured or recommended in the default UI.
