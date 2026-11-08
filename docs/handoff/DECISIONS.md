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
Four modes, all first-class (details in `AGENT_CONNECTIONS.md`):
1. **Launched**: the calendar starts a terminal agent headless (Claude Code, Codex, Gemini CLI, Muse Code, OpenCode, Cursor CLI, Copilot CLI, Goose, Amp, plus a **custom command** adapter for anything else).
2. **Connected**: the agent talks to the calendar through the bundled MCP server (Claude Desktop, Codex/ChatGPT desktop, any MCP client). The user starts the work.
3. **Portable**: any agent or chat LLM without local access (claude.ai, ChatGPT, Gemini app, Meta Muse, OpenAI dots, Instinct…) follows a public guide and returns a **gift package** (a single HTML file, a zip or plain text) that the user drops onto the door.
4. **Command-line/HTTP submission**: any local process can submit through `advent-agent submit` or the authenticated localhost API.

The setup screen shows honestly what each mode can do: whether it can be scheduled, how well the surprise is kept, and what kinds of gifts are possible.

## D7. Personalisation and surprise
- A launched agent runs with its working directory set to a private gift workspace. It still loads its own user-level memory and instructions (e.g. `~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md`, its own memory features), so it knows the user as it normally does. It does **not** browse the user's other project folders unless the user grants specific folders in Settings ("folders your agent may look at for inspiration", empty by default, read-only).
- The optional profile (hobbies, humour, dislikes, topics to avoid, language, accessibility, people or pets) is passed to every mode.
- Connected and portable modes: the agent is told not to describe the gift while making it, but tool calls stay visible in chat apps. The setup and preparation screens say so plainly ("you might glimpse the wrapping paper").

## D8. Chat-only LLMs are supported
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
  - The share mark's GitHub link points to `https://github.com/suchipizza/Advent-Agent`. The deskmenace.com link keeps `ref=aa-share`.
  - The early start for Day 1 and the finale also applies in connected and portable modes: door 1 accepts a gift before December 1, the finale from December 20. Neither can be revealed before its day.

