# Contributing to Advent Agent

Thanks for helping. Advent Agent is MIT-licensed (see `LICENSE`); by contributing you agree that your contribution is released under the same licence.

## Ground rules

- The agent never purchases or books anything. Nothing in code, docs or ideas may claim or imply that it did.
- No API keys required, no telemetry, no analytics, no remote config.
- Decisions live in `docs/handoff/DECISIONS.md`; if your change needs a new one, add it there with a date.
- Run `npm run typecheck` and `npm test` before opening a pull request.

## Adding a gift idea

The idea library lives in `gift-library/ideas/`, one Markdown file per idea (format in `gift-library/README.md` and `docs/handoff/GIFT_WORKSHOP.md` §4).

1. Copy an existing file, for example `cp gift-library/ideas/fortune-cookie.md gift-library/ideas/my-new-idea.md`, and edit it. The `id` must be kebab-case and equal to the file name; `group` is A–H; `skills` come from the workshop skills; `suitable_if` / `avoid_if` must carry any conditional rule ("only if pet context exists").
2. Run `npm run library:index` to regenerate `gift-library/INDEX.json` and `INDEX.md` (CI runs `npm run library:index -- --check` and fails when they are stale).
3. Run `npx vitest run test/unit/library.test.ts`.
4. Open a pull request with `status: candidate`. The maintainer flips it to `approved` after reviewing a real run in the gift lab.

Ideas are inspiration, never a quota. Keep real-world ideas (`real_world: suggest`) as proposals: the recipient buys or books.

## Adding a launched-mode adapter

Launched mode starts a terminal agent headless. Each agent has an adapter in `src/adapters/<name>.ts` implementing the `Adapter` interface from `src/adapters/types.ts` (`detect()`, `capabilities()`, `launch(ctx)`), registered in `src/adapters/index.ts`. Verify every CLI flag against the installed version's `--help` and record it in `docs/AGENT_COMPAT.md`; mark `verified: false` until you have. Add a contract test next to the existing adapter tests that asserts the launch spec (command, args, prompt passing, budget flag when a cap is set) for a fixed `LaunchContext`, so a flag change cannot slip through unnoticed.

## Not accepted

- Gary artwork, sprites or any Desk Menace assets. Gary is a bundled dependency and appears on the calendar page only; the idea library and gift content must never feature him.
- Features that purchase, book, collect emails, phone home or need a hosted service.
