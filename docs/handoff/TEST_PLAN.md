# Test plan and definition of done

A feature is done when its tests pass in CI on macOS, Ubuntu and Windows (Node 20/22/24). Every row in DESIGN_SPEC §16 and every item here is listed in `docs/PROGRESS.md` and ticked only when its test exists and passes.

## 1. Unit (Vitest)
- **Eligibility**: before Dec 1, Dec N at unlockHour −1 min and +1 min, Dec 24, after the season, unlockHour 0/7/23, DST-transition timezones, a frozen season timezone while the device timezone changes, and the server rejecting future doors.
- **Door state machine**: every transition; idempotent open; retry creates an attempt without duplication; cancel; crash recovery from each state.
- **Manifest and package parsing**: forms A–D; missing or extra fields; embedded HTML manifest; text paste; loose media.
- **Intake security**: zip-slip, symlinks, zip bombs, oversized files, executables, the secret scanner (true and false positives), sanitisation of agent text.
- **Storage**: atomic writes under simulated crashes, schema migration with backup, export without secrets, import round-trip.
- **Library**: every idea file validates, the index is up to date, the 78 ideas match the source bank's titles and groups.
- **Promo**: shown only on the configured day, only after reveal, hidden after expiry, hidden when there's no code.

## 2. Integration
- **Fake agent adapter** (`test/fake-agent/`): a scripted CLI that behaves like a launched agent. It emits progress phases, writes a fixture gift, submits, and can fail, time out, emit a secret or produce a broken gift. It drives every launched-mode path.
- **Workspace, persona and list (D28)**: one workspace per season with doors as subfolders and earlier doors readable; persona copied as CLAUDE.md/AGENTS.md, refreshed when its source changes; checking the list reads only the copied allow-list, merges tagged lines, is editable, and refreshes on December 8 and 15.
- **CLI and HTTP submit**: token required; Host/Origin checks; DNS-rebinding style Host rejected.
- **Scheduler**: preparation at the configured time with a faked clock; catch-up after a simulated sleep; no duplicate runs; honest "late" status.
- **Service install**: generates the correct unit, plist or task definition (tested as file output; real install only in a manual check).

## 3. End-to-end (Playwright, demo and fixture homes)
- All of DESIGN_SPEC §16: visual fidelity, locks (Dec 8: door 8 opens, door 9 shakes and shows an accessible message), direct-URL blocking, flap animation then preparation or viewer, rapid taps → one job, reduced motion, midnight rollover while open, reload/back/forward, revisiting without regeneration.
- **Renderers**: fixture gift per kind (interactive HTML, image, audio, video, document, card + PNG/SVG/PDF downloads, song with score, WAV and render-it-yourself sheet, real-world proposal, link, unknown → download).
- **Sandbox**: a fixture gift tries `parent.document`, `localStorage`, `fetch('http://127.0.0.1:4224/api/…')`, top-level navigation and a remote image without consent. All are blocked.
- **Shelf and archive**: only revealed gifts; past season browsable; dates kept.
- **Persona and list**: the "Who is your Secret Santa?" picker in setup, the list section in Settings.
- **Gary**: present on the calendar only; right-click shows "Hire Gary" with the correct URL; "send home" persists for the day; the setting hides him; hidden under reduced motion.
- **Voucher**: appears on door 6 after reveal, never before reveal, never on other doors.
- **Layouts**: screenshots at 320, 390, 768, 1280 and 1440 px, plus 200% zoom; no horizontal overflow; compared against `previews/` by eye in the PR and by Playwright snapshot thereafter.
- **Accessibility**: axe-core with no serious violations; keyboard-only run through setup → open → gift → back; focus restored to the envelope; live-region messages.

## 4. Real-agent smoke tests (opt-in, local, costs tokens)
`ADVENT_REAL_AGENTS=1 npm run test:agents`. For each installed CLI (Claude Code, Codex, Gemini CLI, plus any others found), run a lab season and ask for one small gift with a 10k-token budget. Assert that progress was reported, the gate passed and the gift rendered. Record the CLI version, flags used, duration and usage in `docs/AGENT_COMPAT.md`. That file is the source of truth for the adapter table.


## 5. Packaging
- `npm pack` → install in a clean temp directory → `npx advent-agent doctor` and `start` work, on all three OSes.
- Package size budget: ≤ 15 MB, with no Chromium or ffmpeg bundled.
- First run with no agent installed: a friendly message that says which terminal agents are supported.

## 6. Gift lab, then Noémie's manual review (after sections 1–5 are green)

`advent-agent lab` uses an isolated home (`~/.advent-agent/lab`), with every door unlocked and real agents allowed.

```
advent-agent lab --idea <id> [--agent claude-code|codex|gemini|…] [--profile <file>]
advent-agent lab --ideas <id1,id2,…>         # batch, one door each
advent-agent lab --free                      # agent ignores the library (wildcard)
advent-agent lab open                        # opens the lab calendar
advent-agent lab review                      # opens the review sheet
```

- Lab gifts open in the real UI, so the envelope ritual is tested too.
- `lab review` shows each lab gift with a review form, saved to `docs/lab-reviews/<date>.md` in the repo working tree:
  - **Works**: yes / no / partly.
  - **Delight**: 1–5.
  - **Felt personal**: yes / no / not applicable.
  - **Note quality**: 1–5.
  - **Problems**: free text.
  - **Approve idea**: yes / no.

  Approving sets `status: approved` in the idea file.
- Suggested first batch for Noémie (one per renderer and mode, including the voucher day):

| Idea | What it exercises |
|---|---|
| Fortune Cookie | interactive toy |
| Daily Mini-Crossword | puzzle engine |
| Music-Box Melody | sound + render-it-yourself sheet |
| Handwritten-Style Card | card + print |
| Winter Desktop and Phone Wallpaper | image export sizes |
| The Book You Didn't Know You Needed | real-world proposal |
| A Night somewhere | experience research |
| Tiny Digital Snow Globe | canvas + audio |
| Choose-your-own story / Three-Riddle Escape Room | multi-step interaction |
| One `--free` wildcard | — |

  Run it once through Claude Code and once through Codex (launched).

## 7. Release checklist
- [ ] Every PROGRESS item ticked; known limitations documented.
- [ ] `promo.json` code set and verified on the website.
- [ ] README with a GIF of an envelope opening (no real personal gift content), quick start, modes table, FAQ, credits, license notes.
- [ ] `AGENT_GUIDE.md` reachable at its public URL.
- [ ] npm publish `advent-agent` 1.0.0; GitHub release; tag.
