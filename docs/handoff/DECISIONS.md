# Decisions (8 November 2026)

These override the product description, idea bank and design spec wherever they conflict. Add new decisions at the bottom with a date.

## D1. The agent never purchases or books
- No purchase gateway. No automatic checkout. No "preauthorized purchase" mode. The agent never pays for or books anything.
- The agent can research, compare, design, find real vendors and booking paths, and pre-fill a cart or form **only through tools the user already gave it**. It hands over a **purchase-ready proposal**: exact item or experience, vendor, URL, price with currency and the date it was checked, shipping or booking constraints, and a clear "what's left for you to do".
- Settings keep a **price ceiling for real-world suggestions** (per gift, optional season total; default: real-world suggestions on, ceiling unset = "keep it modest"). The calendar shows the user's own "I bought it" marks, which are optional and local only.
- The gift page never says "bought", "ordered" or "booked". It only says the agent prepared it.
- Website FAQ must state: *the agent never makes purchases* (see `DESK_MENACE_INTEGRATION.md`).

## D2. Idea library
- Source: `AI_Advent_Calendar_Gift_Idea_Bank.md`, 78 ideas in groups A–H. Not the 123-idea Appendix A. *(Source superseded by D14.)*
- The library stays open: ideas can be added, edited or removed through normal repo PRs. The format is defined in `GIFT_WORKSHOP.md` §4.
- Each idea has a `status` (`candidate` | `approved`). Noémie approves ideas after reviewing them in the gift lab (`TEST_PLAN.md` §6). Agents may use any idea, whatever its status. The status matters only for Noémie's review workflow and the README showcase.

