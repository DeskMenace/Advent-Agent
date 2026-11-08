# Agent connections

Every mode delivers the same thing in the end: a **gift package** (§5) that goes through the same intake and quality gate. The calendar never makes gifts itself.

## 1. The four modes at a glance

| Mode | Who | Who starts the work | Scheduled? | Surprise kept? | Gift ceiling |
|---|---|---|---|---|---|
| **Launched** | Terminal agents installed on the computer | The calendar (when a door is opened, or on schedule) | Yes | Fully: output is hidden, only spoiler-free phases are shown | Full: games, audio, multi-file, web research |
| **Connected** | MCP clients: Claude Desktop, ChatGPT/Codex desktop, Cursor, any MCP host | The user ("open door 7") | No | Partly: the chat shows tool calls | Full, when the host can write files and run code |
| **Portable** | Chat LLMs and cloud agents: claude.ai, ChatGPT, Gemini app, Meta Muse, OpenAI dots, Instinct, … | The user pastes the request | No (though the agent can make it ahead of time) | Partly: the user can ask for it to be sent without looking | One self-contained HTML file, text, or a real-world proposal |
| **Submit** | Any local script, agent or automation | Whoever calls it | Whatever the caller can do | Up to the caller | Anything that fits the package format |

Plain-language versions of these rows go into the Setup screen, the README and the website FAQ.

## 2. Launched mode: adapters

The adapter interface is `detect() → {installed, version, path}`, `capabilities()`, `run(job) → events`, `cancel(job)`.

