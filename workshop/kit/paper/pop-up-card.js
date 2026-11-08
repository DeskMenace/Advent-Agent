// kit/paper/pop-up-card.js — CSS-3D greeting card that opens on click/drag, with staggered pop-up layers and paper texture.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createPopUpCard } from './pop-up-card.js';
//   const card = createPopUpCard(document.querySelector('#stage'), {
//     front: '<h1>For Mo</h1>', insideLeft: '<p>A small forest grew in here.</p>',
//     inside: '<p class="msg">Happy December</p>',                        // right page, behind the layers
//     layers: [{ html: '🌲', x: 10, y: 30, w: 30, depth: 30 }, { html: '🦊', x: 50, y: 45, w: 25, depth: 60 }],
//     width: 300, height: 400, paper: '#f7f1e3', onOpen: () => confettiBurst(),
//   });
//   card.open(); card.close(); card.toggle(); card.setProgress(0.5);   // drag the cover left to open by hand
//   window.adventCapture = { async prepare() { await card.open({ instant: true }); } };
//   // Keyboard: Enter/Space toggles, Escape closes. Reduced motion: opens instantly. card.destroy() cleans up.

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
/** Progress (0..1) of pop-up layer `index` of `count` for card progress p: later layers start later and overshoot slightly. */
export function layerProgress(p, index = 0, count = 1, stagger = 0.35) {
  const start = 0.25 + (count > 1 ? (index / (count - 1)) * stagger : 0);
  const local = clamp((p - start) / Math.max(0.05, 1 - start));
  return local <= 0 ? 0 : local >= 1 ? 1 : easeOutBack(local);
}
/** Horizontal drag → progress: dragging the cover left by one card width opens it fully. */
export function dragToProgress(startProgress, dx, width) { return clamp(startProgress - dx / Math.max(1, width)); }

export const CSS = `
.kpc{position:relative;display:flex;justify-content:center;align-items:center;perspective:1600px;width:calc(var(--kpc-w)*2.1);max-width:100%;height:calc(var(--kpc-h)*1.15);touch-action:none;user-select:none;-webkit-user-select:none}
.kpc-card{position:relative;width:var(--kpc-w);height:var(--kpc-h);transform-style:preserve-3d;cursor:pointer;outline:none}
.kpc-card:focus-visible{box-shadow:0 0 0 3px var(--kpc-focus,#3b6fd8);border-radius:4px}
.kpc-paper{background-color:var(--kpc-paper,#f7f1e3);background-image:radial-gradient(rgba(60,40,10,.06) .8px,transparent 1.2px),radial-gradient(rgba(255,255,255,.55) .8px,transparent 1.2px),linear-gradient(135deg,rgba(255,255,255,.4),rgba(0,0,0,.05));background-size:7px 7px,11px 11px,100% 100%;background-position:0 0,3px 5px,0 0}
.kpc-base,.kpc-cover,.kpc-face{position:absolute;inset:0;border-radius:3px}
.kpc-base{transform-style:preserve-3d;box-shadow:0 18px 30px rgba(0,0,0,.18),inset 6px 0 10px -6px rgba(0,0,0,.25);overflow:visible}
.kpc-inside{position:absolute;inset:0;padding:8%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-end;text-align:center}
.kpc-cover{transform-origin:0 50%;transform-style:preserve-3d}
.kpc-face{backface-visibility:hidden;-webkit-backface-visibility:hidden;padding:8%;box-sizing:border-box;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;overflow:hidden}
.kpc-front{box-shadow:0 10px 24px rgba(0,0,0,.2)}
.kpc-inner{transform:rotateY(180deg);box-shadow:inset -6px 0 10px -6px rgba(0,0,0,.25)}
.kpc-layer{position:absolute;transform-origin:50% 100%;display:flex;justify-content:center;align-items:flex-end;font-size:calc(var(--kpc-h)*.16);line-height:1;pointer-events:none;filter:drop-shadow(0 6px 4px rgba(0,0,0,.18))}
.kpc-layer>img,.kpc-layer>svg{width:100%;height:auto;display:block}
`;
export function injectStyles(doc = document) {
  if (doc.getElementById('kit-pop-up-card-css')) return;
  const s = doc.createElement('style'); s.id = 'kit-pop-up-card-css'; s.textContent = CSS; doc.head.appendChild(s);
}
function put(el, content) { if (content == null) return; if (typeof content === 'string') el.innerHTML = content; else el.appendChild(content); }

