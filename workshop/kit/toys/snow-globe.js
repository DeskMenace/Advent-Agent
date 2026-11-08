// kit/toys/snow-globe.js — canvas 2D snow globe: glass highlight, snow with inertia, shake by drag/keys/motion, object slots.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createSnowGlobe } from './snow-globe.js';
//   const globe = createSnowGlobe(document.querySelector('#globe'), {
//     slots: [{ content: '🏠', x: 0, y: 0.35, size: 0.5 }, { content: '<svg …>…</svg>', x: -0.4, y: 0.5, size: 0.25 },
//             { content: 'dog.png', x: 0.45, y: 0.5, size: 0.3 }],   // emoji / SVG string / image URL or data URI; x,y in -1..1
//     label: 'A snow globe with their house inside', glass: 'rgba(200,230,255,0.18)', base: '#6b3f2a', flakes: 260 });
//   motionBtn.onclick = () => globe.enableMotion();   // iOS needs a tap to grant motion; never asked automatically
//   globe.shake(1);                                   // also: drag/flick the globe, or press Space / Enter while focused
//   globe.setSlots([{ content: '🎄', x: 0, y: 0.3, size: 0.6 }]);
//   window.adventCapture = { async prepare() { globe.shake(1); await new Promise((r) => setTimeout(r, 600)); } };
//   globe.destroy();

/** Pure physics step. particles: [{x,y,vx,vy,r}] relative to the globe centre; keeps every flake inside the circle `radius`.
 *  ax, ay: extra acceleration this step (shake); gravity: px/s²; drag: per-second velocity damping (snow is floaty).
 *  floor: optional y of the snow bed (flakes rest at floor - p.h, so the pile has depth). Returns mean squared speed. */
export function stepSnow(particles, dt, { ax = 0, ay = 0, radius = 100, gravity = 18, drag = 1.6, bounce = 0.3, floor = null } = {}) {
  const k = Math.exp(-drag * dt);
  let energy = 0;
  for (const p of particles) {
    const r = p.r || 0;
    p.vx = (p.vx + ax * dt) * k;
    p.vy = (p.vy + (ay + gravity) * dt) * k;
    p.x += p.vx * dt; p.y += p.vy * dt;
    const lim = Math.max(0, radius - r), d = Math.hypot(p.x, p.y);
    if (d > lim && d > 0) {
      const nx = p.x / d, ny = p.y / d; p.x = nx * lim; p.y = ny * lim;
      const vn = p.vx * nx + p.vy * ny;
      if (vn > 0) { p.vx -= (1 + bounce) * vn * nx; p.vy -= (1 + bounce) * vn * ny; p.vx *= 0.6; p.vy *= 0.6; }
    }
    if (floor != null && p.y > floor - (p.h || 0) && p.vy >= 0) { p.y = floor - (p.h || 0); p.vy = 0; p.vx *= Math.exp(-10 * dt); if (Math.abs(p.vx) < 0.05) p.vx = 0; }
    energy += p.vx * p.vx + p.vy * p.vy;
  }
  return energy / Math.max(1, particles.length);
}

/** Seeded flakes spread inside a circle. */
export function makeSnow(count, radius, seed = 1) {
  let s = seed >>> 0 || 1; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  return Array.from({ length: count }, () => {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * radius * 0.95;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, vx: 0, vy: 0, r: 0.6 + rnd() * 1.8, a: 0.55 + rnd() * 0.45, h: rnd() * radius * 0.12 };
  });
}

function reducedMotion() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }

export function createSnowGlobe(container, opts = {}) {
  const o = { slots: [], label: 'Snow globe. Press Space to shake.', glass: 'rgba(210,235,255,0.16)', base: '#6b3f2a', baseDark: '#3e2318', snow: '#ffffff', scene: 'rgba(40,70,110,0.35)', flakes: 240, seed: 7, ...opts };
  const reduced = reducedMotion();
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0; canvas.setAttribute('role', 'button'); canvas.setAttribute('aria-label', o.label);
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;cursor:grab;outline-offset:4px';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, R = 100, cx = 0, cy = 0, dpr = 1;
  let flakes = [], slots = [], raf = 0, last = 0, running = false, hidden = false;
  let impulse = { x: 0, y: 0 }, offset = { x: 0, y: 0, vx: 0, vy: 0 }, drag = null, motionOn = false;
  const scale = reduced ? 0.4 : 1;

  function layout() {
    const rect = container.getBoundingClientRect(); dpr = Math.min(3, globalThis.devicePixelRatio || 1);
    W = Math.max(50, rect.width); H = Math.max(50, rect.height || rect.width);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const oldR = R; R = Math.min(W * 0.42, H * 0.36); cx = W / 2; cy = H * 0.42;
    if (!flakes.length) flakes = makeSnow(Math.round(o.flakes * (reduced ? 0.5 : 1)), R, o.seed);
    else if (oldR !== R) for (const f of flakes) { f.x *= R / oldR; f.y *= R / oldR; f.h *= R / oldR; }
    draw();
  }
  function loadSlot(s) {
    const slot = { x: 0, y: 0.3, size: 0.4, ...s, img: null };
    const c = String(s.content || '');
    if (/^\s*<svg/i.test(c)) { slot.img = new Image(); slot.img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(c); }
    else if (/^(data:|blob:|\.{0,2}\/|[\w-]+\.(png|jpe?g|gif|webp|svg)$)/i.test(c)) { slot.img = new Image(); slot.img.src = c; }
    if (slot.img) slot.img.onload = () => draw();
    return slot;
  }
  function setSlots(list) { slots = (list || []).map(loadSlot); draw(); }

  function draw() {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const gx = cx + offset.x, gy = cy + offset.y;
    // base
    const bw = R * 1.5, bh = R * 0.5, by = gy + R * 0.82;
    const bg = ctx.createLinearGradient(gx - bw / 2, 0, gx + bw / 2, 0);
    bg.addColorStop(0, o.baseDark); bg.addColorStop(0.45, o.base); bg.addColorStop(1, o.baseDark);
    ctx.fillStyle = bg; ctx.beginPath();
    ctx.moveTo(gx - bw * 0.42, by); ctx.lineTo(gx + bw * 0.42, by); ctx.lineTo(gx + bw / 2, by + bh); ctx.lineTo(gx - bw / 2, by + bh); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(gx - bw * 0.42, by, bw * 0.84, 4);
    // inside
    ctx.save(); ctx.beginPath(); ctx.arc(gx, gy, R, 0, Math.PI * 2); ctx.clip();
    const sg = ctx.createRadialGradient(gx, gy - R * 0.3, R * 0.1, gx, gy, R);
    sg.addColorStop(0, 'rgba(255,255,255,0.05)'); sg.addColorStop(1, o.scene);
    ctx.fillStyle = sg; ctx.fillRect(gx - R, gy - R, R * 2, R * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(gx, gy + R * 0.86, R * 0.75, R * 0.2, 0, 0, Math.PI * 2); ctx.fill();
    for (const s of slots) {
      const size = s.size * R, x = gx + s.x * R, y = gy + s.y * R;
      if (s.img) { if (s.img.complete && s.img.naturalWidth) { const ar = s.img.naturalWidth / s.img.naturalHeight; const w = ar >= 1 ? size : size * ar, h = ar >= 1 ? size / ar : size; ctx.drawImage(s.img, x - w / 2, y - h, w, h); } }
      else { ctx.font = `${size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(String(s.content), x, y); }
    }
    ctx.fillStyle = o.snow;
    for (const f of flakes) { ctx.globalAlpha = f.a; ctx.beginPath(); ctx.arc(gx + f.x, gy + f.y, f.r * (R / 120), 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.restore();
    // glass + highlight
    ctx.fillStyle = o.glass; ctx.beginPath(); ctx.arc(gx, gy, R, 0, Math.PI * 2); ctx.fill();
    const rim = ctx.createRadialGradient(gx, gy, R * 0.85, gx, gy, R);
    rim.addColorStop(0, 'rgba(255,255,255,0)'); rim.addColorStop(1, 'rgba(255,255,255,0.35)');
    ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(gx, gy, R, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = '#fff'; ctx.beginPath();
    ctx.ellipse(gx - R * 0.42, gy - R * 0.45, R * 0.12, R * 0.3, -0.7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(gx + R * 0.5, gy - R * 0.55, R * 0.05, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  function frame(t) {
    raf = 0; if (hidden) { running = false; return; }
    const dt = Math.min(0.05, last ? (t - last) / 1000 : 1 / 60); last = t;
    const e = stepSnow(flakes, dt, { ax: impulse.x, ay: impulse.y, radius: R, gravity: R * 0.18, drag: 1.4, floor: R * 0.8 });
    impulse.x = 0; impulse.y = 0;
    if (!drag) { offset.vx += -offset.x * 120 * dt; offset.vy += -offset.y * 120 * dt; offset.vx *= Math.exp(-10 * dt); offset.vy *= Math.exp(-10 * dt); offset.x += offset.vx * dt; offset.y += offset.vy * dt; }
    draw();
    const still = e < 0.05 && Math.abs(offset.x) + Math.abs(offset.y) < 0.3 && !drag;
    if (still) { running = false; last = 0; return; }   // idle: no CPU when nothing moves
    raf = requestAnimationFrame(frame);
  }
  function wake() { if (!running && !hidden) { running = true; last = 0; raf = requestAnimationFrame(frame); } }

  /** strength 0..1+. Gives every flake a random kick so the globe swirls. */
  function shake(strength = 1) {
    const s = strength * scale * R * 6;
    for (const f of flakes) { f.vx += (Math.random() - 0.5) * s; f.vy += (Math.random() - 0.8) * s; }
    if (!reduced) { offset.vx += (Math.random() - 0.5) * strength * 300; offset.vy -= strength * 120; }
    wake();
  }
  const onDown = (e) => { drag = { x: e.clientX, y: e.clientY, t: performance.now(), ox: offset.x, oy: offset.y, sx: e.clientX, sy: e.clientY }; canvas.setPointerCapture?.(e.pointerId); canvas.style.cursor = 'grabbing'; wake(); };
  const onMove = (e) => {
    if (!drag) return; const now = performance.now(), dt = Math.max(1, now - drag.t) / 1000;
    const vx = (e.clientX - drag.x) / dt, vy = (e.clientY - drag.y) / dt;
    const lim = reduced ? R * 0.05 : R * 0.25;
    offset.x = Math.max(-lim, Math.min(lim, drag.ox + (e.clientX - drag.sx) * 0.5)); offset.y = Math.max(-lim, Math.min(lim, drag.oy + (e.clientY - drag.sy) * 0.5));
    impulse.x -= vx * 1.8 * scale; impulse.y -= vy * 1.8 * scale;   // inertia: snow lags behind the glass
    drag.x = e.clientX; drag.y = e.clientY; drag.t = now; wake();
  };
  const onUp = () => { if (!drag) return; drag = null; canvas.style.cursor = 'grab'; wake(); };
  const onKey = (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); shake(1); } };
  const onMotion = (e) => { const a = e.acceleration || e.accelerationIncludingGravity; if (!a) return; const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0); if (m > (e.acceleration ? 6 : 16)) shake(Math.min(1.5, m / 20)); };
  const onVis = () => { hidden = document.hidden; if (!hidden) wake(); };

  /** Ask for motion permission (iOS) and listen to devicemotion. Call from a click. Resolves true when listening. */
  async function enableMotion() {
    if (motionOn) return true;
    const DME = globalThis.DeviceMotionEvent; if (!DME) return false;
    try { if (typeof DME.requestPermission === 'function' && (await DME.requestPermission()) !== 'granted') return false; } catch { return false; }
    addEventListener('devicemotion', onMotion); motionOn = true; return true;
  }

  canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp); canvas.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVis);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(layout) : null; ro ? ro.observe(container) : addEventListener('resize', layout);
  setSlots(o.slots); layout(); wake();

  return {
    canvas, shake, setSlots, enableMotion, redraw: draw,
    settle() { for (const f of flakes) { f.vx = f.vy = 0; } draw(); },
    destroy() {
      cancelAnimationFrame(raf); running = false; ro ? ro.disconnect() : removeEventListener('resize', layout);
      document.removeEventListener('visibilitychange', onVis); if (motionOn) removeEventListener('devicemotion', onMotion); canvas.remove();
    },
  };
}