Each run:
1. Creates `doors/NN/workspace/` and writes `BRIEF.md` (the day's context, §4) into it.
2. Starts the CLI non-interactively with `cwd = workspace`, the prompt "Read BRIEF.md and follow the gift-director skill", read access to the bundled workshop folder, and write access to the workspace only.
3. Captures stdout and stderr to the private `log.txt`. Parses structured output when the CLI provides it (token and cost usage).
4. The agent reports progress with `advent-agent progress <phase>`. Phases come from a fixed spoiler-free set: `thinking`, `making`, `testing`, `wrapping`. It submits with `advent-agent submit ./gift --day N` (or the adapter submits `./gift` when the process exits).
5. Enforces the timeout (default 20 min, configurable) and the token budget where the CLI supports a limit (otherwise the budget is advisory, and the UI labels it that way).

Initial adapter table. **Verify every flag against the installed version's `--help` before relying on it.**

| Agent | Detect | Non-interactive call (indicative) | Permissions approach | Its own memory loads? |
|---|---|---|---|---|
| Claude Code | `claude --version` | `claude -p "<prompt>" --output-format stream-json --verbose --max-turns N --add-dir <workshop>` | `--allowedTools` limited to Read/Write/Edit/Glob/Grep, `Bash(advent-agent:*)`, plus WebSearch/WebFetch if web is allowed | Yes (`~/.claude/CLAUDE.md`, memory) |
| Codex CLI | `codex --version` | `codex exec --json --skip-git-repo-check -C <workspace> "<prompt>"` | `--sandbox workspace-write` | Yes (`~/.codex/AGENTS.md`) |
| Gemini CLI | `gemini --version` | `gemini -p "<prompt>" --output-format json` | approval mode limited to edits, plus the include-directories flag for the workshop | Yes (`~/.gemini/GEMINI.md`) |
| Muse Code (Meta) | check binary name and headless support | verify; if there's no headless mode, mark it "connected/portable only" | verify | verify |
| OpenCode | `opencode --version` | `opencode run "<prompt>"` | verify | verify |
| Cursor CLI | `cursor-agent --version` | `cursor-agent -p "<prompt>"` | verify | verify |
| GitHub Copilot CLI | `copilot --version` | `copilot -p "<prompt>"` | verify | verify |
| Goose | `goose --version` | `goose run -t "<prompt>"` | verify | verify |
| Amp | `amp --version` | `amp -x "<prompt>"` | verify | verify |
| **Custom command** | user-provided | template with `{prompt}`, `{prompt_file}`, `{workspace}`, `{workshop}`, `{day}` | user-defined; shown with a warning | n/a |

For any agent not in the table, the custom command adapter is the escape hatch. Contributors add first-class adapters through PRs (`src/adapters/<name>.ts` plus a contract test).

## 3. Connected mode: MCP server

`advent-agent mcp` (stdio). Setup shows copy-paste config for Claude Desktop, ChatGPT/Codex desktop, Cursor and others, and offers "add it for me" for known config files (it shows a diff and asks before writing).

Tools (names final unless there's a reason to change them):

| Tool | Purpose |
|---|---|
| `get_calendar_context(day?)` | The §4 brief as JSON. With no `day`: the earliest eligible door that is unopened and waiting for an agent |
| `list_workshop()` / `read_workshop_guide(skill, file?)` | Skill index, then the full skill text on demand (keeps tokens low) |
| `list_ideas(filter?)` / `read_idea(id)` | Idea library index (id, title, summary, suitable_if), then the full entry |
| `start_gift(day)` | Creates the workspace, returns its absolute path (for hosts that can write files), marks the door `preparing` |
| `report_progress(day, phase)` | Spoiler-free phase |
| `check_gift(day, path?)` | Runs the quality gate without sealing; returns structured problems |
| `submit_gift(day, path?)` or `submit_gift(day, files[])` | Seals the gift. The inline `files[]` (name + base64 or text) is for hosts that can't write to disk |

There are no purchase tools. MCP resources expose the same guides for hosts that prefer resources.

The tool descriptions and the gift-director skill tell the agent: *don't describe the gift in chat; say "Your gift is wrapped. Open door N in your calendar."*

Preparation screen in this mode: "Your Secret Santa works when you call them. Tell your agent: **Open door 7 of my Advent Agent calendar.**" (with a copy button), plus a live state update when `start_gift` arrives.

## 4. The day brief (all modes)

```
season, day, date, locale, language, timeZone
recipient profile (optional, user-approved fields only)
history: concise records of previous gifts (title, medium, motifs, feedback) - never unrevealed future gifts
budgets: token target (default 25k, advisory unless enforced), real-world price ceiling, "agent never purchases" rule
permissions: web research allowed?, folders allowed for inspiration (read-only), external network in gifts allowed?
capabilities: what the calendar can render (renderer list), what the workshop offers
mode notes: e.g. "nobody will see your output except the final gift", or for portable: "produce a single self-contained HTML file"
library pointer: how to list or read ideas (optional use)
package format + how to check/submit
```

## 5. Gift package format (universal contract)

The calendar accepts any of these:

**A. Folder or zip**
```
gift.json        required manifest
index.html       optional main interactive page
assets/…         images, audio, video, fonts, data
```

**B. Single HTML file** (best for chat LLMs). The manifest is embedded:
```html
<script type="application/advent-gift+json">{ "schema": "advent-agent/gift@1", "day": 7, … }</script>
```
If the manifest is missing, the calendar asks the user for the day and treats the file as an `interactive-html` gift titled from `<title>`.

**C. Plain text or markdown paste.** Rendered as a letter, poem or story on paper. A first-line `# Title` becomes the title.

**D. Loose media files** (image, audio, video, PDF), dropped together. The calendar creates a minimal manifest and asks the user for nothing more than the day.

`gift.json` (agent-authored; untrusted):
```jsonc
{
  "schema": "advent-agent/gift@1",
  "day": 7,
  "title": "The Snow Globe of Small Victories",
  "category": "Interactive toy",          // shown after reveal only
  "subtitle": "Shake gently.",
  "note": "…the agent's card to the recipient: what it is, why I chose it, how to enjoy it…",
  "primary": "index.html",
  "artifacts": [
    { "path": "index.html", "kind": "interactive-html", "title": "Snow globe" },
    { "path": "assets/globe.png", "kind": "image", "role": "download", "alt": "…" }
  ],
  "song": { "score": "assets/score.json", "renderSheet": "assets/render-it-yourself.md" },     // optional
  "realWorld": {                                                                                // optional (D1)
    "items": [{ "name": "…", "vendor": "…", "url": "https://…", "price": 34.9, "currency": "CHF",
                "checkedAt": "2026-12-07", "notes": "ships in 3–5 days" }],
    "whatsLeft": "Click the link, choose size M, pay. Nothing has been ordered."
  },
  "links": [{ "label": "Open the hut's booking page", "url": "https://…" }],
  "network": [],                        // origins the gift wants to load (user consents)
  "incomplete": [],                     // honest list of what isn't done
  "continuity": { "thread": "pixel-egg", "motifs": ["egg", "snow"] },
  "agent": { "name": "Claude Code" },
  "usage": { "tokens": 18400 }
}
```
The JSON Schema ships as `schema/gift.schema.json` and is published so any agent can follow it.

## 6. Portable mode: the public guide

- `AGENT_GUIDE.md` sits at the repo root, readable by URL (GitHub raw, later also `deskmenace.com/advent/agent-guide`). It's a compact version of the gift-director skill for agents with no local tools: the package format (B and C), the self-contained HTML rules (inline everything, no network), the Sound Studio score format plus a tiny inline player snippet, quality self-checks, the honesty rules and the "don't describe it while making it" rule.
- The preparation screen in portable mode shows a **copyable request**: today's date, door number, the optional profile summary (only fields the user allowed), recent gift titles, a link to the guide, and "send me the result as one HTML file attached, or as text. Don't show me a preview."
- A drop zone and paste box sit on the door's preparation screen and on the gift shelf ("add a gift for door N").
- Cloud agents (dots, Instinct, Meta Muse…) can't reach localhost. The user forwards the attachment or text. Document this honestly.

## 7. CLI (also used by agents)

```
advent-agent                         start + open calendar
advent-agent setup | settings        open the wizard / settings in the browser
advent-agent status                  season and door states (no spoilers)
advent-agent context --day N         print the day brief (JSON)
advent-agent check <path> [--day N]  run the quality gate, no sealing
advent-agent submit <path> --day N   submit a gift (zip, folder, html, file, text)
advent-agent progress <phase>        report a phase (uses ADVENT_AGENT_JOB env from the launcher)
advent-agent mcp                     MCP server (stdio)
advent-agent service install|uninstall|status
advent-agent demo                    demo season with fixture gifts (isolated home)
advent-agent lab …                   gift lab (TEST_PLAN.md §6)
advent-agent export|import|backup
advent-agent doctor                  detect agents, check ports, permissions, optional Chromium/ffprobe
```

## 8. Optional skill installation (connected-mode comfort)

Launched agents don't need anything installed: they read the bundled workshop through the path given in the brief. For connected hosts that support Agent Skills (agentskills.io convention), Settings offers "Install the Advent Agent skills into <agent>". It shows the target folder and files, asks for consent, and uninstalls cleanly (it removes only its own folder). Never install automatically.
