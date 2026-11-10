# Threat model

Short and factual. Every claim names the file that implements it.

## What runs where

- **The headless agent** (the user's own Claude Code, Codex or Gemini CLI) is started by the companion for each door, with its working folder set to `<season>/workspace/doors/NN` (`src/core/paths.ts`). Launch flags and tool lists are in `src/adapters/index.ts`.
- **The app itself makes no network calls** of its own and has no telemetry, analytics or remote configuration. The one exception is opt-in: if the user configures the OpenAI-compatible image provider in Advanced settings, the companion calls that endpoint with the user's key (`src/providers/index.ts`). The CLI's `fetch` calls go to the local companion (`src/cli/client.ts`). The agent CLIs talk to their own vendors; that traffic is theirs, not the app's.
- **Companion**: binds to `127.0.0.1` (`src/server/companion.ts`). Every request to the app origin (port 4224) is checked for an allowed `Host` and, when present, an allowed `Origin` (`src/server/auth.ts`, `src/server/app.ts`). Login is a one-time token exchanged for an HttpOnly, SameSite=Strict cookie; CLI and HTTP submissions use a bearer `api.token`.
- **Gifts** are served from a separate origin and port (127.0.0.1:4225, `src/server/gift-origin.ts`), under per-process random tokens, with a strict Content-Security-Policy (`connect-src 'none'` unless the user consented to specific origins), `Cross-Origin-Resource-Policy: same-site`, `nosniff`, `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, no cookies, a Host check, and traversal checks (`src/intake/headers.ts`). The UI shows them only in iframes with `sandbox="allow-scripts allow-pointer-lock allow-downloads"` (no `allow-same-origin`), never injected into the app DOM (`ui/src/renderers/index.tsx`).
- Gifts pass a quality gate before they are sealed, including a secret scan and a check for network calls (`src/intake/gate.ts`, `src/intake/checks.ts`, `src/intake/secrets.ts`).

## Checking the list

The list check lets the Secret Santa learn about the user. The app, not the agent, chooses what may be read: `gatherSources` in `src/core/list.ts` copies an allow-list into the task folder, and the agent reads only the copies.

Read (copied):
- the global agent instruction file (`~/.claude/CLAUDE.md`, `~/.codex/AGENTS.md`, `~/.gemini/GEMINI.md`);
- per-project memory folders (`.md` and `.txt`, two levels deep) and per-project instruction files (`CLAUDE.md`, `AGENTS.md`);
- at most 40 files, 6 KB per file, 48 KB in total (`FILE_CAP`, `TOTAL_CAP`, `MAX_FILES`).

Never read:
- session transcripts, source code, `.env` files, keys and credentials, the calendar's own folder and the lab folder (`ownRoots`, `isOwnProject`, `isOwnFolder`);
- any file whose name matches `REFUSED_NAME` (`.env*`, `secret`, `credential`, `token`, `.pem`, `.key`, `id_rsa`, `.p12`, `keychain`, `password`);
- lines that look like secrets in the allowed files are replaced by a placeholder before copying (`cleanSourceText`, using the scanner in `src/intake/secrets.ts`).

Enforcement differs by agent. Claude Code is started with `--tools Read,Write,Glob,Grep`, no shell, no web, no extra folders, no skills or MCP servers (`src/adapters/index.ts`). Codex and Gemini cannot be restricted that way by a flag: the task instructions forbid reading elsewhere and the secret scan covers the copies, but it is advisory (`docs/KNOWN_LIMITATIONS.md`).

The resulting `list.json` stays on the user's computer and is skipped when a season is exported (`src/core/store.ts`).

## Persona

A persona is read-only from the persona's own project. Support files it points at are Markdown only, inside that folder, never dot-files or credentials, capped in size, and copied; nothing is ever written to the persona's project (`src/core/persona.ts`).

## What a gift may execute

- HTML and JavaScript run in the sandboxed iframe above, on an origin different from the app, with no network by default (CSP `connect-src 'none'`).
- "Tool" gifts are files the user chooses to download and run themselves. The app never executes them; files a gift marks `downloadOnly` are served as attachments, never inline (`src/server/gift-origin.ts`).

## What the agent can do

Tool allow-lists are in `src/adapters/index.ts`. For a door, Claude Code gets file read/write/edit and a short list of shell commands (`advent-agent`, `node`, `ls`, `cat`, `mkdir`, `cp`, `python3`, `npx`), plus web search only if the user turned web research on. Codex runs in its `workspace-write` sandbox and Gemini in `auto_edit` with shell denied, unless the user explicitly enabled the permissive mode. The agent never buys or books anything, and the UI never claims it did.

## Trust boundaries and residual risks

| Boundary | Protection | Residual risk |
|---|---|---|
| Web page in the user's browser to the companion | 127.0.0.1 bind, Host and Origin checks, session cookie, bearer token | Other local processes of the same user can read `api.token` |
| Gift content to the app | Separate origin and port, sandboxed iframe without `allow-same-origin`, CSP, CORP | A browser sandbox bug; gifts with user-consented network origins can send data to them |
| Agent to the user's files | Per-door workspace, tool allow-lists, Claude Code and Codex sandbox flags | The agent is the user's own and has the user's permissions; Gemini and permissive mode are not confined by the app |
| List check to private data | App-chosen allow-list, name refusal, secret-line removal, size caps | Instructions files can contain personal facts the user did not expect to share with their agent; non-Claude agents are only instructed |
| Gift content to the outside world (sharing) | Exports skip tokens and `list.json`; the secret scan runs on gifts | A gift the user shares may still contain what the user typed into it |
| Time | Date locks stop accidental spoilers | Changing the system clock opens doors early (not defended) |

## Not protected

- The user's own agent has the user's permissions. If it is compromised or misbehaves, Advent Agent cannot contain it.
- Anything that already runs as the user on the same computer.
- Third-party CLIs and the model providers behind them.
