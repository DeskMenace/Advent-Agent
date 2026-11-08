// kit/toys/holo-card.js — trading card that tilts with the pointer (or gyro), shows a holographic sheen and glare, and flips to its back.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createHoloCard } from './holo-card.js';
//   const card = createHoloCard(document.querySelector('#stage'), {
//     front: '<img src="data:image/png;base64,..." alt="Rosa as a rare card">', back: '<p>HP 120 · Weakness: Mondays</p>',
//     width: 300, height: 420, maxTilt: 14, radius: 16, onFlip: (side) => console.log(side),
//   });
//   gyroBtn.onclick = async () => { gyroBtn.hidden = await card.enableGyro(); };   // iOS asks permission on a tap only
//   card.flip(); card.setTilt(0.8, 0.2);            // x, y in 0..1 across the card (0.5,0.5 = flat)
//   window.adventCapture = { async prepare() { card.setTilt(0.78, 0.3); } };
//   // Click/tap or Enter/Space flips; Escape returns to the front. Arrow keys tilt. Reduced motion: no tilt, instant flip.
//   // Sheen colours: pass { sheen: ['#ff7ac6', '#7af5ff', '#a6ff7a', '#ffe27a'] }. card.destroy() cleans up.

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
/** Pointer position inside the card (px) → rotation in degrees and normalised sheen position. */
export function tiltFromPointer(x, y, w, h, maxTilt = 14) {
  const mx = clamp(x / Math.max(1, w)), my = clamp(y / Math.max(1, h));
  return { rx: (0.5 - my) * 2 * maxTilt, ry: (mx - 0.5) * 2 * maxTilt, mx, my };
}
/** deviceorientation beta (front/back, deg) and gamma (left/right, deg) → same shape as tiltFromPointer. Assumes the phone is held ~45° upright. */
export function tiltFromOrientation(beta, gamma, maxTilt = 14, range = 30) {
  const mx = clamp(0.5 + (gamma || 0) / (2 * range)), my = clamp(0.5 + ((beta || 45) - 45) / (2 * range));
  return { rx: (0.5 - my) * 2 * maxTilt, ry: (mx - 0.5) * 2 * maxTilt, mx, my };
}
export const lerp = (a, b, t) => a + (b - a) * t;

export const CSS = `
.kholo{perspective:1000px;display:inline-block;touch-action:none;user-select:none;-webkit-user-select:none}
.kholo-card{position:relative;width:var(--kh-w);height:var(--kh-h);transform-style:preserve-3d;cursor:pointer;outline:none;border-radius:var(--kh-r)}
.kholo-card:focus-visible{box-shadow:0 0 0 3px var(--kh-focus,#3b6fd8)}
.kholo-face{position:absolute;inset:0;border-radius:var(--kh-r);overflow:hidden;backface-visibility:hidden;-webkit-backface-visibility:hidden;box-shadow:0 14px 30px rgba(0,0,0,.28);background:var(--kh-bg,#1d1b2e);color:var(--kh-ink,#fff)}
.kholo-back{transform:rotateY(180deg)}
.kholo-content{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center}
.kholo-content>img{width:100%;height:100%;object-fit:cover;display:block}
.kholo-sheen{position:absolute;inset:0;pointer-events:none;mix-blend-mode:color-dodge;opacity:calc(.25 + var(--kh-d,0) * .55);
  background:repeating-linear-gradient(calc(110deg + var(--kh-mx,.5) * 40deg),var(--kh-c1) 0%,var(--kh-c2) 7%,var(--kh-c3) 14%,var(--kh-c4) 21%,var(--kh-c1) 28%),
  conic-gradient(from calc(var(--kh-mx,.5) * 360deg) at calc(var(--kh-mx,.5) * 100%) calc(var(--kh-my,.5) * 100%),var(--kh-c1),var(--kh-c2),var(--kh-c3),var(--kh-c4),var(--kh-c1));
  background-size:300% 300%,100% 100%;background-position:calc(var(--kh-mx,.5) * 100%) calc(var(--kh-my,.5) * 100%),0 0;background-blend-mode:hue;filter:saturate(1.2) brightness(.8)}
.kholo-glare{position:absolute;inset:0;pointer-events:none;mix-blend-mode:overlay;background:radial-gradient(circle at calc(var(--kh-mx,.5) * 100%) calc(var(--kh-my,.5) * 100%),rgba(255,255,255,.85),rgba(255,255,255,.15) 30%,rgba(0,0,0,.25) 80%);opacity:calc(.35 + var(--kh-d,0) * .5)}
.kholo-flat .kholo-sheen{opacity:.35}
`;
export function injectStyles(doc = document) {
  if (doc.getElementById('kit-holo-card-css')) return;
  const s = doc.createElement('style'); s.id = 'kit-holo-card-css'; s.textContent = CSS; doc.head.appendChild(s);
}
function put(el, content) { if (content == null) return; if (typeof content === 'string') el.innerHTML = content; else el.appendChild(content); }

