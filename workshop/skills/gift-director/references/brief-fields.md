# brief.json fields (AGENT_CONNECTIONS §4)

| Field | Meaning | Use |
|---|---|---|
| `season`, `day`, `date` | Year, door number 1–24, ISO date in the season's time zone | `day` goes into the manifest unchanged |
| `locale`, `language`, `timeZone` | Recipient's locale, language code, IANA zone | Write in `language`; format dates for `locale` |
| `mode` | `launched`, `connected`, `portable`, `submit` | Decides secrecy and hand-over |
| `recipient` | Optional, only shared fields: hobbies, humour, dislikes, avoid, language, accessibility, people, pets | Facts you may use; `dislikes`/`avoid` are hard rules |
| `history[]` | `{day, title, kind, category, motifs, thread, feedback}` for opened or sealed earlier doors only | Vary medium; pick up threads |
| `budgets` | `tokenTarget`, `tokenEnforced`, `usdCapPerGift`, `realWorldSuggestions`, `priceCeilingPerGift`, `priceCeilingSeason`, `rule` | Scope the work; respect ceilings |
| `permissions` | `webResearch`, `inspirationFolders[]`, `giftNetwork` | If `giftNetwork` is false, inline everything |
| `capabilities` | `renderers[]`, `workshopPath`, `skills[]`, `providers[]` | Pick kinds the calendar can show |
| `modeNotes[]` | Plain sentences about this mode | Follow them literally |
| `library` | `howTo`, `count` | Optional inspiration |
| `packaging` | `format`, `check`, `submit`, `progress` | The exact commands for this mode |
| `workspace`, `attempt`, `previousProblems[]` | Where you are, which try this is, what the gate rejected last time | Fix `previousProblems` first on a retry |
