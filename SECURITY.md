# Security policy

## Reporting a vulnerability

Please report security problems **privately** through GitHub's private vulnerability reporting:

https://github.com/DeskMenace/Advent-Agent/security/advisories/new

There is no security email address. Please do not open a public issue or discussion for a vulnerability, and do not include real API keys or personal files in a report; a minimal reproduction with invented data is enough.

## Supported versions

Only the latest 1.x release is supported. Fixes are released as a new patch or minor version of that line.

## Scope

In scope:

- A gift escaping its sandbox: running outside its iframe, reading the app origin, reaching the network without the user's consent, or touching files.
- The localhost servers: bypassing the Host or Origin checks, DNS rebinding, cross-site requests that reach the API, or binding to anything other than 127.0.0.1.
- Token leaks: the API token, login tokens or session key appearing in logs, URLs after exchange, exports or gift content.
- Path traversal or zip-slip in gift serving, gift import, or exports.
- The list check ("checking the list") reading files it must not read, or copying secrets into what the agent sees.
- Spoilers: unrevealed gift content reaching the UI or `/api/calendar` before its door opens.

Not in scope:

- The user's own AI agent misbehaving. It runs with the user's own permissions and settings (see `docs/THREAT_MODEL.md`).
- Vulnerabilities in third-party CLIs (Claude Code, Codex, Gemini CLI and others) or in model output. Please report those to their vendors.
- Someone who already controls the user's computer or account.
- Changing the computer's clock to open doors early (documented in `docs/KNOWN_LIMITATIONS.md`).

## What to expect

Advent Agent is a small, seasonal, volunteer-run project. I aim to acknowledge a report within about a week and to fix confirmed issues quickly, but responses may be slower outside the November-December season. You will be credited in the advisory if you wish.

## Safe harbour

If you act in good faith, stay within the scope above, avoid harming other people's data or systems, and give a reasonable time to fix the issue before disclosing it, I will not pursue legal action over your research.
