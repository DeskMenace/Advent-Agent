# Agent connections

Every mode delivers the same thing in the end: a **gift package** (§4) that goes through the same intake and quality gate. The calendar never makes gifts itself.

## 1. Launched agents (D28)

Supported agents are **terminal agents launched by the calendar**: Claude Code, Codex, Gemini CLI, OpenCode, Cursor CLI, Copilot CLI, Goose, Amp, plus the custom command adapter. Chat apps (copy-paste mode, MCP desktop clients) are not supported (D28 supersedes D6.2, D6.3 and D8).

| | Launched | Submit (any local process) |
|---|---|---|
| Who starts the work | The calendar, when a door is opened or on schedule | Whoever calls `advent-agent submit` or the localhost API |
| Scheduled? | Yes | Whatever the caller can do |
| Surprise kept? | Fully: output is hidden, only spoiler-free phases are shown | Up to the caller |

"Submit" is not a connection the user picks in the UI: it is how launched agents hand in their gift, and it stays open to any local process with the API token.

## 2. Launched mode: adapters

The adapter interface is `detect() → {installed, version, path}`, `capabilities()`, `run(job) → events`, `cancel(job)`.

Each run:
1. Uses one stable **season workspace**, `seasons/<year>/workspace/`, with the door as a subfolder (`doors/NN/`), and writes `BRIEF.md` (the day's context, §4) into the door's folder. Earlier doors' sealed gifts are copied read-only into `doors/MM/gift/` so collections can build on them. The chosen persona, if any, is kept as `CLAUDE.md` and `AGENTS.md` at the workspace root.
2. Starts the CLI non-interactively with `cwd = the season workspace` (one Claude Code project per season, so the Secret Santa's own project memory carries across doors), the prompt "Read doors/NN/BRIEF.md and follow the gift-director skill", read access to the bundled workshop folder, and write access to the workspace only.
3. Captures stdout and stderr to the private `log.txt`. Parses structured output when the CLI provides it (token and cost usage).
4. The agent reports progress with `advent-agent progress <phase>`. Phases come from a fixed spoiler-free set: `thinking`, `making`, `testing`, `wrapping`. It submits with `advent-agent submit ./doors/NN/gift --day N` (or the calendar submits that folder when the process exits).
5. Enforces the timeout (default 20 min, configurable) and the token budget where the CLI supports a limit (otherwise the budget is advisory, and the UI labels it that way).

Initial adapter table. **Verify every flag against the installed version's `--help` before relying on it.**

| Agent | Detect | Non-interactive call (indicative) | Permissions approach | Its own memory loads? |
|---|---|---|---|---|
| Claude Code | `claude --version` | `claude -p "<prompt>" --output-format stream-json --verbose --max-turns N --add-dir <workshop>` | `--allowedTools` limited to Read/Write/Edit/Glob/Grep, `Bash(advent-agent:*)`, plus WebSearch/WebFetch if web is allowed | Yes (`~/.claude/CLAUDE.md`, memory) |
| Codex CLI | `codex --version` | `codex exec --json --skip-git-repo-check -C <workspace> "<prompt>"` | `--sandbox workspace-write` | Yes (`~/.codex/AGENTS.md`) |
| Gemini CLI | `gemini --version` | `gemini -p "<prompt>" --output-format json` | approval mode limited to edits, plus the include-directories flag for the workshop | Yes (`~/.gemini/GEMINI.md`) |
| OpenCode | `opencode --version` | `opencode run "<prompt>"` | verify | verify |
| Cursor CLI | `cursor-agent --version` | `cursor-agent -p "<prompt>"` | verify | verify |
| GitHub Copilot CLI | `copilot --version` | `copilot -p "<prompt>"` | verify | verify |
| Goose | `goose --version` | `goose run -t "<prompt>"` | verify | verify |
| Amp | `amp --version` | `amp -x "<prompt>"` | verify | verify |
| **Custom command** | user-provided | template with `{prompt}`, `{prompt_file}`, `{workspace}` (the start folder), `{door}` (this door's folder), `{workshop}`, `{day}` | user-defined; shown with a warning | n/a |

For any agent not in the table, the custom command adapter is the escape hatch. Contributors add first-class adapters through PRs (`src/adapters/<name>.ts` plus a contract test).

## 3. The day brief

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

## 4. Gift package format (universal contract)

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

## 5. CLI (also used by agents)

```
advent-agent                         start + open calendar
advent-agent setup | settings        open the wizard / settings in the browser
advent-agent status                  season and door states (no spoilers)
advent-agent context --day N         print the day brief (JSON)
advent-agent check <path> [--day N]  run the quality gate, no sealing
advent-agent submit <path> --day N   submit a gift (zip, folder, html, file, text)
advent-agent progress <phase>        report a phase (uses ADVENT_AGENT_JOB env from the launcher)
advent-agent service install|uninstall|status
advent-agent lab …                   gift lab (TEST_PLAN.md §6)
advent-agent export|import|backup
advent-agent doctor                  detect agents, check ports, permissions, optional Chromium/ffprobe
```
