# Progress — acceptance checklist

Every item below comes from `docs/handoff/TEST_PLAN.md` (§1–§5, §7) and `docs/spec/DESIGN_SPEC.md` §16.
An item is ticked only when its test exists and passes. The test file (or manual check) is named next to each item.

Legend: `[ ]` open · `[x]` passing · `[~]` built, test pending · `[!]` blocked (see `docs/KNOWN_LIMITATIONS.md`)

## 1. Unit (Vitest) — TEST_PLAN §1

### Eligibility — `test/unit/eligibility.test.ts`
- [x] U1.1 Before Dec 1: no door eligible, countdown to Dec 1 at unlockHour
- [x] U1.2 Dec N at unlockHour −1 min: door N locked; +1 min: door N eligible
- [x] U1.3 Dec 24: all 24 eligible; after the season (Dec 25–Jan 31): all 24 eligible, season marked ended
- [x] U1.4 unlockHour 0 / 7 / 23 behave as configured
- [x] U1.5 DST-transition timezone (e.g. America/Sao_Paulo, Europe/Zurich) does not shift door boundaries
- [x] U1.6 Frozen season timezone: device timezone change does not change eligibility
- [x] U1.7 Server rejects a future door on `POST /api/doors/:day/open` and `GET /api/doors/:day` with the lock response

### Door state machine — `test/unit/door-state.test.ts`
- [x] U2.1 Every allowed transition succeeds; every disallowed one throws
- [x] U2.2 Idempotent open: a second open returns the existing job, no new attempt
- [x] U2.3 Retry creates attempt N+1, archives the previous workspace, never merges
- [x] U2.4 Cancel from queued / preparing / waiting_* → cancelled
- [x] U2.5 Crash recovery: a persisted state in each in-flight state recovers to a consistent state on restart

### Manifest and package parsing — `test/unit/package-parse.test.ts`
- [x] U3.1 Form A (folder/zip with gift.json) parses
- [x] U3.2 Form B (single HTML with embedded manifest) parses; without a manifest the title comes from `<title>` and the day is requested
- [x] U3.3 Form C (text/markdown paste) → document gift; first-line `# Title` becomes the title
- [x] U3.4 Form D (loose media) → minimal manifest, kinds inferred
- [x] U3.5 Missing required fields rejected with structured errors; unknown extra fields tolerated
- [x] U3.6 `schema/gift.schema.json` is in sync with the zod schema

### Intake security — `test/unit/intake-security.test.ts`
- [x] U4.1 Zip-slip (`../`, absolute paths) rejected
- [x] U4.2 Symlinks rejected
- [x] U4.3 Zip bomb / >200 files / >200 MB rejected
- [x] U4.4 Oversized single file rejected
- [x] U4.5 Executables (.exe .sh .app .dll .bat .cmd .scr .msi .ps1 .jar .com) stored download-only with a warning, never served inline
- [x] U4.6 Secret scanner: true positives (API-key patterns, `api.token` contents, `.env` lines, absolute home paths) and false positives (plain prose, short hex) behave as specified
- [x] U4.7 Agent text sanitisation: raw HTML never reaches the app DOM (markdown allow-list)

### Storage — `test/unit/storage.test.ts`
- [x] U5.1 Atomic write: simulated crash between temp write and rename leaves the previous file intact
- [x] U5.2 Schema migration runs with a backup first
- [x] U5.3 Export contains no `api.token`, `session.key`, `log.txt` or keychain values
- [x] U5.4 Import round-trip restores seasons and door states

### Library — `test/unit/library.test.ts`
- [x] U6.1 Every `gift-library/ideas/*.md` validates against the idea schema
- [x] U6.2 `INDEX.json` and `INDEX.md` are up to date (CI fails when stale)
- [x] U6.3 78 ideas; titles and groups match `docs/spec/AI_Advent_Calendar_Gift_Idea_Bank.md`
- [x] U6.4 Gary never appears in the library

### Promo — `test/unit/promo.test.ts`
- [x] U7.1 Shown only on the configured day
- [x] U7.2 Shown only after reveal
- [x] U7.3 Hidden after `expires`
- [x] U7.4 Hidden when `enabled` is false or the code is unset

## 2. Integration — TEST_PLAN §2

