# Advent Agent — Claude Code handoff

**Product:** Advent Agent, an open-source, local-first advent calendar where the user's own AI agent makes the gift behind each of the 24 doors.
**Repo:** new standalone GitHub repo (created by Noémie), MIT license, npm package `advent-agent` (name was free on 8 Nov 2026).
**Target:** usable by real users on **1 December 2026**; feature-complete, tested, released to npm before then.
**Scope:** the full product. There is no MVP and no phased plan. If something genuinely cannot be built, it goes in `docs/KNOWN_LIMITATIONS.md` with the reason. It is never left out quietly.

## Reading order

| # | File | What it is | Authority |
|---|---|---|---|
| 1 | `DECISIONS.md` (this folder) | Decisions taken on 8 Nov 2026 that **override** the specs | Highest |
| 2 | `ARCHITECTURE.md` | Stack, components, storage, data model, security, API | High |
| 3 | `AGENT_CONNECTIONS.md` | How every kind of agent connects; contracts (CLI, MCP, HTTP, gift package) | High |
| 4 | `GIFT_WORKSHOP.md` | Bundled skills, building blocks, idea library format, music and templates | High |
| 5 | `DESK_MENACE_INTEGRATION.md` | Credit, share mark, gary.js on the calendar page, voucher, website FAQ items | High |
| 6 | `TEST_PLAN.md` | Automated tests, real-agent smoke tests, the gift lab and Noémie's manual review | High |
| 7 | `../Design/advent_calendar_handoff/DESIGN_SPEC.md` | Visual, interaction and accessibility spec | Authoritative for UI unless overridden by 1 |
| 8 | `../Design/advent_calendar_handoff/advent_calendar_mockup.html` + `previews/` + `reference/` | Look, feel and motion reference | Visual reference only |
| 9 | `../AI_Advent_Calendar_Product_Description.md` | Full product description | Background; overridden by 1–6 where they differ |
| 10 | `../AI_Advent_Calendar_Gift_Idea_Bank.md` | **The** idea library source (78 ideas, groups A–H) | Content source |

The product description's Appendix A (123 ideas) is **not** the library. Use the Gift Idea Bank file.

## Setup for the coding session

1. Clone the empty repo Noémie created.
2. Copy into the repo:
   - `docs/spec/`: product description, idea bank, design spec, mockup, previews, reference image.
   - `docs/handoff/`: this folder.

   Do not edit the copied spec files. Write corrections in `docs/handoff/DECISIONS.md` (append a dated entry).
3. Put `CLAUDE.md.template` at the repo root as `CLAUDE.md`.
4. Build. Track progress in `docs/PROGRESS.md`: a checklist of every acceptance criterion from `TEST_PLAN.md`, ticked only when its test passes.

## Prompt to start Claude Code

> Read `CLAUDE.md`, then every file in `docs/handoff/` in the order given by `docs/handoff/README.md`, then `docs/spec/DESIGN_SPEC.md`, and open the mockup HTML and previews. Build the complete Advent Agent product described there. `DECISIONS.md` overrides the specs. Don't reduce scope. If something cannot be built, record it in `docs/KNOWN_LIMITATIONS.md` with the reason. Before writing code, produce `docs/PROGRESS.md` (acceptance checklist) and `docs/IMPLEMENTATION_PLAN.md` (order of work). Then build, test and tick items off as their tests pass. Verify every third-party CLI flag and file path you rely on against the tool's current `--help` or docs. Don't trust the handoff's examples blindly. Stop and ask Noémie only for decisions that are irreversible or that contradict `DECISIONS.md`.
