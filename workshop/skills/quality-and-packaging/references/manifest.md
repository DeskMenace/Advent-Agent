# gift.json reference (schema advent-agent/gift@1)

| Field | Type | Required | Notes |
|---|---|---|---|
| `schema` | `"advent-agent/gift@1"` | yes | exact string |
| `day` | integer 1–24 | yes | must equal the door you were asked to prepare (`day_mismatch`) |
| `title` | string 1–160 | yes | shown after the reveal |
| `category` | string ≤ 80 | no | e.g. "Interactive toy", "Letter", "Song", "Real-world find" |
| `subtitle` | string ≤ 300 | no | one line under the title |
| `note` | string 1–8000 | yes | your card to the recipient |
| `primary` | relative path | no | the main page or file to open first |
| `artifacts[]` | ≤ 200 items | no | `{ path, kind, title?, role?, alt?, mime? }` |
| `artifacts[].kind` | string | yes | `interactive-html`, `image`, `audio`, `video`, `document`, `card`, `song`, `real-world`, `link`, `download` |
| `artifacts[].role` | enum | no | `primary`, `download`, `asset`, `thumbnail`, `print`, `transcript`, `caption` |
| `song` | object | no | `{ score, renderSheet?, wav? }` relative paths; a song gift should have all three |
| `realWorld` | object | no | `{ items: [{ name, vendor, url, price?, currency?, checkedAt, notes? }], whatsLeft }` |
| `links[]` | ≤ 30 | no | `{ label, url }` https only |
| `network[]` | ≤ 10 https origins | no | origins the gift wants to load; the recipient must consent; prefer `[]` |
| `incomplete[]` | ≤ 30 strings | no | honest list of what is missing or untested |
| `continuity` | object | no | `{ thread?, motifs? }` for callbacks in later doors |
| `agent` | object | no | `{ name?, version? }` |
| `usage` | object | no | `{ tokens?, usd? }` |

Paths: relative, forward slashes, no `.`/`..` segments, no drive letters, no backslashes, must exist in the package.

## Embedded form (single HTML)

```html
<script type="application/advent-gift+json">
{ "schema": "advent-agent/gift@1", "day": 7, "title": "The Snow Globe", "category": "Interactive toy",
  "note": "Shake gently. I made the snow settle slowly because you said December goes too fast." }
</script>
```

`primary` and `artifacts` are optional here; the file itself is the `interactive-html` gift.

## Text form

A `.md` or `.txt` file (or pasted text). First line `# Title`. Rendered on paper as a letter, poem or story.