### Fake agent adapter — `test/integration/launched.test.ts`, `test/fake-agent/`
- [x] I1.1 Happy path: phases reported, gift written, submitted, door `ready`
- [x] I1.2 Failure exit → `failed`, retry works
- [x] I1.3 Timeout → `failed` with timeout reason, process killed
- [x] I1.4 Secret in gift → gate rejects, structured error returned to the agent, door not ready
- [x] I1.5 Broken gift (missing primary file) → gate rejects
- [x] I1.6 Log output never reaches `/api/calendar`, `/api/doors/:day` or SSE

### MCP — `test/integration/mcp.test.ts`
- [x] I2.1 Every tool callable from an SDK client (`get_calendar_context`, `list_workshop`, `read_workshop_guide`, `list_ideas`, `read_idea`, `start_gift`, `report_progress`, `check_gift`, `submit_gift`)
- [x] I2.2 Inline `files[]` submission seals a gift
- [x] I2.3 "No pending door" case returns a clear message
- [x] I2.4 Submission for an ineligible day is rejected
- [x] I2.5 Resources expose the guides

### CLI and HTTP submit — `test/integration/http-auth.test.ts`
- [x] I3.1 Mutating routes without a token or cookie → 401
- [x] I3.2 Bad `Host` (e.g. `evil.com`, DNS-rebinding style) → 403
- [x] I3.3 Cross-origin `Origin` → 403
- [x] I3.4 `advent-agent submit` with the token succeeds; without it fails

### Scheduler — `test/integration/scheduler.test.ts`
- [x] I4.1 Preparation starts at the configured time with a faked clock
- [x] I4.2 Catch-up after a simulated sleep prepares missed doors
- [x] I4.3 No duplicate runs for the same door
- [x] I4.4 Late preparation is recorded honestly (`preparedLate`, reason)

### Service install — `test/integration/service.test.ts`
- [x] I5.1 launchd plist generated correctly (file output)
- [x] I5.2 systemd `--user` unit generated correctly
- [x] I5.3 Windows Task Scheduler XML generated correctly

## 3. End-to-end (Playwright) — TEST_PLAN §3 and DESIGN_SPEC §16

### Calendar and animation — `test/e2e/calendar.spec.ts`
- [x] E1.1 Simulated Dec 8: door 8 opens, door 9 shakes and announces an accessible message
- [x] E1.2 Before Dec 1: all doors locked and countdown shown; Dec 24: all eligible
- [x] E1.3 Direct URL to a future gift is blocked
- [x] E1.4 First open: flap flips, insert lifts, then preparation screen or viewer
- [x] E1.5 Rapid taps → one job
- [x] E1.6 Reduced motion: no animation, same outcomes
- [x] E1.7 Midnight rollover while open updates eligibility without reload
- [x] E1.8 Reload, Back/Forward and revisiting a gift do not regenerate

### Renderers — `test/e2e/renderers.spec.ts`
- [x] E2.1 interactive HTML
- [x] E2.2 image
- [x] E2.3 audio (plays with controls, no autoplay)
- [x] E2.4 video (inline, download link)
- [x] E2.5 document (text / markdown / PDF)
- [x] E2.6 card with PNG / SVG / PDF downloads and print
- [x] E2.7 song: score plays, WAV download, render-it-yourself sheet with copy buttons
- [x] E2.8 real-world proposal (price, date checked, "what's left", never "bought")
- [x] E2.9 link
- [x] E2.10 unknown kind → download fallback

### Sandbox — `test/e2e/sandbox.spec.ts`
- [x] E3.1 `parent.document` blocked
- [x] E3.2 `localStorage` blocked (opaque origin)
- [x] E3.3 `fetch('http://127.0.0.1:4224/api/…')` blocked
- [x] E3.4 Top-level navigation blocked
- [x] E3.5 Remote image without consent blocked (CSP)

### Shelf and archive — `test/e2e/shelf.spec.ts`
- [x] E4.1 Shelf shows only revealed gifts
- [x] E4.2 Past season browsable under Archive with original dates

### Portable flow — `test/e2e/portable.spec.ts`
- [x] E5.1 Drop a zip
- [x] E5.2 Drop an HTML file
- [x] E5.3 Paste text
- [x] E5.4 Drop loose media

