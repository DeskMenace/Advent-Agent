// kit/toys/sticker-peel.js — sticker you peel by dragging a corner: the fold reveals its back; release past a threshold peels it off, otherwise it sticks back.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createStickerPeel } from './sticker-peel.js';
//   const sticker = createStickerPeel(document.querySelector('#slot'), {
//     front: '<div class="art">🐸 WORLD\'S OKAYEST FROG</div>', back: '<small>peel here ↗</small>',
//     under: '<p>Underneath: the real message.</p>', width: 260, height: 260, radius: 18,
//     threshold: 0.45, onPeeled: () => celebrate(), onProgress: (f) => meter.value = f,
//   });
//   sticker.peel(); sticker.reset(); sticker.setPeel('br', 180, 160);   // corner tl|tr|bl|br, point in sticker px
//   window.adventCapture = { async prepare() { sticker.setPeel('br', 150, 130); } };   // mid-peel share frame
//   // Drag starts from the corner nearest the pointer. Enter/Space peels it off, Escape resets.
//   // Reduced motion: instant. sticker.destroy() cleans up. Pure geometry: foldGeometry(w, h, corner, px, py).

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export function cornerPoint(w, h, corner) { return { x: corner.includes('r') ? w : 0, y: corner.includes('b') ? h : 0 }; }
export function nearestCorner(w, h, x, y) { return (y > h / 2 ? 'b' : 't') + (x > w / 2 ? 'r' : 'l'); }
export function polygonArea(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; }
/** Sutherland–Hodgman: keep the part of `poly` where (X − m)·n ≥ 0 (sign = 1) or ≤ 0 (sign = −1). */
export function clipHalfPlane(poly, m, n, sign = 1) {
  const side = (p) => sign * ((p.x - m.x) * n.x + (p.y - m.y) * n.y); const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], sa = side(a), sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) { const t = sa / (sa - sb); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
  }
  return out;
}
/**
 * Fold the corner C of a w×h sticker so it lands on point P. The fold line is the perpendicular bisector of C–P.
 * Returns { keep, peeled } polygons (sticker coordinates), `matrix` [a,b,c,d,e,f] (CSS matrix(), origin 0 0) reflecting
 * the peeled part across the fold, `fraction` of the area peeled (0..1) and the fold `angle` (deg) for shading.
 */
