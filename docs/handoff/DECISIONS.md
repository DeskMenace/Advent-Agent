# Decisions (8 November 2026)

These override the product description, idea bank and design spec wherever they conflict. Add new decisions at the bottom with a date.

## D1. The agent never purchases or books
- No purchase gateway. No automatic checkout. No "preauthorized purchase" mode. The agent never pays for or books anything.
- The agent can research, compare, design, find real vendors and booking paths, and pre-fill a cart or form **only through tools the user already gave it**. It hands over a **purchase-ready proposal**: exact item or experience, vendor, URL, price with currency and the date it was checked, shipping or booking constraints, and a clear "what's left for you to do".
- Settings keep a **price ceiling for real-world suggestions** (per gift, optional season total; default: real-world suggestions on, ceiling unset = "keep it modest"). The calendar shows the user's own "I bought it" marks, which are optional and local only.
- The gift page never says "bought", "ordered" or "booked". It only says the agent prepared it.
- Website FAQ must state: *the agent never makes purchases* (see `DESK_MENACE_INTEGRATION.md`).

## D2. Idea library
- Source: `AI_Advent_Calendar_Gift_Idea_Bank.md`, 78 ideas in groups A–H. Not the 123-idea Appendix A.
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