## D3. One idea-entry format
The two example YAML schemas (product description Appendix B and the idea bank's "recipe structure") are merged into the single format in `GIFT_WORKSHOP.md` §4.

## D4. Door unlocking and opening
- `unlockHour` setting (0–23, default **0 = midnight**) in the season's frozen IANA timezone (default: device timezone).
- Door N is *eligible* from December N at `unlockHour` local time. Becoming eligible only **unlocks** the door. The gift is revealed only when the user clicks the envelope: flap animation, then the gift page (or the preparation screen if the gift isn't ready).
- **"Your gifts" shelf**: a dedicated page listing every opened gift of the current season (thumbnail or preview, title, date). It never shows unopened gifts. Past seasons live under Archive.

## D5. Design spec duplicate
`Design/AI_Advent_Calendar_Design_Spec.md` was deleted. `Design/advent_calendar_handoff/DESIGN_SPEC.md` is canonical.

## D6. Agent connection modes
**Superseded in part by D28: modes 2 (connected) and 3 (portable) are removed; launched and submit remain.** Four modes, all first-class (details in `AGENT_CONNECTIONS.md`):
1. **Launched**: the calendar starts a terminal agent headless (Claude Code, Codex, Gemini CLI, Muse Code, OpenCode, Cursor CLI, Copilot CLI, Goose, Amp, plus a **custom command** adapter for anything else).
2. **Connected**: the agent talks to the calendar through the bundled MCP server (Claude Desktop, Codex/ChatGPT desktop, any MCP client). The user starts the work.
3. **Portable**: any agent or chat LLM without local access (claude.ai, ChatGPT, Gemini app, Meta Muse, OpenAI dots, Instinct…) follows a public guide and returns a **gift package** (a single HTML file, a zip or plain text) that the user drops onto the door.
4. **Command-line/HTTP submission**: any local process can submit through `advent-agent submit` or the authenticated localhost API.

The setup screen shows honestly what each mode can do: whether it can be scheduled, how well the surprise is kept, and what kinds of gifts are possible.

## D7. Personalisation and surprise
- A launched agent runs with its working directory set to a private gift workspace. It still loads its own user-level memory and instructions (e.g. `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md`, its own memory features), so it knows the user as it normally does. It does **not** browse the user's other project folders unless the user grants specific folders in Settings ("folders your agent may look at for inspiration", empty by default, read-only).
- The optional profile (hobbies, humour, dislikes, topics to avoid, language, accessibility, people or pets) is passed to every mode.
- (Connected and portable modes, which this bullet once covered, were removed in D28.)

## D8. Chat-only LLMs are supported
**Superseded by D28: chat apps and chat-only LLMs are not supported.**
Through portable mode (D6.3). The guide teaches a chat LLM to make what it can do well, without local tools: a single self-contained HTML gift (card, poem, game, puzzle, music box, story), or a text or real-world proposal. Claude Desktop works in **connected mode** through the MCP server and can make full-quality gifts. It cannot be scheduled because the user starts each session.

## D9. No paid creative services by default
- The default product needs **no API keys** and uses only the agent's own capabilities plus the bundled workshop.
- **Music**: the agent writes the song (lyrics, melody, arrangement), the bundled Sound Studio plays it in the browser (music box or synth, optional browser-voice "singing", WAV export), and the gift includes a **render-it-yourself sheet**: lyrics, structure, style tags and a ready-to-paste prompt for any music generator. Name no provider in the UI.
- **Video, slides, cards, wallpapers, zines**: bundled templates and building blocks (`GIFT_WORKSHOP.md`).
- **Advanced settings** (collapsed by default): the user can add their own provider keys (music, image, speech, video) stored in the OS keychain. They are used only through narrow adapters, and only when the user enables paid use with a spend cap. The product must feel complete without them.

## D10. Desk Menace funnel
- Quiet credit in the app and README; a share mark on exported or shared gifts; gary.js walking on the **calendar page only**, with right-click "Hire Gary" to the purchase page; a **one-time 20% voucher** slipped into one envelope (configurable day), signed by the makers and not by the agent. Details in `DESK_MENACE_INTEGRATION.md`.
- **No email capture, no analytics, no tracking** in the product.
- Gary never appears in the idea library and is never presented as the agent's gift.

## D11. Stack
Node.js local app run with `npx advent-agent` (plus optional global install), browser UI, no Electron. It must feel like a toy, not a dev tool: one command, the browser opens on the calendar, and setup is a friendly wizard. Details in `ARCHITECTURE.md`.

## D12. Name
**Advent Agent.** Tagline: *Your AI agent is your Secret Santa.* "24 Little Wonders" (the mockup's working title) may be reused as an in-app phrase but is not the product name.


# Added 8 November 2026 (gift-quality review)

## D13. Gift quality bar
A gift should feel like a tiny, wonderfully unnecessary piece of the internet made for one person, not another AI-generated greeting card. Interactive web experiences (self-contained HTML/JS with optional 2D/3D, physics, sound, personalised text and downloads) are a first-class gift form. Every gift is judged on three criteria: emotional effect (funny, ridiculous, absurd, cute or touching), delightful interaction, and shareability.

## D14. New gift library (supersedes D2's source)
The library is rebuilt as 49 ideas in 10 families (`gift-library/`), in the format described in its README. It replaces the 78-idea bank as the source; ideas from the old bank can be migrated in the new format if worth keeping. The library stays open (PRs), ideas keep `candidate | approved` status, and agents may use any idea, combine ideas or invent their own. Library ideas and references are inspiration: the agent must personalise the object, interaction or story, not only the name, so no two users receive the same gift.

## D15. Season shape

- **Day 1** is chosen among `anchor: day1` ideas and made during setup, so door 1 opens instantly.
- **December 24** is epic: an `anchor: finale` idea or something of that size, calling back to the season.
- **Collections**: at most 3 items per set, at most 2 sets per season, items spaced at least 4 days apart, the third completes the set.
- **Rotation rules** are guidance in the gift-director skill, applied by the agent from the history in the day brief (no repeated family, form or interaction verb within 3 days; a rough emotion mix; touching gifts from Day 5; at least one exceptional gift per week). The calendar code still doesn't select or quota ideas, except that it restricts Day 1 and December 24 to anchors in the brief.
- **No tomorrow teasers.**

## D16. Budget tiers
Settings gets "How generous is your Secret Santa?": Light (tier S), Standard (M, default), Generous (L). Day 1 and December 24 get tier XL: 3× the daily budget, at least L. The brief carries the tier; ideas carry their minimum tier and whether a chat LLM can make them (`capability: chat-ok`). README and FAQ state that gift size depends on budget and agent.

## D17. Finale preparation
In launched mode the calendar may start the December 24 gift from December 20, so it has time and budget. The door still unlocks only on December 24.

## D18. Missed and late doors stack
Missed doors stay available and pile up; nothing expires and nothing scolds. Late installers get every past door as catch-up. The agent makes caught-up doors lighter and more varied.

## D19. Reminder without email
Setup offers an optional `.ics` file with a daily "Your door is open" event at `unlockHour` in the season's timezone, December 1–24. Local file, no account, no tracking.

## D20. Sharing = exporting
Because the calendar is local, Share exports media: a 1080×1350 still, a 3–10 s loop (MP4/GIF), the standalone HTML file, and downloads. The agent declares a share frame (a `share.png` or a capture hook) in `gift.json`. Exports go through a privacy preview with one-tap blurring of marked private text. Stills and loops are captured by opening the gift in the user's installed Chrome or Edge (headless, via `puppeteer-core`, no bundled browser download), with the agent's `share.png` or `share.webm` as fallback.

## D21. Share mark
Exports carry a discreet mark, bottom-right: *"Made by my Advent Agent · more gifts at deskmenace.com"* plus a small GitHub logo linking to the repository. No star prompt, no "star us on GitHub". The calendar adds it; the agent never adds logos or links.

## D22. Personalisation goes deep; quality review stays internal
Agents use everything they legitimately know (memory, profile, history, granted folders), because specific gifts are the most shareable ones. Limits: the profile's avoid list, no invented facts, and sensitive matters (health, money, relationships in difficulty) never in the share frame. Gift scoring ("would they post this?") happens only in our gift lab during testing; agents don't run a self-scoring loop.

## D23. Implementation decisions recorded during the build (8 November 2026)
- **Gary on narrow screens.** Below 780 px the board fills the width and Gary would inevitably cover envelopes, so he is not shown there. On wider screens he lives in the left page margin (x ≤ 8 %) at floor level, may stand on the board's credit line, and never reaches the envelopes or the status panel on his own. (§3 "must not cover envelopes for long".)
- **Launched-mode progress has two channels.** `advent-agent progress <phase>` (through a PATH shim the runner adds, so no global install is needed) and a plain `./.progress` file in the workspace, polled every 2 s, for agents whose permission mode blocks shell commands (Gemini CLI with `auto_edit`). The runner also submits `./gift` when the agent exits without submitting, as `AGENT_CONNECTIONS.md` §2 allows.
- **Gate feedback loop.** When a launched agent's gift fails the gate, the agent is started once more in the same attempt with the structured problems appended to `BRIEF.md`; a second failure marks the door failed (retry creates a new attempt).
- **Budget enforcement.** Claude Code gets `--max-budget-usd` when a USD cap is set (there is no token-limit flag); Codex and Gemini expose no limit flag, so the token target is advisory and labelled so in the brief and the UI.
- **Gift origin URLs** use a per-process random path segment per gift (`/g/<token>/…`), so a page on the gift origin cannot guess another gift's files; the UI gets the base URL from the API after reveal.
- **Test clock.** `ADVENT_AGENT_FAKE_NOW` pins "now" only for a non-default `ADVENT_AGENT_HOME`; the default install always uses the real clock. Demo and lab homes simulate the day through `demo.json`.
- **Demo and lab ports.** Demo runs on 4324/4325, lab on 4424/4425, so they never collide with a live calendar on 4224/4225.
- **Snapshots.** Playwright screenshot comparisons run locally (macOS baselines committed); CI saves screenshots as artifacts instead of comparing, because font rendering differs per OS.
- **Settings updates** merge a raw patch onto the current config and validate the whole object (zod 4's `.partial()` re-applies defaults and would reset untouched settings).
- **D23 additions for the gift-quality review (8 November 2026):**
  - `puppeteer-core` is pinned to **24.x** (supports Node ≥ 18). Version 25 needs Node ≥ 22.12 and would break the Node 20 target. Captures use the user's installed Chrome or Edge; if they opted into the gift test drive, that browser is used as a fallback. Nothing is downloaded for sharing.
  - Without `ffmpeg`, the share loop is exported as **WebM** (encoded in the same headless browser); MP4 and GIF need `ffmpeg`.
  - **Portable mode is capped at tier M** (chat assistants can't test or iterate), including Day 1 and December 24. Launched and connected modes get XL for those two doors.
  - **gift@1 stays accepted** with a warning, so older guides, drops of loose files and plain-text pastes keep working. gift@2's stricter rules apply only to manifests that declare `advent-agent/gift@2`.
  - gift@2 treats remote media as an **error** (not a warning) unless the origin is declared in `network` and the user allowed gift network access, which keeps ARCHITECTURE §8's consent path.
  - The **library index order** is generated: families in the README's order, then Day 1 and finale anchors, then tier, then title. The hand-ordered `INDEX.md` delivered with the library was regenerated in that order.
  - **The 78-idea bank is retired** (D14). None of its ideas were migrated; they remain in `docs/spec/` for anyone who wants to port one in the new format.
  - The share mark's GitHub link points to `https://github.com/DeskMenace/Advent-Agent`. The deskmenace.com link keeps `ref=aa-share`.
  - The early start for Day 1 and the finale also applies in connected and portable modes: door 1 accepts a gift before December 1, the finale from December 20. Neither can be revealed before its day.

## D24. No demo mode (8 November 2026, Noémie)
- There is no user-facing demo. Every gift a person sees is a surprise made by their own agent; the product never shows sample gifts. This overrides DESIGN_SPEC §3 ("Demo/developer preview") and §9.3, and TEST_PLAN §5's "first run → demo mode" path.
- `advent-agent demo` is removed. A first run goes straight to setup, which offers launched, connected and portable modes.
- The fixture gifts stay in the repository as test data only (`fixtures/gifts/`, `scripts/fixture-calendar.ts`, used by the e2e suite and `npm run dev`). They are not in the npm package.
- The gift lab (`advent-agent lab`) stays: it runs the user's own agent and is meant for reviewing ideas, not for showing samples.


## D25. Onboarding, calendar redesign, reveal and sharing (9 November 2026, from HANDOFF_ONBOARDING_AND_DESIGN)
- **Setup wizard is now two screens** (welcome, agent connection). Delivery and budget moved to the first-launch onboarding modal on the calendar; the profile ("About you") and the `.ics` reminder live only in Settings. Timezone defaults to the device; unlock hour to midnight.
- **Day 1 starts after onboarding**, not at setup completion, so the budget the user picks applies. Finishing *or* dismissing onboarding (`POST /api/onboarding/complete`) saves the choices or the defaults (On demand, Standard), sets `onboardingDone`, and starts Day 1. Re-running setup after onboarding still starts Day 1 at once.
- **Scheduled delivery** is selectable only in launched mode; the server forces `on_demand` otherwise.
- **The reveal is a modal on the calendar.** `/door/:day` now opens that modal; the preparation page is gone. Connected and portable instructions (the sentence to say, the request to paste, the drop area) sit under the wrapped present. A locked door that is being wrapped early (Day 1, the finale) opens the modal too, so those modes can still fill it before its day.
- **Opened doors carry title and thumbnail** in `/api/calendar` (they are already revealed, so no spoiler), for the peeking corner and the aria-label.
- **Gift page moves to `/gifts/:day`.** `/gift/:season/:day` still works for past seasons; there is no archive UI. Feedback, "I bought it" and the voucher slip stay on the gift page below the actions.
- **Chrome:** the "Advent Agent · made by Desk Menace" line under the board is removed (handoff §1.3: "Nothing else"). The Desk Menace credit remains in the share mark, the CLI's first run and Gary's menu.
- **Profile** gains `name` ("What to call you"). People and pets are one field in the UI (stored in `people`).
- **Pretend date** (developers only): `ADVENT_PRETEND_DATE=2026-12-08` or `--pretend-date`, honoured on any home including the default one. A bare date keeps the real time of day in the season's timezone; a full ISO instant pins the clock. Never shown in the UI.
- **Calendar events** for Gary are `CustomEvent`s on `window`: `door:locked-click`, `gift:preparing`, `gift:ready`, `gift:revealed`, each with `{ day }`.
- **Fonts** Fraunces and Instrument Sans are bundled from `@fontsource/*` (SIL OFL), Latin subset only.
- **Shelf thumbnails** use the gift's sealed thumbnail (from the test drive); gifts without one show a star. Capturing a share still per card would launch a headless browser for every gift.

## D26. Only the user and their agent (9 November 2026, round 2 after Noémie tested the preview)
Principle: once the user starts opening gifts, it's only them and their agent. The calendar is the wrapping paper: it never speaks inside a gift, never hints at what kinds of gifts exist, and never brands the gift. **Replaces D21.**
- **No gift-type hints** before a gift is opened: budget copy is about size and tokens only; the agent-mode table no longer lists "gifts possible"; README/FAQ give no gift examples; the portable request no longer names Day 1 idea ids (the public guide now has a "Door 1 and December 24" section instead).
- **The note is the agent's alone.** `note` is optional in gift.json; the intake no longer invents notes or categories for loose drops (HTML, text, media). New optional `signature` (≤ 40 chars). The note renders in a small terminal panel, typed once (instant with reduced motion), signed only if the agent signed. The calendar's own "— your advent gift-maker" line is gone everywhere, including exports.
- **Nothing from us inside a gift:** no kind labels, captions or "plays inline" bars in renderers; real-world gifts show only item, vendor, price and link plus the agent's note (`realWorld.whatsLeft` is optional and no longer shown). Feedback chips, the "I bought it" mark and the voucher slip are removed from the gift page (decision 7 on the voucher is still open; the server keeps the data and APIs).
- **No share mark** on any export (still, loop, saved file). Fixed caption `My AI agent made this gift for me 🎁` (gift.json `share.caption` is ignored); one link, `https://deskmenace.com`, no path, no `ref`. Copy link is removed. Instagram and TikTok copy the caption without the URL.
- **Save = the gift itself** (`GET /api/save/:day`, `/api/save/:day/file?id=`): the agent's declared `save.file` first, otherwise by form: interactive/HTML card → own HTML with local assets inlined; styled HTML document → PDF (HTML without a browser); plain text → .txt; song → WAV plus lyrics .txt from the score; real-world and links → a bare page with only the agent's details; motion → MP4/WebM and GIF; then `downloads`, `print` files and download artifacts. The old standalone page with our layout is gone. Songs without a WAV keep the in-gift player's own export.
- **Footer:** "Fully local. Nothing leaves your device."
- The config key `share.mark` stays readable for old configs but is ignored, and its Settings toggle is removed.

## D27. Library update: small tools, second lives, render (9 November 2026, from PROMPT_CC_library_update)
- **Library: 58 ideas in 11 families.** New family `small-tools` (8 ideas) and form `tool`; new ideas `song-about-your-project` and the 8 tools; `karaoke-song` is now "A Song About You" (any genre, rap included). The idea schema gains `render` (`2d` | `3d` | `either` | `terminal`, shown as a 2D/3D column in INDEX.md) and `save` (natural formats), which replaces `exports`. Every idea body must have **Make it theirs**, **Make it useful (offer in your note)** and **Great vs lazy**; the indexer rejects an idea without them. `INDEX.json`/`INDEX.md` are generated by our `npm run library:index`, not copied.
- `docs/spec/advent-gifts/` stays frozen at the original 49 ideas (CLAUDE.md: never edit `docs/spec`). The library test now checks that every original idea is kept and lists exactly what the update added.
- **gift-director** merged with round 2 kept: library text is examples, not rules (§2); families are directions (§3); later gifts can grow an earlier one by re-delivering it whole (§5); games fully playable, songs any genre, small-tool safety rules (§6); new §7 "Give it a second life"; the note is §8 and packaging §9. Tier S lists "a small tool".
- **`followUp { offer, prompt }`** in gift.json: for the agent only. The calendar never displays it; the offer reaches the user only through the agent's own note. It is scanned like the note (no purchase words, no secrets) and appears in later briefs' history so any session of their agent can pick it up.
- **Tool gifts** keep their files in a `tool/` folder. The calendar shows the `entry` (a terminal screenshot or an `index.html` with real output) and the note; Save gives `tool/` as a zip (scripts executable, nothing added), then the screenshot. The calendar never runs tool files; scripts stay download-only.
- **`check_gift` for tools** fails when `tool/` is missing or empty, there is no README, there is no uninstall instruction (an uninstall file or an "uninstall" line in the README), or a script calls `rm -rf`, `shutil.rmtree`, `os.remove`, `unlink`, `fs.rm(Sync)` or `Remove-Item` without a dry-run guard (the words "dry run" in that file). Network modules and `curl`/`wget` are a warning only. These are heuristics: they catch obvious mistakes, not a determined tool.
- **Kit:** new `maker/terminal-frame.js` (the `terminal-frame` block the tool ideas name): a terminal window drawn in HTML for share frames, text only.
- The maker skill carries the small-tool safety rules (dry run by default, never delete, undo log, no network, no admin rights, one-line install and uninstall). The concierge skill needed no change: it never touches the user's machine.

## D28. Agents only, personas, one workspace per season, checking the list (9 November 2026, from PROMPT_CC_list_and_personas)
**Supersedes D6.2, D6.3 and D8.** Diagnosis from the lab: each door ran in its own folder, so Claude Code saw an empty project memory; there were no global `CLAUDE.md` / `AGENTS.md` files; the lab profile was empty; only 25 of 96 pitches used a personal detail.
- **Terminal agents only.** Portable (copy-paste) mode, connected mode for chat apps, the MCP server (`advent-agent mcp`, its host snippets, "add it for me", the skills installer), `AGENT_GUIDE.md`, the drop area, the `/api/doors/:day/submit` drop route and their docs and tests are removed. Launched agents never used MCP, so the server went with them. Supported: Claude Code, Codex, Gemini CLI, OpenCode, Cursor CLI, Copilot CLI, Goose, Amp, plus the custom command. Muse Code (no headless mode) is dropped. `advent-agent submit`, `check`, `progress` and the authenticated localhost API stay: any local process can still submit.
- **Old data keeps loading.** A config with mode `connected`/`portable` or adapter `muse` reads as "no agent chosen yet" (launched, no adapter); a door attempt or sealed gift recorded with those modes reads as `submit`. The waiting state `waiting_for_drop` is kept for old doors.
- **Naming rule.** The user never sees "profile scan", "memory import" or "get to know you". The step is **"checking the list"**.
- **"Who is your Secret Santa?"** (setup, agent screen): "Just my agent" (default) or "One of my personas". Candidates come from a file scan by the app, no agent run: Claude Code custom agents and output styles (user and project), project `CLAUDE.md` files that define a persona (a simple heuristic: "your name is", "You are …", "Act as", a "Persona" heading in the first 60 lines), projects found by decoding the folder names in `~/.claude/projects` (guided by the file system, because the encoding is lossy); Codex `AGENTS.md` of projects named in session metadata (first line of each rollout file only). The calendar's own and lab folders are never candidates. Each shows name, project and a one-line preview, plus "Choose a file…".
- **A picked persona** is copied into the season workspace as `CLAUDE.md` and `AGENTS.md` (with a marker so only our own copies are ever removed), is refreshed on the next run when its source changed (and by "Refresh" in Settings), and its project memory is read during checking the list. Nothing is ever written to the persona's own project. The note is signed with the persona's name (gift-director §8; the brief's "Who you are" section). A file chosen with "Choose a file…" is kept as a copy under `personas/` because a browser gives the text, not the path.
- **One stable workspace per season**: `seasons/<year>/workspace/`, doors as subfolders (`doors/NN/`). Every agent run starts there, so Claude Code sees one project per season and its own project memory carries across doors, separate from the user's real projects. Earlier doors' sealed gifts are copied read-only into `doors/MM/gift/` so a collection can build on them. Door folders are still deleted after sealing; retries archive `doors/NN.attempt-N`. `season.workspace` is excluded from export and backup as before.
- **Checking the list** is one launched agent run as the chosen persona with a tier-S budget. It runs right after "Start wrapping", before the first door of a season is made (the door shows "Your Secret Santa is checking its list…", phase `list`), and refreshes on December 8 and 15 (scheduler, once each, at most one failed attempt per six hours). The app decides what may be read: it copies an allow-list (Claude Code: `~/.claude/CLAUDE.md`, `~/.claude/projects/*/memory/`, project `CLAUDE.md`, plus the persona's project memory; Codex: `~/.codex/AGENTS.md`, `~/.codex/memories/`, project `AGENTS.md`; Gemini: `~/.gemini/GEMINI.md`) into the task folder, drops secret-looking lines, and the agent reads only those copies (Claude Code runs with no shell, no web and no extra folders). Never read: session transcripts, source code, `.env` files, keys or credentials, the calendar's own and lab folders. The agent writes `list.md` (10–20 short lines tagged with their source); the app parses it, drops lines with secrets or the profile's avoid list, merges it into `list.json` without duplicates or anything the user deleted, and deletes the copied sources. The task tells the agent to leave out secrets, customer or confidential names, health, money and relationships in difficulty.
- **Settings "Your Secret Santa's list"**: every line is editable or deletable (a deleted line never comes back), review is optional, and a paste box ("Paste what your Claude or ChatGPT app knows about you", hint "Ask your app: what do you know about me?") is merged on the next check. The old profile fields sit under it ("Anything it might not know").
- **The brief carries the list** (it replaces the empty "About the recipient"). With lines: each gift uses at least one real detail where it fits naturally. With none: "never invent personal facts" stays.
- **Two quality fixes.** gift-director §7: "If the idea's 'Make it useful' lists a desktop or terminal version, offer it in your note and add `followUp`. Otherwise an offer is optional." The Downloads Archaeologist is rewritten: a command that writes a funny excavation report and sorts finds into absurd folders (move, never delete); the gift page is one line, a short animated terminal "demo dig" on a sample folder, and the one command to run it on their own Downloads (dry run first); the demo terminal is the share frame.
- **Implementation notes.** `ADVENT_AGENT_USER_HOME` (tests only) replaces the user's home for the persona and list scans. The custom command template gains `{door}`; `{workspace}` is now the start folder. The list check's private log is `seasons/<year>/list/log.txt`.
- **The list stays local.** `list.json` and `personas/` are not part of an export or a backup (they hold what the agent learned about the user, or the user's own persona text); the list is rebuilt by the next check.

## D29 (2026-11-10): Persona copy is small; support files stay plain
- The season CLAUDE.md / AGENTS.md starts with a fixed frame ("For this Advent calendar you are <Name>, acting as the user's Secret Santa. Keep your name, voice and personality; ignore work procedures, tools and tasks from your usual role.") followed by the persona's core text, capped at 8 KB (Codex reads about 32 KiB of AGENTS.md by default; not verified locally).
- Files the persona points at (`@path`) are copied as plain files under `<workspace>/persona/`, listed by path, never `@`-imported. Read-only from the persona's project, Markdown only, 60 KB total.
- Skill-style personas (`.claude/*.md`, `skills/*/SKILL.md`) are candidates. The picker groups by project, shows the path and flags same names.

## D30 (2026-11-10): Gift-origin media is loaded in CORS mode
The gift origin sends `Cross-Origin-Resource-Policy: same-site`, which Chromium applies to different ports: plain `<img>`/`<audio>`/`<video>` from the gift origin were blocked (thumbnails on the board and shelf, image/audio/video gifts on the gift page). Fix: `crossorigin="anonymous"` on those elements (the gift origin already answers with `Access-Control-Allow-Origin` for the app). The strict policy stays.

## D31 (2026-11-10): The list check has a real cost cap
- Measured before: 232k tokens, $0.21, 21 turns (18 separate Reads). The "tier S, about 30k" in the brief was advisory only. The cost was the agent re-reading its growing context on each turn (191k cache-read tokens), on top of a fixed baseline of about 26k tokens per Claude Code session.
- Now: the sources are capped at 6 KB per file and 48 KB in all, and handed over as one `sources/ALL.md` (one Read, one Write). Claude Code runs the list task with `--tools Read,Write,Glob,Grep --disable-slash-commands --strict-mcp-config` (verified against `claude --help`), which drops the user's skills, plugins and MCP servers from the prompt.
- Enforced: `--max-budget-usd` is always set for the list check, to $0.25 (or half the user's per-gift cap if lower). Adapters without a budget flag (Codex, Gemini, others) rely on the 48 KB read cap.
- Measured after: 74k tokens, $0.13, 4 turns, 16 lines. A 30k all-in cap is not reachable with Claude Code, because the baseline alone is about 26k. Realistic: about 75k tokens, $0.13.

## D32 (2026-11-10): Varied details, a balanced list, no mascot subject
- The brief asks for one or two list details per gift (not "at least one"), varied: a detail used by one of the last three gifts is never reused. Gifts record what they used in `gift.json` as `detailsUsed` (optional, at most 4, never shown by the calendar); the brief shows the last three gifts' details.
- The list check spreads over several projects and areas: at most 5 agent lines per source (user lines are never cut). If the material covers only one project, the list says so in a first line instead of padding.
- D10 enforced in code: lines about Gary, gary.js and Desk Menace never reach the list or the brief (the workshop stays free of them, per the hygiene test). The lab flags a pitch or gift centred on them (title or first sentence, or two mentions) and `plan-season` exits non-zero; `compare` reports the count and the share of pitches about the most-shared subject.
- Measured before the change (previous round): 17 of 24 Claude Code pitches were about Gary (14 centred), and 23 of 24 Codex pitches were about FEA Copilot (a single-project list).

## D33 (2026-11-10): Node 22+, a 64 KB list read cap, major-version bumps paused
- **Node 22 or newer.** Node 20 reached end of life in April 2026. `engines` is `>=22`, the CI matrix is Node 22 and 24 on Linux, macOS and Windows, and the README says so. (`puppeteer-core` 25 needs Node >= 22.12, which now becomes possible; see D-note on pinning 24.x.)
- **List read cap 64 KB** (was 48 KB, D31): 48 KB reached only 20 of 31 project folders on the maintainer's machine; 64 KB reaches all 31. Measured: about $0.18 and 118k tokens per check on Claude Code (was $0.13 and 74k), inside the $0.25 hard cap.
- **Dependabot ignores semver-major updates until 2027-01-15** (npm and GitHub Actions). Ignore rules cannot expire: remove them on or after that date.
- Gary: right-click and "Remove Gary" removes him until the next day; Settings has "Show Gary on the calendar". There is no one-click dismiss, so the README says exactly that.

## D34 (2026-11-19, Noémie): No voucher, no hero GIF of a gift
- **The one-time 20% voucher is dropped.** This closes decision 7 and replaces the voucher part of the Desk Menace decision above and of `DESK_MENACE_INTEGRATION.md` §4. The slip was already off the gift page (D26); the server config (`src/promo/promo.json`), `src/core/promo.ts`, the `promo` field of the revealed-gift response and the U7 tests are removed. Gifts and gift pages carry nothing from the makers.
- **No hero GIF, and no sample gifts anywhere** (README, website, social preview, launch posts): what is inside a door is the surprise. The README shows one GIF of Door 1 opening that stops before the gift (`docs/media/door-1-opening.gif`). `docs/DEMO_SHOTLIST.md` is kept only for that clip.
- **Gary as ambassador** lives on deskmenace.com (the Advent Agent page), done outside this repository. In the calendar he stays as decided in D33.

## D35 (2026-11-20, Noémie): The package stays `advent-agent`
- The npm package keeps its unscoped name, so the command stays `npx advent-agent` (already on the live website, the README and the posts). An unscoped package cannot be moved into a scope; a scope would mean a new package.
- The npm org `deskmenace` is created only to reserve the name and to give team access later.

## D36 (2026-11-20, Noémie): The user decides the model and the cost
- **Found on 20 November:** Claude Code's default model had changed since the measurements of 8 to 10 November (Sonnet 5.5 and Opus 5.5). On the new default, a list check reached its fixed $0.25 cap after three turns and wrote nothing, on every run.
- **The calendar never changes the agent's model.** It is the user's agent; the model is set in the agent's own settings, and the UI says so in setup and in Settings.
- **One spend limit, chosen by the user:** "No limit" (the default, for people who trust their agent) or an amount in dollars per gift. It is in the second onboarding step and in Settings, Budget. Claude Code enforces it; other agents are told. This replaces the fixed $0.25 list cap of D31 and D33: a list check now runs under the user's limit, or under none. It stays small by construction (one read of at most 64 KB).
- **A reached limit says so.** The door reports "stopped at the spend cap" instead of "rate limit" (Claude Code prints a routine `rate_limit_event` on healthy runs, which was misread).
- **Cost numbers are a dated snapshot, for information only:** the README, `docs/COSTS.md` and the website give the dates and models of the measurement and say that models and prices change. We do not re-measure.
- **Personal email in the root commit:** accepted as it is (option C); the history is not rewritten.

## D37 (2026-11-20, Noémie): Antigravity CLI is the third tested agent; Gemini CLI is no longer recommended
- **Found on 20 November:** Google stopped serving Gemini CLI for personal accounts (free, AI Pro, AI Ultra) on 18 June 2026 and points them to Antigravity CLI (`agy`). Gemini CLI remains for paid API keys and enterprise licences only.
- **Antigravity CLI gets its own adapter** (`antigravity`), tested with a real gift like Claude Code and Codex. We say "tested" only for an agent that made and sealed a gift, with the date.
- **Gemini CLI stays in the product** (the adapter is kept for people with a paid key) but is not in the install steps, and every text says its gift path is untested.
- **How Antigravity runs:** in its terminal sandbox with settings passed for that run only (`--settings`, never saved to the user's file). Headless `agy` ends the run at the first question it cannot ask, so nothing may need a question: commands are sandboxed, file reads are allowed up front (anywhere for a gift, as with Claude Code and Codex; only the season folder for the list), leaving the sandbox and MCP tools are denied, URL reading follows the web-research setting.
- **No `advent-agent` command in that sandbox** (no network): progress goes through `.progress` and the calendar submits the gift at exit, the route the brief already offers.
