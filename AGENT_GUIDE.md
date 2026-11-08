# Advent Agent: guide for agents without local tools

You are an AI assistant (a chat model, a cloud agent) and someone has asked you to be the Secret Santa behind one door of their **Advent Agent** calendar. Advent Agent is an open-source, local-first advent calendar: the person's own AI agent makes the gift behind each of the 24 doors, and the calendar reveals it on the day. You have no access to their computer, so you hand them a **gift package** (one HTML file or text) that they drop onto the door. The agent never purchases or books anything; it makes things and, at most, prepares proposals the person can act on.

Full schema: https://raw.githubusercontent.com/suchipizza/Advent-Agent/main/schema/gift.schema.json

## 1. The request you will receive

A short message with: today's date, the door number N, optionally a profile summary (only fields the person chose to share: hobbies, humour, dislikes, language, accessibility, people or pets), recent gift titles, a link to this guide, and "send me the result as one HTML file attached, or as text. Don't show me a preview."

Use only what is in that message. Never invent personal facts. If you know nothing about the person, make something universally delightful: a toy, a poem about the hour and the door, a small game. Write in the person's language.

## 2. What to make

Pick one form you can finish well in a single reply:

- **Interactive HTML**: a card with a flip, a snow globe, a tiny game, a quiz about the season, a word puzzle, a music box, a choose-your-path story, a wallpaper generator.
- **Text**: a letter, a poem in a fixed form, a short story, a zine script.
- **Real-world proposal**: one well-chosen product, book or experience, verified, with a link and price, as text.

Vary from the recent gift titles you were given (change medium and tone). One polished modest gift beats an ambitious broken one.

## 3. Output options

### Option B: one self-contained HTML file (best)

Put this manifest in the `<head>` and attach the file (or paste the whole thing in a code block if attachments are impossible):

```html
<script type="application/advent-gift+json">
{
  "schema": "advent-agent/gift@1",
  "day": 7,
  "title": "The Snow Globe of Small Victories",
  "category": "Interactive toy",
  "note": "Shake it by dragging or pressing Space. I made the snow settle slowly because December goes too fast.",
  "incomplete": []
}
</script>
```

`day` must be the door number you were given. `title` and `category` are shown after the reveal. `note` is your card to the person: two to six warm, specific sentences, no stock phrases, no process talk. `incomplete` lists honestly anything that does not work (empty only if everything works).

### Option C: plain text or markdown

Start with a title line `# Title`, then the text. The calendar renders it on paper. Add your note as a short closing paragraph.

### Real-world proposal (as text)

```
# A book for door 7

item: <exact title, edition, language>
vendor: <shop or publisher>
url: https://…
price: 24.90 CHF
checkedAt: 2026-12-07
constraints: <shipping time, order-by date, sizes, opening hours>
what's left: Open the link, choose the paperback, pay. Nothing has been ordered or booked.

why: <two or three sentences tied to what they shared>
```

Verify the page exists and the price is current on `checkedAt`. Never write "bought", "ordered", "booked", "purchased", "reserved for you" or "paid for". Keep it modest unless a ceiling was given.

## 4. Rules for the HTML file

- **Inline everything**: CSS and JS in the file; images as inline SVG or `data:` URIs. No `<script src>`, no `<link href>` to the web, no external fonts, no `fetch`, no analytics. The file runs offline in a sandboxed frame.
- Use system font stacks (`Georgia, serif`; `system-ui, sans-serif`; `'Caveat','Bradley Hand',cursive` for handwriting).
- **Keyboard and touch**: every action works with keys and with taps; visible focus; buttons at least 44×44 px; text at least 16 px; contrast at least 4.5:1.
- **Reduced motion**: check `matchMedia('(prefers-reduced-motion: reduce)')` and cut animation when it matches. Never flash.
- **No autoplay audio**; sound starts after a click or key. Offer a mute or stop.
- **Reset** where relevant (games, puzzles) without reloading the page.
- Fit a 360 px wide phone and a 1280 px laptop.
- Under about 5 MB. No secrets, no API keys, no file paths, no personal data, no names of third parties.
- `localStorage` may throw in the sandbox: wrap it in try/catch or keep state in memory.

## 5. Sound Studio: a tiny music-box player

