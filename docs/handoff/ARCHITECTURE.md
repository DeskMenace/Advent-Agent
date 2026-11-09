# Architecture

Recommendations, not dogma. Deviate if there's a clear reason and record it in `DECISIONS.md`.

## 1. Shape

```
                 ┌───────────── user's agents ─────────────┐
 launched CLI ◄──┤ claude / codex / gemini / custom         │
                 └──────────────────────────────────────────┘
                                   │
                    advent-agent companion (Node)
   ┌───────────────┬───────────────┼────────────────┬───────────────┐
 Agent adapters  Job runner &   Gift intake &     Season store    Scheduler
 (spawn, MCP,    state machine  quality gate      (files, JSON)   (in-process +
  HTTP, CLI)                    (validate, seal)                   OS service)
                                   │
          127.0.0.1:4224  app origin  (calendar UI + /api)
          127.0.0.1:4225  gift origin (sandboxed gift content only)
```

## 2. Stack

- **Runtime**: Node ≥ 20 (test on 20, 22 and 24), TypeScript, ESM. Prefer packages without native dependencies; `npx` must work on macOS, Linux and Windows.
- **Server**: Hono (or bare `node:http`) on `127.0.0.1` only.
- **UI**: Vite + Preact (or vanilla TS) + plain CSS ported from the mockup. No component library or Tailwind look. Built assets ship inside the npm package.
- **Validation**: zod schemas shared by server and CLI.
- **Archive handling**: `yauzl` (or similar) with zip-slip and size-bomb protection.
- **Keychain** (Advanced only): `@napi-rs/keyring` as an *optional* dependency. If it's unavailable, keys are not stored and the UI explains why. Never fall back to plaintext.
- **Tests**: Vitest (unit and integration), Playwright (e2e; already a dev dependency, not a runtime dependency).

## 3. Processes and lifecycle

- `npx advent-agent` starts the companion if it isn't running, then opens `http://127.0.0.1:4224/?t=<one-time-token>`. The token is exchanged for an HttpOnly, SameSite=Strict session cookie, then stripped from the URL.
- Only one companion runs per user (lock file + pid; a second launch just opens the browser).
- **Scheduled mode** needs the companion running at preparation time. `advent-agent service install` registers a per-user login service (launchd LaunchAgent on macOS, systemd `--user` unit on Linux, Task Scheduler on Windows); `service uninstall` removes it. Setup offers this when the user picks scheduled mode, with plain-language consent.
- **Catch-up**: on start and on wake (detected through a clock jump), the scheduler finds missed preparations and runs them. The UI shows "prepared late at 08:12 because your computer was asleep", never a fake on-time run.

## 4. Storage

Data directory: `~/.advent-agent/` by default (override with `ADVENT_AGENT_HOME`; a separate home for demo and lab).

```
~/.advent-agent/
  config.json                 # non-secret settings, schemaVersion
  profile.json                # optional personalisation profile (name, language, avoid list, …)
  list.json                   # "the list" (D28): what the Secret Santa knows, editable in Settings
  personas/                   # text of a persona chosen with "Choose a file…" (D28)
  session.key                 # 0600; signs session cookies
  api.token                   # 0600; for CLI/HTTP submissions
  seasons/2026/
    season.json               # year, timeZone (frozen), unlockHour, mode, adapter
    workspace/                # ONE stable working folder per season (D28): every agent run starts here
      CLAUDE.md, AGENTS.md    # the chosen persona's text (only when a persona is set)
      list/                   # the "checking the list" task: TASK.md, list.md (copied sources are deleted afterwards)
      doors/07/               # one door's folder: BRIEF.md, brief.json, gift/ (deleted after sealing unless debug)
      doors/03/gift/          # read-only copies of earlier sealed gifts, for collections
    doors/07/
      state.json              # job + reveal state (see §5)
      gift/                   # sealed, validated package (read-only after seal)
      log.txt                 # private agent output; never sent to the UI
    history.jsonl             # concise gift records for continuity (D7)
    ledger.jsonl              # token/cost usage and "I bought it" marks
  lab/ ...                    # gift lab seasons (isolated)
  backups/
```

- Writes are atomic (temp file, fsync, rename). Every JSON file carries `schemaVersion`; migrations run at startup with a backup first.
- Export or backup writes a zip of seasons without the tokens, keys or logs. Import restores it.
- Deleting a season removes only `seasons/<year>/`.

## 5. Door state model

Keep separate: **eligibility** (computed from clock, timezone and unlockHour), **job state**, **readiness**, **reveal**.

```
jobState: not_requested → queued → preparing → (waiting_for_agent | waiting_for_drop | waiting_for_permission)
          → validating → ready | failed | cancelled
revealed: boolean + revealedAt   (set only when the user opens a READY gift)
```

- `waiting_for_agent`: submit mode; a local process has to submit the gift.
- `waiting_for_drop`: legacy (portable mode, removed in D28); old doors may still carry it.
- **Idempotency**: `POST /api/doors/:day/open` returns the existing job if there is one. Retry creates a new attempt number under the same door, and the previous workspace is archived, not merged.
- The UI envelope states from DESIGN_SPEC §4.4 are derived from this model.
- Eligibility is checked on the **server** for every door and gift request; direct URLs to future doors get the same lock response. Clock tampering is not defended against (DESIGN_SPEC §9.2); say so in the docs.
- Day rollover: the server sends events over SSE at the unlock boundary; the UI also rechecks on focus or visibility change.

