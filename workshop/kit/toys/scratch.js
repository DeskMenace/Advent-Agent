// kit/toys/scratch.js — scratch-off layer: a canvas over any content, scratched away by pointer; reports % revealed; Reveal button for keyboards.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createScratch } from './scratch.js';
//   // <div id="ticket" style="position:relative;width:320px;height:200px"><p>You won: one (1) nap.</p></div>
//   const s = createScratch(document.querySelector('#ticket'), {
//     cover: '#b8b8c0', pattern: 'foil', text: 'SCRATCH HERE', brush: 26, threshold: 0.6,
//     onProgress: (p) => meter.value = p, onReveal: () => burst(),
//   });
//   s.reveal();  s.reset();  s.progress();     // 0..1
//   // A "Reveal" button is added for keyboard and switch users (pass { button: false } to hide it).
//   window.adventCapture = { async prepare(kind) { s.scratchTo(0.45); } };     // half-scratched share still
//   coverage(alphaArray, stride) is pure: fraction of sampled pixels whose alpha is 0.

/** Fraction of cleared pixels in RGBA `data`, sampling every `stride`-th pixel. Pure. */
export function coverage(data, stride = 8) {
  let clear = 0, total = 0;
  for (let i = 3; i < data.length; i += 4 * stride) { total++; if (data[i] < 32) clear++; }
  return total ? clear / total : 0;
}

export function createScratch(root, { cover = '#b9b9c2', pattern = 'foil', text = 'SCRATCH', textColor = 'rgba(40,40,50,.55)', brush = 24, threshold = 0.55, onProgress, onReveal, button = true, buttonLabel = 'Reveal', seed = 7 } = {}) {
  if (getComputedStyle(root).position === 'static') root.style.position = 'relative';
  const c = document.createElement('canvas'); c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Scratch-off cover. Use the Reveal button to uncover it.');
  Object.assign(c.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair', borderRadius: 'inherit', transition: 'opacity .5s' });
  root.appendChild(c); const g = c.getContext('2d', { willReadFrequently: true });
  let btn = null; if (button) { btn = document.createElement('button'); btn.type = 'button'; btn.textContent = buttonLabel; Object.assign(btn.style, { position: 'absolute', right: '8px', bottom: '8px', minHeight: '36px', padding: '0 12px', borderRadius: '18px', border: '0', font: '600 14px system-ui,sans-serif', background: 'rgba(0,0,0,.6)', color: '#fff', cursor: 'pointer', zIndex: '1' }); btn.onclick = () => api.reveal(); root.appendChild(btn); }
  let w = 0, h = 0, dpr = 1, revealed = false, last = null, pct = 0, checkPending = false;
  function paint() {
    const b = root.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); w = Math.max(1, b.width); h = Math.max(1, b.height);
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalCompositeOperation = 'source-over'; c.style.opacity = '1'; revealed = false; pct = 0;
    if (pattern === 'foil') { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, cover); gr.addColorStop(0.45, '#e9e9f0'); gr.addColorStop(0.55, cover); gr.addColorStop(1, '#8d8d98'); g.fillStyle = gr; } else g.fillStyle = cover;
    g.fillRect(0, 0, w, h);
    let a = seed; const r = () => ((a = (a * 16807) % 2147483647) / 2147483647);
    g.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < (w * h) / 180; i++) g.fillRect(r() * w, r() * h, 1.2, 1.2);
    if (text) { g.fillStyle = textColor; g.font = `800 ${Math.max(14, Math.min(w / 10, 34))}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2); }
  }
  function dot(x, y) { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(x, y, brush / 2, 0, Math.PI * 2); g.fill(); }
  function line(a, b) { const d = Math.hypot(b.x - a.x, b.y - a.y); const n = Math.max(1, Math.ceil(d / (brush / 4))); for (let i = 1; i <= n; i++) dot(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n); }
  function check() {
    if (checkPending) return; checkPending = true;
    requestAnimationFrame(() => { checkPending = false; if (revealed) return; pct = coverage(g.getImageData(0, 0, c.width, c.height).data, 16); onProgress && onProgress(pct); if (pct >= threshold) api.reveal(); });
  }
  const pos = (e) => { const b = c.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  c.addEventListener('pointerdown', (e) => { if (revealed) return; c.setPointerCapture(e.pointerId); last = pos(e); dot(last.x, last.y); check(); });
  c.addEventListener('pointermove', (e) => { if (!last || revealed) return; const p = pos(e); line(last, p); last = p; check(); });
  const up = () => { last = null; }; c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  const api = {
    progress: () => pct,
    get revealed() { return revealed; },
    reveal() { if (revealed) return; revealed = true; pct = 1; c.style.opacity = '0'; c.style.pointerEvents = 'none'; if (btn) btn.hidden = true; onProgress && onProgress(1); onReveal && onReveal(); },
    reset() { c.style.pointerEvents = ''; if (btn) btn.hidden = false; paint(); onProgress && onProgress(0); },
    /** Scratch a deterministic zig-zag until about `target` of the cover is gone (for share frames). */
    scratchTo(target = 0.5) { let prev = { x: brush, y: brush }; for (let row = 0, y = brush; y < h && pct < target; row++, y += brush * 0.8) { const x = row % 2 ? brush : w - brush; line(prev, { x, y }); prev = { x, y }; pct = coverage(g.getImageData(0, 0, c.width, c.height).data, 16); } onProgress && onProgress(pct); },
    destroy() { c.remove(); btn && btn.remove(); },
  };
  paint();
  return api;
}
