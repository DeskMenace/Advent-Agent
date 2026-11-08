// kit/toys/bloom.js — seeded procedural flowers (bezier SVG petals) that unfold on touch, click or keyboard.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createBloom, flowerGeometry } from './bloom.js';
//   const bloom = createBloom(document.querySelector('#garden'), {
//     seed: 'their-name', count: 5,                          // string or number; same seed → same bouquet
//     hues: [340, 20, 45], labels: ['Mum', 'Dad', 'Juno', 'Ines', 'Tom'],   // optional petal hues and per-flower names
//     onOpen: (i) => note.textContent = `Flower ${i + 1} opened` });
//   // Tap/click a bud, or Tab to it and press Enter/Space: it unfolds with an overshooting ease.
//   bloom.unfold(2);  bloom.unfoldAll();  bloom.close();  bloom.regrow('new-seed');
//   window.adventCapture = { async prepare() { bloom.unfoldAll({ instant: true }); } };
//   flowerGeometry(7, { petals: 8, layers: 2 }).petals[0].d;   // pure: deterministic SVG path data (Node-safe)
//   bloom.destroy();

const NS = 'http://www.w3.org/2000/svg';
function hashSeed(s) { if (typeof s === 'number') return s >>> 0; let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const r2 = (n) => Math.round(n * 100) / 100;

export function easeOutBack(t, s = 1.70158) { const u = t - 1; return 1 + (s + 1) * u * u * u + s * u * u; }
export function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

/** Deterministic flower. Petals point "up" (negative y) from the origin; rotate each by `angle` degrees.
 *  Returns { petals: [{ d, angle, layer, fill, stroke, length }], center: { r, fill, dots: [{x,y,r}] }, stem: { d } }. */
export function flowerGeometry(seed, { petals, layers, radius = 50, hues } = {}) {
  const rnd = mulberry32(hashSeed(seed));
  const n = petals || 5 + Math.floor(rnd() * 8);
  const L = layers || 1 + Math.floor(rnd() * 3);
  const hue = hues && hues.length ? hues[Math.floor(rnd() * hues.length)] : Math.floor(rnd() * 360);
  const shape = rnd(); // 0..1: round → pointed
  const out = [];
  for (let layer = 0; layer < L; layer++) {
    const len = radius * (1 - layer * 0.22) * (0.9 + rnd() * 0.15), w = len * (0.28 + (1 - shape) * 0.3) * (1 - layer * 0.1);
    const tip = shape > 0.6 ? 0.02 : 0.25; const offset = (layer % 2) * (180 / n);
    for (let i = 0; i < n; i++) {
      const j = (rnd() - 0.5) * 0.12, l = len * (1 + j), ww = w * (1 + j);
      const d = `M0 0 C${r2(-ww)} ${r2(-l * 0.25)} ${r2(-ww * 1.05)} ${r2(-l * (0.85 - tip))} 0 ${r2(-l)} C${r2(ww * 1.05)} ${r2(-l * (0.85 - tip))} ${r2(ww)} ${r2(-l * 0.25)} 0 0Z`;
      const light = 62 + layer * 8 + (rnd() - 0.5) * 8;
      out.push({ d, angle: r2((360 / n) * i + offset + (rnd() - 0.5) * 6), layer, length: r2(l),
        fill: `hsl(${(hue + layer * 8) % 360} ${70 - layer * 5}% ${r2(light)}%)`, stroke: `hsl(${hue} 55% ${r2(light - 22)}%)` });
    }
  }
  const cr = radius * (0.14 + rnd() * 0.08), dots = [];
  for (let k = 0; k < 9; k++) { const a = k * 2.39996, rr = cr * 0.75 * Math.sqrt((k + 0.5) / 9); dots.push({ x: r2(Math.cos(a) * rr), y: r2(Math.sin(a) * rr), r: r2(cr * 0.12) }); }
  const sway = (rnd() - 0.5) * radius * 0.6;
  return { petals: out, layers: L, center: { r: r2(cr), fill: `hsl(${(hue + 40 + Math.floor(rnd() * 20)) % 360} 80% 52%)`, dots },
    stem: { d: `M0 0 C${r2(sway)} ${r2(radius * 0.8)} ${r2(-sway)} ${r2(radius * 1.6)} 0 ${r2(radius * 2.4)}` } };
}

function reducedMotion() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }

export function createBloom(container, opts = {}) {
  const o = { seed: 1, count: 3, hues: null, labels: [], duration: 1300, onOpen: null, background: 'transparent', ...opts };
  const reduced = reducedMotion();
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('role', 'group'); svg.setAttribute('aria-label', o.label || 'Flowers. Tap a bud to open it.');
  svg.style.cssText = `display:block;width:100%;height:100%;touch-action:manipulation;background:${o.background}`;
  container.appendChild(svg);
  let flowers = [], raf = 0;

  function build(seed) {
    svg.textContent = ''; flowers = [];
    const rnd = mulberry32(hashSeed(seed)); const n = o.count, W = 100 * n, H = 260;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
    for (let i = 0; i < n; i++) {
      const geo = flowerGeometry(`${seed}:${i}`, { radius: 34 + rnd() * 10, hues: o.hues });
      const x = 50 + i * 100 + (rnd() - 0.5) * 20, y = 70 + rnd() * 50;
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', `translate(${r2(x)} ${r2(y)})`); g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button');
      g.setAttribute('aria-label', (o.labels[i] ? o.labels[i] + ': ' : '') + 'closed flower, press to open'); g.style.cursor = 'pointer'; g.style.outline = 'none';
      const stem = document.createElementNS(NS, 'path'); stem.setAttribute('d', geo.stem.d); stem.setAttribute('fill', 'none'); stem.setAttribute('stroke', '#3d7a3a'); stem.setAttribute('stroke-width', '3'); stem.setAttribute('stroke-linecap', 'round');
      const leaf = document.createElementNS(NS, 'path'); const ly = 60 + rnd() * 40, side = rnd() < 0.5 ? -1 : 1;
      leaf.setAttribute('d', `M0 ${r2(ly)} q${side * 18} -14 ${side * 30} 2 q${side * -14} 12 ${side * -30} -2Z`); leaf.setAttribute('fill', '#5a9a4b');
      g.append(stem, leaf);
      const petalEls = [];
      for (let layer = geo.layers - 1; layer >= 0; layer--) for (const p of geo.petals.filter((q) => q.layer === layer)) {
        const el = document.createElementNS(NS, 'path'); el.setAttribute('d', p.d); el.setAttribute('fill', p.fill); el.setAttribute('stroke', p.stroke); el.setAttribute('stroke-width', '0.8');
        g.appendChild(el); petalEls.push({ el, p });
      }
      const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', geo.center.r); c.setAttribute('fill', geo.center.fill); g.appendChild(c);
      for (const d of geo.center.dots) { const e = document.createElementNS(NS, 'circle'); e.setAttribute('cx', d.x); e.setAttribute('cy', d.y); e.setAttribute('r', d.r); e.setAttribute('fill', 'rgba(60,30,0,0.45)'); g.appendChild(e); }
      const f = { g, petalEls, center: c, progress: 0, target: 0, from: 0, start: 0, layers: geo.layers, label: o.labels[i] };
      const toggle = () => (f.target ? close(i) : unfold(i));
      g.addEventListener('click', toggle);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      g.addEventListener('focus', () => c.setAttribute('stroke', '#222')); g.addEventListener('blur', () => c.removeAttribute('stroke'));
      svg.appendChild(g); flowers.push(f); paint(f);
    }
  }
  /** Petal pose for a progress 0 (bud) → 1 (open). Inner layers open later. */
  function paint(f) {
    for (const { el, p } of f.petalEls) {
      const delay = (f.layers - 1 - p.layer) * 0.18; const local = Math.max(0, Math.min(1, (f.progress - delay) / (1 - delay * 0.5)));
      const e = easeOutBack(local), a0 = ((p.angle + 180) % 360) - 180, bud = a0 * 0.12;   // closed: petals bunched upward like a bud
      const ang = bud + (a0 - bud) * e, sx = 0.3 + 0.7 * e, sy = 0.55 + 0.45 * e;
      el.setAttribute('transform', `rotate(${r2(ang)}) scale(${r2(sx)} ${r2(sy)})`);
    }
    f.center.setAttribute('transform', `scale(${r2(0.4 + 0.6 * easeOutCubic(Math.min(1, f.progress * 1.5)))})`);
  }
  function animate(now) {
    raf = 0; let busy = false;
    for (const f of flowers) {
      if (f.progress === f.target) continue;
      const t = Math.min(1, (now - f.start) / o.duration); f.progress = f.from + (f.target - f.from) * t;
      if (t >= 1) f.progress = f.target; else busy = true; paint(f);
    }
    if (busy) raf = requestAnimationFrame(animate);
  }
  function go(i, target, instant) {
    const f = flowers[i]; if (!f || f.target === target) return;
    f.from = f.progress; f.target = target; f.start = performance.now();
    f.g.setAttribute('aria-label', (f.label ? f.label + ': ' : '') + (target ? 'open flower' : 'closed flower, press to open'));
    if (instant || reduced) { f.progress = target; paint(f); } else if (!raf) raf = requestAnimationFrame(animate);
    if (target && o.onOpen) o.onOpen(i);
  }
  function unfold(i, { instant = false } = {}) { go(i, 1, instant); }
  function close(i, { instant = false } = {}) { go(i, 0, instant); }
  build(o.seed);
  return {
    svg, unfold, close,
    unfoldAll({ instant = false, stagger = 220 } = {}) { flowers.forEach((_, i) => (instant || reduced ? unfold(i, { instant: true }) : setTimeout(() => unfold(i), i * stagger))); },
    closeAll() { flowers.forEach((_, i) => close(i)); },
    regrow(seed) { cancelAnimationFrame(raf); raf = 0; o.seed = seed; build(seed); },
    get count() { return flowers.length; },
    destroy() { cancelAnimationFrame(raf); svg.remove(); },
  };
}