## 6. HTTP API (app origin, localhost)

All mutating routes need the session cookie (UI) or a `Bearer api.token` (CLI), and all routes check `Host` (127.0.0.1/localhost only, which blocks DNS rebinding) and `Origin`.

```
GET  /api/calendar                    season, eligibility, door states (no gift content for unrevealed doors)
POST /api/doors/:day/open             start or return the job (eligible doors only)
GET  /api/doors/:day                  state; gift manifest only if revealed (or ready + opening now)
POST /api/doors/:day/retry | cancel
GET  /api/events                      SSE: state changes, day rollover (spoiler-free)
GET  /api/gifts                       revealed gifts (shelf); /api/archive/:season
POST /api/doors/:day/feedback         loved it / not my thing / too personal / note
POST /api/doors/:day/bought           user's own mark (D1)
GET/PUT /api/settings, /api/profile
POST /api/export, /api/import
```

Agent-facing (bearer token): `GET /api/agent/context?day=N`, `POST /api/agent/progress`, `POST /api/agent/submit`. These are the same operations as the CLIls in `AGENT_CONNECTIONS.md`.

## 7. Gift intake and quality gate

On every submission, from any mode:

1. Unpack into a quarantine folder. Reject path traversal, symlinks, more than 200 files, more than 200 MB total (configurable), and unknown executable types (`.exe`, `.sh`, `.app`, `.dll`… are stored as download-only with a warning, never run).
2. Parse and validate `gift.json` (or the embedded manifest, or build a manifest from loose files or text; see `AGENT_CONNECTIONS.md` §5).
3. Run per-type checks:
   - HTML: parses; local references exist; no remote script or style unless allowed; size limits.
   - Images: decode and dimensions.
   - Audio and video: container sniffing, plus an `ffprobe` decode check when available.
   - Text: non-empty, encoding.
   - Real-world proposals: required fields present.
   - Links: URL syntax, `https`, no credentials in the URL.
4. **Headless render check**: if Playwright's Chromium is available (it's a lazy optional install; Setup offers "enable gift test drive (~150 MB)"), load interactive gifts off-screen on the gift origin, catch console errors and failed requests, click the first focusable control, and take a private screenshot used as the shelf thumbnail. Without it, skip the step and record `verification.render = "skipped"`.
5. **Secret scan**: API-key patterns, the contents of `api.token`, keychain values, `.env`-style lines and absolute home paths. On a hit, reject and ask the agent to fix it (launched or connected mode) or show a warning (portable).
6. Seal: copy to `gift/`, compute SHA-256 for every file, write the server-side manifest with `verification` results, and mark the door `ready`.

The gate reports problems back to the agent as structured errors so it can fix and resubmit. The user only sees a spoiler-free "your Secret Santa is adding the finishing touches".

## 8. Gift rendering and sandbox

- Gift files are served **only** from the gift origin (`127.0.0.1:4225`), a different origin from the app.
- Interactive HTML runs in `<iframe sandbox="allow-scripts allow-pointer-lock allow-downloads">`. Never add `allow-same-origin` together with `allow-scripts`. Response headers on the gift origin: a strict CSP (`default-src 'self' data: blob:; connect-src 'none'; frame-ancestors http://127.0.0.1:4224`), no cookies, `Cross-Origin-Resource-Policy`.
- A per-gift capability lets the agent declare `network: ["https://…"]` (e.g. a map tile). The user sees "this gift wants to load content from X". If they decline, the gift renders without it.
- A renderer registry maps `kind`/MIME to a viewer: `interactive-html`, `image`, `audio`, `video`, `document` (text, markdown, PDF), `card` (SVG/PNG with print), `song` (Sound Studio score + render-it-yourself sheet), `real-world` (product/experience proposal), `link`, `download` (fallback). Unknown kinds fall back to a safe download or link view. New renderers register without touching the calendar.
- Agent text (title, note, description) is rendered as text, or as sanitised markdown (allow-list), never as raw HTML in the app origin.

## 9. Security checklist

- Bind to 127.0.0.1 only; check Host and Origin; CSRF protection through SameSite cookies plus Origin checks.
- Tokens are 0600 and never appear in URLs after the first exchange, logs or exports.
- Launched agents run with the least-privilege flags their CLI offers (see `AGENT_CONNECTIONS.md` §2). Never use "skip all permissions" flags by default. A user who opts into a more permissive mode for a given agent sees a clear warning.
- No silent install of third-party skills, packages or scripts. Bundled workshop code is versioned with the release. Agent-written code runs only inside the gift sandbox (browser) or the agent's own sandbox.
- Demo and lab use separate data homes and can never call real agents unless explicitly in lab mode.

## 10. Cross-platform

Windows path handling, spawn with `shell: false` and resolved executables, CRLF-safe parsing, and no reliance on `bash` for core features. CI matrix: macOS, Ubuntu and Windows × Node 20/22/24.
