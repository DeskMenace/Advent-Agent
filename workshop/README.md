# Gift Workshop

Everything an agent needs to make a good gift: judgement in `skills/`, building blocks in `kit/`. MIT, like the rest of Advent Agent, and versioned with each release of the `advent-agent` package (the folder ships inside it).

```
workshop/
  skills/<name>/SKILL.md      Agent Skills format: frontmatter name + description, body, examples/, references/
  kit/                        vanilla JS/CSS building blocks (inlineable, no network) + templates/ + tokens.css
```

## Skills

`gift-director` is always read first. It explains the giver's role, the brief, honesty, variety, budget, the no-purchase rule, secrecy, packaging and the note. The other seven are opened as needed: `storyteller`, `arcade`, `art-studio`, `sound-studio`, `maker`, `concierge`, `quality-and-packaging`. Each has `examples/great-vs-lazy.md` with one great and one lazy execution note per form, so agents calibrate quality instead of copying a template.

## How agents find this folder

- **Launched agents** get the absolute path in `BRIEF.md` (and `brief.json` → `capabilities.workshopPath`), written into their private workspace by the calendar. The CLI is started with read access to this folder and write access to the workspace only.
- **Connected agents** (MCP) call `list_workshop()` for the skill index and `read_workshop_guide(skill, file?)` for the full text on demand.
- **Portable agents** (chat LLMs without local tools) do not need this folder: they follow `AGENT_GUIDE.md` at the repo root, which is a compact version of `gift-director` plus the package format and an inline music player.
- Optionally, Settings can install the skills into a connected host that supports the Agent Skills convention (never automatically).

## Rules of the house

- Gifts copy kit code **into** the gift; nothing is imported from the workshop at runtime.
- No network, no CDN, no web fonts, no analytics in gifts.
- The agent never purchases or books anything; real-world finds are proposals.
- The idea library (if present) is inspiration, never a quota. Nothing in the code selects or rotates ideas.

## Contributing

Edit a skill or a kit file, run `npx vitest run test/unit/kit.test.ts test/unit/workshop.test.ts`, open a PR. Keep skills direct and concrete; keep kit files single-file inlineable with an MIT header and a 10-line usage example at the top.
