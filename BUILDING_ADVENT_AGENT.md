# Building Advent Agent

**What this is:** the reference document for Advent Agent, an advent calendar where your own AI coding agent is your Secret Santa and makes you one gift a day, December 1–24. It explains how the calendar works, what we decided and why, what we learned, and where things stand. It's written for two readers: us, as the basis for development, and anyone who wants to build something similar from scratch.

**Status:** release candidate (1.0.0-rc.0), not yet released. The calendar, the gift workshop (skills and kit) and the idea library are implemented; the lab rounds on originality, checking the list, personas and rebuilt gifts are done; CI is green on Linux, macOS and Windows (Node 22 and 24). See [CHANGELOG.md](CHANGELOG.md) and §7.

**Keeping it current:** Claude Code updates §7 (status) and adds to §5 (lessons) at the end of every work round, and records each new decision in `docs/handoff/DECISIONS.md` with a one-line summary here. Keep this file free of personal data (no real names, personas, project names or home paths). It may be published with the repo.

---

## 1. If you build one from scratch: the 15 rules

1. **The anticipation is the product.** Never show a demo gift or hint at what kinds of gifts exist. The user should only know that *their* agent will make something for *them*.
2. **Once a door opens, it's the user and their agent.** The calendar is the wrapping paper. It writes nothing inside a gift: no labels, no explanations, no branding.
3. **Judge every gift on three things:** a clear feeling (funny, ridiculous, absurd, cute or touching), something unexpected to touch or play with, and a share frame (one image or short loop that sums it up).
4. **Interactive web pages are the main format**, not images or greeting cards. The bar is "a tiny, wonderfully unnecessary piece of the internet made for one person".
5. **Personal beats impressive**, and your agent's memory is not where you think it is. It depends on the folder and the app. Gather what the agent knows once, deliberately (§3.4).
6. **Give the agent a library of ideas, not templates,** and say explicitly that everything in it is an example. Families are directions, not menus.
7. **Shape the season, don't leave it to chance.** Day 1 is prepared before December and must land in 30 seconds. December 24 is epic. Collections are small (3 items maximum). There are rotation rules and no teasers.
8. **Scale gifts to budget honestly.** Budget tiers per gift, minimum tiers per idea, and plain FAQ copy: smaller budgets and models make smaller gifts.
9. **The note is the agent's alone,** in its voice, signed with its name or persona if it wants.
10. **A local app has no links.** Sharing means exporting the media. Save gives the media in its natural format.
11. **Every gift can have a second life** (desktop, terminal, wallpaper, print), but the agent offers it and never installs anything unasked.
12. **Agents only.** Copy-paste with chat assistants is too much friction and spoils the surprise.
13. **Hard safety lines:** the agent never buys anything; tools never delete; nothing is sent to us; check licences before reusing code.
14. **Test cheaply first:** have agents only *choose* gifts for a whole season before building any. That's where sameness and missing personalisation show up.
15. **Isolate the lab** from real data, and from the agent's own project memory.

---

## 2. How it works, end to end

```
npx advent-agent
  └─ Setup: pick your agent (terminal agents only) and "Who is your Secret Santa?" (your agent, or one of your personas)
      └─ Onboarding pop-up, 2 steps: Delivery (on demand | scheduled) → Budget (Light | Standard | Generous) → "Start wrapping"
          └─ Checking the list: one agent run gathers what it already knows about you → list.md
              └─ Day 1 is made now, so door 1 opens instantly
                  └─ Each day: door unlocks at unlockHour → the agent gets the day brief → chooses and builds → quality check → sealed
                      └─ User clicks the door → flap opens → wrapped present (loading) → unwrap → gift + agent's note
                          └─ Auto-saved to Your Gifts → Share (exports) / Save (native media) / Open full page
```

### 2.1 Pieces

