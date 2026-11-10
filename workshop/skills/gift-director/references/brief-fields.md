# brief.json fields (AGENT_CONNECTIONS §4)

| Field | Meaning | Use |
|---|---|---|
| `season`, `day`, `date` | Year, door number 1–24, ISO date in the season's time zone | `day` goes into the manifest unchanged |
| `season.anchor` | `day1`, `finale` or `null` (when present) | Day 1: choose among `anchor: day1` ideas; December 24: `anchor: finale` or something that size |
| `season.isCatchUp` | The door is being caught up after a gap (when present) | Lighter, more varied; never mention the delay |
| `locale`, `language`, `timeZone` | Recipient's locale, language code, IANA zone | Write in `language`; format dates and prices for `locale`; print services ship to this country |
| `mode` | `launched`, `submit` | Launched: you are started by the calendar and it submits `./doors/NN/gift` if you exit without submitting |
| `list` | Lines about the recipient, each with its source | Real details you should use (one or two per gift, varied: never one the last three gifts used; record them as `detailsUsed`); empty means do not invent facts |
| `persona` | Present when the recipient chose a persona | Speak in its voice and sign the note with its name |
| `cwd`, `workspace` | Your start folder (season workspace) and this door's subfolder | Write only into your door's folder |
| `recipient` | Optional, only fields they told us directly: hobbies, humour, dislikes, avoid, language, accessibility, people, pets | Facts you may use; `dislikes`/`avoid` are hard rules |
| `history[]` | `{day, title, kind, category, motifs, thread, feedback}` plus `family`, `emotion`, `interaction`, `collection` when present | Rotation rules: no repeated family, form or verb within 3 days; emotion mix; callbacks for the finale |
| `collections` | Sets started this season and how many items each has (when present) | At most 2 sets, 3 items each, 4+ days apart |
| `budget.tier`, `budget.tokens` | `S`, `M`, `L` or `XL` and an advisory token count (when present) | Choose an idea whose minimum `tier` fits; write `tierUsed` |
| `budgets` | `tokenTarget`, `tokenEnforced`, `usdCapPerGift`, `realWorldSuggestions`, `priceCeilingPerGift`, `priceCeilingSeason`, `rule` | Scope the work; respect ceilings |
| `permissions` | `webResearch`, `inspirationFolders[]`, `giftNetwork` | Without `webResearch`, no real-world items or print services. Gifts are offline either way: inline everything |
| `capabilities` | `renderers[]`, `workshopPath`, `skills[]`, `providers[]` | Kit blocks live under `workshopPath/kit` |
| `modeNotes[]` | Plain sentences about this mode | Follow them literally |
| `library` | `howTo`, `count` | Ideas to start from (`list_ideas`, `read_idea`) |
| `packaging` | `format`, `check`, `submit`, `progress` | The exact commands for this mode |
| `workspace`, `attempt`, `previousProblems[]` | Where you are, which try this is, what the gate rejected last time | Fix `previousProblems` first on a retry |
