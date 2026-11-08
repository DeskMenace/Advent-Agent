// kit/sound/cassette.js — cassette player: spinning reels, drag the tape to scrub, side A/B tracklist (scores or audio files; no autoplay).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createCassette } from './cassette.js';
//   const tape = createCassette(document.querySelector('#deck'), {
//     label: 'For Sam — Winter 2026', color: '#e8553d',
//     sides: { A: [{ title: 'Opening', score: myScore }, { title: 'Voice note', src: 'note.mp3' }], B: [{ title: 'Outro', score: outro }] },
//   });
//   // Nothing plays until Play is pressed. Drag the tape window or a reel to scrub; arrow keys seek ±5 s.
//   tape.play(); tape.pause(); tape.flip(); tape.seek(12); tape.mute(true);
//   tape.onTrack = (track, side) => {};                     // optional hook when the current track changes
//   reelRadii(0.3) → { left, right } radii in px (pure);  trackAt(tracks, 42) → { index, offset }
//   Scores use the sound/score.js format (tempo, tracks[{ voice, notes[{ t, p, d, v }] }]); audio uses <audio> (local files/blobs only).

const DRUMS = ['kick', 'snare', 'hat'];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

/** Tape pack radii: the left (supply) reel shrinks while the right (take-up) reel grows, keeping tape area constant. Pure. */
export function reelRadii(progress, { min = 14, max = 34 } = {}) {
  const p = Math.min(1, Math.max(0, progress)); const a0 = min * min, span = max * max - a0;
  return { left: Math.sqrt(a0 + span * (1 - p)), right: Math.sqrt(a0 + span * p) };
}
/** Find the track playing at `seconds` along a side. Tracks need `duration` (seconds). Pure. */
export function trackAt(tracks, seconds) {
  let acc = 0;
  for (let i = 0; i < tracks.length; i++) { const d = tracks[i].duration || 0; if (seconds < acc + d) return { index: i, offset: Math.max(0, seconds - acc), start: acc }; acc += d; }
  const last = tracks.length - 1; return { index: last, offset: last >= 0 ? tracks[last].duration || 0 : 0, start: acc - (last >= 0 ? tracks[last].duration || 0 : 0), end: true };
}
export function scoreSeconds(score) {
  let end = 0; for (const tr of score.tracks || []) for (const n of tr.notes || []) end = Math.max(end, n.t + n.d);
  return (end * 60) / score.tempo + 0.6;
}
export function sideLength(tracks) { return tracks.reduce((s, t) => s + (t.duration || 0), 0); }

function miniSynth() {
  let ctx = null, master = null, noise = null, muted = false; const live = new Set();
  function ensure() {
    if (ctx) return ctx; const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) throw new Error('Web Audio is not available');
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate); const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return ctx;
  }
  function start(node, t, end) { live.add(node); node.onended = () => live.delete(node); node.start(t); node.stop(end); }
  function play(voice, p, t, dur, vel) {
    const g = ctx.createGain(); g.connect(master); t = Math.max(t, ctx.currentTime);
    if (DRUMS.includes(voice)) {
      const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = voice === 'hat' ? 'highpass' : 'lowpass'; f.frequency.value = voice === 'hat' ? 7000 : voice === 'snare' ? 2500 : 160;
      const len = voice === 'hat' ? 0.05 : 0.2; g.gain.setValueAtTime(vel * 0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + len); s.connect(f); f.connect(g); start(s, t, t + len + 0.05); return;
    }
    const o = ctx.createOscillator(); o.type = voice === 'bass' ? 'triangle' : voice === 'pad' ? 'sawtooth' : voice === 'pluck' ? 'square' : 'sine'; o.frequency.value = mtof(p);
    const peak = vel * (voice === 'pad' || voice === 'pluck' ? 0.1 : 0.3); const rel = voice === 'musicbox' ? 0.8 : 0.25;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + (voice === 'pad' ? 0.2 : 0.005)); g.gain.exponentialRampToValueAtTime(0.001, t + dur + rel);
    o.connect(g); start(o, t, t + dur + rel + 0.05);
  }
  return {
    ensure, play, now: () => (ctx ? ctx.currentTime : 0),
    async resume() { ensure(); if (ctx.state === 'suspended') await ctx.resume(); },
    stopAll() { for (const n of live) { try { n.stop(); } catch {} } live.clear(); },
    mute(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.7; },
    /** Schedule a score starting `offset` seconds into it. */
    playScore(score, offset) {
      const t0 = ctx.currentTime + 0.08; const spb = 60 / score.tempo;
      for (const tr of score.tracks || []) for (const n of tr.notes || []) { const s = n.t * spb, d = n.d * spb; if (s + d <= offset) continue; play(tr.voice, n.p ?? 0, t0 + Math.max(0, s - offset), d - Math.max(0, offset - s), (n.v ?? 0.8) * (tr.gain ?? 1)); }
    },
  };
}

