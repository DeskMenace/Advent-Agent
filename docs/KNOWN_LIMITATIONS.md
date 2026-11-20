# Known limitations

Things that could not be built or verified as specified, with the reason. Nothing is left out quietly.

| Item | Status | Reason / what exists instead |
|---|---|---|
| Adapters for OpenCode, Cursor CLI, GitHub Copilot CLI, Goose, Amp | Built, **unverified** | None of these CLIs is installed on the build machine, so their flags are the handoff's indicative ones and marked *unverified* in `docs/AGENT_COMPAT.md` and in the setup UI. The real-agent smoke test records them when found. Muse Code has no confirmed headless mode and is offered as connected/portable only. |
| CI on Ubuntu, macOS and Windows | Runs on GitHub Actions | The matrix (macOS/Ubuntu/Windows × Node 22/24) is in `.github/workflows/ci.yml` and was green on 10 Nov 2026, after Windows-specific fixes. Node 20 reached end of life in April 2026 and is not supported. |
| Visual snapshot comparison on CI | Local only | Font rendering differs per OS; CI saves screenshots as artifacts and the comparison runs locally against committed macOS baselines (`test/e2e/*-snapshots/`). |
| Service install (launchd / systemd / Task Scheduler) | Definitions tested as file output; real install is a manual check | As planned in `TEST_PLAN.md` §2. `advent-agent service install` runs the platform tool and reports its result. |
| Real-agent smoke tests | **Claude Code and Codex passed; Gemini CLI not run** | On 20 Nov 2026, under the current gift format, Claude Code (402 s) and Codex CLI (597 s) each made a gift that passed the gate and was sealed. Gemini CLI 0.70, logged in with a personal Google account, stopped at once with "This client is no longer supported for Gemini Code Assist for individuals" and pointed to another product, so its gift path is untested. The calendar reports this as "no longer supported by its maker". |
| Clock tampering | Not defended | Date locks prevent accidental spoilers only (DESIGN_SPEC §9.2). Documented in the UI and README. |
| Budget enforcement for agents without a limit flag | Advisory | Only Claude Code enforces a (dollar) cap; others get an advisory token target, labelled as such. |
| Provider adapters | One reference adapter | A generic OpenAI-compatible image adapter ships; music, speech and video adapters are interfaces for contributors (`src/providers/index.ts`). |
| "Choose a file…" for a persona | Copy, not a live link | A browser hands over a file's text, not its path, so a chosen file is stored under `~/.advent-agent/personas/` and "Refresh" re-copies that stored text. Personas found by the scan are live: the source file is re-read on every run. |
| "Checking the list" reads only what the app copies for it | Enforced for Claude Code; advisory for others | The app copies an allow-list of files into the task folder and tells the agent to read only those. Claude Code runs with no shell, no web and no extra folders. Codex and Gemini cannot be stopped from reading elsewhere by a flag; the instruction forbids it and the secret scan drops secret-looking lines from the copies. |
| Share loop as MP4/GIF | Needs `ffmpeg` | D20 asks for MP4/GIF. With `ffmpeg` on the machine both are produced; without it the loop is a WebM made in the same headless browser. |
| Share capture without Chrome or Edge | Fallback only | Without an installed Chrome/Edge (or the opt-in test-drive browser), the still falls back to the agent's `share.png` (stamped in the page) and the loop to `share.webm` (re-recorded with the mark in the page). Gifts without either can still be saved as a file. |
| Kit blocks marked "planned" | 16 of 44 names | The ideas name 44 kit blocks. The 10 priority groups from SPEC_CHANGES are built; 16 others (wheel, map, countdown, scroll-scenes, pop, ticket, bracket, balloon, glass, charts, css-3d-box, stars, shake, water, stage, gallery) are listed in `workshop/kit/INDEX.json` as planned, and agents build them from scratch, as the library README allows. |
| Kit blocks on real devices | Not hand-tested | Every new block ran in a headless Chrome smoke test; touch, gyro/motion permissions and audio output on real phones were not checked by hand. |
| Gift-quality scoring | Internal, not run | SPEC_CHANGES' scoring of `day1`/`finale` ideas across personas, models and tiers is the gift lab's job (Q15 in `docs/PROGRESS.md`). |

## Hosted gift links (9 November 2026)
Sharing exports files and hands off to each network; there is no public link to a gift, because gifts live only on the user's computer. A hosted link would need a backend and a privacy decision. Possible later feature.

## TikTok and Instagram loops without ffmpeg
The share loop is MP4 only when `ffmpeg` is installed; otherwise it is WebM, which TikTok and Instagram may refuse on upload.
