# Advent Agent — instructions for coding agents

Open-source, local-first advent calendar. The user's own AI agent makes the gift behind each door. Node companion + browser UI, run with `npx advent-agent`. MIT.

## Source of truth
`docs/handoff/DECISIONS.md` > other `docs/handoff/*` > `docs/spec/DESIGN_SPEC.md` (UI) > `docs/spec/AI_Advent_Calendar_Product_Description.md`. Never edit `docs/spec/*`. Record new decisions in `DECISIONS.md` with a date.

## Non-negotiables
- Full scope; no MVP framing. Anything not buildable goes in `docs/KNOWN_LIMITATIONS.md` with the reason.
- The agent never purchases or books. Nothing in the UI may claim it did.
- No API keys required. No telemetry, analytics, email capture or remote config.
- Generated gifts are untrusted: served only from the gift origin, in sandboxed iframes, never injected into the app DOM.
- Bind to 127.0.0.1; check Host and Origin; tokens never in logs, URLs (after exchange) or exports.
- No spoilers: unrevealed gift content, titles, types and previews never reach the UI or `/api/calendar`.
- Keep the mockup's look: wooden board, ribbon and bow, 4×6 envelopes, paper palette, flap animation. No dashboard aesthetics.
- Gary (gary.js, bundled locally) on the calendar page only.
- Verify third-party CLI flags against `--help` and record them in `docs/AGENT_COMPAT.md`.

## Commands
- `npm run dev`: companion + Vite UI with a demo home
- `npm test`: unit + integration · `npm run e2e`: Playwright · `npm run test:agents`: real agents (opt-in, costs tokens)
- `npm run library:index`: regenerate the idea index
- `npm run build && npm pack`: release check

## Working style
- Track work in `docs/PROGRESS.md`; tick an item only when its test passes.
- Small, reviewed commits. Run tests before every commit.
- Use the fake agent (`test/fake-agent`) for anything that would otherwise need a real agent.
