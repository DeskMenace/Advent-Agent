# The README clip: Door 1 opening

There is no hero GIF and no sample gift anywhere (README, website, social preview, posts): what is inside a door is the surprise (`docs/handoff/DECISIONS.md`, D34). The README shows one short clip, `docs/media/door-1-opening.gif`: the board, a click on envelope 1, the present wobbles, the lid pops, and it stops there.

## Record it again

```sh
npx tsx scripts/record-door-gif.ts          # writes docs/media/door-1-opening.gif
```

It needs ffmpeg on your PATH. The script starts the fixture calendar in a temporary home (no agent runs, nothing of yours is on screen), records the page with Playwright, and holds the reveal request back, so no part of a gift is ever drawn into the video. Gary is off (`?gary=0`).

## Before you commit a new clip

- Step through the frames and check that nothing of a gift is visible: no title, no thumbnail, no note.
- Keep it under 5 MB.
- For social posts, record the same flow as a video; the same rule applies: cut before the gift.
