# Agent compatibility

Source of truth for the launched-mode adapter table. Flags marked **verified** were checked against the installed CLI's `--help` on the date given. Flags marked *unverified* come from the handoff's indicative table and are confirmed by the real-agent smoke test (`ADVENT_REAL_AGENTS=1 npm run test:agents`) when that CLI is found.

| Agent | Detect | Version seen | Non-interactive call | Permissions | Budget enforcement | Status |
|---|---|---|---|---|---|---|
| Claude Code | `claude --version` | 2.1.319 (8 Nov 2026) | `claude -p "<prompt>" --output-format stream-json --verbose --add-dir <workshop> --allowedTools <list> --permission-mode acceptEdits --permission-prompts none --max-budget-usd <usd> --no-session-persistence` | `--allowedTools Read Write Edit Glob Grep "Bash(advent-agent:*)"` plus `WebSearch WebFetch` when web research is allowed; `--permission-prompts none` denies anything else | `--max-budget-usd` (hard, print mode); token target advisory | **verified** flags; smoke test pending |
| Codex CLI | `codex --version` | codex-cli 0.142.5 (8 Nov 2026) | `codex exec --json --skip-git-repo-check -C <workspace> --sandbox workspace-write --add-dir <workshop> -o <last-message-file> "<prompt>"` | `--sandbox workspace-write` | none exposed → advisory | **verified** flags; smoke test pending |
| Gemini CLI | `gemini --version` | 0.49.0 (8 Nov 2026) | `gemini -p "<prompt>" --output-format json --approval-mode auto_edit --include-directories <workshop>` | `--approval-mode auto_edit` (edits only; shell commands are denied, so progress is reported through the HTTP API instead of the CLI) | none exposed → advisory | **verified** flags; smoke test pending |
| OpenCode | `opencode --version` | not installed | `opencode run "<prompt>"` | — | advisory | *unverified* |
| Cursor CLI | `cursor-agent --version` | not installed | `cursor-agent -p "<prompt>"` | — | advisory | *unverified* |
| GitHub Copilot CLI | `copilot --version` | not installed | `copilot -p "<prompt>"` | — | advisory | *unverified* |
| Goose | `goose --version` | not installed | `goose run -t "<prompt>"` | — | advisory | *unverified* |
| Amp | `amp --version` | not installed | `amp -x "<prompt>"` | — | advisory | *unverified* |
| Muse Code (Meta) | `muse --version` | not installed | no headless mode confirmed | — | — | *unverified*: offered as connected/portable only until verified |
| Custom command | user-provided | — | template with `{prompt}`, `{prompt_file}`, `{workspace}`, `{workshop}`, `{day}` | user-defined (warning shown) | advisory | n/a |

## Smoke-test results

_(filled by `npm run test:agents`)_