const CSS = `
.cst{--cst-body:#2a2a2e;--cst-label:#f3ead7;--cst-accent:#e8553d;--cst-ink:#2b2118;max-width:460px;margin:0 auto;font:15px/1.4 system-ui,sans-serif;color:var(--cst-ink)}
.cst-shell{position:relative;aspect-ratio:1.6;background:var(--cst-body);border-radius:16px;padding:6%;box-shadow:inset 0 2px 0 rgba(255,255,255,.12),0 10px 30px rgba(0,0,0,.35);touch-action:none;user-select:none}
.cst-label{background:var(--cst-label);border-radius:8px;height:100%;position:relative;overflow:hidden;box-shadow:inset 0 -14px 0 var(--cst-accent)}
.cst-title{position:absolute;left:6%;right:6%;top:6%;font:600 clamp(13px,3.6vw,18px)/1.2 "Segoe Print","Bradley Hand","Comic Sans MS",cursive;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cst-side{position:absolute;left:6%;top:24%;font:800 22px system-ui;color:var(--cst-accent)}
.cst-window{position:absolute;left:18%;right:18%;top:30%;height:44%;background:#1b1714;border-radius:40px;cursor:grab;outline:none}
.cst-window:focus-visible{box-shadow:0 0 0 3px var(--cst-accent)}.cst-window.is-drag{cursor:grabbing}
.cst-window svg{width:100%;height:100%;display:block}
.cst-ui{display:flex;gap:8px;justify-content:center;margin:14px 0 8px;flex-wrap:wrap}
.cst-ui button{min-width:44px;min-height:44px;border-radius:10px;border:0;background:#3a3a40;color:#fff;font:600 15px system-ui;padding:0 12px;cursor:pointer;box-shadow:0 3px 0 #1c1c20}
.cst-ui button:active{transform:translateY(2px);box-shadow:0 1px 0 #1c1c20}.cst-ui button:focus-visible{outline:3px solid var(--cst-accent)}
.cst-scrub{width:100%;accent-color:var(--cst-accent)}
.cst-list{list-style:none;padding:0;margin:8px 0 0;background:var(--cst-label);border-radius:8px}
.cst-list li{padding:8px 12px;border-bottom:1px dashed rgba(0,0,0,.15);display:flex;justify-content:space-between;cursor:pointer}
.cst-list li.is-now{font-weight:700;color:var(--cst-accent)}.cst-list li:last-child{border:0}
.cst-time{font-variant-numeric:tabular-nums;opacity:.7}
`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function audioDuration(src) {
  return new Promise((res) => { const a = new Audio(); a.preload = 'metadata'; a.onloadedmetadata = () => res(Number.isFinite(a.duration) ? a.duration : 0); a.onerror = () => res(0); a.src = typeof src === 'string' ? src : URL.createObjectURL(src); });
}

