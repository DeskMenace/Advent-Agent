# Changelog

All notable changes to Advent Agent. This project follows [Semantic Versioning](https://semver.org/).

## [1.0.0] (unreleased)

The first public release.

### The calendar
- Twenty-four envelopes on a wooden board; Door N unlocks on December N, in a timezone frozen for the season. Locked doors shake, they do not spoil.
- Your own terminal AI agent makes the gift behind each door: on demand when you open it, or on a schedule the night before. Progress is shown as spoiler-free phases.
- A season with a shape: Day 1 is wrapped during setup so it opens instantly, December 24 is the big one, missed doors wait.
- Gifts render in a sandboxed frame on a separate origin; every gift passes a quality gate (manifest, files, media decode, secret scan, optional headless test drive) before it is sealed.
- Share exports a picture or a short video with a privacy preview; Save gives the gift in its own format. Nothing is uploaded.

### Agents
- Launched terminal agents: Claude Code, Codex CLI and Gemini CLI (flags verified); OpenCode, Cursor CLI, Copilot CLI, Goose and Amp (built from documented flags, unverified); a custom-command adapter.
- `advent-agent submit` and the authenticated localhost API for local scripts.

### Knowing you
- "Checking the list": before Door 1, and again on December 8 and 15, one short run of your agent over copies of a few files the app chooses, capped at 64 KB. The list is on your computer, editable in Settings, and never exported.
- A persona picker: choose your agent, or one of your own personas; notes are signed with its name.
- One workspace per season, so the Secret Santa's own memory carries across doors.
- Gifts use one or two details, varied from gift to gift.

### Gifts
- The Gift Workshop: eight skills and vanilla JS building blocks for games, art, sound, stories and small tools.
- An idea library under CC BY 4.0, curated by the maintainer, with Day 1 and finale anchors and small collections.
- The gift package format (`gift@2`) with a published JSON schema.
- Gifts can offer a second life (a desktop version, a terminal command) in the note; nothing is installed unasked.

### Safety and privacy
- Binds to 127.0.0.1 with Host and Origin checks; no telemetry, no network calls of its own, no API keys required. The agent never buys or books anything.
- `advent-agent doctor` prints versions, agents, prerequisites and recent errors with paths and names redacted.
- See [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md) and [SECURITY.md](SECURITY.md).

### Governance
- MIT code, CC BY 4.0 gift library, [trademark policy](TRADEMARKS.md), [governance](GOVERNANCE.md), [contributing guide](CONTRIBUTING.md) with DCO sign-off, Contributor Covenant 2.1.
