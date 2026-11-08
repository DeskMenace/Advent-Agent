# Sharing, exports and gift.json

The calendar runs locally, so a link to a gift would point at the user's own computer and work for nobody else. **Sharing means exporting media.** You prepare what can be exported. The calendar's gift page shows the Share button, the export menu and the share mark.

## What you provide

| Output | When | How |
|---|---|---|
| **Share frame** (required) | Every gift | A `share.png` (1080×1350) **or** a capture recipe: the page state the calendar should capture (see below) |
| **Share loop** | Gifts whose magic is motion (shake, bloom, peel, splash) | A capture recipe with `durationMs` 3000–10000. The calendar records it as MP4/GIF. You can also provide `share.webm` yourself using the kit's canvas recorder |
| **Standalone version** | Interactive gifts | `index.html` must work alone when opened from disk (no calendar runtime required), so the user can send the file to a friend |
| **Downloads** | When natural | Wallpapers at real device sizes, a printable PDF/PNG, a sticker sheet, a WAV of the song, a high score card |
| **Print files** | Stickers, posters, cards, zines | Print-ready files at real sizes with bleed, plus real print services if research is allowed (price, currency, date checked; never ordering) |

### Capture recipe

When a static `share.png` can't capture the gift (CSS 3D, physics, live interaction), expose a capture hook:

```js
// in index.html
window.adventCapture = {
  async prepare(kind) {   // kind: "still" | "loop"
    // put the gift into its most showable state: card opened, globe shaken,
    // all three fruits on the plate, the high score screen…
  }
};
```

The calendar opens the gift in a headless browser at 1080×1350 (or 1080×1920 for loops), calls `prepare`, then screenshots or records it.

### Design rules for share frames

- Readable on a phone, at a glance, with no explanation.
- The personal detail is visible: their dog, their fruit, their title.
- Leave the bottom-right 160×48 px clear. The calendar adds the share mark there.
- Do not add your own logo, watermark, links or hashtags.

## What the calendar adds (not you)

- **Share mark** on every exported image, video and standalone file: *"Made by my Advent Agent · more gifts at deskmenace.com"* plus a small GitHub logo linking to the repository. Small, quiet, bottom-right.
- **Privacy preview** before anything leaves the device: what is visible, with one tap to blur names, places or text you marked as private. Mark private regions with `data-advent-private` on the element or list them in `share.privateText`.
- The note from you, shown on the gift page (it is included in exports only if the user chooses).

## gift.json

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
  "print": [],                          // real-world print options (never purchased)
  "realWorld": null,                    // concierge proposal, if any (D1)
  "credits": [
    { "what": "CSS 3D envelope technique", "source": "CSS 3D Lab", "license": "MIT", "url": "https://github.com/Evirtual/css-3d-lab" }
  ]
}
```

`credits` is required whenever you adapt third-party code, art, fonts or sounds. The check fails if a credited licence is not on the allowed list in `inspiration-sources.md`.
