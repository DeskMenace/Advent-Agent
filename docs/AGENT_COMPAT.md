# Agent compatibility

Source of truth for the launched-mode adapter table. Flags marked **verified** were checked against the installed CLI's `--help` on the date given. Flags marked *unverified* come from the handoff's indicative table and are confirmed by the real-agent smoke test (`ADVENT_REAL_AGENTS=1 npm run test:agents`) when that CLI is found.

| Agent | Detect | Version seen | Non-interactive call | Permissions | Budget enforcement | Status |
|---|---|---|---|---|---|---|
| Claude Code | `claude --version` | 2.1.319 (8 Nov 2026) | `claude -p "<prompt>" --output-format stream-json --verbose --add-dir <workshop> --allowedTools <list> --permission-mode acceptEdits --permission-prompts none --max-budget-usd <usd> --no-session-persistence` | `--allowedTools Read Write Edit Glob Grep "Bash(advent-agent:*)"` plus `WebSearch WebFetch` when web research is allowed; `--permission-prompts none` denies anything else | `--max-budget-usd` (hard, print mode); token target advisory | **verified** flags; smoke test pending |
| Codex CLI | `codex --version` | codex-cli 0.142.5 (8 Nov 2026) | `codex exec --json --skip-git-repo-check -C <workspace> --sandbox workspace-write --add-dir <workshop> -o <last-message-file> "<prompt>"` | `--sandbox workspace-write` | none exposed → advisory | **verified** flags; smoke test pending |
| Gemini CLI | `gemini --version` | 0.49.0 (8 Nov 2026) | `gemini -p "<prompt>" --output-format json --skip-trust --approval-mode auto_edit --include-directories <workshop>` | `--approval-mode auto_edit` (edits only; shell commands are denied, so progress is reported through the HTTP API instead of the CLI) | none exposed → advisory | **verified** flags; smoke test pending |
| OpenCode | `opencode --version` | not installed | `opencode run "<prompt>"` | — | advisory | *unverified* |
| Cursor CLI | `cursor-agent --version` | not installed | `cursor-agent -p "<prompt>"` | — | advisory | *unverified* |
| GitHub Copilot CLI | `copilot --version` | not installed | `copilot -p "<prompt>"` | — | advisory | *unverified* |
| Goose | `goose --version` | not installed | `goose run -t "<prompt>"` | — | advisory | *unverified* |
| Amp | `amp --version` | not installed | `amp -x "<prompt>"` | — | advisory | *unverified* |
| Custom command | user-provided | — | template with `{prompt}`, `{prompt_file}`, `{workspace}`, `{door}`, `{workshop}`, `{day}` | user-defined (warning shown) | advisory | n/a |

## Smoke-test results

Run with `ADVENT_REAL_AGENTS=1 npm run test:agents` (rows below are appended by the test; the notes are written by hand).

### 8 November 2026 (morning run), macOS, Node 24.11.1: blocked by account state, not by the adapters

| Agent | Version | Outcome | What the CLI said | Adapter change |
|---|---|---|---|---|
| Claude Code | 2.1.319 | Started, read `BRIEF.md`, then stopped | `429 rate_limit` / `model_requires_usage_credits`: the account's weekly limit was reached and overage is disabled | none needed; the calendar now says "has reached a usage or rate limit" |
| Codex CLI | 0.142.5 | Stopped at the first request | `The 'gpt-5.4' model is not supported when using Codex with a ChatGPT account` (from `model = "gpt-5.4"` in `~/.codex/config.toml`) | none; the calendar does not override the user's model and now says "configured with a model your account cannot use" |
| Gemini CLI | 0.49.0 | Stopped at start | `Please set an Auth method …` (no login on this machine); also `Approval mode overridden to "default" because the current folder is not trusted` | **added `--skip-trust`** (verified in `--help`), otherwise edits would wait for approvals nobody can give |

Later the same day Claude Code's limit reset and it passed (row below). Each of the three was launched with the verified flags, received the brief and reached its model provider; none reached the gift-making stage, so the gate and render steps were not exercised with a real agent yet. Re-run once the accounts are usable:

```
ADVENT_REAL_AGENTS=1 npm run test:agents
ADVENT_REAL_AGENTS=1 ADVENT_REAL_AGENTS_ONLY=claude-code npm run test:agents
```

| Agent | Version | Date | Result | Phases | Kind | Duration | Usage | Command |
|---|---|---|---|---|---|---|---|---|
| Claude Code | 2.1.319 | 2026-11-08 | ready | making, testing, wrapping | interactive-html | 55s | ? tokens | `~/.local/bin/claude -p "Read BRIEF.md in the current folder and follow the gift-director skill." --output-format stream-json --verbose --no-session-` |
| Claude Code | 2.1.319 | 2026-11-08 | ready | wrapping | interactive-html | 110s | 369474 tokens, $0.505 | `~/.local/bin/claude -p "Read BRIEF.md in the current folder and follow the gift-director skill." --output-format stream-json --verbose --no-session-` |
| Claude Code | 2.1.329 | 2026-11-20 | ready | list, thinking, testing, wrapping | interactive-html | 402s | 966647 tokens, $2.990 (Fable 5.2, the default that day; the list check before it: 127150 tokens, $0.676) | `~/.local/bin/claude -p "Read doors/01/BRIEF.md and follow the gift-director skill. Work in that door's folder." --output-format stream-json --verbose --no-sessi` |
| Codex CLI | 0.167.0 | 2026-11-20 | ready | making, testing, wrapping | interactive-html | 597s | 2161995 tokens | `~/.nvm/versions/node/v24.11.1/bin/codex exec --json --skip-git-repo-check -C <workspace> |

### Checking the list (Claude Code), D31
`claude -p "<prompt>" --output-format stream-json --verbose --no-session-persistence --tools Read,Write,Glob,Grep --disable-slash-commands --strict-mcp-config --allowedTools Read Write Glob Grep --permission-mode acceptEdits --permission-prompts none --max-budget-usd <the user's spend limit>` (the flag is left out when the user chose "No limit", D36; it was a fixed 0.25 before 20 November). `--tools`, `--disable-slash-commands`, `--strict-mcp-config` and `--max-budget-usd` verified in `claude --help` (2.1.319). `--bare` is not used: it ignores OAuth, so subscription users could not log in. There is no `--max-turns` flag. Measured: 74k tokens, $0.13, 4 turns.