export function createPopUpCard(container, {
  front = '', insideLeft = '', inside = '', layers = [], width = 300, height = 400, paper = '#f7f1e3',
  lean = 18, duration = 1100, label = 'Greeting card', onOpen, onClose, onProgress,
} = {}) {
  const doc = container.ownerDocument || document; injectStyles(doc);
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const root = doc.createElement('div'); root.className = 'kpc';
  root.style.setProperty('--kpc-w', width + 'px'); root.style.setProperty('--kpc-h', height + 'px'); root.style.setProperty('--kpc-paper', paper);
  const card = doc.createElement('div'); card.className = 'kpc-card'; card.tabIndex = 0; card.setAttribute('role', 'button');
  card.setAttribute('aria-label', label + ': press Enter to open or close'); card.setAttribute('aria-expanded', 'false');
  const base = doc.createElement('div'); base.className = 'kpc-base kpc-paper';
  const insideEl = doc.createElement('div'); insideEl.className = 'kpc-inside'; put(insideEl, inside); base.appendChild(insideEl);
  const layerEls = layers.map((l) => {
    const el = doc.createElement('div'); el.className = 'kpc-layer' + (l.className ? ' ' + l.className : '');
    el.style.left = (l.x ?? 10) + '%'; el.style.top = (l.y ?? 20) + '%'; el.style.width = (l.w ?? 40) + '%'; if (l.h != null) el.style.height = l.h + '%';
    put(el, l.html ?? l.content); base.appendChild(el); return { el, depth: l.depth ?? 40 };
  });
  const cover = doc.createElement('div'); cover.className = 'kpc-cover';
  const f = doc.createElement('div'); f.className = 'kpc-face kpc-front kpc-paper'; put(f, front);
  const inner = doc.createElement('div'); inner.className = 'kpc-face kpc-inner kpc-paper'; put(inner, insideLeft);
  cover.append(f, inner); card.append(base, cover); root.appendChild(card); container.appendChild(root);

  let p = 0, anim = 0, wasOpen = false;
  function render() {
    const e = p; // already eased by the animator or set by drag
    card.style.transform = `translateX(${(e * width) / 2}px) rotateX(${e * lean}deg)`;
    cover.style.transform = `rotateY(${-180 * e}deg)`;
    layerEls.forEach(({ el, depth }, i) => {
      const lp = layerProgress(e, i, layerEls.length);
      el.style.transform = `translateZ(${depth * lp}px) rotateX(${(1 - Math.min(1, lp)) * -90}deg)`;
      el.style.opacity = lp <= 0 ? '0' : '1';
    });
    const open = p > 0.98; card.setAttribute('aria-expanded', String(p > 0.5));
    if (open && !wasOpen) onOpen && onOpen(); if (!open && wasOpen && p < 0.02) onClose && onClose();
    if (open) wasOpen = true; else if (p < 0.02) wasOpen = false;
    onProgress && onProgress(p);
  }
  function setProgress(v) { cancelAnimationFrame(anim); goal = null; anim = 0; p = clamp(v); render(); }
  let goal = null;   // where the running animation is heading, so toggle() mid-animation reverses it
  function animateTo(target, { instant = false } = {}) {
    cancelAnimationFrame(anim); goal = target;
    if (instant || reduced() || typeof requestAnimationFrame !== 'function') { p = target; render(); return Promise.resolve(); }
    const from = p, ms = duration * Math.abs(target - from) || 1, t0 = performance.now();
    return new Promise((resolve) => {
      const step = (now) => { const t = clamp((now - t0) / ms); p = from + (target - from) * easeInOutCubic(t); render(); if (t < 1) anim = requestAnimationFrame(step); else { anim = 0; resolve(); } };
      anim = requestAnimationFrame(step);
    });
  }
  let drag = null;
  const down = (e) => { if (e.button > 0) return; drag = { x: e.clientX, start: p, moved: false, id: e.pointerId }; try { card.setPointerCapture(e.pointerId); } catch {} };
  const move = (e) => { if (!drag || e.pointerId !== drag.id) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 6) drag.moved = true; if (drag.moved) setProgress(dragToProgress(drag.start, dx, width)); };
  const up = (e) => { if (!drag || e.pointerId !== drag.id) return; const d = drag; drag = null; if (!d.moved) { toggle(); return; } animateTo(p > 0.5 ? 1 : 0); };
  const key = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } else if (e.key === 'Escape') close(); };
  card.addEventListener('pointerdown', down); card.addEventListener('pointermove', move); card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up); card.addEventListener('keydown', key);
  const open = (o) => animateTo(1, o), close = (o) => animateTo(0, o), toggle = (o) => animateTo((goal ?? p) > 0.5 ? 0 : 1, o);
  render();
  return {
    el: root, card, open, close, toggle, setProgress, get progress() { return p; }, get isOpen() { return p > 0.5; },
    destroy() { cancelAnimationFrame(anim); card.removeEventListener('pointerdown', down); card.removeEventListener('pointermove', move); card.removeEventListener('pointerup', up); card.removeEventListener('pointercancel', up); card.removeEventListener('keydown', key); root.remove(); },
  };
}
