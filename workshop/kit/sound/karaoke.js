// kit/sound/karaoke.js — karaoke player: lyrics highlighted word by word in time with a score (Web Audio, inline synth, no autoplay).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createKaraoke, lyricLines } from './karaoke.js';
//   const score = { tempo: 96, tracks: [{ voice: 'musicbox', notes: [{ t: 0, p: 72, d: 1 }, { t: 1, p: 76, d: 1 }],
//     lyrics: [{ t: 0, text: 'Hap-' }, { t: 1, text: 'py' }, { t: 4, text: 'Tuesday' }] }] };
//   const k = createKaraoke(document.querySelector('#stage'), score, { beatsPerLine: 4, title: 'A song for Ana' });
//   // Nothing plays until the user presses Play (the AudioContext is created on that click).
//   k.play(); k.pause(); k.restart(); k.mute(true); k.seek(8);           // seek in beats
//   k.onWord = (word, line) => {};  k.onEnd = () => {};                   // optional hooks
//   lyricLines(score, { beatsPerLine: 4 }) → [{ start, end, words: [{ t, text, end }] }]   (pure)
//   window.adventCapture = { async prepare() { k.seek(4); } };            // shows a highlighted line for the share still
//   Reduced motion: no bounce animation, highlight still moves. Space toggles play when the stage has focus.

const DRUMS = ['kick', 'snare', 'hat'];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const b2s = (beats, tempo) => (beats * 60) / tempo;

function allLyrics(score) { return (score.tracks || []).flatMap((tr) => tr.lyrics || []).filter((l) => l && typeof l.text === 'string').sort((a, b) => a.t - b.t); }
export function totalBeats(score) {
  let end = 0;
  for (const tr of score.tracks || []) { for (const n of tr.notes || []) end = Math.max(end, n.t + n.d); for (const l of tr.lyrics || []) end = Math.max(end, l.t + 1); }
  return end;
}

/** Group lyrics into lines. A new line starts every `beatsPerLine` beats, or at a lyric whose text starts with "/" or after one ending in "\n". Pure. */
export function lyricLines(score, { beatsPerLine = 8 } = {}) {
  const lyr = allLyrics(score); const lines = []; let cur = null; let forceBreak = false;
  for (let i = 0; i < lyr.length; i++) {
    const l = lyr[i]; let text = l.text; let brk = forceBreak;
    if (text.startsWith('/')) { brk = true; text = text.slice(1); }
    forceBreak = /\n$/.test(text); text = text.replace(/\n$/, '');
    const lineIndex = Math.floor(l.t / beatsPerLine);
    if (!cur || brk || cur.index !== lineIndex) { cur = { index: lineIndex, start: l.t, end: l.t, words: [] }; lines.push(cur); }
    const next = lyr[i + 1]; const end = next ? next.t : l.t + 1;
    cur.words.push({ t: l.t, text, end }); cur.end = end;
  }
  for (let i = 0; i < lines.length; i++) { const nxt = lines[i + 1]; if (nxt) lines[i].end = Math.min(lines[i].end, nxt.start); delete lines[i].index; }
  return lines;
}
/** Which line/word is active at `beat`. Returns { line, word } indices (-1 when before the first or between lines). Pure. */
export function activeWord(lines, beat) {
  for (let li = 0; li < lines.length; li++) {
    const L = lines[li]; if (beat < L.start) return { line: li > 0 && beat < lines[li - 1].end ? li - 1 : -1, word: -1, upcoming: li };
    if (beat < L.end || li === lines.length - 1) {
      let w = -1; for (let wi = 0; wi < L.words.length; wi++) if (L.words[wi].t <= beat) w = wi;
      if (li === lines.length - 1 && beat >= L.end) return { line: li, word: L.words.length - 1, done: true };
      return { line: li, word: w };
    }
  }
  return { line: -1, word: -1 };
}

