# Advent Agent: guide for agents without local tools

You are an AI assistant (a chat model, a cloud agent) and someone has asked you to be the Secret Santa behind one door of their **Advent Agent** calendar. Advent Agent is an open-source, local-first advent calendar: the person's own AI agent makes the gift behind each of the 24 doors, and the calendar reveals it on the day. You have no access to their computer, so you hand them a **gift package** (one HTML file, or text) that they drop onto the door. The agent never purchases or books anything; it makes things and, at most, prepares proposals the person can act on.

- Manifest schema: https://raw.githubusercontent.com/suchipizza/Advent-Agent/main/schema/gift.schema.json
- Idea index (49 ideas, with tier and `capability`): https://raw.githubusercontent.com/suchipizza/Advent-Agent/main/gift-library/INDEX.md

## 1. The bar

Opening the door should feel like discovering **a tiny, wonderfully unnecessary piece of the internet that was clearly made for them**. Not another AI-generated greeting card. A flat image with a poem on it is the failure mode.

Every gift hits three criteria. Check them before you write any code:

1. **Emotional effect.** Pick one on purpose: `funny`, `ridiculous`, `absurd`, `cute` or `touching`. One clear feeling beats a mix. Touching gifts land better after the first few days.
2. **Delightful interaction.** Something unexpected happens when they touch, drag, open, shake, squeeze, peel, blow, scratch, tilt, type or wait. Name the verb. The first interaction is discoverable in under 3 seconds (a hint like "shake me", a wobble, a cursor change), and one thing happens that they didn't expect: a second layer, a hidden reaction, an easter egg.
3. **Shareability.** Picture the **share frame** now: the single image (1080×1350) that sums the gift up, legible on a phone. If you can't picture it, change the idea.

## 2. The request you will receive

A short message with: today's date, the door number N, optionally a profile summary (only fields the person chose to share: hobbies, humour, dislikes, things to avoid, language, accessibility, people or pets), recent gift titles, a link to this guide, and "send me the result as one HTML file attached, or as text. Don't show me a preview."

Use what is in that message and what you legitimately remember about the person. **Never invent personal facts.** If you know nothing, make something universally delightful: a snow globe with today's date frosted into the glass, a pop-up card, a tiny game. Write in the person's language. Respect the avoid list. Health, money and relationships in difficulty never go into the share frame.

## 3. Choose what to make

You are a chat model: **stay in tier S or M**. Tier S is one page and one mechanic; tier M is two or three interactions, a personalised illustration, sound. Ideas in the index marked `capability: chat-ok` are designed for you. Use one, combine two, or invent your own with this formula: *a familiar delightful object* × *a surprising tactile interaction* × *something only they would recognise* × *a share frame*.

Good chat-sized gifts: a CSS 3D envelope or pop-up card that opens, a jelly fruit you squeeze, a snow globe you shake, a holo card you tilt, a sticker sheet you peel, a scratch card, a magic 8-ball, a deadpan certificate you stamp, a karaoke song, a small quiz or puzzle about their year.

Personalise the **object**, not just the name: their dog in the globe, their fruit as the jelly, their mountain on the card. A recipe with only the name swapped is a lazy gift. Vary from the recent gift titles (change family, form and verb). One modest gift done beautifully beats an ambitious one that breaks.

## 4. Output: one self-contained HTML file (best)

Put this manifest in the `<head>` and attach the file (or paste the whole thing in one code block if attachments are impossible):

```html
<script type="application/advent-gift+json">
{
  "schema": "advent-agent/gift@2",
  "day": 7,
  "title": "Your Very Own Jelly Persimmon",
  "ideaId": "jelly-fruit",
  "family": "tactile-toys",
  "emotion": "cute",
  "interaction": ["squeeze", "stretch"],
  "form": "interactive-html",
  "tierUsed": "S",
  "note": "You said persimmons taste like autumn pretending to be summer. This one wobbles like it agrees.",
  "share": {
    "still": { "capture": "still" },
    "caption": "My AI Secret Santa made me a jelly persimmon",
    "privateText": []
  },
  "credits": [],
  "incomplete": []
}
</script>
```

- `day` is the door number you were given. `title` is shown after the reveal.
- `ideaId` is the library idea you started from, or `null` for your own invention. `family` comes from the index.
- `emotion` is one of `funny`, `ridiculous`, `absurd`, `cute`, `touching`. `interaction` lists the verbs.
- `tierUsed` is `"S"` or `"M"`.
- `share.still` is `{ "capture": "still" }` (the calendar captures your page through the hook in §5). Add `"loop": { "capture": "loop", "durationMs": 6000 }` (3000–10000) when the magic is motion. `caption` is one line they might post with it, in their language.
- `note` is your card to them: two to four warm, specific sentences saying why you made this. No stock phrases, no explanation of how you built it.
- `credits` lists anything you adapted (§7). `incomplete` lists honestly anything that does not work (empty only if everything works).
- Valid JSON: no comments, no trailing commas.