| Piece | Where | Role |
|---|---|---|
| Calendar app | Node local app, browser UI (`npx advent-agent`) | Doors, scheduling, onboarding, reveal, Your Gifts, Settings, share and save |
| Agent adapters | Claude Code, Codex, Gemini CLI, OpenCode, Cursor CLI, Copilot CLI, Goose, Amp, custom command | Launch the agent headless in the season workspace |
| Season workspace | `<data>/seasons/<year>/workspace/`, doors as `doors/NN/` | One agent project per season; persona copy; earlier gifts readable |
| Day brief | Passed to every run | Day, date, language, the list, persona, history, budget tier, anchors, permissions, how to submit |
| Gift-director skill | `workshop/skills/gift-director/` | How to choose, personalise, size, build, offer a second life, write the note, package |
| Specialist skills | `workshop/skills/` | storyteller, arcade, art-studio, sound-studio, maker (tools), concierge (real-world) |
| Kit | `workshop/kit/` | Inlineable, offline, MIT building blocks (pop-up card, snow globe, jelly, capture…) |
| Gift library | `gift-library/ideas/*.md`, indexed by `npm run library:index` | 58 ideas in 11 families |
| Gift package | `gift.json` + files | Manifest: emotion, interaction, form, tier, note, signature, share, save, followUp, credits |
| Quality gate | `check_gift` / `advent-agent check` | Fails broken or unsafe gifts before sealing |
| Lab | `lab plan-season`, `lab make-gift`, `lab simulate-season`, `lab report` | Testing choices, quality and full seasons without waiting for December |

### 2.2 The gift package (`gift.json`, schema `advent-agent/gift@2`)

