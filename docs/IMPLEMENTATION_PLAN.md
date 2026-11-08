# Implementation plan

Order of work for Advent Agent. Each step ends with its tests green and a commit. Decisions that deviate from the handoff are recorded in `docs/handoff/DECISIONS.md`.

## Verified facts (8 Nov 2026, this machine)

| Item | Verified value |
|---|---|
| Node | 24.11.1 (targets 20/22/24 in CI) |
| Claude Code | 2.1.319 · `claude -p --output-format stream-json --verbose --allowedTools … --add-dir … --max-budget-usd` (no `--max-turns`; budget enforced through `--max-budget-usd` in print mode) · `--permission-mode` choices: acceptEdits, auto, bypassPermissions, manual, dontAsk, plan · `--permission-prompts none` denies anything that would prompt |
| Codex CLI | 0.142.5 · `codex exec --json --skip-git-repo-check -C <dir> --sandbox workspace-write --add-dir <dir> -o <file> "<prompt>"` (no token-limit flag: budget advisory) |
| Gemini CLI | 0.49.0 · `gemini -p "<prompt>" --output-format json --approval-mode auto_edit --include-directories <dir>` (no token-limit flag: budget advisory) |
| OpenCode, Cursor CLI, Copilot CLI, Goose, Amp, Muse | not installed here: adapters ship with the handoff's indicative flags marked **unverified** in `docs/AGENT_COMPAT.md`; the smoke test records them when found |
| gary.js | 0.2.0 on npm, 7.0 MB of Gary assets + 356 KB engine. Served from the installed package at runtime (never a CDN). `menu.credit`, `position`, `enabled`, `dropTo`, `surfaces`, `limits` confirmed in `docs/configuration.md` |
| MCP SDK | `@modelcontextprotocol/sdk` 1.32.x (`server/mcp.js`, `server/stdio.js`, zod ≥ 3.25 / 4) |
| Playwright | `playwright-core` 1.65 has `install chromium` / `chromium-headless-shell`; a system Chrome is usable via `channel: 'chrome'` |
| ffprobe | available at `/opt/homebrew/bin/ffprobe` here; optional at runtime |
| Agent config files | Claude Desktop `~/Library/Application Support/Claude/claude_desktop_config.json` (`mcpServers`); Codex `~/.codex/config.toml` (`[mcp_servers.*]`); Gemini `~/.gemini/settings.json` (`mcpServers`); Cursor `~/.cursor/mcp.json` |
| Skills folders | `~/.claude/skills`, `~/.codex/skills`, `~/.gemini/skills` (also `gemini skills link <path>`), `~/.agents/skills` (shared convention) |

## Stack (ARCHITECTURE §2, confirmed)

TypeScript (5.x), ESM, Node ≥ 20 · Hono 4 + `@hono/node-server` · Preact 10 + Vite 7, plain CSS ported from the mockup · zod 4 (shared schemas) · `@modelcontextprotocol/sdk` 1.32 · `yauzl` 3 (read) + `yazl` 3 (write) · `playwright-core` (runtime, lazy browser) · `@napi-rs/keyring` (optional) · Vitest 5 · `@playwright/test` 1.65 + `@axe-core/playwright`.

## Steps

### 0. Repo skeleton and docs (this step)
- Copy handoff + spec, `CLAUDE.md`, `PROGRESS.md`, `IMPLEMENTATION_PLAN.md`, `KNOWN_LIMITATIONS.md` (empty), `AGENT_COMPAT.md` (verified table above).
- `package.json`, tsconfig, vitest, playwright, vite configs, CI workflow (macOS/Ubuntu/Windows × Node 20/22/24), `.gitignore`.

### 1. Shared contracts (`src/shared/`)
- zod schemas: `gift.json` manifest (AGENT_CONNECTIONS §5), door state, season, config, profile, settings, idea frontmatter, promo, API responses (spoiler-free projections).
- `schema/gift.schema.json` generated from zod; test keeps it in sync (U3.6).
- Renderer kinds enum + registry contract (D5).

### 2. Core (`src/core/`)
- `time/`: IANA wall-clock helpers (no deps), eligibility, countdown, next unlock (U1.*).
- `storage/`: home dir, atomic JSON writes, schemaVersion + migrations with backup, lock file, tokens (0600), export/import without secrets (U5.*).
- `doors/`: state machine, attempts, idempotent open, retry archive, cancel, recovery (U2.*).
- `season/`: create/freeze timezone, archive, history.jsonl, ledger.jsonl.
- `promo/`: slip visibility rules (U7.*).
- `brief/`: day brief builder (AGENT_CONNECTIONS §4), profile allow-list, history projection (D8).

### 3. Intake and quality gate (`src/intake/`)
- Unpack (zip/folder/html/text/loose) into quarantine with zip-slip, symlink, count/size, executable rules (U4.1–U4.5).
- Manifest parse for forms A–D (U3.*). Per-type checks (HTML refs, image decode via header parsing, audio/video sniff + optional ffprobe, text, real-world fields, links https).
- Secret scanner (U4.6). Agent text sanitiser: markdown allow-list → Preact nodes (U4.7).
- Render check with `playwright-core` when a browser is available; otherwise `verification.render = "skipped"`.
- Seal: SHA-256 per file, server manifest with `verification`, door → ready. Structured error report for agents.

