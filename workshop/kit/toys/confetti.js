// kit/toys/confetti.js — confetti bursts: uses the vendored canvas-confetti when present on window, else a tiny built-in canvas burst.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { burst, hasVendor } from './confetti.js';
//   // Optional richer confetti: paste kit/vendor/confetti.browser.js (ISC, credit it in gift.json) into a plain <script>.
//   openBtn.onclick = () => burst({ x: 0.5, y: 0.6, count: 120, colors: ['#e8553d', '#ffcf4a', '#3bb273'] });
//   burst({ origin: buttonEl });                     // fire from the centre of an element
//   burst({ emoji: ['🍑', '✨'], count: 30 });         // emoji pieces (built-in burst only)
//   hasVendor();                                     // true when window.confetti exists
//   window.adventCapture = { async prepare(kind) { burst({ count: 160, seed: 3 }); await new Promise((r) => setTimeout(r, 400)); } };
//   Reduced motion: a third of the pieces, no spin, and a short fade; pass { force: true } to ignore it, { none: true } for nothing.
//   Returns a Promise that resolves when the pieces are gone.
//   The built-in canvas is fixed, full-screen, pointer-events: none, and removed when done.

export function hasVendor() { return typeof globalThis.window !== 'undefined' && typeof window.confetti === 'function'; }
export function reducedMotion() { try { return !!(globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; } }

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const DEFAULT_COLORS = ['#e8553d', '#ffcf4a', '#3bb273', '#4a90e2', '#c86dd7', '#ffffff'];

/** Create pieces (pure; used by the built-in renderer and testable). x, y in pixels. */
export function makePieces({ x = 0, y = 0, count = 100, spread = 70, angle = 90, velocity = 11, colors = DEFAULT_COLORS, emoji = null, seed = Date.now(), spin = true } = {}) {
  const r = rng(seed); const out = [];
  for (let i = 0; i < count; i++) {
    const a = ((angle + (r() - 0.5) * spread) * Math.PI) / 180; const v = velocity * (0.55 + r() * 0.65);
    out.push({ x, y, vx: Math.cos(a) * v, vy: -Math.sin(a) * v, w: 6 + r() * 6, h: 4 + r() * 6, rot: r() * Math.PI * 2, vr: spin ? (r() - 0.5) * 0.4 : 0, tilt: r() * Math.PI, color: colors[i % colors.length], emoji: emoji ? emoji[i % emoji.length] : null, life: 1 });
  }
  return out;
}
/** Advance pieces one frame (pure). Returns the number still alive. */
export function stepPieces(pieces, { gravity = 0.32, drag = 0.985, decay = 0.006, floor = Infinity } = {}) {
  let alive = 0;
  for (const p of pieces) { if (p.life <= 0) continue; p.vx *= drag; p.vy = p.vy * drag + gravity; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.tilt += 0.1; p.life -= decay; if (p.y > floor) p.life = 0; if (p.life > 0) alive++; }
  return alive;
}

function originXY(o) {
  if (o && o.getBoundingClientRect) { const b = o.getBoundingClientRect(); return { x: (b.left + b.width / 2) / innerWidth, y: (b.top + b.height / 2) / innerHeight }; }
  return null;
}

/** Fire a burst. x, y are 0–1 fractions of the viewport (or pass `origin` as an element). */
export function burst(opts = {}) {
  const reduce = !opts.force && reducedMotion(); if (opts.none) return Promise.resolve();
  const o = originXY(opts.origin) || { x: opts.x ?? 0.5, y: opts.y ?? 0.6 };
  const count = Math.max(1, Math.round((opts.count ?? 100) * (reduce ? 0.33 : 1)));
  if (hasVendor() && !opts.emoji) {
    const res = window.confetti({ particleCount: count, spread: opts.spread ?? 70, angle: opts.angle ?? 90, startVelocity: (opts.velocity ?? 11) * 4, origin: o, colors: opts.colors, disableForReducedMotion: false, ticks: reduce ? 80 : 200, scalar: opts.scalar ?? 1, zIndex: opts.zIndex ?? 1000 });
    return Promise.resolve(res);
  }
  return builtIn({ ...opts, count, x: o.x, y: o.y, reduce });
}

function builtIn({ x, y, count, reduce, zIndex = 1000, ...rest }) {
  return new Promise((resolve) => {
    const c = document.createElement('canvas'); const dpr = Math.min(2, devicePixelRatio || 1);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    Object.assign(c.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: String(zIndex) }); c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c); const g = c.getContext('2d'); g.scale(dpr, dpr);
    const pieces = makePieces({ ...rest, count, x: x * innerWidth, y: y * innerHeight, spin: !reduce, seed: rest.seed ?? Date.now() });
    const decay = reduce ? 0.02 : 0.006;
    function frame() {
      g.clearRect(0, 0, innerWidth, innerHeight);
      const alive = stepPieces(pieces, { decay, floor: innerHeight + 40 });
      for (const p of pieces) {
        if (p.life <= 0) continue; g.save(); g.globalAlpha = Math.min(1, p.life * 2); g.translate(p.x, p.y); g.rotate(p.rot);
        if (p.emoji) { g.font = `${p.w * 2.4}px system-ui, sans-serif`; g.textAlign = 'center'; g.fillText(p.emoji, 0, 0); }
        else { g.fillStyle = p.color; g.fillRect(-p.w / 2, (-p.h / 2) * Math.abs(Math.cos(p.tilt)), p.w, p.h * Math.abs(Math.cos(p.tilt)) + 0.5); }
        g.restore();
      }
      if (alive > 0) requestAnimationFrame(frame); else { c.remove(); resolve(); }
    }
    requestAnimationFrame(frame);
  });
}
