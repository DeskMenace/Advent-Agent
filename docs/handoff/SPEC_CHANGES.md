# Spec changes from the gift-quality review (8 November 2026)

What changes in the existing specs so the new library and gift-director guide work. Decisions D13–D22 go at the bottom of the decisions file.

## Decisions

**D13. Gift quality bar.** A gift should feel like a tiny, wonderfully unnecessary piece of the internet made for one person, not another AI-generated greeting card. Interactive web experiences (self-contained HTML/JS with optional 2D/3D, physics, sound, personalised text and downloads) are a first-class gift form. Every gift is judged on three criteria: emotional effect (funny, ridiculous, absurd, cute or touching), delightful interaction, and shareability.

**D14. New gift library (supersedes D2's source).** The library is rebuilt as 49 ideas in 10 families (`gift-library/`), in the format described in its README. It replaces the 78-idea bank as the source; ideas from the old bank can be migrated in the new format if worth keeping. The library stays open (PRs), ideas keep `candidate | approved` status, and agents may use any idea, combine ideas or invent their own. Library ideas and references are inspiration: the agent must personalise the object, interaction or story, not only the name, so no two users receive the same gift.

**D15. Season shape.**
- **Day 1** is chosen among `anchor: day1` ideas and made during setup, so door 1 opens instantly.
- **December 24** is epic: an `anchor: finale` idea or something of that size, calling back to the season.
- **Collections**: at most 3 items per set, at most 2 sets per season, items spaced at least 4 days apart, the third completes the set.
- **Rotation rules** are guidance in the gift-director skill, applied by the agent from the history in the day brief (no repeated family, form or interaction verb within 3 days; a rough emotion mix; touching gifts from Day 5; at least one exceptional gift per week). The calendar code still doesn't select or quota ideas, except that it restricts Day 1 and December 24 to anchors in the brief.
- **No tomorrow teasers.**

**D16. Budget tiers.** Settings gets "How generous is your Secret Santa?": Light (tier S), Standard (M, default), Generous (L). Day 1 and December 24 get tier XL: 3× the daily budget, at least L. The brief carries the tier; ideas carry their minimum tier and whether a chat LLM can make them (`capability: chat-ok`). README and FAQ state that gift size depends on budget and agent.

**D17. Finale preparation.** In launched mode the calendar may start the December 24 gift from December 20, so it has time and budget. The door still unlocks only on December 24.

**D18. Missed and late doors stack.** Missed doors stay available and pile up; nothing expires and nothing scolds. Late installers get every past door as catch-up. The agent makes caught-up doors lighter and more varied.

**D19. Reminder without email.** Setup offers an optional `.ics` file with a daily "Your door is open" event at `unlockHour` in the season's timezone, December 1–24. Local file, no account, no tracking.

**D20. Sharing = exporting.** Because the calendar is local, Share exports media: a 1080×1350 still, a 3–10 s loop (MP4/GIF), the standalone HTML file, and downloads. The agent declares a share frame (a `share.png` or a capture hook) in `gift.json`. Exports go through a privacy preview with one-tap blurring of marked private text. Stills and loops are captured by opening the gift in the user's installed Chrome or Edge (headless, via `puppeteer-core`, no bundled browser download), with the agent's `share.png` or `share.webm` as fallback.

**D21. Share mark.** Exports carry a discreet mark, bottom-right: *"Made by my Advent Agent · more gifts at deskmenace.com"* plus a small GitHub logo linking to the repository. No star prompt, no "star us on GitHub". The calendar adds it; the agent never adds logos or links.

**D22. Personalisation goes deep; quality review stays internal.** Agents use everything they legitimately know (memory, profile, history, granted folders), because specific gifts are the most shareable ones. Limits: the profile's avoid list, no invented facts, and sensitive matters (health, money, relationships in difficulty) never in the share frame. Gift scoring ("would they post this?") happens only in our gift lab during testing; agents don't run a self-scoring loop.

## gift.json → schema `advent-agent/gift@2`

New fields: `ideaId`, `family`, `emotion`, `interaction`, `tierUsed`, `collection { set, index, size }`, `share { still, loop, caption, privateText }`, `downloads`, `print`, `credits`. Full example in `workshop/skills/gift-director/references/share-and-export.md`. `check_gift` additionally fails on: missing share frame, missing `emotion` or `interaction`, `credits` with a licence not on the allowed list, network requests in `index.html`, and any of "bought", "ordered", "booked".

## Day brief additions

- `budget.tier` (S, M, L, XL) and `budget.tokens`
- `season.anchor` (`day1`, `finale` or null) and `season.isCatchUp`
- `history[]` entries gain `family`, `emotion`, `interaction`, `collection`
- `collections`: sets started this season and how many items each has

## Calendar features

1. **Share capture service.** The Node app opens the gift in a headless browser at 1080×1350 (stills) or 1080×1920 (loops), calls `window.adventCapture.prepare()`, then screenshots or records. Use the user's installed Chrome or Edge through `puppeteer-core` (no bundled browser download). Fallback: the agent's `share.png` or `share.webm`.
2. **Share panel** on the gift page: Share (Web Share API with files where supported; otherwise download and copy), Download still, Download loop, Download standalone file, Print files, privacy preview. Share mark applied to every export.
3. **Generosity setting** (D16) and its explanation in setup.
4. **Day 1 during setup** with tier XL; door 1 shows a wrapping animation if it's still running when setup ends.
5. **Stacked doors and catch-up** (D18), and the `.ics` reminder (D19).
6. **Collections shelf.** The "Your gifts" shelf shows completed sets together.

## Kit priority (build before 1 December)

Blocks most ideas depend on, in order. Each is vanilla JS/CSS, MIT, inlineable, offline, touch and reduced-motion aware, with a 10-line usage example.

1. `capture` + `recorder`: capture hook helper, canvas → PNG/WebM
2. `pop-up-card` and `envelope` (CSS 3D, paper texture)
3. `snow-globe` (canvas or three.js: glass highlight, snow with inertia, shake gesture, object slots)
4. `jelly` (2D soft-body, volume-preserving mass-spring, translucent rendering)
5. `bloom` (procedural flowers that unfold on touch)
6. `holo-card` and `sticker-peel` (our own implementations, not React Bits code)
7. `aquarium` and `crystal` (adapted from CSS 3D Lab, MIT, credited)
8. `sound` + `karaoke` + `cassette` (karaoke = lyrics timed to `score.json`)
9. `character-rig` (SVG rig with idle, look, react, sleep states and blinking)
10. `confetti`, `scratch`, `arcade` (exists), `document` layouts

Vendored: three.js (MIT), matter.js (MIT), canvas-confetti (ISC).

## README and FAQ copy

> **How elaborate are the gifts?** It depends on your agent and how generous you let it be. A Secret Santa on a small budget or a smaller model makes smaller gifts: a lovely card, a jelly fruit, a song. With more room and a strong coding agent it can build games, little worlds and characters that react to you. Change "How generous is your Secret Santa?" in Settings at any time.

> **Can I share my gifts?** Yes. Every gift has a Share button that exports an image, a short video or the gift itself as a file you can send. You see a preview first and can blur anything private.

## Test plan (internal only)

In the gift lab, run each `day1` and `finale` idea and a sample of others across test personas, models and tiers. Score each output 1–5 on the three criteria plus "would I post this?". Ideas that average under 3.5 on any criterion at their minimum tier are reworked or moved up a tier before `approved`.
