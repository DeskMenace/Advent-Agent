> **Spoiler warning.** These files describe the gifts that Advent Agent can make for you. If you are going to use the calendar yourself, do not read the ideas: let your agent surprise you. This folder is for people who build, review and extend the library.

# Gift library

58 ideas for Advent Agent gifts. **They are inspiration, not templates.** Agents may use an idea as it is, combine two, or ignore the library and invent their own gift. How agents choose and build is in `workshop/skills/gift-director/SKILL.md`.

Every idea is designed around the three creative criteria:

1. **Emotional effect:** funny, ridiculous, absurd, cute or touching.
2. **Delightful interaction:** something unexpected happens when you touch, drag, open, shake, squeeze or play.
3. **Shareability:** a share frame that sums it up in one image or a short loop.

## Families

| Family | What it is | Ideas |
|---|---|---|
| `paper-and-pop-ups` | Cards, envelopes, tickets and boxes that open in 3D | 7 |
| `tactile-toys` | Desk objects you shake, squeeze, tap or steer | 7 |
| `living-things` | Characters, flowers, gardens, ornaments | 4 |
| `sound` | Songs (about them, about their project, any genre incl. rap), mixtapes, music boxes, soundscapes | 5 |
| `games` | Small games and puzzles | 5 |
| `deadpan-documents` | Awards, museums, reports, patents, newspapers, trailers played completely straight | 9 |
| `printables` | Stickers, wallpapers, zines, with print files | 3 |
| `heart` | The touching ones | 4 |
| `real-world` | Purchase-ready proposals; the agent never buys (D1) | 2 |
| `small-tools` | Scripts and terminal things that are useful *and* funny or cute: Downloads tidier, terminal theme, snow in the terminal | 8 |
| `finale` | December 24 only | 4 |

**Families are directions, not menus.** An agent can pick a family and build something that isn't listed in it. Everything inside an idea ("their city", "their dog") is an example, never a requirement.

Anchors: 4 ideas are marked `anchor: day1` (chosen during setup) and 4 `anchor: finale` (December 24). Agents choose Day 1 only from the `day1` set and should pick December 24 from the `finale` set or invent something of that size.

Collections (`collection: <set>`, maximum 3 items per set, at most 2 sets per season): `jelly-fruits`, `bouquets`, `ornaments`, `tank-fish`.

## Idea format

One Markdown file per idea in `ideas/<id>.md`. Frontmatter:

| Field | Values | Meaning |
|---|---|---|
| `id`, `title` | | Stable slug and display title |
| `family` | see table above | Used for rotation (no repeat within 3 days) |
| `anchor` | `day1` · `finale` · `none` | Restricts the idea to Day 1 or December 24 |
| `collection` | set name or `null` | Part of a 3-item set |
| `emotion` | `funny` `ridiculous` `absurd` `cute` `touching` | The intended feeling, first one dominant |
| `interaction` | verbs | The delight: shake, squeeze, peel, open, scratch… Used for rotation |
| `forms` | `interactive-html` `video` `audio` `image` `print` `tool` | Output forms |
| `render` | `2d` `3d` `either` `terminal` | How it's drawn; `either` = agent's choice by budget |
| `tier` | `S` `M` `L` `XL` | **Minimum** budget tier to make it well (see `budget-tiers.md`) |
| `capability` | `chat-ok` · `coding-agent` | `chat-ok` = a chat LLM can make it as one self-contained HTML file using kit blocks |
| `summary` | | What it is, in two sentences |
| `suitable_if` / `avoid_if` | | Conditions on what the agent knows and the user's settings |
| `share_frame` | | What the share image and loop should show |
| `save` | | What the user can save, in natural formats: png, mp4, html that plays on its own, wallpaper, pdf, wav, script… |
| `print` | bool | Comes with print-ready files (and real print services if research is allowed) |
| `kit` | kit block names | Building blocks in `workshop/kit/` that help; the agent builds from scratch if a block is missing |
| `references` | ids below | Inspiration and implementation references |
| `skills` | workshop skills | Which specialist skills to read |
| `minimum_done` | | The bar for "finished" |
| `status` | `candidate` · `approved` | Maintainer review in the gift lab. Agents may use either. New entries are `candidate`; only the maintainer sets `approved` |
| `credit` | GitHub handle without the `@`, optional | Who proposed the idea. Pattern `^[A-Za-z0-9-]{1,39}$`. Shown as "idea by @handle" in `INDEX.md` and included in `INDEX.json` |

The body has three sections: **Make it theirs** (examples of personalising beyond the name), **Make it useful** (a second life the agent can include or offer in its note, e.g. a desktop snow globe, a terminal snowfall, a printable) and **Great vs lazy** (calibration, not a template).

## Reference ids

| id | Source | Reuse |
|---|---|---|
| `css-3d-lab`, `css-3d-lab-envelope`, `-crystal`, `-aquarium`, `-hotair`, `-confetti` | github.com/Evirtual/css-3d-lab (models at css3dlab.edgarasneverdauskas.com/models/<name>/) | MIT: copy with credit |
| `codrops` | tympanus.net/codrops | Demos MIT unless stated otherwise: check each |
| `openprocessing` | openprocessing.org | Default CC BY-NC-SA: inspiration only unless the sketch says otherwise |
| `wonderworks-jelly`, `-bloom`, `-cassette` | wonderworks.vercel.app/experiments/… | No licence found: inspiration only |
| `react-bits-holo-card`, `react-bits-sticker-peel` | reactbits.dev | MIT + Commons Clause, React: reimplement in vanilla JS, never add to the kit |
| `rive-marketplace` | rive.app/marketplace | Per file; never use a marketplace character |
| `snowglobe-willeastcott` | github.com/willeastcott/snowglobe | Inspiration only (WebGPU, separately licensed scan) |
| `christmas-popup-card-dammafra` | holidaywishes.dammafra.dev | Licence not verified: inspiration only |

Details and copying rules: `workshop/skills/gift-director/references/inspiration-sources.md`.

## Adding an idea

Open a gift-idea issue first (see `CONTRIBUTING.md`); once the maintainer accepts it, copy an existing file, change it, set `status: candidate` and `credit: <your-handle>`, run `npm run library:index`, open a PR. A good idea passes the three criteria, says how to make it personal beyond swapping the name, and names its share frame.

## Licence

The ideas in this folder are licensed under [CC BY 4.0](LICENSE): use, adapt and share them, with credit. The code in the rest of the repository is MIT. See `TRADEMARKS.md` for names and logos.
