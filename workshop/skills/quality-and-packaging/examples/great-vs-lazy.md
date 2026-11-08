# Quality and Packaging: great vs lazy

## Manifest
- **Great:** `gift@2`, `day` from the brief, a spoiler-safe `title`, `emotion: "absurd"`, `interaction: ["peel"]`, `tierUsed` honest, `share.still` as a capture request with a hook that peels the first sticker, a `caption` in the person's language, `credits` for the one MIT snippet adapted, `incomplete` honest.
- **Lazy:** `day: 1` on door 9, `note: "Enjoy!"`, no `emotion`, no `share`, `entry` pointing at `Index.HTML` that does not exist.

## Share frame
- **Great:** `prepare("still")` opens the pop-up card, hides the buttons, waits 400 ms for the paper to settle; the dog's name sits in a `data-advent-private` span; the bottom-right corner is empty.
- **Lazy:** No hook, so the still shows the closed envelope and a "Click to open" hint; the agent's own "made with ♥ by AI" watermark sits where the share mark goes.

## Running the gate
- **Great:** `advent-agent check ./gift --day 9`, read all problems, fix each, re-run until clean, then submit once.
- **Lazy:** Submit without checking, get `network_request` for a CDN copy of three.js, and add the origin to `network` instead of inlining the vendored copy.

## Credits
- **Great:** The CSS 3D crystal is adapted from an MIT snippet, credited with source, licence and URL. The bloom effect seen on a no-licence demo was rewritten from scratch and is not copied.
- **Lazy:** A GPL particle library pasted in and credited as "GPL-3.0", which fails `credit_license`.

## Purchase words
- **Great:** "The choice is yours: open the link to buy it."
- **Lazy:** A reassuring negation that names the purchase word anyway, which still trips `purchase_claim` because the word itself is in it.

## Secret hygiene
- **Great:** Grep the package for `sk-`, `/Users/`, `token`, `@`; no logs, no `.env`, no notes-to-self in the folder.
- **Lazy:** Ship `debug.log` with the workspace path, a `.env` with a key, and the recipient's email in a comment.

## Incomplete list
- **Great:** `["Level 3 is a placeholder with one enemy", "WebM export untested on Safari"]`.
- **Lazy:** `[]` while two buttons do nothing, or `["some polish"]`.

## Single-file HTML
- **Great:** One file, 1.2 MB, system font stacks, images as data URIs, embedded manifest, capture hook, works offline and opened from disk.
- **Lazy:** 6 MB of base64 video plus three `<script src="https://…">` tags and a web font link.