/** Minimal synth (duplicated on purpose: no cross-file imports). */
export function createMiniSynth(volume = 0.7) {
  let ctx = null, master = null, noise = null; const live = new Set(); let muted = false;
  function ensure() {
    if (ctx) return ctx; const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) throw new Error('Web Audio is not available');
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : volume; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function track(node, stopAt) { live.add(node); node.onended = () => live.delete(node); node.start(Math.max(stopAt[0], ctx.currentTime)); node.stop(stopAt[1]); }
  function play(voice, pitch, when, dur, vel = 0.8) {
    ensure(); const g = ctx.createGain(); g.connect(master); const t = Math.max(when, ctx.currentTime);
    if (DRUMS.includes(voice)) {
      const src = ctx.createBufferSource(); src.buffer = noise; const f = ctx.createBiquadFilter();
      f.type = voice === 'hat' ? 'highpass' : voice === 'snare' ? 'bandpass' : 'lowpass'; f.frequency.value = voice === 'hat' ? 7000 : voice === 'snare' ? 1800 : 150;
      const len = voice === 'hat' ? 0.05 : voice === 'snare' ? 0.15 : 0.25;
      g.gain.setValueAtTime(vel * (voice === 'kick' ? 1.2 : 0.5), t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
      src.connect(f); f.connect(g); track(src, [t, t + len + 0.05]);
      if (voice === 'kick') { const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.2); o.connect(g); track(o, [t, t + 0.3]); }
      return;
    }
    const o = ctx.createOscillator(); o.frequency.value = mtof(pitch);
    o.type = voice === 'pad' ? 'sawtooth' : voice === 'bass' ? 'triangle' : voice === 'pluck' ? 'square' : 'sine';
    const peak = vel * (voice === 'pad' ? 0.12 : voice === 'pluck' ? 0.1 : 0.3);
    const a = voice === 'pad' ? 0.2 : 0.004; const rel = voice === 'musicbox' ? 0.8 : voice === 'pad' ? 0.6 : 0.2;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
    if (voice === 'musicbox' || voice === 'pluck') g.gain.exponentialRampToValueAtTime(0.001, t + dur + rel);
    else { g.gain.setValueAtTime(peak * 0.8, t + Math.max(a, dur)); g.gain.linearRampToValueAtTime(0, t + dur + rel); }
    let out = o; if (voice === 'pad') { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; o.connect(f); out = f; }
    if (voice === 'musicbox') { const o2 = ctx.createOscillator(); o2.frequency.value = mtof(pitch) * 4; const g2 = ctx.createGain(); g2.gain.value = 0.15; o2.connect(g2); g2.connect(g); track(o2, [t, t + dur + rel]); }
    out.connect(g); track(o, [t, t + dur + rel + 0.05]);
  }
  return {
    ensure, play,
    get ctx() { return ctx; },
    now: () => (ctx ? ctx.currentTime : 0),
    resume: async () => { ensure(); if (ctx.state === 'suspended') await ctx.resume(); },
    stopAll() { for (const n of live) { try { n.stop(); } catch {} } live.clear(); },
    mute(m = !muted) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : volume, ctx.currentTime, 0.02); return muted; },
    get muted() { return muted; },
  };
}

