# Advent Agent

**Your AI coding agent is your Secret Santa: 24 handmade gifts, Dec 1–24. Runs locally.**

<!-- HERO GIF (to record): npx → onboarding → door click → the present wobbles → the lid pops → cut before the gift. Shot list: docs/DEMO_SHOTLIST.md -->

```sh
npx advent-agent
```

A local-first advent calendar: twenty-four paper envelopes on a wooden board, and behind each one a gift your *own* AI agent makes for you. What it makes is the surprise. The calendar keeps it wrapped; the agent does the rest. No account, no API keys, no tracking.

## Prerequisites

- **Node.js 20 or newer** (tested on 20, 22 and 24).
- **A supported terminal agent, installed and logged in**: Claude Code, Codex CLI or Gemini CLI (verified), or one of the others listed below. Run it once on its own first, so you know it works.
- **Chrome, Edge or Chromium** for sharing a gift as a picture or a short video. The calendar finds an installed one; without it, everything else still works.
- **ffmpeg** (optional): lets Share produce MP4 and GIF. Without it you get WebM.

## What happens

1. **Setup.** `npx advent-agent` opens the calendar in your browser. A short wizard asks which agent is your Secret Santa (or which of your own personas), when it should work, and how generous it should be.
2. **Day 1 is wrapped at setup.** Before wrapping, your Secret Santa checks its list: a short run of your own agent over its own memory and a few instruction files, to learn who it is giving to. Then Door 1 is made, so it opens instantly.
3. **Nothing opens before December 1.** Door N unlocks on December N. Locked doors shake; they do not spoil. If you install late, doors that are already due are made for you, and missed doors wait: nothing expires.
4. **Each day, your agent makes a gift.** On demand when you open the door, or on a schedule the night before. You only see spoiler-free phases (thinking, making, testing, wrapping). A quality gate checks every gift before it reaches you, and December 24 is the big one.

## Supported agents

The calendar starts your agent itself, headless, in a workspace of its own. All agents run in launched mode and can be scheduled (a login service for launchd, systemd or Task Scheduler; the computer has to be on).

| Agent | Status | Notes |
|---|---|---|
| **Claude Code** | Flags verified | Spend cap enforced (`--max-budget-usd`) when you set one |
| **Codex CLI** | Flags verified | Runs in its workspace-write sandbox; no token-limit flag, so the budget is advisory |
| **Gemini CLI** | Flags verified | File edits allowed, shell commands denied; the calendar submits the gift when it exits; budget advisory |
| **OpenCode**, **Cursor CLI**, **Copilot CLI**, **Goose**, **Amp** | Built from documented flags, not yet verified on every machine | Marked as such in setup. See [docs/AGENT_COMPAT.md](docs/AGENT_COMPAT.md) |
| **Custom command** | You are responsible for what it does | Any agent you can start from a command line |

Any local script can also hand a gift in with `advent-agent submit`.

## What it costs

Your agent uses its normal plan or billing; the calendar sends nothing anywhere else. Setup offers **Light, Standard** and **Generous**, which tell the agent to aim for gifts of tier S, M or L (December 1 and 24 get a bigger one, tier XL). The tiers are advisory (the agent is told, not stopped), except that Claude Code can enforce a dollar cap.

We measured real builds with the lab (`advent-agent lab`), on Claude Code with the default model, one gift at a time through the full workflow (brief, build, test, seal):

| Tier the agent used | Gifts measured | Typical cost per gift | Range |
|---|---|---|---|
| S (light) | 3 | about $0.55 | $0.44 – $0.95 |
| M (standard) | 8 | about $0.80 | $0.27 – $2.21 |
| L (generous) | 1 | $3.92 (one sample) | n/a |
| XL (December 24) | 1 | $1.20 (one sample) | n/a |

- **Per season, roughly:** about **$14** on Light, **$20** on Standard (22 daily gifts, Day 1 and December 24 at XL), plus about $0.13 for each list check (three in a season). Generous is not measured well enough to give a number; expect more, in the tens of dollars.
- **Tokens:** the same builds used a median of about 0.6 million tokens each on Claude Code and about 1.75 million on Codex. These counts include the agent re-reading its own context on every turn (mostly cheap cached reads), so they are far above the advisory 30k / 100k / 300k. Dollars are the better yardstick on API billing; on a subscription, expect each gift to use a noticeable slice of your usage limit, and a bigger slice on Generous.
- **How measured:** the usage and cost Claude Code reported for each run (Codex reports tokens only), in 19 real builds. Small samples; your agent, model and the ideas it picks change the numbers a lot. A smaller budget or model makes smaller gifts. You can change the budget in Settings at any time.

## Privacy and safety

