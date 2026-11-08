# Known limitations

Things that could not be built or verified as specified, with the reason. Nothing is left out quietly.

| Item | Status | Reason / what exists instead |
|---|---|---|
| Adapters for OpenCode, Cursor CLI, GitHub Copilot CLI, Goose, Amp, Muse Code | Built, **unverified** | None of these CLIs is installed on the build machine, so their flags are the handoff's indicative ones and marked *unverified* in `docs/AGENT_COMPAT.md` and in the setup UI. The real-agent smoke test records them when found. Muse Code has no confirmed headless mode and is offered as connected/portable only. |
| CI on Ubuntu and Windows | Workflow written, **not yet run** | The GitHub Actions matrix (macOS/Ubuntu/Windows × Node 20/22/24) exists in `.github/workflows/ci.yml`; it runs on the first push. Everything was tested locally on macOS with Node 24. |
| Visual snapshot comparison on CI | Local only | Font rendering differs per OS; CI saves screenshots as artifacts and the comparison runs locally against committed macOS baselines (`test/e2e/*-snapshots/`). |
| Service install (launchd / systemd / Task Scheduler) | Definitions tested as file output; real install is a manual check | As planned in `TEST_PLAN.md` §2. `advent-agent service install` runs the platform tool and reports its result. |
| Real-agent smoke tests | **Run, blocked by accounts** | Run on 8 Nov 2026: Claude Code hit its weekly usage limit, Codex's config names a model the ChatGPT login cannot use, Gemini CLI is not logged in. Details and re-run commands in `docs/AGENT_COMPAT.md`. No real agent has completed a gift yet. |
| Voucher code | Unset until release | `src/promo/promo.json` ships with `<SET AT RELEASE>`, so the slip is hidden until Noémie sets a real code (`TEST_PLAN.md` §7). |
| Clock tampering | Not defended | Date locks prevent accidental spoilers only (DESIGN_SPEC §9.2). Documented in the UI and README. |
| Budget enforcement for agents without a limit flag | Advisory | Only Claude Code enforces a (dollar) cap; others get an advisory token target, labelled as such. |
| Provider adapters | One reference adapter | A generic OpenAI-compatible image adapter ships; music, speech and video adapters are interfaces for contributors (`src/providers/index.ts`). |
| Portable mode with cloud agents | Manual hand-off | Cloud agents cannot reach localhost; the user carries the file or text across (documented in the UI and `AGENT_GUIDE.md`). |