const CSS = `
.kk{--kk-ink:#fdf6e3;--kk-dim:rgba(253,246,227,.45);--kk-hi:#ffcf4a;--kk-bg:#1d1630;background:var(--kk-bg);color:var(--kk-ink);border-radius:18px;padding:24px 20px;font:600 clamp(20px,5vw,34px)/1.35 system-ui,sans-serif;text-align:center;outline:none;position:relative}
.kk:focus-visible{box-shadow:0 0 0 3px var(--kk-hi)}
.kk-title{font-size:.5em;letter-spacing:.12em;text-transform:uppercase;opacity:.7;margin:0 0 12px}
.kk-lines{min-height:4.2em;display:flex;flex-direction:column;justify-content:center;gap:.25em}
.kk-line{color:var(--kk-dim);transition:color .2s,transform .3s;margin:0}
.kk-line.is-current{color:var(--kk-ink)}
.kk-line.is-next{font-size:.75em}
.kk-w{display:inline-block;margin:0 .14em;transition:color .12s}
.kk-w.is-sung{color:var(--kk-hi)}
.kk-w.is-now{color:var(--kk-hi);transform:translateY(-.08em) scale(1.08)}
.kk-bar{height:4px;background:rgba(255,255,255,.15);border-radius:2px;margin:16px 0 12px;overflow:hidden}.kk-bar>i{display:block;height:100%;width:0;background:var(--kk-hi)}
.kk-ctl{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.kk-ctl button{font:600 15px system-ui,sans-serif;min-width:44px;min-height:44px;padding:0 14px;border-radius:22px;border:0;background:rgba(255,255,255,.14);color:inherit;cursor:pointer}
.kk-ctl button:focus-visible{outline:3px solid var(--kk-hi)}
@media (prefers-reduced-motion:reduce){.kk-w.is-now{transform:none}.kk-line{transition:none}}
`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Build the karaoke UI inside `root`. Never autoplays. */
export function createKaraoke(root, score, { beatsPerLine = 8, title = score.title || '', synth = null, lead = 0.12 } = {}) {
  if (!document.getElementById('kk-style')) { const st = document.createElement('style'); st.id = 'kk-style'; st.textContent = CSS; document.head.appendChild(st); }
  const lines = lyricLines(score, { beatsPerLine }); const total = totalBeats(score); const tempo = score.tempo;
  const sy = synth || createMiniSynth();
  root.classList.add('kk'); root.tabIndex = 0;
  root.innerHTML = `${title ? `<p class="kk-title">${esc(title)}</p>` : ''}<div class="kk-lines" aria-live="off"><p class="kk-line is-current"></p><p class="kk-line is-next"></p></div>
<div class="kk-bar" role="progressbar" aria-label="Song progress" aria-valuemin="0" aria-valuemax="100"><i></i></div>
<div class="kk-ctl"><button type="button" data-k="play" aria-label="Play">▶ Play</button><button type="button" data-k="restart" aria-label="Restart">⟲</button><button type="button" data-k="mute" aria-pressed="false" aria-label="Mute">🔊</button></div>`;
  const [curEl, nextEl] = root.querySelectorAll('.kk-line'); const bar = root.querySelector('.kk-bar'); const fill = bar.firstElementChild;
  const btn = (k) => root.querySelector(`[data-k="${k}"]`);
  let playing = false, startCtx = 0, offsetBeat = 0, raf = 0, shownLine = -2, lastWord = '';
  const api = { onWord: null, onEnd: null, lines, get playing() { return playing; }, get beat() { return currentBeat(); } };
  function currentBeat() { return playing ? offsetBeat + ((sy.now() - startCtx) * tempo) / 60 : offsetBeat; }
  function renderLine(el, L) { el.innerHTML = L ? L.words.map((w) => `<span class="kk-w">${esc(w.text)}</span>`).join(' ') : '&nbsp;'; }
  function render(beat) {
    const a = activeWord(lines, beat); const li = a.line >= 0 ? a.line : Math.max(0, a.upcoming ?? 0);
    if (li !== shownLine) { shownLine = li; renderLine(curEl, lines[li]); renderLine(nextEl, lines[li + 1]); }
    const spans = curEl.children;
    for (let i = 0; i < spans.length; i++) { spans[i].classList.toggle('is-sung', a.line === li && i < a.word); spans[i].classList.toggle('is-now', a.line === li && i === a.word); }
    const key = `${a.line}:${a.word}`; if (key !== lastWord && a.word >= 0) { lastWord = key; api.onWord && api.onWord(lines[a.line].words[a.word], lines[a.line]); }
    const p = total ? Math.min(1, beat / total) : 0; fill.style.width = `${p * 100}%`; bar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  }
  function frame() { const b = currentBeat(); render(b); if (b >= total + 0.5) { stop(); offsetBeat = 0; api.onEnd && api.onEnd(); render(total); return; } raf = requestAnimationFrame(frame); }
  function scheduleFrom(beat) {
    const t0 = sy.now() + lead; startCtx = t0; offsetBeat = beat;
    for (const tr of score.tracks || []) { const gain = tr.gain ?? 1; for (const n of tr.notes || []) { if (n.t + n.d <= beat) continue; const s = Math.max(0, n.t - beat); sy.play(tr.voice, n.p ?? 0, t0 + b2s(s, tempo), b2s(n.d - Math.max(0, beat - n.t), tempo), (n.v ?? 0.8) * gain); } }
  }
  function stop() { if (!playing) return; offsetBeat = currentBeat(); playing = false; sy.stopAll(); cancelAnimationFrame(raf); btn('play').textContent = '▶ Play'; btn('play').setAttribute('aria-label', 'Play'); }
  api.play = async () => { if (playing) return; await sy.resume(); if (offsetBeat >= total) offsetBeat = 0; scheduleFrom(offsetBeat); playing = true; btn('play').textContent = '❚❚ Pause'; btn('play').setAttribute('aria-label', 'Pause'); raf = requestAnimationFrame(frame); };
  api.pause = () => stop();
  api.toggle = () => (playing ? api.pause() : api.play());
  api.restart = async () => { const was = playing; stop(); offsetBeat = 0; render(0); if (was) await api.play(); };
  api.seek = (beat) => { const was = playing; stop(); offsetBeat = Math.max(0, Math.min(total, beat)); render(offsetBeat); if (was) api.play(); };
  api.mute = (m) => { const v = sy.mute(m); btn('mute').setAttribute('aria-pressed', String(v)); btn('mute').textContent = v ? '🔇' : '🔊'; btn('mute').setAttribute('aria-label', v ? 'Unmute' : 'Mute'); return v; };
  api.destroy = () => { stop(); root.innerHTML = ''; };
  btn('play').onclick = () => api.toggle(); btn('restart').onclick = () => api.restart(); btn('mute').onclick = () => api.mute();
  root.addEventListener('keydown', (e) => { if (e.target === root && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); api.toggle(); } });
  render(0);
  return api;
}