- **Everything runs on your computer.** The calendar binds to `127.0.0.1`, checks the Host and Origin of every request, makes no network calls of its own, and has no telemetry. Your agent works as it normally does, including with its own model provider.
- **Checking the list.** Before Door 1 (and again on December 8 and 15), one short run of your own agent reads **copies** of a few files the app chooses: your agent's global instruction file, its per-project memory, and the instruction files of your projects (at most 48 KB in all). It writes a list of short lines, which you can read, edit or delete in Settings. It **never reads** session transcripts, source code, `.env` files, keys or credentials, or the calendar's own folders, and it leaves out secrets, health, money and anything on your avoid list. The list stays on your computer and is not part of exports.
- **The agent never buys or books anything.** If it suggests something, you decide.
- **Gifts are untrusted.** They run in an isolated, sandboxed frame on a separate origin, with a strict policy and no network by default.
- **Scheduled mode needs the computer on** at the hour your agent works.

The details, with the files that implement each claim, are in [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md). Report a vulnerability through the repository's private vulnerability reporting: see [SECURITY.md](SECURITY.md).

## FAQ

**Does my agent buy things?** No. Advent Agent never makes purchases or bookings.

**Do I need API keys or paid services?** No. Optional advanced settings let you add your own image provider, stored in your OS keychain and used with a spend cap.

**How does my Secret Santa know me?** Through the list above. You can also choose one of your own personas (a Claude Code agent or output style, or a project instruction file that gives your agent a name and voice) as your Secret Santa; its notes are signed with its name.

**Can I peek?** Locks prevent accidental spoilers. They are not a vault: changing your computer's clock opens doors.

**Can I share my gifts?** Yes. Share exports a picture or a short video, with a preview first and a way to blur anything private. Nothing is uploaded. Save downloads the gift itself in its own format.

**Do I need to come back every day?** No. Missed doors wait for you and pile up. Settings offers an optional calendar file (`.ics`) with a daily reminder.

**What if I want a gift again, or as a tool?** Your agent sometimes offers a second life in its note (a desktop version, a terminal command). Say yes and it builds it then; it never installs anything unasked.

**Is it free?** Yes: MIT-licensed code and a CC BY gift library.

## Troubleshooting

Start with `advent-agent doctor`: it prints versions, your agents, prerequisites and recent errors, with paths and names removed. Include its output in a bug report, and never paste your list, your agent's memory files or gift contents.

- **"Agent not installed" or not detected.** `doctor` shows what it found on your PATH. Install the agent, log in once in a terminal, then retry the door.
- **"Not authenticated", "rate limited" or "model unavailable".** These come from the agent itself. Log in again, wait for the limit to reset, or pick another model in the agent's own settings, then retry.
- **Sharing says no browser was found.** Install Chrome, Edge or Chromium. Settings can also fetch a small Playwright Chromium for the optional gift test drive.
- **Port in use.** The calendar uses 4224 (app) and 4225 (gifts). Stop the program using them and start again; `doctor` prints the ports the calendar expects.
- **A door failed.** Open it again to retry. If it keeps failing, the door's private log is in `~/.advent-agent/seasons/<year>/doors/NN/log.txt`; it can contain your agent's output, so look before sharing.
- **Doors opened too early or too late.** Locks follow your computer's clock and the timezone frozen at setup.

Known gaps are in [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md).

## Useful commands

```
advent-agent                  start and open the calendar
advent-agent doctor           versions, agents, prerequisites, recent errors (redacted)
advent-agent status           door states, no spoilers
advent-agent service install  start the companion at login (scheduled mode)
advent-agent export | import  your seasons as a zip, without secrets
advent-agent version | help
```

## Who makes this

Advent Agent is made by **Noémie Rakotomalala** ([@suchipizza](https://github.com/suchipizza)) at [Desk Menace](https://deskmenace.com/?ref=aa-readme). Gary, Desk Menace's grumpy desktop character, walks across the calendar page; you can send him home (he stays away until the next day) or switch him off in Settings. The project is free, and that is how Desk Menace says hello. Gary is never part of a gift.

## Build your own

How and why it is built, the fifteen rules, and the lessons from the lab are in [BUILDING_ADVENT_AGENT.md](BUILDING_ADVENT_AGENT.md). The Gift Workshop (`workshop/`) holds the skills and building blocks agents use, and the idea library (`gift-library/`) holds the ideas: spoilers if you plan to use the calendar yourself.

Want to help? See [CONTRIBUTING.md](CONTRIBUTING.md), [GOVERNANCE.md](GOVERNANCE.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Development basics:

```
npm install
npm run build          # server + UI + schema
npm test               # unit + integration (fake agent, auth, scheduler, workspace, list)
npm run e2e            # Playwright against the internal fixture calendar
npm run test:packaging # npm pack → clean install → doctor + start
```

## Licences

- **Code:** MIT, see [LICENSE](LICENSE).
- **Gift library** (`gift-library/`): CC BY 4.0, see [gift-library/LICENSE](gift-library/LICENSE).
- **Names and artwork:** "Advent Agent", "Desk Menace", Gary and the logos are not covered by those licences: see [TRADEMARKS.md](TRADEMARKS.md). Third-party material is listed in [THIRD_PARTY.md](THIRD_PARTY.md).
