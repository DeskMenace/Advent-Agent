---
name: quality-and-packaging
description: Before every submission: per-type checklists, the gift.json manifest and the embedded-manifest HTML form, running advent-agent check or check_gift, understanding and fixing every gate problem code, secret hygiene (no keys, paths, private data), size and file limits, honest incomplete lists.
license: MIT
---

# Quality and Packaging

The quality gate is a friend with a checklist. Pass it on the first try by checking the same things yourself.

## The manifest

Form A (folder or zip): `gift.json` next to the files. Form B (single HTML): the same JSON inside

```html
<script type="application/advent-gift+json">{ "schema": "advent-agent/gift@1", "day": 7, "title": "…", "category": "…", "note": "…" }</script>
```

Required: `schema` (exactly `advent-agent/gift@1`), `day` (1–24, must match the door), `title` (≤ 160), `note` (≤ 8000). Common: `category`, `subtitle`, `primary`, `artifacts[]` (`path`, `kind`, `title`, `role`, `alt`, `mime`), `song`, `realWorld`, `links`, `network`, `incomplete`, `continuity`, `agent`, `usage`. Kinds the calendar renders: `interactive-html`, `image`, `audio`, `video`, `document`, `card`, `song`, `real-world`, `link`, `download`; unknown kinds become downloads. Full field table: `references/manifest.md`. Schema file: `schema/gift.schema.json` next to the workshop folder.

Paths are relative, forward slashes, no `..`, no leading `/`, and must exist in the package. URLs are https without credentials.

## Checklists

**Every gift**
- Opens with no console errors; nothing depends on the network (no CDN scripts, fonts, images, fetch). Everything inline or in the package.
- Works with keyboard only and with touch only; visible focus; text ≥ 16 px; contrast ≥ 4.5:1.
- `prefers-reduced-motion` respected; no autoplay audio; no flashing.
- Fits 360 px wide and 1280 px wide.
- No personal data, no file paths, no keys or tokens, no third-party names, nothing from the recipient's folders copied verbatim.
- No forbidden purchase words anywhere: bought, ordered, booked, purchased, reserved for you, paid for.
- `note` is warm, specific, two to six sentences, no stock phrases, no process talk.
- `incomplete` lists everything that does not work. Empty only if everything works.
- `day` equals the brief's day. `title` is spoiler-safe until opened (it is shown only after the reveal, but still).

**Interactive HTML**: reset works without reload; pause exists where there is motion; state survives a resize; the file is under ~5 MB (hard limit 8 MB per HTML).
**Images**: real PNG/JPEG/SVG/WebP that decode; `alt` on each; wallpapers at exact sizes.
**Audio/video**: decodes; a player with controls; captions or a transcript artifact for spoken words.
**Documents / text**: first line `# Title` for text gifts; print CSS for printables; PDF opens.
**Song**: `song.score` validates (`tracks` non-empty, `tempo` > 0); `song.wav` decodes; `song.renderSheet` present and naming no provider.
**Real-world**: every item has `name`, `vendor`, https `url`, `checkedAt` today, price + currency; `whatsLeft` ends with "Nothing has been ordered or booked."; ceiling respected.

## Run the gate

```
advent-agent check ./gift --day N      # launched / CLI
check_gift(day, path)                  # connected (MCP)
```

Output is a list of `{ code, severity, path?, message }`. Errors block submission; warnings do not but deserve a look. Fix, re-run, repeat until clean. Then:

```
advent-agent submit ./gift --day N
submit_gift(day, path)  or  submit_gift(day, files=[{ name, text|base64 }])
```

Problem codes and fixes: `references/gate-errors.md`. If the brief lists `previousProblems`, fix those first.

## Secret hygiene

The gate scans every text file for API keys (`sk-…`, `AKIA…`, `ghp_…`, `xox…`, `AIza…`), private keys, bearer headers, `KEY=value` env lines, home paths (`/Users/…`, `/home/…`, `C:\Users\…`), node_modules, and the calendar's own token. Any hit is `secret_<kind>` and blocks the gift. Before packaging, grep your files for `sk-`, `/Users/`, `/home/`, `@` and `token`. Do not include logs, `.env`, `.git`, `node_modules`, editor files, or your own notes.

## Limits

200 files, 200 MB total, 8 MB per HTML file; keep single-file gifts under ~5 MB and media under 2 MB (images) / 10 MB (video) for a fast reveal. No symlinks, no absolute paths, no `..`.

## Honest incompleteness

`incomplete: ["Level 3 is not built", "No sound on Safari (untested)"]`. Plain sentences, each a fact. Never "minor polish remaining".