Key fields:
- `ideaId` (or null if invented), `family`, `emotion`, `interaction`, `form` (`interactive-html`, `video`, `audio`, `image`, `print`, `tool`), `tierUsed`, `collection`
- `note` and `signature` (both the agent's own)
- `share` (still and/or capture recipe for a loop) and `save` (primary file in its natural format)
- `downloads`, `print`, `realWorld` (proposal, never a purchase)
- `followUp { offer, prompt }`: a second-life offer; never shown by the calendar
- `credits` (required whenever third-party code or assets are adapted)

Full example: `workshop/skills/gift-director/references/share-and-export.md`.

---

## 3. Decisions and why

Canonical list with numbers: `docs/handoff/DECISIONS.md`. Grouped by theme here, with the reasoning.

### 3.1 Agents and modes

| Decision | Why |
|---|---|
| **Terminal agents only.** Copy-paste mode for chat assistants and connected mode for desktop chat apps were removed. Local submission (`advent-agent submit`, localhost API) stays. | Copy-paste was about 4 steps × 24 days, the gift was made in plain view (spoiling the surprise), and gifts were limited to one untested HTML page. Anyone who can run `npx` almost certainly has a terminal agent. It also fits the name. |
| **On demand is the default delivery; scheduled is optional.** | On demand works for every agent and makes the wrapping part of the show. Scheduled is for people who want gifts ready when the door unlocks. |
| **Day 1 is prepared right after onboarding, in both modes.** | Door 1 must open instantly; a waiting screen on the first day kills the magic. Making it after onboarding also means the chosen budget applies. |
| **December 24 can start building from December 20** (launched mode). | It gets the largest budget and needs time; the door still unlocks on the 24th. |
| **Node local app, browser UI, no Electron.** | One command, feels like a toy, not a dev tool. |

### 3.2 Gift design

| Decision | Why |
|---|---|
| **Three criteria for every gift:** emotion, delightful interaction, shareability. | The biggest risk is people stopping after 3 days. Surprise and wanting to show someone are what bring them back. |
| **Interactive HTML is first-class.** Any form is allowed, but everything should have something to touch. | A flat image with a poem is the failure mode. Coding agents can do far more than chat image generation, and the gift should show it. |
| **A library of 58 ideas in 11 families**, written as examples: "Make it theirs", "Make it useful", "Great vs lazy". | Agents need a sense of the bar and of range. Written as rules, ideas made every user's gifts identical. "Great vs lazy" calibrates quality without templates. |
| **Families are directions, not menus;** inventing is encouraged. | Prevents everyone getting the same 24 gifts; lets agents build something new within a direction. |
| **Anchors:** 4 Day 1 ideas (snow globe of your year, pop-up hello, holo card, tiny companion) and 4 finale ideas (game of your year, premiere, tiny world, escape room). | Day 1 sets the tone and must land in 30 seconds; December 24 must feel epic and call back to the season. |
| **Collections: at most 3 items per set, at most 2 sets, spaced ≥4 days apart.** Later gifts can grow an earlier one (a new fish in the same tank, delivered as the whole tank). | A collectible every day becomes boring. Three items with a payoff are enough. Gifts are sealed, so growth means redelivery. |
| **Rotation rules** (guidance, applied by the agent from history): no repeated family, form or interaction within 3 days; rough emotion mix; touching gifts from Day 5; at least one exceptional gift per week. **No tomorrow teasers.** | Variety without the calendar code choosing or quota-ing ideas. Teasers were rejected as unnecessary. |
| **Budget tiers:** S (~30k tokens), M (~100k), L (~300k), XL (3× daily, at least L) for Day 1 and December 24. Ideas carry a minimum tier. User setting: Light, Standard (default) or Generous. | Gift size depends on the budget and the model. Honesty about this beats disappointment. "Cut scope, never polish." |
| **Every game fully playable**, tested by the agent. | A title screen is a broken gift. |
| **Songs in any genre, including rap**, presented karaoke-style, with a render-it-yourself sheet. A song about you, and a song about one of your projects. | No paid music services by default; the sheet lets users make a full track elsewhere. |
| **Small tools family** (Downloads tidier, festive terminal, snow in the terminal, fortune, commit celebrations, focus timer, photo sorter, countdown tab). | Coding agents can give useful software, and it can still be funny. |
| **Small-tool safety:** the agent delivers files only and never runs or installs; dry run by default; never deletes; undo log; no network; no admin rights; one-line install and uninstall. The check fails tools without a README, an uninstall step or a dry-run guard around deletes. | It's real software on someone's real computer. |
| **Second life:** each idea lists ways to make it useful (desktop snow globe or fish tank, terminal snowfall, wallpaper, ringtone, printable). Cheap ones are included. Software on the user's machine is only *offered* in the note, with a `followUp` prompt naming the gift folder. When an idea lists a desktop or terminal version, offering it is required. | Gifts people keep using get shown again. Agents skipped purely optional offers, so it's now conditional-mandatory. Never installing unasked keeps trust. |
| **Desktop creatures stay silent** (walk, nap, stare, react; no speech). | A free, simple desktop pet shows people what a desktop character is; the talking, personality-heavy version is a separate product. |
| **The mixtape has two sides:** original tunes (MP3, addable to Spotify as Local Files) and a curated playlist of real songs (titles only, with search links). | It brings the gift into an app people use daily, without copying lyrics or audio. |

### 3.3 Experience and UI

| Decision | Why |
|---|---|
| **No demo anywhere in the UI.** A developer-only pretend-date flag exists for testing. | A demo spoils the surprise of what *your* agent will make. |
| **No gift-type hints** in onboarding, Settings, setup or the FAQ (budget copy talks about size and tokens only). | Hints like "one page, one mechanic" or "games, little worlds" set expectations and remove anticipation. |
| **Onboarding is 2 steps** (Delivery, Budget). No questions about the user. | The agent is supposed to know you; asking would undercut the game. The list and persona handle it (§3.4). |
| **Self-explaining doors:** four states told apart by look alone (locked with wax seal, ready with a gold star, preparing with a gold ribbon, opened with flap open and a card peeking out). The only explanatory text is the fixed home copy (headline, subline, 3 steps). | Text like "You can open December 8" is noise; the calendar should read at a glance. |
| **Reveal pop-up:** flap → wrapped present hops while loading → bow unties, lid pops → gift rises. Closing during preparation is safe. The gift is auto-saved to Your Gifts. | Unwrapping is the ritual, even when the gift is already ready. |
| **The note sits in a small terminal panel**, written only by the agent (`gift.json` `note`), with an optional `signature`, the persona's name if a persona is set. The calendar never writes or falls back to a note. | It must be obvious the agent wrote it; any text from us breaks the relationship. |
| **Nothing from us inside gifts:** no kind labels, no "what's left for you" on real-world proposals, no share mark. | Once doors open, it's the user and their agent. Our text felt like interference and made us look involved in purchases. |
| **Footer:** "Runs entirely on your computer. Nothing is sent to us." plus a small GitHub mark. No Archive button. | Plain reassurance, no fluff. The agent still talks to its own provider, so we claim only what's true. |
| **The mockup's look** (cream dotted background, wooden board, envelope styles, Fraunces and Instrument Sans bundled locally) **with our own red bow.** | It looked best; fonts are bundled because the app must work offline and make no third-party requests. |

### 3.4 Personalisation and personas

| Decision | Why |
|---|---|
| **"Checking the list"**: right after Start wrapping, one agent run reads what the agent already knows: user-level and project instruction files, project memory folders, the persona's project memory, and the Codex equivalents. It writes `list.md` (10–20 tagged lines). Refreshed on December 8 and 15 ("checking it twice"). | Agent memory is folder-scoped (§5). Doing it once is reviewable, cheap compared with 24 searches, and works for every agent. The Santa framing keeps the game; "get to know you" would have broken it. |
| **The list never reads** session transcripts, source code, `.env` files, keys or credentials, or the calendar's own and lab folders. **It excludes** secrets, confidential or customer names, health, money, relationships in difficulty, and the avoid list. | Privacy and trust; share frames go public. |
| **Review of the list is optional** (Settings: edit or delete lines). There's also a paste box for what a Claude or ChatGPT app knows ("Ask your app: what do you know about me?"). | Mandatory review would make it feel like a form. Chat-app account memory can't be read by terminal agents; pasting it bridges the gap. |
| **Brief wording:** if the list has lines, use at least one real detail per gift where it fits. "Never invent personal facts" stays. | Without facts, agents rightly went generic; with facts, they should use them. |
| **Persona picker** in setup ("Who is your Secret Santa?"): the app scans custom agents, output styles, skill-style persona files and persona `CLAUDE.md`/`AGENTS.md` files across known projects, grouped by project with duplicates flagged. A file picker is the fallback. | People who built personas want them to be the Santa. |
| **The persona is copied, not run in place:** its core text inlined into the season workspace's `CLAUDE.md`/`AGENTS.md`, capped at 8 KB, behind a frame ("For this Advent calendar you are <Name>, acting as the user's Secret Santa… ignore work procedures"). Referenced files go under `persona/` as plain files (not @-imported). Refreshed when the source changes. The persona's project is never written to. | Running inside a real project would leak gift spoilers into that project's memory, pollute the repo and narrow the view. Big persona files cost tokens on every turn and may be truncated by some agents. The frame stops work procedures leaking into gifts. |
| **One stable workspace per season.** | One agent project instead of 24; the Secret Santa's own memory carries across doors; no clutter in the user's agent folders. |

### 3.5 Sharing and saving

| Decision | Why |
|---|---|
| **Share = export media:** a 1080×1350 still, a 9:16 or 4:5 loop, the standalone file. Captured in the user's installed Chrome or Edge (headless, `puppeteer-core`), with the agent's own share image as fallback. A privacy preview with one-tap blur comes first. | Gifts live on the user's computer, so there's no public link. No bundled browser download. |
| **Buttons:** native Share… (where files can be shared, mostly phones), X, Facebook, Instagram, TikTok, Copy image. **No Copy link.** | X and Facebook only accept text and a URL, so the media is saved first. Instagram and TikTok can't receive media from a desktop website: save, copy the caption, open the site. Copy link pointed at nothing meaningful. |
| **Caption:** "My AI agent made this gift for me 🎁". **URL:** `https://deskmenace.com` (no path, no ref) for X and Facebook; no URL for Instagram and TikTok. | Honest (the agent made it); minimal sponsorship. |
| **No share mark on exports.** | "Made by my Advent Agent" was misleading (the agent made it) and too sponsored. |
| **Save = the gift itself, in its natural format:** PNG, MP4/GIF, the standalone HTML for interactive gifts, audio plus lyrics, PDF for written pieces, a reference page for a real book, a zip for tools. The agent can declare its primary file (`save`). | A page wrapping the gift with our headers isn't what people want to keep. |

### 3.6 Safety, privacy, licences

| Decision | Why |
|---|---|
| **The agent never purchases or books.** Real-world gifts are purchase-ready proposals (item, vendor, price with currency and date checked, link). The words "bought", "ordered" and "booked" fail the check. Stated in the README, FAQ and website, not inside gifts. | Trust and liability. |
| **No API keys needed; no paid creative services by default.** Optional provider adapters sit behind a collapsed setting with spend caps. | The product must feel complete for free. |
| **No analytics, no tracking, no email capture.** Gifts make no network requests; the kit is vendored. | It's a personal, local product; offline gifts also keep working forever. |
| **Licence rules for references:** copy only MIT/BSD/ISC/Apache/CC0 (and CC BY for art and sound, credited in `credits`). GPL, AGPL, NonCommercial, no-licence or Commons-Clause sources are inspiration only. | Checked 8 November: CSS 3D Lab is MIT (copyable); React Bits is MIT + Commons Clause (reimplement, never add to the kit); OpenProcessing defaults to CC BY-NC-SA; Wonderworks has no licence; Codrops demos must be checked individually. |

### 3.7 Desk Menace and restraint

Advent Agent is free and open source, made by the team behind Desk Menace (deskmenace.com).
- The calendar page has a quiet presence: the footer GitHub mark, and later Gary (Desk Menace's character) walking around the calendar page only.
- Gifts carry nothing from us.
- Gary never appears in the library and is never presented as the agent's gift.
- There is no voucher or offer in any envelope (dropped, D34).

**Why:** the calendar has to be loved on its own. Anything that feels like an ad inside the experience costs more than it earns.

---

## 4. The lab: how we test

| Test | Command | What it measures | Cost seen |
|---|---|---|---|
| Originality (choices only) | `lab plan-season --harness --model --run` | The production brief for days 1→24, stopping after the choice; history accumulates. Library vs invented share, repeats, cross-season overlap, family/emotion/interaction mix, rule violations, personal details used | Cheap compared with building |
| Quality (full builds) | `lab make-gift --idea <id>` or `--free` | Automated checks (opens, no console errors or network, touch, 360 px, share capture, Save format, playable) + blind 1–5 scoring | Day 1 build with list check: ~0.74M tokens (0.23M list check + 0.51M gift) |
| Dress rehearsal | `lab simulate-season --messy` | 24 days with scheduled delivery, skipped days, catch-up, closing mid-preparation, injected crash, invalid gift and restart | Use the cheapest model and tier S |

**Rules:**
- Use a lab data folder and the pretend-date flag; never the real calendar.
- Lab outputs go in `lab/out/` (gitignored).
- Clean up the agent project folders the lab creates.
- Score gifts blind (model hidden).
- A single real persona (the developer's own agent) is enough at this stage.

---

## 5. Lessons learned

1. **Agent memory is folder- and app-scoped.**
   - Claude Code loads `~/.claude/CLAUDE.md`, `CLAUDE.md` files walking up from the working folder, and per-folder project memory.
   - Chat apps have account memory that terminal agents can't read.
   - Running each door in a fresh folder outside the user's projects stripped almost everything. Only 25 of 96 pitches used a personal detail, and it left 83 empty project folders.
   - Fix: checking the list, one workspace per season, a persona copy.
2. **"The agent already knows you" is a promise you have to engineer.** Don't assume it; gather it once, with care.
3. **Personas live in projects and get big.** Copy the core text with a size cap and a frame. Referenced files stay readable but aren't auto-imported. Don't run inside the persona's project.
4. **Copy leaks the surprise.** Budget descriptions that listed gift types ("one page, one mechanic", "games, little worlds") told users what to expect. Describe size and tokens, never content.
5. **Any text from the calendar inside a gift breaks the spell** ("What's left for you", "Your agent prepared this proposal", "Made by my Advent Agent"). Users read it as the company interfering.
6. **A local app can't share links,** and social networks can't receive media from a desktop website. Design the share flow around exporting and handing off.
7. **"Save" means the thing itself.** A page with our headers around the gift isn't a keepsake.
8. **Agents skip optional extras.** "At most one offer, not every gift needs one" produced a fish tank with no desktop-tank offer. Make rules conditional-mandatory where it matters.
9. **Don't spec gifts around data the agent can't see.** The Downloads tidier confused people because the gift page couldn't show a real report; the fix is a labelled demo on a sample folder plus the command.
10. **Write library ideas as examples.** "Make the scene their city or a season they love" was read as a constraint; "something they love, e.g. their dog, a city, a monument…" isn't.
11. **Inspiration sites are rarely reusable code.** Check licences; build your own kit blocks so small-budget gifts still look expensive.
12. **Test choices before builds.** Choosing a whole season is cheap and reveals sameness and missing personalisation before you spend on building.
13. **Lab checks must understand gifts:** tap the gift's first button, not the centre; ignore the normal abort of the live-update stream when leaving a page.
14. **Different ports are different sites** for `Cross-Origin-Resource-Policy: same-site`. Thumbnails and media from the gift origin were blocked until `crossorigin="anonymous"` was added (keeping the strict policy).
15. **Watch token cost on fixed overheads:** the list check (0.23M in one test) and anything inlined in `CLAUDE.md` (re-read every turn) matter more than the gift itself.
16. **First results on quality:** gifts were decent across the board. The snow globe Day 1 was excellent; the pop-up hello was good. Weak points were missing second-life offers and unclear tool gifts, both fixed.

---

## 6. What has been done (8–10 November)

- **8 Nov:**
  - GTM review: retention risk after day 3, Day 1 hero, shareability, sponsorship restraint.
  - New gift library (49 ideas, then 58) and the gift-director skill with references (budget tiers, share and export, inspiration sources and licences).
  - Decisions on tiers, anchors, collections, rotation, sharing, stacked doors and the `.ics` reminder.
- **9 Nov:**
  - Onboarding (2 steps) and redesign implemented: door states, reveal pop-up, Your Gifts, share sheet, Settings. Demo and Archive removed.
  - Round 2 fixes: no gift-type hints, the agent's note in a terminal with signature, nothing from us in gifts, share mark removed, new caption and URL, Copy link removed, Save gives native media, new footer.
  - Library update: render and save fields, "Make it useful", small-tools family, songs about you and your project, examples-not-rules, collections that grow, playable games, `followUp`, silent desktop creatures, mixtape to Spotify.
  - Lab built and run: originality (4 seasons), quality (13 gifts), dress rehearsal (24 days, cheap model).
  - Personalisation diagnosed.
- **10 Nov:**
  - Chat modes removed.
  - Persona picker, persona copy with 8 KB cap and frame, and one workspace per season.
  - Checking the list.
  - The two quality fixes.
  - Cross-origin bug fixed and lab checks corrected.
  - Persona Day 1 test passed (signed, in voice, no work procedures leaked).
  - CI green: 278 unit and integration tests, 60 end-to-end. Committed, not pushed.

---

## 7. Status and what's left

**Closed in the latest round** (details in `docs/handoff/DECISIONS.md`, D28 to D33):
- (Superseded on 20 November by D36: the fixed list cap is gone, the user's own spend limit applies.) The list check now has a real cost cap (D31, D33): sources capped at 64 KB and read once from a single bundle, a hard spend limit, about $0.18 and 118k tokens a check on Claude Code (it was 0.23M tokens, about $0.21, before).
- Gifts use one or two details, varied (D32): every pitch in the rerun used a real detail, with 2.0 (Claude Code) and 1.0 (Codex) details per pitch, against 7.8 and 3.0 before. The subject no longer repeats through the season, and no pitch is centred on the mascot or its makers (the lab checks this).
- The repository, its history and the package were scanned for private names, paths and addresses before the first push.
- The three rebuilt gifts pass the corrected lab checks.

**Before launch:**
1. **Gary on the calendar page:** design session (reactions and lines; active, silent and absent days), then build (corner idle, silent actions, walking on and behind the calendar, popping out of an opened envelope). The calendar already emits `door:locked-click`, `gift:preparing`, `gift:ready` and `gift:revealed`.
2. **Kit blocks:** confirm which of the 10 priority blocks exist (capture/recorder, pop-up card, envelope, snow globe, jelly, bloom, holo card, sticker peel, aquarium/crystal, sound/karaoke/cassette, character rig, confetti/scratch) and build the missing ones.
3. **deskmenace.com page:** landing, install, FAQ (supported agents, budget and rough tokens per season, never buys, runs locally, scheduled needs the computer on).
4. **Voucher:** dropped (D34).
5. **Fresh-machine install test** (Mac, plus Windows if supported) with Claude Code and Codex: install → onboarding → list → Day 1.
6. **Publish:** public repo, npm package, README. On launch day, once the repo is public: add yourself as a required reviewer on the GitHub environment `npm` (Settings → Environments → npm → Deployment protection rules; not available on the Free plan while the repo is private), apply the ruleset (`docs/RULESET.md`), and publish through `publish.yml` so the package gets provenance.
7. **Launch posts** and a spoiler-free demo (the unwrapping, not a gift).

**Known limitations** (`docs/KNOWN_LIMITATIONS.md`):
- No hosted gift links.
- Without ffmpeg, loops save as WebM, which Instagram and TikTok may refuse.
- The dry-run check for tools is a text match.
- The Codex `AGENTS.md` size limit is unverified (our copy stays at 8 KB).

---

## 8. Where things are

| Path | What |
|---|---|
| `docs/handoff/DECISIONS.md` | Numbered decisions (canonical) |
| `docs/KNOWN_LIMITATIONS.md` | Things deliberately left out |
| `docs/BUILDING_ADVENT_AGENT.md` | This document |
| `gift-library/` | Ideas, README (format), INDEX.json and INDEX.md (generated) |
| `workshop/skills/gift-director/` | The agent's main guide, plus `references/` (budget tiers, share and export, inspiration sources) |
| `workshop/skills/*` | Specialist skills (maker holds the tool safety rules) |
| `workshop/kit/` | Building blocks and vendored libraries (three.js, matter.js, canvas-confetti) |
| `src/core/persona.ts` | Persona scan, copy, cap and frame |
| `lab/` | Lab commands; outputs in `lab/out/` (gitignored) |
