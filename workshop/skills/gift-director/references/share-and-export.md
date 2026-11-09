# Sharing, exports and gift.json

The calendar runs locally, so a link to a gift would point at the user's own computer and work for nobody else. **Sharing means exporting media.** You prepare what can be exported. The calendar shows Share (a picture or short video, handed off to a network) and Save (the gift itself in its natural format).

## What you provide

| Output | When | How |
|---|---|---|
| **Share frame** (required) | Every gift | A `share.png` (1080×1350) **or** a capture recipe: the page state the calendar should capture (see below) |
| **Share loop** | Gifts whose magic is motion (shake, bloom, peel, splash) | A capture recipe with `durationMs` 3000–10000. The calendar records it as MP4/GIF. You can also provide `share.webm` yourself using the kit's canvas recorder |
| **Primary file** (Save) | Every gift that has one | The gift in its natural format: the PNG of an image or card, the WAV/MP3 of a song, a PDF of a book or styled text. Name it in `save`. For an HTML gift, `index.html` itself is saved with its local assets inlined, so it must work alone when opened from disk |
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
- Do not add your own logo, watermark, links or hashtags.

## What the calendar adds (not you)

- Nothing on the gift. Exports carry no mark, logo or link: they are your gift only.
- **Privacy preview** before anything leaves the device, with one tap to blur names, places or text you marked as private. Mark private regions with `data-advent-private` on the element or list them in `share.privateText`.
- A fixed caption and link for the share hand-off. You don't write a caption.
- Your note, shown exactly as you wrote it in a small terminal window under the gift, signed with your `signature` if you gave one. Nothing is shown if you leave the note out.

### What Save gives the user

| Gift form | Save gives |
|---|---|
| Image, card, artwork, wallpaper | Your image file (name it in `save`) |
| Motion | The loop as MP4 (WebM without ffmpeg) and GIF |
| Interactive | Your `index.html` with local assets inlined |
| Song or audio | Your audio file, and the lyrics as .txt from the score |
| Styled text (HTML document) | A PDF of your page |
| Plain text | The .txt |
| Real book or experience | A bare page with only the details you gave |
| `downloads` and `print` files | Further items in the Save menu |

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
  "signature": "Pip",                   // optional, any name you like, or leave it out
  "save": { "file": "jelly-persimmon.png", "type": "image/png" },   // optional: the gift's primary file
  "share": {
    "still": "share.png",               // or { "capture": "still" }
    "loop": { "capture": "loop", "durationMs": 6000 },   // optional
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