/** Create the cassette UI in `root`. Returns a controller; never autoplays. */
export function createCassette(root, { label = 'Mixtape', color, sides = { A: [], B: [] }, reel = { min: 14, max: 34 } } = {}) {
  if (!document.getElementById('cst-style')) { const st = document.createElement('style'); st.id = 'cst-style'; st.textContent = CSS; document.head.appendChild(st); }
  const reduce = globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const synth = miniSynth(); let audio = null; let muted = false;
  const S = { A: (sides.A || []).map((t) => ({ ...t })), B: (sides.B || []).map((t) => ({ ...t })) };
  for (const k of ['A', 'B']) for (const t of S[k]) if (t.score && !t.duration) t.duration = scoreSeconds(t.score);
  let side = 'A', pos = 0, playing = false, startedAt = 0, startPos = 0, raf = 0, angleL = 0, angleR = 0, lastT = 0, curIndex = -1;
  root.classList.add('cst'); if (color) root.style.setProperty('--cst-accent', color);
  root.innerHTML = `<div class="cst-shell"><div class="cst-label"><div class="cst-title">${esc(label)}</div><div class="cst-side" aria-hidden="true">A</div>
<div class="cst-window" tabindex="0" role="slider" aria-label="Tape position" aria-valuemin="0">
<svg viewBox="0 0 200 80" aria-hidden="true"><path class="cst-tape" fill="none" stroke="#5a3a24" stroke-width="2"/>
<g class="cst-reel" data-r="l"><circle class="cst-pack" cx="50" cy="40" r="30" fill="#5a3a24"/><circle cx="50" cy="40" r="11" fill="#eee"/><g class="cst-spokes" stroke="#888" stroke-width="3"><line x1="50" y1="31" x2="50" y2="49"/><line x1="42" y1="35.5" x2="58" y2="44.5"/><line x1="42" y1="44.5" x2="58" y2="35.5"/></g></g>
<g class="cst-reel" data-r="r"><circle class="cst-pack" cx="150" cy="40" r="14" fill="#5a3a24"/><circle cx="150" cy="40" r="11" fill="#eee"/><g class="cst-spokes" stroke="#888" stroke-width="3"><line x1="150" y1="31" x2="150" y2="49"/><line x1="142" y1="35.5" x2="158" y2="44.5"/><line x1="142" y1="44.5" x2="158" y2="35.5"/></g></g></svg></div></div></div>
<input class="cst-scrub" type="range" min="0" step="0.1" value="0" aria-label="Seek">
<div class="cst-ui"><button type="button" data-k="rew" aria-label="Back 10 seconds">◀◀</button><button type="button" data-k="play" aria-label="Play">▶</button><button type="button" data-k="ff" aria-label="Forward 10 seconds">▶▶</button><button type="button" data-k="flip" aria-label="Flip to side B">Flip</button><button type="button" data-k="mute" aria-pressed="false" aria-label="Mute">🔊</button><span class="cst-time" aria-live="off">0:00</span></div>
<ol class="cst-list"></ol>`;
  const q = (s) => root.querySelector(s); const win = q('.cst-window'); const scrub = q('.cst-scrub'); const list = q('.cst-list'); const timeEl = q('.cst-time');
  const packs = root.querySelectorAll('.cst-pack'); const spokes = root.querySelectorAll('.cst-spokes'); const tapePath = q('.cst-tape');
  const api = { onTrack: null };
  const len = () => sideLength(S[side]) || 1;
  const now = () => (playing ? startPos + (performance.now() - startedAt) / 1000 : pos);
  function renderList() {
    list.innerHTML = S[side].map((t, i) => `<li data-i="${i}" tabindex="0"><span>${esc(t.title || `Track ${i + 1}`)}</span><span class="cst-time">${t.duration ? fmt(t.duration) : '–'}</span></li>`).join('');
    q('.cst-side').textContent = side; q('[data-k="flip"]').setAttribute('aria-label', `Flip to side ${side === 'A' ? 'B' : 'A'}`); scrub.max = String(len());
  }
  function draw(t) {
    const p = t / len(); const r = reelRadii(p, { min: reel.min * (30 / 34), max: 30 });
    packs[0].setAttribute('r', r.left.toFixed(2)); packs[1].setAttribute('r', r.right.toFixed(2));
    tapePath.setAttribute('d', `M${50 - r.left} 40 L 30 76 L 170 76 L ${150 + r.right} 40`);
    spokes[0].setAttribute('transform', `rotate(${angleL} 50 40)`); spokes[1].setAttribute('transform', `rotate(${angleR} 150 40)`);
    scrub.value = String(t); win.setAttribute('aria-valuemax', String(Math.round(len()))); win.setAttribute('aria-valuenow', String(Math.round(t))); win.setAttribute('aria-valuetext', fmt(t)); timeEl.textContent = fmt(t);
    const at = trackAt(S[side], t);
    if (at.index !== curIndex) { curIndex = at.index; list.querySelectorAll('li').forEach((li, i) => li.classList.toggle('is-now', i === at.index)); api.onTrack && S[side][at.index] && api.onTrack(S[side][at.index], side); }
    return { at, r };
  }
  /** Linear tape speed is constant, so angular speed = v / radius: the small reel spins faster. */
  function spin(dtSec, dir = 1) { const r = reelRadii(now() / len()); const v = 60 * dtSec * dir; if (!reduce) { angleL += (v / r.left) * 57; angleR += (v / r.right) * 57; } }
  function stopSound() { synth.stopAll(); if (audio) { audio.pause(); audio = null; } }
  function startSound(t) {
    stopSound(); const { index, offset } = trackAt(S[side], t); const tr = S[side][index]; if (!tr) return;
    if (tr.score) synth.playScore(tr.score, offset);
    else if (tr.src) { audio = new Audio(typeof tr.src === 'string' ? tr.src : URL.createObjectURL(tr.src)); audio.muted = muted; audio.currentTime = offset; audio.play().catch(() => {}); }
  }
  function frame(ts) {
    const dt = lastT ? (ts - lastT) / 1000 : 0; lastT = ts; spin(dt);
    const t = now(); if (t >= len()) { api.pause(); pos = len(); draw(pos); return; }
    const { at } = draw(t); if (at.index !== playingIndex) { playingIndex = at.index; startSound(t); }
    raf = requestAnimationFrame(frame);
  }
  let playingIndex = -1;
  api.play = async () => {
    if (playing) return; if (S[side].some((t) => t.score)) await synth.resume(); if (pos >= len()) pos = 0;
    playing = true; startPos = pos; startedAt = performance.now(); lastT = 0; playingIndex = trackAt(S[side], pos).index; startSound(pos);
    const b = q('[data-k="play"]'); b.textContent = '❚❚'; b.setAttribute('aria-label', 'Pause'); raf = requestAnimationFrame(frame);
  };
  api.pause = () => { if (!playing) return; pos = now(); playing = false; cancelAnimationFrame(raf); stopSound(); const b = q('[data-k="play"]'); b.textContent = '▶'; b.setAttribute('aria-label', 'Play'); };
  api.toggle = () => (playing ? api.pause() : api.play());
  api.seek = (t) => { const was = playing; api.pause(); pos = Math.max(0, Math.min(len(), t)); draw(pos); if (was) api.play(); };
  api.flip = () => { api.pause(); side = side === 'A' ? 'B' : 'A'; pos = 0; curIndex = -1; renderList(); draw(0); };
  api.mute = (m = !muted) => { muted = m; synth.mute(m); if (audio) audio.muted = m; const b = q('[data-k="mute"]'); b.setAttribute('aria-pressed', String(m)); b.textContent = m ? '🔇' : '🔊'; b.setAttribute('aria-label', m ? 'Unmute' : 'Mute'); return m; };
  api.destroy = () => { api.pause(); root.innerHTML = ''; };
  Object.defineProperty(api, 'position', { get: now }); Object.defineProperty(api, 'side', { get: () => side });
  // Scrub by dragging the tape window: horizontal drag winds the tape (and the reels with it).
  let drag = null;
  win.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, t: now(), was: playing }; api.pause(); win.classList.add('is-drag'); win.setPointerCapture(e.pointerId); });
  win.addEventListener('pointermove', (e) => { if (!drag) return; const w = win.getBoundingClientRect().width || 1; const dx = e.clientX - drag.x; const t = Math.max(0, Math.min(len(), drag.t + (dx / w) * len() * 0.5)); spin((t - pos) / 2, 1); pos = t; draw(pos); });
  const end = () => { if (!drag) return; const was = drag.was; drag = null; win.classList.remove('is-drag'); if (was) api.play(); };
  win.addEventListener('pointerup', end); win.addEventListener('pointercancel', end);
  win.addEventListener('keydown', (e) => { const k = e.key; if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); api.seek(now() + (k === 'ArrowRight' ? 5 : -5)); } else if (k === ' ' || k === 'Enter') { e.preventDefault(); api.toggle(); } });
  scrub.addEventListener('input', () => api.seek(Number(scrub.value)));
  q('[data-k="play"]').onclick = () => api.toggle(); q('[data-k="flip"]').onclick = () => api.flip(); q('[data-k="mute"]').onclick = () => api.mute();
  q('[data-k="rew"]').onclick = () => api.seek(now() - 10); q('[data-k="ff"]').onclick = () => api.seek(now() + 10);
  list.addEventListener('click', (e) => { const li = e.target.closest('li'); if (!li) return; const i = Number(li.dataset.i); api.seek(S[side].slice(0, i).reduce((s, t) => s + (t.duration || 0), 0)); });
  list.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.closest('li')) e.target.closest('li').click(); });
  renderList(); draw(0);
  // Audio tracks without a duration: read metadata, then refresh the list.
  const pending = ['A', 'B'].flatMap((k) => S[k].filter((t) => t.src && !t.duration));
  if (pending.length) Promise.all(pending.map(async (t) => { t.duration = await audioDuration(t.src); })).then(() => { renderList(); draw(pos); });
  return api;
}