### 4. Server (`src/server/`)
- Two Hono apps: app origin 4224 (UI + `/api`), gift origin 4225 (sealed files only, strict CSP, no cookies, CORP).
- Auth: one-time token → HttpOnly SameSite=Strict cookie signed with `session.key`; `Bearer api.token` for CLI/MCP; Host + Origin checks (I3.*).
- Routes from ARCHITECTURE §6; SSE events; spoiler-free projections enforced in one place (I1.6).
- Static UI serving from `dist/ui`.

### 5. Agent adapters and job runner (`src/adapters/`, `src/jobs/`)
- Adapter interface; Claude Code, Codex, Gemini (verified flags), OpenCode, Cursor, Copilot, Goose, Amp, Muse (indicative, unverified-marked), custom command.
- Runner: workspace + `BRIEF.md`, spawn `shell:false`, log capture to `log.txt`, timeout, usage parsing, auto-submit `./gift` on exit, structured gate errors fed back (one retry round).
- Fake agent (`test/fake-agent/`) and launched-mode integration tests (I1.*).
- Scheduler: in-process timer + catch-up on start/wake (clock-jump detection), honest `preparedLate` (I4.*).
- Service install: plist / systemd unit / schtasks XML generation + install/uninstall/status (I5.*).

### 6. CLI (`src/cli/`)
All commands in AGENT_CONNECTIONS §7: start/open, setup, settings, status, context, check, submit, progress, mcp, service, demo, lab, export, import, backup, doctor. First-run dim credit line.

### 7. MCP server (`src/mcp/`)
Tools and resources from AGENT_CONNECTIONS §3 over the local API; starts the companion if needed (I2.*). Copy-paste configs + "add it for me" with diff and consent for Claude Desktop, Codex, Gemini, Cursor. Optional skill installation (§8).

### 8. Workshop (`workshop/`)
- Skills (Agent Skills format): gift-director, storyteller, arcade, art-studio, sound-studio, maker, concierge, quality-and-packaging, each with `examples/` (great vs lazy) and `references/`.
- Kit (vanilla, inlineable, tested): arcade, art, sound (score format, synth/music-box, player, WAV export, speechSynthesis singing, soundscapes), story, maker, templates (video→WebM, slides, card, poster/wallpaper, zine, trading card, real-world proposal, IOU coupon).
- `AGENT_GUIDE.md` at the repo root (portable mode).

### 9. Idea library (`gift-library/`)
- Script converts the bank into 78 idea files (one format, GIFT_WORKSHOP §4); `npm run library:index` builds `INDEX.json`/`INDEX.md`; tests U6.*; `CONTRIBUTING.md`.

### 10. UI (`ui/`)
- Routes: `/` calendar, `/setup`, `/settings`, `/door/:day` (preparation), `/gift/:season/:day`, `/gifts` (shelf), `/archive/:season`, `/demo`, `/lab/review`.
- Calendar board ported from the mockup (CSS, bow SVG, 24 patterns, flap/letter animation, locked shake, toast + live region), status panel, Gary (calendar only, local assets, seasonal lines, reduced-motion hide, setting, send-home per day).
- Preparation screen per mode (launched phases, connected copy button, portable copyable request + drop zone + paste box), permission/network consent, retry/cancel, honest late status.
- Gift page: eyebrow, title, artifact frame, renderer registry (10 kinds + fallback), note, actions (download/print/share with privacy preview and share mark), feedback, "I bought it", prev/next with eligibility, voucher slip.
- Setup wizard (mode table with honest capabilities, agent detection, timezone, unlockHour, delivery mode, service consent, profile, folders, price ceiling, test drive, advanced providers).
- Settings, shelf, archive, demo mode (isolated home, day slider), lab review form.

### 11. Demo, lab and fixtures
- `advent-agent demo`: isolated home with fixture gifts for every renderer kind (built by `scripts/build-fixtures.ts`), day slider.
- `advent-agent lab`: isolated home, all doors unlocked, real agents allowed, `review` sheet → `docs/lab-reviews/<date>.md`, approve → idea `status`.

### 12. E2E, a11y, layouts, packaging
- Playwright suites E1–E9 against demo/fixture homes; axe; snapshots at 5 widths + 200 % zoom.
- `npm pack` test in a temp dir; size budget.

### 13. Release prep
- README (GIF recorded from the demo with fixture content), THIRD_PARTY.md (gary.js MIT + Gary Asset Licence), FAQ items, `AGENT_COMPAT.md` final, `KNOWN_LIMITATIONS.md` final, version 1.0.0. Publishing is Noémie's call.

## Parallelisation
Steps 8 and 9 are content-heavy and independent of the server; they run as delegated tasks against the contracts fixed in step 1 while steps 2–7 are built. Step 10 starts once step 4's API is stable.
