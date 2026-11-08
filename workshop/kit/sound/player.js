// kit/sound/player.js — accessible score player UI: play/pause/stop, progress, lyrics line, keyboard, no autoplay.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createPlayer } from './player.js';     // expects a synth from synth.js and a score (score.js format)
//   const player = createPlayer(document.querySelector('#player'), {
//     score, synth,                                 // synth: { resume(), now(), play(voice, midi, when, dur, vel), stopAll() }
//     label: 'A small waltz for door 7',            // visible title and aria-label
//     loop: false, onLyric: (text) => {}, onEnd: () => {},
//   });
//   // Nothing plays until the recipient presses Play (or Space when the player is focused).
//   player.play(); player.pause(); player.stop(); player.seek(0.5);     // seek: fraction 0..1
//   player.destroy();
//   // Styles: .sp, .sp-btn, .sp-progress, .sp-time, .sp-lyric — minimal CSS is injected once; override freely.

export function createPlayer(container, { score, synth, label = 'Music', loop = false, lookahead = 0.15, onLyric, onEnd } = {}) {
  injectStyles();
  const tempo = score.tempo, b2s = (b) => (b * 60) / tempo;
  const events = []; score.tracks.forEach((tr, ti) => { for (const n of tr.notes || []) events.push({ beat: n.t, d: n.d, voice: tr.voice, p: n.p ?? 0, v: (n.v ?? 0.8) * (tr.gain ?? 1), ti }); });
  events.sort((a, b) => a.beat - b.beat);
  const lyrics = score.tracks.flatMap((tr) => tr.lyrics || []).sort((a, b) => a.t - b.t);
  let total = 0; for (const e of events) total = Math.max(total, e.beat + e.d); for (const l of lyrics) total = Math.max(total, l.t);
  const totalSec = b2s(total);
  const root = document.createElement('div'); root.className = 'sp'; root.setAttribute('role', 'region'); root.setAttribute('aria-label', label); root.tabIndex = 0;
  root.innerHTML = `<div class="sp-row"><button type="button" class="sp-btn sp-play" aria-label="Play">▶</button><button type="button" class="sp-btn sp-stop" aria-label="Stop">■</button>
    <span class="sp-title"></span></div><input class="sp-progress" type="range" min="0" max="1000" value="0" aria-label="Position"><div class="sp-row"><span class="sp-time">0:00 / ${fmt(totalSec)}</span><span class="sp-lyric" aria-live="polite"></span></div>`;
  root.querySelector('.sp-title').textContent = label; container.appendChild(root);
  const playBtn = root.querySelector('.sp-play'), stopBtn = root.querySelector('.sp-stop'), prog = root.querySelector('.sp-progress'), timeEl = root.querySelector('.sp-time'), lyricEl = root.querySelector('.sp-lyric');
  let playing = false, startCtx = 0, offset = 0, nextIdx = 0, timer = 0, raf = 0, lastLyric = null;
  function position() { return playing ? offset + (synth.now() - startCtx) : offset; }
  function scheduleAhead() {
    const now = synth.now(), horizon = now + lookahead * 2;
    while (nextIdx < events.length) { const e = events[nextIdx], when = startCtx + b2s(e.beat) - offset; if (when > horizon) break; if (when >= now - 0.01) synth.play(e.voice, e.p, when, b2s(e.d), e.v); nextIdx++; }
  }
  function ui() {
    const pos = Math.min(position(), totalSec); prog.value = String(Math.round((pos / totalSec) * 1000)); timeEl.textContent = `${fmt(pos)} / ${fmt(totalSec)}`;
    const beat = (pos * tempo) / 60; let cur = null; for (const l of lyrics) { if (l.t <= beat) cur = l; else break; }
    if (cur !== lastLyric) { lastLyric = cur; lyricEl.textContent = cur ? cur.text : ''; onLyric && onLyric(cur ? cur.text : ''); }
    if (playing && pos >= totalSec) { if (loop) { api.seek(0); api.play(); } else { api.stop(); onEnd && onEnd(); } return; }
    if (playing) raf = requestAnimationFrame(ui);
  }
  function seekTo(sec) { offset = Math.max(0, Math.min(totalSec, sec)); nextIdx = events.findIndex((e) => b2s(e.beat) >= offset - 0.001); if (nextIdx < 0) nextIdx = events.length; if (playing) { synth.stopAll(); startCtx = synth.now(); } ui(); }
  const api = {
    element: root, get playing() { return playing; }, get duration() { return totalSec; },
    async play() { if (playing) return; await synth.resume(); startCtx = synth.now() + 0.05; playing = true; playBtn.textContent = '❚❚'; playBtn.setAttribute('aria-label', 'Pause'); timer = setInterval(scheduleAhead, lookahead * 1000 / 2); scheduleAhead(); ui(); },
    pause() { if (!playing) return; offset = position(); playing = false; clearInterval(timer); cancelAnimationFrame(raf); synth.stopAll(); playBtn.textContent = '▶'; playBtn.setAttribute('aria-label', 'Play'); seekTo(offset); },
    stop() { playing = false; clearInterval(timer); cancelAnimationFrame(raf); synth.stopAll(); playBtn.textContent = '▶'; playBtn.setAttribute('aria-label', 'Play'); seekTo(0); },
    toggle() { playing ? api.pause() : api.play(); },
    seek(fraction) { seekTo(fraction * totalSec); },
    destroy() { api.stop(); root.remove(); },
  };
  playBtn.addEventListener('click', () => api.toggle()); stopBtn.addEventListener('click', () => api.stop());
  prog.addEventListener('input', () => seekTo((Number(prog.value) / 1000) * totalSec));
  root.addEventListener('keydown', (e) => { if (e.target === prog) return; if (e.key === ' ' || e.key === 'k') { e.preventDefault(); api.toggle(); } else if (e.key === 'Home') { e.preventDefault(); api.seek(0); } else if (e.key === 'Escape') api.stop(); });
  ui(); return api;
}
function fmt(s) { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById('sp-styles')) return;
  const st = document.createElement('style'); st.id = 'sp-styles';
  st.textContent = `.sp{font:15px/1.4 system-ui,sans-serif;background:#FFFAF0;color:#243A32;border:1px solid #DFD7C9;border-radius:8px;padding:12px;max-width:420px}
.sp:focus-visible{outline:3px solid #E7C890;outline-offset:2px}.sp-row{display:flex;gap:8px;align-items:center;justify-content:space-between}.sp-title{flex:1;font-family:Georgia,serif;font-size:17px;margin-left:4px}
.sp-btn{min-width:44px;min-height:44px;border-radius:6px;border:1px solid #BD955A;background:#14503A;color:#FFFAF0;font-size:16px;cursor:pointer}.sp-btn:focus-visible{outline:3px solid #E7C890;outline-offset:2px}
.sp-progress{width:100%;margin:10px 0;accent-color:#A82438}.sp-time{color:#766F62;font-variant-numeric:tabular-nums}.sp-lyric{font-style:italic;min-height:1.4em}`;
  document.head.appendChild(st);
}
