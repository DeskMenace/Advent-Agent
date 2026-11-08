# Quality and Packaging: great vs lazy

## Manifest
- **Great:** `schema`, `day` from the brief, a spoiler-safe `title`, `category`, a real `note`, `primary: index.html`, every artifact with `kind`, `alt` for images, `continuity` set, `incomplete` honest.
- **Lazy:** `day: 1` on door 9, `note: "Enjoy!"`, artifacts pointing at `Index.HTML` that does not exist.

## Running the gate
- **Great:** `advent-agent check ./gift --day 9`, read all problems, fix each, re-run until clean, then submit once.
- **Lazy:** Submit without checking, get `remote_code`, add the CDN origin to `network` to silence it instead of inlining.

## Secret hygiene
- **Great:** Grep the package for `sk-`, `/Users/`, `token`, `@`; no logs, no `.env`, no notes-to-self in the folder.
- **Lazy:** Ship `debug.log` with the workspace path, a `.env` with a key, and the recipient's email in a comment.

## Incomplete list
- **Great:** `["Level 3 is a placeholder with one enemy", "WebM export untested on Safari"]`.
- **Lazy:** `[]` while two buttons do nothing, or `["some polish"]`.

## Single-file HTML
- **Great:** One file, 1.2 MB, fonts from system stacks, images as data URIs, embedded manifest, works offline.
- **Lazy:** 6 MB of base64 video plus three `<script src="https://…">` tags and a web font link.