Write music as a score: `tempo` (BPM), `tracks[]` with `voice` and `notes[]` where `t` is the start in beats, `p` the MIDI pitch (60 = middle C), `d` the duration in beats and `v` the velocity 0–1. Optional `lyrics: [{ t, text }]`. This player (under 60 lines) plays it with Web Audio, no autoplay:

```html
<button id="play" type="button">Play</button>
<script>
const score = { tempo: 84, tracks: [
  { voice: 'musicbox', notes: [ { t: 0, p: 67, d: 1 }, { t: 1, p: 71, d: 1 }, { t: 2, p: 74, d: 1 }, { t: 3, p: 71, d: 1 },
                                 { t: 4, p: 72, d: 1 }, { t: 5, p: 71, d: 1 }, { t: 6, p: 67, d: 2 } ] },
  { voice: 'bass', notes: [ { t: 0, p: 43, d: 4, v: 0.5 }, { t: 4, p: 48, d: 4, v: 0.5 } ] } ] };
let ctx, master, playing = false;
function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
function voice(name, midi, when, dur, vel) {
  const g = ctx.createGain(); g.connect(master); const f = mtof(midi);
  const o = ctx.createOscillator(); o.connect(g);
  if (name === 'bass') { o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vel * 0.6, when + 0.01);
    g.gain.setValueAtTime(vel * 0.6, when + dur - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, when + dur); }
  else { o.type = 'sine'; o.frequency.value = f;                         // music box: fast attack, long ring
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 4.1;
    const g2 = ctx.createGain(); g2.gain.value = 0.2; o2.connect(g2); g2.connect(g); o2.start(when); o2.stop(when + 1.2);
    g.gain.setValueAtTime(0.0001, when); g.gain.linearRampToValueAtTime(vel * 0.5, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + Math.max(0.6, dur) + 0.6); }
  o.start(when); o.stop(when + Math.max(dur, 0.6) + 0.7);
}
function play() {
  if (playing) return; playing = true;
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  master = master || (() => { const m = ctx.createGain(); m.gain.value = 0.8; m.connect(ctx.destination); return m; })();
  if (ctx.state === 'suspended') ctx.resume();
  const beat = 60 / score.tempo, start = ctx.currentTime + 0.1; let end = 0;
  for (const tr of score.tracks) for (const n of tr.notes) {
    voice(tr.voice, n.p, start + n.t * beat, n.d * beat, n.v ?? 0.8); end = Math.max(end, (n.t + n.d) * beat);
  }
  setTimeout(() => { playing = false; }, (end + 1.5) * 1000);
}
document.getElementById('play').addEventListener('click', play);
</script>
```

Hints: write the melody first (mostly steps, one leap, a clear high point), keep it 30–90 seconds, end on the key note. If the gift *is* a song, include the lyrics with section labels and a short "render it yourself" paragraph (style tags, tempo, key, mood, vocal description) the person can paste into any music tool. Name no provider.

## 6. Quality self-checks before you send

- Open the file in your head: does it load with no network? Any `http` or `https` references besides links the person clicks? Remove them.
- Does every button do something? Does the keyboard reach everything? Is there a reset?
- Is `day` right? Is the manifest valid JSON (watch trailing commas)?
- Is the note warm and specific, free of "I hope this finds you well", "Enjoy!", "delightful", and of process talk?
- Nothing from the `dislikes`/`avoid` fields appears. No invented facts. No personal data, no paths, no keys.
- `incomplete` is honest.

## 7. Honesty

List what does not work in `incomplete` (or in a final line of a text gift). Never claim a feature that is not there. Never invent facts about the person, and never present a guess as knowledge. For real-world finds, say exactly what you verified and when. You never buy or book anything.

## 8. Secrecy

The person may be reading as you work. Do not show a preview, do not describe the gift, do not quote lines from it, do not explain your idea. Produce the file or text, then say only:

> Your gift is wrapped. Open door N in your calendar.

If the platform forces you to show the content inline (a code block), still do not add a description around it.

## 9. How the person adds your gift

They open their calendar, go to door N (the preparation screen) or to the gift shelf ("add a gift for door N"), and drop the HTML file onto the drop zone or paste the text into the paste box. The calendar checks the package (valid manifest, no remote code, no purchase claims, no secrets) and seals it behind the door until the day. Cloud agents cannot reach the person's computer, so the person forwards your attachment or text themselves.