### Gary — `test/e2e/gary.spec.ts`
- [x] E6.1 Present on the calendar page only
- [x] E6.2 Right-click menu shows "Hire Gary" with `https://deskmenace.com/?ref=aa-gary`
- [x] E6.3 "Send home" persists for the day
- [x] E6.4 Setting "Show Gary on the calendar" hides him
- [x] E6.5 Hidden under reduced motion

### Voucher — `test/e2e/voucher.spec.ts`
- [x] E7.1 Appears on the configured door after reveal
- [x] E7.2 Never before reveal
- [x] E7.3 Never on other doors

### Layouts — `test/e2e/layout.spec.ts`
- [x] E8.1 Screenshots at 320, 390, 768, 1280, 1440 px and 200 % zoom
- [x] E8.2 No horizontal overflow at any of them

### Accessibility — `test/e2e/a11y.spec.ts`
- [x] E9.1 axe-core: no serious or critical violations on calendar, setup, preparation, gift, shelf
- [x] E9.2 Keyboard-only run: setup → open → gift → back
- [x] E9.3 Focus restored to the envelope after back
- [x] E9.4 Live-region messages present and concise

### DESIGN_SPEC §16 rows not covered above
- [x] D1 Visual fidelity: wood-framed, ribbon-topped 4×6 board; 24 numbers in order with varied paper treatments (snapshot + review)
- [x] D2 Gift pages keep typography, paper treatment and hierarchy (snapshot)
- [x] D3 No broken/empty media frames or layout shifts at common sizes
- [x] D4 Agent companion card present and gift-specific (renderer fixtures)
- [x] D5 New gift kinds register without touching the calendar (`test/unit/renderer-registry.test.ts`)
- [x] D6 On-demand is the default; scheduled mode offered only with the companion service (setup e2e)
- [x] D7 No API key required to finish setup; keys optional, add/remove locally (settings e2e)
- [x] D8 Purchase: the agent never purchases; "I bought it" marks are user-only; price ceiling respected in briefs (`test/unit/package-parse.test.ts` D1 checks, brief rule in `src/core/brief.ts`)
- [x] D9 Demo state can't charge, order or touch live season data (`test/integration/demo.test.ts`)
- [x] D10 Data persists locally, archives by season, export without secrets (U5.3, E4.2)
- [x] D11 Browser errors for unavailable formats handled with fallback actions (E2.10)

## 4. Real-agent smoke tests — TEST_PLAN §4 (opt-in)
- [!] R1 `ADVENT_REAL_AGENTS=1 npm run test:agents` runs against each installed CLI (Claude Code, Codex, Gemini CLI); results in `docs/AGENT_COMPAT.md` — harness built and run on 8 Nov; all three blocked by account state (rate limit, unsupported model in Codex config, Gemini not logged in). Re-run needed.
- [ ] R2 Manual: Claude Desktop MCP connection (connected mode) — Noémie
- [ ] R3 Manual: portable mode with a chat LLM via `AGENT_GUIDE.md` — Noémie

## 5. Packaging — TEST_PLAN §5 — `test/packaging/pack.test.ts`
- [x] P1 `npm pack` → install in a clean temp dir → `npx advent-agent doctor` and `demo` work (macOS here; Ubuntu/Windows via CI)
- [x] P2 Package size ≤ 15 MB; no Chromium or ffmpeg bundled
- [x] P3 First run with no agent installed offers demo, connected and portable modes

## 6. Gift lab — TEST_PLAN §6
- [x] L1 `advent-agent lab --idea`, `--ideas`, `--free`, `open`, `review` work in an isolated home
- [x] L2 `lab review` saves `docs/lab-reviews/<date>.md` and can set `status: approved`
- [ ] L3 Noémie's first batch (after 1–5 are green) — Noémie

## 7. Release checklist — TEST_PLAN §7
- [ ] REL1 Every item above ticked or in `docs/KNOWN_LIMITATIONS.md`
- [ ] REL2 `promo.json` code set and verified on the website — Noémie
- [x] REL3 README with envelope GIF, quick start, modes table, FAQ, credits, licence notes
- [x] REL4 `AGENT_GUIDE.md` reachable at its public URL (GitHub raw)
- [ ] REL5 npm publish `advent-agent` 1.0.0, GitHub release, tag — Noémie approves