### Plain text (only when HTML is impossible)

Start with a title line `# Title`, then the text, then your note as a short closing paragraph. The calendar renders it on paper. Text has nothing to touch and no share frame, so prefer HTML.

## 5. The capture hook and private text

The calendar opens your file in a headless browser at 1080×1350 (stills) or 1080×1920 (loops), calls `prepare`, then screenshots or records. Put the page in its most showable state: card opened, globe shaken, fruit mid-squish, high score showing.

```js
window.adventCapture = {
  async prepare(kind) {                       // "still" or "loop"
    document.documentElement.classList.add('is-capturing');   // CSS hides buttons and hints
    openCard();                               // your own function: the showable state
    if (kind === 'loop') startShake();        // the calendar records durationMs from here
    await new Promise((r) => setTimeout(r, 400));             // let transitions settle
  }
};
```

- It needs no click, never plays sound, finishes within 5 seconds, and shows the final state under reduced motion.
- The personal detail is visible. Leave the **bottom-right 160×48 px clear**: the calendar adds a small share mark there. Add no logo, watermark, link or hashtag of your own.
- Put `data-advent-private` on any element with a name, a place or anything the person might not want to post (`<span data-advent-private>Biscuit</span>`), and list those strings in `share.privateText`. The calendar's privacy preview offers to blur them before anything is shared.

## 6. Rules for the HTML file

- **Offline, always.** CSS and JS inline; images as inline SVG or `data:` URIs. No `<script src>` or `<link href>` to the web, no CDN, no external fonts, no `fetch`, `XMLHttpRequest`, `WebSocket` or `EventSource`, no analytics. The calendar rejects network requests. Links the person clicks are fine.
- Prefer CSS 3D transforms, CSS animation, canvas and Web Audio over large libraries. Write physics yourself in a few lines (springs, gravity).
- Keep it under about **1,500 lines**. Polish beats size.
- System font stacks: `Georgia, serif`; `system-ui, sans-serif`; `'Caveat','Bradley Hand',cursive` for handwriting.
- **Keyboard and touch**: every action works with keys and with taps; visible focus; buttons at least 44×44 px; text at least 16 px; contrast at least 4.5:1.
- **Reduced motion**: check `matchMedia('(prefers-reduced-motion: reduce)')` and cut animation when it matches. Never flash.
- **No autoplay audio**. Sound starts after a click or key. Every gift with sound has **mute**; every game has **restart**.
- Fit a 360 px wide phone and a 1280 px laptop. The file works opened straight from disk.
- Under about 5 MB. No secrets, no API keys, no file paths.
- `localStorage` may throw in the sandbox: wrap it in try/catch or keep state in memory.

## 7. Credits

You may adapt code or assets only under MIT, BSD, ISC, Apache-2.0, CC0, Unlicense, CC BY (art and sound), OFL (fonts) or public domain. List each adapted piece in `credits`: `{ "what": "CSS 3D envelope", "source": "CSS 3D Lab", "license": "MIT", "url": "https://github.com/Evirtual/css-3d-lab" }`. GPL, NonCommercial, NoDerivatives and unlicensed work are **inspiration only**: rewrite the technique yourself. Never use a brand's mascot or a recognisable character.

## 8. Sound: a tiny karaoke player

Write music as a score: `tempo` (BPM), `tracks[]` with `voice` and `notes[]` where `t` is the start in beats, `p` the MIDI pitch (60 = middle C), `d` the duration in beats and `v` the velocity 0–1. `lyrics: [{ t, text }]` time each word to a beat. This player (under 60 lines) plays it with Web Audio, highlights each word as it sounds, has mute, and never autoplays:

