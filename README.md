# Advent Agent

**Your AI agent is your Secret Santa.**

A local-first advent calendar: twenty-four paper envelopes on a wooden board, and behind each one a gift your *own* AI agent makes for you. A tiny game, a song, a card, a letter, a real thing it found and priced, a plan for a winter walk. The calendar keeps the surprise; the agent does the rest.

Made by [Desk Menace](https://deskmenace.com/?ref=aa-readme), the people behind Gary.

![An envelope opening on the Advent Agent board](docs/media/envelope-opening.gif)

```sh
npx advent-agent
```

That is the whole install. The companion starts on your computer, your browser opens on the calendar, and a short wizard asks how your agent connects. No account, no API keys, no tracking.

## What it does

- **24 doors, December 1–24.** Door N unlocks on December N (at midnight or the hour you choose) in a timezone frozen for the season. Locked doors shake; they do not spoil.
- **Your agent makes the gift.** On demand when you open a door, or on a schedule the night before. Progress is shown as spoiler-free phases: thinking, making, testing, wrapping.
- **A quality gate seals every gift.** Manifest, files, media decode, a secret scan, and an optional headless test drive, before anything reaches your eyes.
- **Gifts render in a sandbox.** Interactive gifts run in an isolated iframe on a separate origin with a strict policy. Ten renderer kinds ship (interactive HTML, image, audio, video, document, card, song, real-world proposal, link, download) and new ones register without touching the calendar.
- **Your agent never buys or books anything.** Real-world gifts arrive as a purchase-ready proposal: exact item, vendor, price with the date it was checked, link, and what is left for you to do. An optional "I bought it" mark is yours alone and stays on your computer.
- **Everything stays local.** `~/.advent-agent` holds your seasons and gifts. Exports never contain tokens, keys or agent logs.

## Which agents work?

| Mode | Who | Who starts the work | Scheduled? | Surprise kept? | Gifts possible |
|---|---|---|---|---|---|
| **Launched** | Terminal agents installed on your computer: Claude Code, Codex CLI, Gemini CLI, plus OpenCode, Cursor CLI, Copilot CLI, Goose, Amp and a custom command | The calendar, when you open a door or on schedule | Yes | Fully: output hidden, only phases shown | Everything: games, audio, multi-file, web research |
| **Connected** | MCP clients: Claude Desktop, Codex desktop, Cursor, any MCP host | You: "Open door 7 of my Advent Agent calendar." | No | Partly: the chat shows tool calls | Everything, when the host can write files and run code |
| **Portable** | Any chat assistant or cloud agent (claude.ai, ChatGPT, Gemini app, …) | You paste a request, then drop the result in | No | Partly: ask it to send the file without a preview | One self-contained HTML file, text, or a real-world proposal |
| **Command line** | Your own scripts | Whoever runs `advent-agent submit` | If your script is | Up to you | Anything in the package format |

Flags for Claude Code, Codex CLI and Gemini CLI were verified against the installed versions; see [docs/AGENT_COMPAT.md](docs/AGENT_COMPAT.md). Agents without local tools follow [AGENT_GUIDE.md](AGENT_GUIDE.md).

## Quick start

1. `npx advent-agent` opens the calendar and the setup wizard.
2. Pick how your agent connects (see the table). Launched agents are detected automatically.
3. Choose the unlock hour, on-demand or scheduled delivery, and (optionally) a few hints about you.
4. On December 1, open the first door.

Useful commands:

```
advent-agent                  start + open the calendar
advent-agent demo             a demo calendar with sample gifts (isolated, never runs an agent)
advent-agent doctor           detect agents, ports, browser, ffprobe
advent-agent status           door states, no spoilers
advent-agent mcp              MCP server for Claude Desktop & friends
advent-agent service install  start the companion at login (scheduled mode)
advent-agent export | import  your seasons as a zip, without secrets
advent-agent lab …            gift lab for trying ideas with real agents
```

## For agents and contributors

- The **Gift Workshop** (`workshop/`) bundles eight skills (gift-director, storyteller, arcade, art-studio, sound-studio, maker, concierge, quality-and-packaging) and vanilla JS building blocks for games, art, sound, stories, mini-tools and templates. Nothing is fetched or installed at gift time.
- The **idea library** (`gift-library/`, 78 ideas in groups A–H) is inspiration, never a quota. Add an idea with a pull request; see [CONTRIBUTING.md](CONTRIBUTING.md).
- The **gift package format** is one `gift.json` plus files (or a single HTML file with an embedded manifest, or plain text). Schema: [`schema/gift.schema.json`](schema/gift.schema.json).
- **Music without paid services**: the agent writes the score, the bundled Sound Studio plays it, and a render-it-yourself sheet lets you use any music generator you like.

## FAQ

**Does my agent buy things?** No. Advent Agent never makes purchases or bookings. When a gift is a real object or experience, your agent prepares it (exact item, vendor, price checked on a date, link) and you decide whether to buy.

**Do I need API keys or paid services?** No. Optional advanced settings let you add your own providers, stored in your OS keychain, used only through narrow adapters with a spend cap.

**Is my data sent anywhere?** The calendar runs on your computer and sends nothing to us. Your agent works as it normally does, including with its own model provider.

**Can I peek?** Locks prevent accidental spoilers. They are not a vault: changing your computer's clock unlocks doors.

**What does it cost in tokens?** Each gift aims for your per-gift budget (25,000 tokens by default) and uses your agent's normal plan or billing. Claude Code can enforce a dollar cap; for other agents the budget is advisory and labelled as such.

**Is it free?** Yes, MIT-licensed.

## Development

```
npm install
npm run build          # server + UI + schema
npm test               # unit + integration (fake agent, MCP, auth, scheduler)
npm run e2e            # Playwright against a demo calendar
npm run test:packaging # npm pack → clean install → doctor + demo
ADVENT_REAL_AGENTS=1 npm run test:agents   # real agents, costs tokens
npm run dev            # companion on a dev demo home (rebuild the UI with `npx vite build ui --watch`)
```

Progress against the acceptance plan is tracked in [docs/PROGRESS.md](docs/PROGRESS.md); known gaps in [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md).

## Credits and licences

Advent Agent is MIT. Made by [Desk Menace](https://deskmenace.com/?ref=aa-readme), the people behind [Gary](https://deskmenace.com/?ref=aa-readme). Gary wanders the calendar page thanks to [gary.js](https://github.com/suchipizza/DeskMenace) (MIT engine; Gary's artwork is under its own licence, see [THIRD_PARTY.md](THIRD_PARTY.md)). Right-click him for "Hire Gary".