export function createHoloCard(container, {
  front = '', back = '', width = 300, height = 420, radius = 16, maxTilt = 14, background = '#1d1b2e', ink = '#fff',
  sheen = ['#ff7ac6', '#7af5ff', '#a6ff7a', '#ffe27a'], sheenOnBack = false, flipMs = 600, label = 'Holographic card', onFlip,
} = {}) {
  const doc = container.ownerDocument || document; injectStyles(doc);
  const win = doc.defaultView || globalThis;
  const reduced = () => { try { return win.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const root = doc.createElement('div'); root.className = 'kholo';
  const vars = { '--kh-w': width + 'px', '--kh-h': height + 'px', '--kh-r': radius + 'px', '--kh-bg': background, '--kh-ink': ink, '--kh-c1': sheen[0], '--kh-c2': sheen[1] || sheen[0], '--kh-c3': sheen[2] || sheen[0], '--kh-c4': sheen[3] || sheen[1] || sheen[0] };
  for (const k in vars) root.style.setProperty(k, vars[k]);
  const card = doc.createElement('div'); card.className = 'kholo-card'; card.tabIndex = 0; card.setAttribute('role', 'button');
  card.setAttribute('aria-label', label + ': press Enter to flip'); card.setAttribute('aria-pressed', 'false');
  const face = (cls, content, withSheen) => {
    const f = doc.createElement('div'); f.className = 'kholo-face ' + cls;
    const c = doc.createElement('div'); c.className = 'kholo-content'; put(c, content); f.appendChild(c);
    if (withSheen) { const s = doc.createElement('div'); s.className = 'kholo-sheen'; const g = doc.createElement('div'); g.className = 'kholo-glare'; f.append(s, g); }
    return f;
  };
  card.append(face('kholo-front', front, true), face('kholo-back', back, sheenOnBack)); root.appendChild(card); container.appendChild(root);

  let flipped = false, flipDeg = 0, raf = 0, gyroOn = false;
  const cur = { rx: 0, ry: 0, mx: 0.5, my: 0.5 }, target = { rx: 0, ry: 0, mx: 0.5, my: 0.5 };
  function apply() {
    card.style.transform = `rotateX(${cur.rx}deg) rotateY(${cur.ry + flipDeg}deg)`;
    const d = Math.min(1, Math.hypot(cur.mx - 0.5, cur.my - 0.5) * 2);
    root.style.setProperty('--kh-mx', cur.mx.toFixed(4)); root.style.setProperty('--kh-my', cur.my.toFixed(4)); root.style.setProperty('--kh-d', d.toFixed(3));
  }
  function loop() {
    raf = 0; let moving = false;
    for (const k of ['rx', 'ry', 'mx', 'my']) { const v = lerp(cur[k], target[k], 0.18); if (Math.abs(v - target[k]) > 0.001) { cur[k] = v; moving = true; } else cur[k] = target[k]; }
    apply(); if (moving) raf = requestAnimationFrame(loop);
  }
  function kick() { if (reduced() || typeof requestAnimationFrame !== 'function') { Object.assign(cur, target); apply(); } else if (!raf) raf = requestAnimationFrame(loop); }
  function setTilt(mx, my) {
    const t = reduced() ? { rx: 0, ry: 0, mx: clamp(mx), my: clamp(my) } : tiltFromPointer(mx * width, my * height, maxTilt);
    if (flipped) t.ry = -t.ry; Object.assign(target, t); kick();
  }
  function flip(toBack = !flipped) {
    flipped = !!toBack; card.setAttribute('aria-pressed', String(flipped));
    card.style.transition = reduced() ? 'none' : `transform ${flipMs}ms cubic-bezier(.3,1.4,.5,1)`;
    flipDeg = flipped ? 180 : 0; apply(); setTimeout(() => { card.style.transition = ''; }, reduced() ? 0 : flipMs);
    onFlip && onFlip(flipped ? 'back' : 'front');
  }
  let down = null;
  const pos = (e) => { const r = card.getBoundingClientRect(); return [(e.clientX - r.left) / Math.max(1, r.width), (e.clientY - r.top) / Math.max(1, r.height)]; };
  const onMove = (e) => { if (gyroOn && e.pointerType !== 'mouse' && !down) return; const [x, y] = pos(e); setTilt(x, y); if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) down.moved = true; };
  const onDown = (e) => { down = { x: e.clientX, y: e.clientY, moved: false }; onMove(e); };
  const onUp = () => { const d = down; down = null; if (d && !d.moved) flip(); };
  const onLeave = () => { down = null; if (!gyroOn) setTilt(0.5, 0.5); };
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    else if (e.key === 'Escape') flip(false);
    else if (e.key.startsWith('Arrow')) { e.preventDefault(); const step = 0.12; const nx = cur.mx + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0); const ny = cur.my + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0); setTilt(clamp(nx), clamp(ny)); }
  };
  const onOrient = (e) => {
    if (e.beta == null && e.gamma == null) return;
    const t = tiltFromOrientation(e.beta, e.gamma, maxTilt); if (reduced()) { t.rx = 0; t.ry = 0; } if (flipped) t.ry = -t.ry;
    Object.assign(target, t); kick();
  };
  card.addEventListener('pointermove', onMove); card.addEventListener('pointerdown', onDown); card.addEventListener('pointerup', onUp);
  card.addEventListener('pointerleave', onLeave); card.addEventListener('pointercancel', onLeave); card.addEventListener('keydown', onKey);
  /** Call from a click/tap handler. Resolves true when tilt now follows the device. */
  async function enableGyro() {
    const DOE = win.DeviceOrientationEvent; if (!DOE) return false;
    try { if (typeof DOE.requestPermission === 'function' && (await DOE.requestPermission()) !== 'granted') return false; } catch { return false; }
    if (!gyroOn) { win.addEventListener('deviceorientation', onOrient); gyroOn = true; } return true;
  }
  apply();
  return {
    el: root, card, flip, setTilt, enableGyro, get side() { return flipped ? 'back' : 'front'; },
    destroy() {
      cancelAnimationFrame(raf); if (gyroOn) win.removeEventListener('deviceorientation', onOrient);
      card.removeEventListener('pointermove', onMove); card.removeEventListener('pointerdown', onDown); card.removeEventListener('pointerup', onUp);
      card.removeEventListener('pointerleave', onLeave); card.removeEventListener('pointercancel', onLeave); card.removeEventListener('keydown', onKey); root.remove();
    },
  };
}