```html
<button id="play" type="button">Play</button> <button id="mute" type="button" aria-pressed="false">Mute</button>
<p id="lyrics"></p>
<style>#lyrics span{padding:0 2px;border-radius:4px}#lyrics span.on{background:#E7C890}</style>
<script>
const score = { tempo: 84, tracks: [
  { voice: 'musicbox', notes: [ { t: 0, p: 67, d: 1 }, { t: 1, p: 71, d: 1 }, { t: 2, p: 74, d: 1 }, { t: 3, p: 71, d: 1 },
                                 { t: 4, p: 72, d: 1 }, { t: 5, p: 71, d: 1 }, { t: 6, p: 67, d: 2 } ],
    lyrics: [ { t: 0, text: 'Snow' }, { t: 1, text: 'on' }, { t: 2, text: 'the' }, { t: 3, text: 'blue' },
              { t: 4, text: 'ket-' }, { t: 5, text: 'tle' }, { t: 6, text: 'lid' } ] },
  { voice: 'bass', notes: [ { t: 0, p: 43, d: 4, v: 0.5 }, { t: 4, p: 48, d: 4, v: 0.5 } ] } ] };
const words = score.tracks.flatMap((tr) => tr.lyrics || []).sort((a, b) => a.t - b.t);
const line = document.getElementById('lyrics');
const spans = words.map((w) => { const s = document.createElement('span'); s.textContent = w.text; line.append(s, ' '); return s; });
let ctx, master, playing = false, muted = false;
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
  master = master || (() => { const m = ctx.createGain(); m.connect(ctx.destination); return m; })();
  master.gain.value = muted ? 0 : 0.8; if (ctx.state === 'suspended') ctx.resume();
  const beat = 60 / score.tempo, start = ctx.currentTime + 0.1; let end = 0;
  for (const tr of score.tracks) for (const n of tr.notes) {
    voice(tr.voice, n.p, start + n.t * beat, n.d * beat, n.v ?? 0.8); end = Math.max(end, (n.t + n.d) * beat);
  }
  (function highlight() {                                                // lyrics follow the score's beats
    const b = (ctx.currentTime - start) / beat; let cur = -1;
    words.forEach((w, i) => { if (b >= w.t) cur = i; });
    spans.forEach((s, i) => s.classList.toggle('on', i === cur));
    if (b * beat < end + 0.5) requestAnimationFrame(highlight); else { playing = false; spans.forEach((s) => s.classList.remove('on')); }
  })();
}
document.getElementById('play').addEventListener('click', play);
document.getElementById('mute').addEventListener('click', (e) => {
  muted = !muted; e.target.setAttribute('aria-pressed', String(muted)); e.target.textContent = muted ? 'Unmute' : 'Mute';
  if (master) master.gain.value = muted ? 0 : 0.8;
});
</script>
```

Hints: write the melody first (mostly steps, one leap, a clear high point), keep it 30–90 seconds, end on the key note, one syllable per note, the chorus repeated exactly. A song gift also includes a **render-it-yourself** section on the page: the lyrics with section labels (`[Verse 1]`, `[Chorus]`), style tags, tempo, key, mood, a vocal description and one ready-to-paste prompt the person can use with any music tool. Name no provider. For the share frame, `prepare` shows the chorus line highlighted, without playing sound.

## 9. Real-world proposals and print services

If you can browse the web and the person allows real-world suggestions, you may propose one well-chosen product, book or experience instead of (or inside) an HTML gift. Verify the page exists, record the price with its currency and the date you checked, and keep it modest unless a ceiling was given. As text:

```
# A book for door 7

item: <exact title, edition, language>
vendor: <shop or publisher>
url: https://…
price: 24.90 CHF
checkedAt: 2026-12-07
constraints: <shipping time, last date for Christmas delivery, sizes, opening hours>
what's left: Open the link, choose the paperback, pay. The choice is yours.

why: <two or three sentences tied to what they shared>
```

For printable gifts (stickers, poster, cards), you may add 2–3 real print services that ship to the person's country to the manifest's `print` list: `{ "service", "url", "product", "price", "currency", "checkedAt", "shipsTo" }`.

**Never write "bought", "ordered", "booked", "purchased", "reserved for you" or "paid for"**, not even in a negation such as "nothing has been …": the calendar rejects the word itself. Say what is left for them instead: "The choice is yours: open the link to buy it." or "Prepared for you. Buying or booking is yours to decide."

## 10. Quality self-checks before you send

- Three criteria: one emotion, a first interaction found in 3 seconds plus one surprise, a share frame `prepare` really produces.
- Open the file in your head: does it load with no network? Any `http` or `https` references besides links the person clicks? Remove them.
- Does every button do something? Does the keyboard reach everything? Is there mute and restart where needed?
- Is `day` right? Is the manifest valid JSON with `schema`, `emotion`, `interaction`, `tierUsed` and `share`?
- Is the note warm and specific, free of "I hope this finds you well", "Enjoy!", "delightful", and of process talk?
- Nothing from the avoid list. No invented facts. Names and places marked `data-advent-private`. No paths, no keys.
- `credits` complete and licences allowed. `incomplete` honest.

## 11. Honesty

List what does not work in `incomplete` (or in a final line of a text gift). Never claim a feature that is not there. Never invent facts about the person, and never present a guess as knowledge. For real-world finds, say exactly what you verified and when. You never buy or book anything.

## 12. Secrecy

The person may be reading as you work. Do not show a preview, do not describe the gift, do not quote lines from it, do not explain your idea. Produce the file or text, then say only:

> Your gift is wrapped. Open door N in your calendar.

If the platform forces you to show the content inline (a code block), still do not add a description around it. Do not tease tomorrow's door.

## 13. How the person adds your gift

They open their calendar, go to door N (the preparation screen) or to the gift shelf ("add a gift for door N"), and drop the HTML file onto the drop zone or paste the text into the paste box. The calendar checks the package (valid manifest, share frame, no network requests, no purchase words, no secrets) and seals it behind the door until the day. Cloud agents cannot reach the person's computer, so the person forwards your attachment or text themselves.
