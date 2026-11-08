// kit/toys/crystal.js — CSS-3D faceted crystal (bipyramid) with live facet lighting, inclusions inside, drag to spin.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createCrystal } from './crystal.js';
//   const gem = createCrystal(document.querySelector('#gem'), {
//     facets: 8, hue: 190, size: 220, label: 'A crystal of good things',
//     inclusions: ['🌱', 'first flat', '🎻'] });          // emoji or short text suspended inside the crystal
//   gem.addInclusion('got the job');                    // one good thing per click, etc.
//   gem.setFacets(10);  gem.setHue(320);                // rebuild with more facets / a new colour
//   gem.spin(true);                                     // gentle auto-spin (off under prefers-reduced-motion)
//   // Drag (mouse/touch) flings it; it keeps spinning with friction. Arrow keys turn it when focused.
//   window.adventCapture = { async prepare() { gem.spin(false); gem.rotate(28, -12); } };
//   gem.destroy();
// Inspired by CSS 3D Lab (MIT, github.com/Evirtual/css-3d-lab); no code copied.

/** Pure geometry for an n-sided bipyramid of radius r and half-heights hTop/hBottom (px).
 *  Each face: { width, height, angle (deg around Y), tilt (deg), top (bool) }; place with rotateY(angle) translateZ(apothem) rotateX(±tilt). */
export function bipyramid(n = 8, r = 100, hTop = 120, hBottom = 160) {
  const n2 = Math.max(3, Math.floor(n)), apothem = r * Math.cos(Math.PI / n2), base = 2 * r * Math.sin(Math.PI / n2), faces = [];
  for (const [top, h] of [[true, hTop], [false, hBottom]]) {
    const slant = Math.hypot(apothem, h), tilt = (Math.asin(apothem / slant) * 180) / Math.PI;
    for (let i = 0; i < n2; i++) faces.push({ width: base, height: slant, angle: (360 / n2) * i, tilt, top });
  }
  return { n: n2, apothem, base, faces };
}
/** Pure: brightness 0..1 of a face given the crystal yaw/pitch (deg); light comes from the viewer's upper left. */
export function facetLight(face, yaw, pitch) {
  const a = ((face.angle + yaw) * Math.PI) / 180, t = (face.tilt * Math.PI) / 180, p = (pitch * Math.PI) / 180;
  const nx = Math.sin(a) * Math.cos(t), nz = Math.cos(a) * Math.cos(t), ny = (face.top ? -1 : 1) * Math.sin(t);
  const ny2 = ny * Math.cos(p) - nz * Math.sin(p), nz2 = ny * Math.sin(p) + nz * Math.cos(p);
  const L = [-0.45, -0.55, 0.7], ll = Math.hypot(...L);
  return Math.max(0, Math.min(1, 0.25 + 0.75 * ((nx * L[0] + ny2 * L[1] + nz2 * L[2]) / ll)));
}

function reducedMotion() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }

export function createCrystal(container, opts = {}) {
  const o = { facets: 8, hue: 190, size: 220, inclusions: [], label: 'Crystal', autoSpin: true, ...opts };
  const reduced = reducedMotion();
  const root = document.createElement('div'); root.tabIndex = 0; root.setAttribute('role', 'img');
  root.style.cssText = 'position:relative;width:100%;height:100%;perspective:900px;touch-action:none;cursor:grab;outline:none;user-select:none;-webkit-user-select:none';
  const gem = document.createElement('div'); gem.style.cssText = 'position:absolute;left:50%;top:50%;transform-style:preserve-3d';
  const glow = document.createElement('div');
  root.append(glow, gem); container.appendChild(root);
  let geo, faceEls = [], incl = [...o.inclusions], inclEls = [], yaw = 20, pitch = -10, vyaw = 0, spinning = o.autoSpin && !reduced, raf = 0, last = 0, drag = null;

  function build() {
    gem.textContent = ''; faceEls = []; inclEls = [];
    const s = o.size, r = s * 0.42; geo = bipyramid(o.facets, r, s * 0.45, s * 0.62);
    glow.style.cssText = `position:absolute;left:50%;top:55%;width:${s * 1.3}px;height:${s * 0.35}px;margin:${-s * 0.175}px 0 0 ${-s * 0.65}px;border-radius:50%;background:radial-gradient(hsl(${o.hue} 90% 70% / .45),transparent 70%);filter:blur(6px);transform:translateY(${s * 0.62}px)`;
    // inclusions: billboards that stay inside the crystal, spread on a small spiral
    incl.forEach((txt, i) => {
      const el = document.createElement('div'); const a = i * 2.4, rr = r * 0.35 * Math.sqrt((i + 0.5) / Math.max(1, incl.length));
      el.textContent = txt; el.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;font:600 ${Math.max(11, s * 0.07)}px system-ui,sans-serif;color:hsl(${o.hue} 60% 20%);text-shadow:0 0 6px #fff;pointer-events:none`;
      el.dataset.pos = JSON.stringify([Math.cos(a) * rr, (i / Math.max(1, incl.length) - 0.5) * s * 0.5, Math.sin(a) * rr]);
      gem.appendChild(el); inclEls.push(el);
    });
    for (const f of geo.faces) {
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;left:${-f.width / 2}px;top:${f.top ? -f.height : 0}px;width:${f.width + 0.6}px;height:${f.height}px;transform-origin:50% ${f.top ? '100%' : '0'};clip-path:polygon(${f.top ? '50% 0,100% 100%,0 100%' : '0 0,100% 0,50% 100%'});backface-visibility:visible`;
      el.style.transform = `rotateY(${f.angle}deg) translateZ(${geo.apothem}px) rotateX(${f.top ? f.tilt : -f.tilt}deg)`;
      gem.appendChild(el); faceEls.push({ el, f });
    }
    paint(); describe();
  }
  function paint() {
    gem.style.transform = `rotateX(${pitch}deg) rotateY(${yaw}deg)`;
    for (const { el, f } of faceEls) {
      const l = facetLight(f, yaw, pitch), sheen = (f.angle + yaw * 1.5) % 360;
      el.style.background = `linear-gradient(${sheen}deg, hsl(${o.hue} 85% ${30 + l * 50}% / ${0.5 + l * 0.25}), hsl(${(o.hue + 30) % 360} 90% ${50 + l * 45}% / ${0.35 + l * 0.3}) 55%, hsl(${(o.hue + 300) % 360} 80% ${45 + l * 40}% / .55))`;
      el.style.boxShadow = `inset 0 0 ${2 + l * 6}px hsl(0 0% 100% / ${0.3 + l * 0.6})`;
    }
    for (const el of inclEls) { const [x, y, z] = JSON.parse(el.dataset.pos); el.style.transform = `translate3d(${x}px,${y}px,${z}px) rotateY(${-yaw}deg) rotateX(${-pitch}deg) translate(-50%,-50%)`; }
  }
  function describe() { root.setAttribute('aria-label', `${o.label}${incl.length ? ': ' + incl.join(', ') : ''}. Drag or use arrow keys to turn it.`); }
  function frame(now) {
    raf = 0; if (document.hidden) { last = 0; return; }
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60); last = now;
    if (!drag) { yaw += vyaw * dt; vyaw *= Math.exp(-1.5 * dt); if (spinning) yaw += 14 * dt; }
    paint();
    if (drag || spinning || Math.abs(vyaw) > 0.5) raf = requestAnimationFrame(frame); else last = 0;
  }
  const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };
  const onDown = (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch, t: performance.now(), lx: e.clientX }; vyaw = 0; root.setPointerCapture?.(e.pointerId); root.style.cursor = 'grabbing'; wake(); };
  const onMove = (e) => {
    if (!drag) return; const now = performance.now(), dt = Math.max(1, now - drag.t) / 1000;
    vyaw = ((e.clientX - drag.lx) * 0.5) / dt; drag.lx = e.clientX; drag.t = now;
    yaw = drag.yaw + (e.clientX - drag.x) * 0.5; pitch = Math.max(-40, Math.min(40, drag.pitch - (e.clientY - drag.y) * 0.3)); paint();
  };
  const onUp = () => { if (!drag) return; drag = null; root.style.cursor = 'grab'; if (reduced) vyaw = 0; vyaw = Math.max(-720, Math.min(720, vyaw)); wake(); };
  const onKey = (e) => { const k = e.key; if (k === 'ArrowLeft') yaw -= 10; else if (k === 'ArrowRight') yaw += 10; else if (k === 'ArrowUp') pitch = Math.max(-40, pitch - 6); else if (k === 'ArrowDown') pitch = Math.min(40, pitch + 6); else return; e.preventDefault(); paint(); };
  const onVis = () => { if (!document.hidden) wake(); };
  root.addEventListener('pointerdown', onDown); root.addEventListener('pointermove', onMove); root.addEventListener('pointerup', onUp); root.addEventListener('pointercancel', onUp);
  root.addEventListener('keydown', onKey); document.addEventListener('visibilitychange', onVis);
  build(); wake();
  return {
    root,
    setFacets(n) { o.facets = n; build(); },
    setHue(h) { o.hue = h; build(); },
    addInclusion(text) { incl.push(String(text)); build(); },
    setInclusions(list) { incl = [...list]; build(); },
    spin(on = true) { spinning = !!on && !reduced; wake(); },
    rotate(y, p = pitch) { yaw = y; pitch = p; vyaw = 0; paint(); },
    destroy() { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); root.remove(); },
  };
}
