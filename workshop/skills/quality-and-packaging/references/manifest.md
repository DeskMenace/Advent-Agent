# gift.json reference (schema advent-agent/gift@2)

The canonical description of what each field is for lives in `gift-director/references/share-and-export.md`. This page is the field-by-field table for packaging. `advent-agent/gift@1` manifests are still accepted, but write `gift@2`.

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema` | `"advent-agent/gift@2"` | yes | exact string |
| `day` | integer 1–24 | yes | must equal the door you were asked to prepare (`day_mismatch`) |
| `title` | string 1–160 | yes | shown after the reveal |
| `note` | string ≤ 8000 | no (recommended) | your card to the recipient, in your voice: 2–4 sentences, why you made this. Shown exactly as written; nothing is shown without it |
| `signature` | string ≤ 40 | no | signs your note: any name you like |
| `save` | `{ file, type }` | no | the gift's primary file in its natural format, for Save; must be in the package |
| `followUp` | `{ offer, prompt }` | no | a second life you offered in your note (gift-director §7): `offer` ≤ 200, `prompt` ≤ 2000, ready to paste. Never shown by the calendar |
| `ideaId` | string or `null` | expected | library idea id, or `null` for your own invention |
| `family` | string | expected | `paper-and-pop-ups`, `tactile-toys`, `living-things`, `sound`, `games`, `deadpan-documents`, `printables`, `heart`, `real-world`, `finale` |
| `emotion` | enum | yes (`emotion_missing`) | `funny`, `ridiculous`, `absurd`, `cute`, `touching`: one, on purpose |
| `interaction` | string or 1–8 strings | yes (`interaction_missing`) | verbs: `open`, `shake`, `squeeze`, `peel`, `scratch`, `drag`, `blow`, `tilt`, `type`, `wait`, `play`… |
| `form` | string | expected | `interactive-html`, `video`, `audio`, `image`, `print`, `document`, `song`, `real-world`, `tool` (files in `tool/`, see the maker skill) |
| `tierUsed` | `S` `M` `L` `XL` | expected | the tier you actually built in (`tier_too_small` warns if the idea's minimum is higher) |
| `collection` | `{ set, index, size }` or `null` | no | `index` 1–3, `size` 2–3 (default 3); at most 2 sets per season |
| `entry` | relative path | folder gifts | the page to open first (alias of the older `primary`) |
| `share.still` | path or `{ "capture": "still" }` | yes (`share_missing`) | a 1080×1350 `share.png`, or a capture request answered by `window.adventCapture.prepare("still")` |
| `share.loop` | path or `{ "capture": "loop", "durationMs": 3000–10000 }` | no | for gifts whose magic is motion; a `share.webm` you recorded also works |
| `share.caption` | string ≤ 300 | no | ignored since D26: the calendar uses one fixed caption |
| `share.privateText` | strings | no | names, places and text the privacy preview offers to blur (pair with `data-advent-private`) |
| `downloads[]` | `{ label, file }` | no | wallpapers at real sizes, print files, WAV, sticker sheet, high-score card |
| `print[]` | `{ service, url, product?, price?, currency?, checkedAt?, shipsTo?, file? }` | no | 2–3 real print services that ship to the person's country; the agent never pays or places anything |
| `credits[]` | `{ what, source, license, url? }` | when you adapted anything | licence must be MIT, BSD, ISC, Apache-2.0, CC0, Unlicense, CC BY, OFL or public domain (`credit_license`) |
| `realWorld` | `{ items[], whatsLeft? }` or `null` | no | concierge proposal (see `concierge`); items `{ name, vendor, url, price?, currency?, checkedAt, notes? }` |
| `song` | `{ score, renderSheet?, wav? }` | song gifts | relative paths; a song gift has all three |
| `artifacts[]` | `{ path, kind, title?, role?, alt?, mime? }` | no | extra files the calendar should know about; `alt` on every image |
| `category`, `subtitle` | strings | no | display only |
| `links[]` | `{ label, url }` | no | https links the person may click |
| `network[]` | https origins | no | keep it `[]`: gifts are offline (`network_request`) |
| `incomplete[]` | ≤ 30 strings | no | honest list of what is missing or untested |
| `continuity` | `{ thread?, motifs? }` | no | callbacks for later doors and the finale |
| `agent`, `usage` | objects | no | `{ name?, version? }`, `{ tokens?, usd? }` |

Paths: relative, forward slashes, no `.`/`..` segments, no drive letters, no backslashes, must exist in the package.

## Full example (folder gift)

```jsonc
{
  "schema": "advent-agent/gift@2",
  "day": 7,
  "title": "Your Very Own Jelly Persimmon",
  "ideaId": "jelly-fruit",              // or null for your own invention
  "family": "tactile-toys",
  "emotion": "cute",                    // funny | ridiculous | absurd | cute | touching
  "interaction": ["squeeze", "stretch"],
  "form": "interactive-html",
  "tierUsed": "M",
  "collection": { "set": "jelly-fruits", "index": 1, "size": 3 },   // optional
  "entry": "index.html",
  "note": "You said persimmons taste like autumn pretending to be summer. This one wobbles like it agrees.",
  "share": {
    "still": "share.png",               // or { "capture": "still" }
    "loop": { "capture": "loop", "durationMs": 6000 },   // optional
    "caption": "My AI Secret Santa made me a jelly persimmon",
    "privateText": []
  },
  "downloads": [
    { "label": "Phone wallpaper", "file": "wallpaper-1179x2556.png" }
  ],
  "print": [],                          // real print services; the person decides (D1)
  "realWorld": null,                    // concierge proposal, if any (D1)
  "credits": [
    { "what": "CSS 3D envelope technique", "source": "CSS 3D Lab", "license": "MIT", "url": "https://github.com/Evirtual/css-3d-lab" }
  ]
}
```

(`gift.json` itself is plain JSON: drop the `//` comments.)

A `print` entry looks like this (research allowed, prices checked today):

```json
{ "service": "<real print shop>", "url": "https://…/stickers", "product": "Kiss-cut sticker sheet A5",
  "price": 9.9, "currency": "CHF", "checkedAt": "2026-12-07", "shipsTo": "CH", "file": "print/stickers-a5-bleed.pdf" }
```

## Embedded form (single HTML)

```html
<script type="application/advent-gift+json">
{ "schema": "advent-agent/gift@2", "day": 7, "title": "The Snow Globe of Small Victories",
  "ideaId": "snow-globe-of-your-year", "family": "tactile-toys", "emotion": "touching", "interaction": ["shake"],
  "form": "interactive-html", "tierUsed": "M",
  "note": "Shake gently. I made the snow settle slowly because you said December goes too fast.",
  "share": { "still": { "capture": "still" }, "loop": { "capture": "loop", "durationMs": 6000 },
             "caption": "My Secret Santa put my whole year in a snow globe", "privateText": [] },
  "credits": [] }
</script>
```

`entry` and `artifacts` are optional here; the file itself is the `interactive-html` gift. A `{ "capture": … }` share frame needs `window.adventCapture.prepare(kind)` in the same file.

## Text form

A `.md` or `.txt` file (or pasted text). First line `# Title`. Rendered on paper as a letter, poem or story. Text-only gifts cannot carry `emotion` or a share frame, so prefer an HTML file whenever you can.
