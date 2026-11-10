# Contributing to Advent Agent

Welcome, and thank you. Advent Agent is a local-first advent calendar where the user's own terminal AI agent makes 24 gifts. The code is MIT (see `LICENSE`) and the gift library is CC BY 4.0 (see `gift-library/LICENSE`). By contributing you agree that your contribution is released under the licence of the part you change. Please also read `CODE_OF_CONDUCT.md` and `GOVERNANCE.md`.

## What we welcome

- **Agent adapters**: support for another terminal agent or a fix to an existing one.
- **Kit blocks**: building blocks in `workshop/kit/` that agents reuse in gifts.
- **Bug fixes.**
- **Docs and translations.**
- **Curated gift ideas** (see below).

For anything bigger than a small fix, open an issue first so we can agree on scope before you spend time.

## Gift ideas

The library is curated on purpose. Every entry costs tokens for every user every day, because agents read the index. So the library stays small, and we accept few ideas.

1. **Issue form first.** Propose your idea with the "Gift idea" issue form. Open a pull request only after the maintainer has accepted it.
2. **Format.** One Markdown file per idea in `gift-library/ideas/` (format in `gift-library/README.md` and `docs/handoff/GIFT_WORKSHOP.md` §4). Copy an existing file, for example `cp gift-library/ideas/magic-8-ball.md gift-library/ideas/my-new-idea.md`. The `id` is kebab-case and equals the file name; `family` and `skills` come from the lists in the README; `suitable_if` / `avoid_if` carry any conditional rule ("only if pet context exists"). Ideas in the `real-world` family are proposals: the recipient buys or books, never the agent.
3. **Status.** New entries land as `status: candidate`. Only the maintainer sets `approved`, after reviewing a real run in the gift lab.
4. **Credit.** Every entry credits its author with a `credit` front-matter field holding your GitHub handle without the `@` (for example `credit: mabel-w`). It is rendered as "idea by @handle" in the index.
5. Run `npm run library:index` to regenerate `gift-library/INDEX.json` and `INDEX.md` (CI runs `npm run library:index -- --check` and fails when they are stale), then `npx vitest run test/unit/library.test.ts`.

Ideas are inspiration, never a quota. Do not put anyone's real personal data in an idea; use invented names such as Mabel or Otto.

## Adding a launched-mode adapter

Launched mode starts a terminal agent headless. Each agent has an adapter in `src/adapters/<name>.ts` or registered in `src/adapters/index.ts`, implementing the `Adapter` interface from `src/adapters/types.ts` (`detect()`, `capabilities()`, `launch(ctx)`). Verify every CLI flag against the installed version's `--help` and record it in `docs/AGENT_COMPAT.md`; keep `verified: false` until you have. Add a contract test (see the Gemini launch-spec assertion in `test/unit/diagnose.test.ts` for the shape) that asserts the launch spec (command, args, prompt passing, budget flag when a cap is set) for a fixed `LaunchContext`, so a flag change cannot slip through unnoticed.

## Non-negotiables

These will not be merged, whatever the quality:

- **No telemetry and no network calls by the app.** No analytics, email capture, remote config or phoning home. (The user's own agent may use the network; the app does not.)
- **No purchasing or booking.** The agent never buys or books anything, and nothing in code, docs or ideas may claim or imply that it did.
- **No paid services by default.** No API keys required; nothing that needs a hosted service.
- **No demo gifts.** There is no user-facing demo; fixture gifts exist for developers and tests only.
- **No Electron.** The app is a Node companion plus a browser UI.
- **Credit and Gary stay upstream.** The Desk Menace credit and Gary are part of this project. Forks may remove them (see `TRADEMARKS.md`), but pull requests to this repository must not. Gary appears on the calendar page only; gift content and the idea library never feature him, and no Gary or Desk Menace artwork is added as a contribution.

Decisions live in `docs/handoff/DECISIONS.md`; if your change needs a new one, add it there with a date.

## Sign your commits (DCO)

We use the [Developer Certificate of Origin](https://developercertificate.org/). It is a short statement that you wrote your contribution, or have the right to submit it, under the project's licence. You agree to it by adding a `Signed-off-by` line to every commit:

```bash
git commit -s -m "Fix the thing"
```

This appends `Signed-off-by: Your Name <you@example.com>`, using your git `user.name` and `user.email`. A check on every pull request fails if a commit lacks it. To fix commits already made: `git rebase --signoff main` and force-push your branch.

## Running the tests

```bash
npm ci
npm run typecheck        # TypeScript
npm test                 # unit + integration (vitest)
npm run e2e              # Playwright; first run: npx playwright install chromium
npm run library:index    # regenerate the idea index; add -- --check to only verify
```

Use the fake agent (`test/fake-agent`) for anything that would otherwise need a real agent. `npm run dev` starts the companion and UI on a throwaway dev home with fixture gifts.

## The gift lab (optional)

If you change a gift idea, a kit block or the workshop skills, the maintainer will want to see a real run. The lab drives a real terminal agent end to end: `npm run lab -- <command>` (see `scripts/lab/cli.ts`), for example:

```bash
npm run lab -- make-gift --idea <id> --harness cc --model <model>
npm run lab -- make-gift --free --harness codex --model default
npm run lab -- report --serve
```

Harnesses are `cc` (Claude Code) and `codex`. Lab homes are created outside the repo, in `~/.advent-agent-lab`, and outputs go to `lab/out/` (gitignored). **The lab uses your own agent and costs real tokens.** It is optional: you do not need it to open a pull request, and you can say in the PR that the maintainer should run it. `npm run test:agents` is the similar opt-in test against real agents and also costs tokens.

## Pull requests

Keep them small and focused. Run `npm run typecheck`, `npm test` and, if you touched the idea library, `npm run library:index`. Update the docs. Fill in the checklist in the pull request template.
