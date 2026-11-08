# Gate problem codes

`advent-agent check` and `check_gift` return `{ code, severity, path?, message }`. Errors block; warnings do not.

| Code | Meaning | Fix |
|---|---|---|
| `manifest_invalid` | `gift.json` or the embedded manifest fails the schema (wrong `schema`, missing `title`/`note`, bad field types, too long) | Compare with `manifest.md`; `schema` must be exactly `advent-agent/gift@1` |
| `file_missing` | A path in `primary`, `artifacts`, or `song` does not exist in the package | Fix the path (case-sensitive, forward slashes) or add the file |
| `nothing_to_show` | No primary, no artifacts, no text, no song, no real-world items: nothing the calendar can render | Add `primary` or at least one artifact |
| `purchase_claim` | A forbidden word appears in `note`, `whatsLeft`, `realWorld.notes` or page text: bought, ordered, booked, purchased, reserved for you, paid for | Rewrite: "I found", "ready for you to order", "Nothing has been ordered or booked." |
| `remote_code` | An HTML file loads a script, module, iframe or stylesheet from an origin not declared in `network` | Inline it. CDN libraries must be pasted into the file |
| `remote_media` (warning) | An HTML file loads an image, font, audio or video from a remote origin | Inline as a data URI or add the file to the package |
| `ref_missing` | HTML references a local file (`src`, `href`) that is not in the package | Add the file or fix the path |
| `ref_outside` | A reference points outside the package (`../`, absolute path) | Keep all files inside the package folder |
| `image_invalid` | An `image` artifact does not decode as PNG/JPEG/GIF/WebP/SVG or has impossible dimensions | Re-export; check the extension matches the content |
| `media_invalid` | An `audio`/`video` artifact does not look like a decodable media file | Re-export as MP3/OGG/WAV or MP4/WebM; check the header |
| `wav_invalid` | `song.wav` is not a valid RIFF/WAVE PCM file | Re-render with `kit/sound/wav.js` (`encodeWav` or `synthesizeScoreToWav`) |
| `score_tracks` | `song.score` has no `tracks` array or it is empty | Add at least one track with notes |
| `score_tempo` | `song.score` has no positive numeric `tempo` | Set `tempo` in BPM |
| `render_sheet_missing` | A `song` gift has no `renderSheet` or the file is missing | Add `assets/render-it-yourself.md` (see sound-studio/references/render-sheet.md) |
| `secret_<kind>` | Possible secret or private data: `secret_openai_key`, `secret_anthropic_key`, `secret_github_token`, `secret_github_pat`, `secret_aws_access_key`, `secret_google_api_key`, `secret_slack_token`, `secret_stripe_key`, `secret_private_key`, `secret_bearer_header`, `secret_env_assignment`, `secret_home_path`, `secret_node_modules`, `secret_calendar_token`, `secret_json_secret` | Remove the text. Never ship `.env`, logs, keys, or paths like `/Users/...` |
| `day_mismatch` | Manifest `day` differs from the door being submitted | Set `day` to the brief's day |
| `too_many_files` | More than 200 files | Remove build artefacts, source maps, node_modules |
| `too_large` | Package over 200 MB (or a single file over its limit; HTML over 8 MB is `html_too_large`) | Compress media; split; lower resolution |
| `path_traversal` | A path contains `..`, starts with `/`, has a drive letter or backslashes | Use plain relative paths |
| `symlink` | The package contains a symbolic link | Replace with a real file |

Other codes you may meet: `manifest_missing` / `manifest_json` (no or unparsable `gift.json`), `zip_invalid`, `file_empty`, `html_shape` (an HTML file without `<html>`/`<body>`), `text_empty`, `pdf_invalid`, `url_credentials`, `currency_missing`, `checked_at` (bad `checkedAt`), `render`/`render_note` (the calendar could not render the gift page or the note). The message always says what to do.
