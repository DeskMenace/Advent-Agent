# Hero GIF: shot list

One GIF for the top of the README, about 12 to 15 seconds, looping. **It must cut before any gift is visible**: the whole point of the calendar is that nobody sees what is inside. No gift screenshots anywhere in the README or the social preview.

Use the fixture calendar so nothing real is on screen and no agent runs:

```sh
npx tsx scripts/fixture-calendar.ts --day 8   # prints a one-time login link; open it in a clean browser window
```

Add `?gary=0` to the URL if you want the board without Gary, or leave him on for one shot.

## Setup

- Browser window about 1280 × 800, light theme, no bookmarks bar, no extensions icons, a clean profile.
- Terminal in a plain dark theme, large font (18 px or more), prompt reduced to `$`. No path, username or hostname visible. Check the title bar too.
- Record at 2x if you can, then export at 1280 px wide, 20 to 24 fps, under 5 MB (gifski or ffmpeg palette). Keep a short MP4 as well for the social posts.

## Shots

| # | Time | What is on screen | Notes |
|---|---|---|---|
| 1 | 0:00 to 0:02 | Terminal: type `npx advent-agent` and press Enter | Keep the typing at natural speed; cut the download wait |
| 2 | 0:02 to 0:04 | The browser opens on the calendar's landing page: headline, the wooden board | Hold on the headline for a beat |
| 3 | 0:04 to 0:06 | Onboarding: "Which agent?" with an agent selected, then "Who is your Secret Santa?" | Do not show any real persona name or project path: use the fixture persona or the "Just my agent" choice |
| 4 | 0:06 to 0:08 | Back on the board. A door unlocks: click an envelope | Choose a door that is unlocked in the fixture (day 8) |
| 5 | 0:08 to 0:10 | The present wobbles in the pop-up | This is the anticipation shot: let it wobble twice |
| 6 | 0:10 to 0:12 | The lid pops | **Cut here**, on the first frame of the lid opening. Do not show the contents |
| 7 | 0:12 to 0:14 | End card: the board with a few open envelopes and the line "Your AI coding agent is your Secret Santa." | Optional; the social preview image is a good still for this |

## Before you publish it

- Pause the recording on every frame of shots 5 and 6 and check that no part of a gift is visible, including a thumbnail, a title or a reflection.
- Check the whole frame for personal information: terminal title, browser tabs, notifications, your name in the menu bar.
- Save it as `docs/media/hero.gif` and replace the comment at the top of the README with `![Advent Agent: from npx to an unopened gift](docs/media/hero.gif)`.