export function foldGeometry(w, h, corner, px, py) {
  const rect = [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
  const c = cornerPoint(w, h, corner), dx = px - c.x, dy = py - c.y, len = Math.hypot(dx, dy);
  if (len < 0.5) return { keep: rect, peeled: [], matrix: [1, 0, 0, 1, 0, 0], fraction: 0, angle: 0 };
  const n = { x: dx / len, y: dy / len }, m = { x: (c.x + px) / 2, y: (c.y + py) / 2 };
  const keep = clipHalfPlane(rect, m, n, 1), peeled = clipHalfPlane(rect, m, n, -1);
  // reflection across the line through m with direction d = perp(n): R = I − 2 n nᵀ
  const a = 1 - 2 * n.x * n.x, b = -2 * n.x * n.y, d = 1 - 2 * n.y * n.y;
  const e = m.x - (a * m.x + b * m.y), f = m.y - (b * m.x + d * m.y);
  return { keep, peeled, matrix: [a, b, b, d, e, f], fraction: clamp(polygonArea(peeled) / (w * h)), angle: (Math.atan2(n.y, n.x) * 180) / Math.PI };
}
const poly = (pts) => (pts.length ? 'polygon(' + pts.map((p) => `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`).join(',') + ')' : 'polygon(0 0,0 0,0 0)');

export const CSS = `
.kpeel{position:relative;width:var(--kp-w);height:var(--kp-h);touch-action:none;user-select:none;-webkit-user-select:none;outline:none}
.kpeel:focus-visible{box-shadow:0 0 0 3px var(--kp-focus,#3b6fd8);border-radius:var(--kp-r)}
.kpeel-under{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;text-align:center}
.kpeel-front,.kpeel-back{position:absolute;left:0;top:0;width:var(--kp-w);height:var(--kp-h);border-radius:var(--kp-r);overflow:hidden;box-sizing:border-box}
.kpeel-front{cursor:grab;background:var(--kp-bg,#fff);box-shadow:0 1px 2px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;text-align:center}
.kpeel.kpeel-drag .kpeel-front{cursor:grabbing}
.kpeel-flap{position:absolute;left:0;top:0;width:var(--kp-w);height:var(--kp-h);transform-origin:0 0;pointer-events:none;filter:drop-shadow(0 6px 6px rgba(0,0,0,.25))}
.kpeel-back{background:linear-gradient(var(--kp-angle,135deg),#d9d6cf,#ffffff 45%,#ecebe6 80%,#c9c6bf);color:#8a857b;display:flex;align-items:center;justify-content:center}
.kpeel-gone .kpeel-flap{transition:transform .7s cubic-bezier(.4,0,.6,1),opacity .7s;opacity:0}
`;
export function injectStyles(doc = document) {
  if (doc.getElementById('kit-sticker-peel-css')) return;
  const s = doc.createElement('style'); s.id = 'kit-sticker-peel-css'; s.textContent = CSS; doc.head.appendChild(s);
}
function put(el, content) { if (content == null) return; if (typeof content === 'string') el.innerHTML = content; else el.appendChild(content); }

export function createStickerPeel(container, {
  front = '', back = '', under = '', width = 240, height = 240, radius = 16, background = '#fff', threshold = 0.45,
  hint = 14, label = 'Sticker', onPeeled, onStick, onProgress,
} = {}) {
  const doc = container.ownerDocument || document; injectStyles(doc);
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const w = width, h = height;
  const root = doc.createElement('div'); root.className = 'kpeel'; root.tabIndex = 0; root.setAttribute('role', 'button');
  root.setAttribute('aria-label', label + ': drag a corner to peel, or press Enter to peel it off');
  for (const [k, v] of [['--kp-w', w + 'px'], ['--kp-h', h + 'px'], ['--kp-r', radius + 'px'], ['--kp-bg', background]]) root.style.setProperty(k, v);
  const underEl = doc.createElement('div'); underEl.className = 'kpeel-under'; put(underEl, under);
  const frontEl = doc.createElement('div'); frontEl.className = 'kpeel-front'; put(frontEl, front);
  const flap = doc.createElement('div'); flap.className = 'kpeel-flap';
  const backEl = doc.createElement('div'); backEl.className = 'kpeel-back'; put(backEl, back); flap.appendChild(backEl);
  root.append(underEl, frontEl, flap); container.appendChild(root);

  let corner = 'br', pt = cornerPoint(w, h, corner), anim = 0, gone = false, drag = null, fraction = 0;
  function render() {
    const g = foldGeometry(w, h, corner, pt.x, pt.y); fraction = g.fraction;
    frontEl.style.clipPath = poly(g.keep); backEl.style.clipPath = poly(g.peeled);
    flap.style.transform = `matrix(${g.matrix.map((v) => +v.toFixed(5)).join(',')})`; flap.style.visibility = g.peeled.length ? 'visible' : 'hidden';
    root.style.setProperty('--kp-angle', (g.angle + 90).toFixed(1) + 'deg');
    onProgress && onProgress(fraction);
  }
  function setPeel(c, x, y) { cancelAnimationFrame(anim); anim = 0; if (c) corner = c; pt = { x, y }; render(); }
  function animateTo(x, y, ms) {
    cancelAnimationFrame(anim);
    if (reduced() || typeof requestAnimationFrame !== 'function') { pt = { x, y }; render(); return Promise.resolve(); }
    const from = { ...pt }, t0 = performance.now();
    return new Promise((resolve) => {
      const step = (now) => { const t = clamp((now - t0) / ms), k = easeOutCubic(t); pt = { x: from.x + (x - from.x) * k, y: from.y + (y - from.y) * k }; render(); if (t < 1) anim = requestAnimationFrame(step); else { anim = 0; resolve(); } };
      anim = requestAnimationFrame(step);
    });
  }
  async function peel() {
    if (gone) return; if (fraction < 0.01) corner = corner || 'br';
    const c = cornerPoint(w, h, corner), far = cornerPoint(w, h, (corner[0] === 'b' ? 't' : 'b') + (corner[1] === 'r' ? 'l' : 'r'));
    await animateTo(c.x + (far.x - c.x) * 2.05, c.y + (far.y - c.y) * 2.05, 520);
    gone = true; frontEl.style.pointerEvents = 'none';
    if (!reduced()) { root.classList.add('kpeel-gone'); const m = flap.style.transform; flap.style.transform = m + ` translate(${(c.x - far.x) * 0.6}px, ${-h * 0.8}px) rotate(${corner[1] === 'r' ? -25 : 25}deg)`; }
    else flap.style.opacity = '0';
    onPeeled && onPeeled();
  }
  function stickBack() { const c = cornerPoint(w, h, corner); return animateTo(c.x, c.y, 320).then(() => onStick && onStick()); }
  function reset() { cancelAnimationFrame(anim); anim = 0; gone = false; root.classList.remove('kpeel-gone'); flap.style.opacity = ''; frontEl.style.pointerEvents = ''; pt = cornerPoint(w, h, corner); render(); }
  const local = (e) => { const r = root.getBoundingClientRect(); return { x: (e.clientX - r.left) * (w / Math.max(1, r.width)), y: (e.clientY - r.top) * (h / Math.max(1, r.height)) }; };
  const onDown = (e) => {
    if (gone || e.button > 0) return; const p = local(e); if (!drag && fraction < 0.01) corner = nearestCorner(w, h, p.x, p.y);
    const c = cornerPoint(w, h, corner); drag = { id: e.pointerId, ox: p.x - pt.x, oy: p.y - pt.y, c };
    root.classList.add('kpeel-drag'); try { root.setPointerCapture(e.pointerId); } catch {}
    cancelAnimationFrame(anim); anim = 0;
  };
  const onMove = (e) => {
    if (gone) return; const p = local(e);
    if (drag && e.pointerId === drag.id) { pt = { x: p.x - drag.ox, y: p.y - drag.oy }; render(); return; }
    if (e.pointerType === 'mouse' && hint > 0 && !anim) { // hover: lift the nearest corner a little
      const c2 = nearestCorner(w, h, p.x, p.y), cp = cornerPoint(w, h, c2);
      const near = Math.hypot(p.x - cp.x, p.y - cp.y) < Math.min(w, h) * 0.3;
      corner = c2; const ix = cp.x === 0 ? 1 : -1, iy = cp.y === 0 ? 1 : -1;
      pt = near ? { x: cp.x + ix * hint, y: cp.y + iy * hint } : cp; render();
    }
  };
  const onUp = (e) => { if (!drag || e.pointerId !== drag.id) return; drag = null; root.classList.remove('kpeel-drag'); if (fraction >= threshold) peel(); else stickBack(); };
  const onLeave = () => { if (!drag && !gone && fraction < 0.05) { pt = cornerPoint(w, h, corner); render(); } };
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); peel(); } else if (e.key === 'Escape') reset(); };
  root.addEventListener('pointerdown', onDown); root.addEventListener('pointermove', onMove); root.addEventListener('pointerup', onUp);
  root.addEventListener('pointercancel', onUp); root.addEventListener('pointerleave', onLeave); root.addEventListener('keydown', onKey);
  render();
  return {
    el: root, peel, reset, stickBack, setPeel, get fraction() { return fraction; }, get peeled() { return gone; },
    destroy() {
      cancelAnimationFrame(anim); root.removeEventListener('pointerdown', onDown); root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerup', onUp);
      root.removeEventListener('pointercancel', onUp); root.removeEventListener('pointerleave', onLeave); root.removeEventListener('keydown', onKey); root.remove();
    },
  };
}
