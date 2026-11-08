// kit/toys/aquarium.js — CSS-3D glass fish tank: fish that wander in 3D, feeding, bubbles, plants; drag to turn the tank.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createAquarium } from './aquarium.js';
//   const tank = createAquarium(document.querySelector('#tank'), {
//     fish: [{ name: 'Biscuit', color: '#ff8a3d' }, { name: 'Sir Bubbles', emoji: '🐡' }, { color: '#5ac8fa', size: 34 }],
//     plants: 4, water: 'rgba(80,170,220,0.28)', label: 'Their fish tank' });
//   feedBtn.onclick = () => tank.feed(6);              // pellets sink; the nearest fish chase and eat them
//   tank.addFish({ name: 'New friend', color: '#c86bfa' });   // collections: one new fish per gift
//   // Drag (mouse or touch) to turn the tank; arrow keys when focused; double-click/Enter feeds.
//   tank.rotate(-20, 8);                               // yaw, pitch in degrees
//   window.adventCapture = { async prepare() { tank.rotate(-25, 10); tank.feed(4); } };
//   tank.destroy();
// Inspired by CSS 3D Lab (MIT, github.com/Evirtual/css-3d-lab); no code copied.

/** Pure: steer one fish {x,y,z,vx,vy,vz,tx,ty,tz,speed} toward its target (or the nearest food) inside the box {w,h,d}.
 *  Returns the index of eaten food or -1. `rnd` lets tests be deterministic. */
export function stepFish(f, dt, box, food = [], rnd = Math.random) {
  const hw = box.w / 2 - 20, hh = box.h / 2 - 16, hd = box.d / 2 - 14;
  let tx = f.tx, ty = f.ty, tz = f.tz, eaten = -1, best = Infinity, hungry = false;
  food.forEach((p, i) => { const d = Math.hypot(p.x - f.x, p.y - f.y, p.z - f.z); if (d < best) { best = d; tx = p.x; ty = p.y; tz = p.z; hungry = true; if (d < 12) eaten = i; } });
  if (!hungry && Math.hypot(tx - f.x, ty - f.y, tz - f.z) < 20) { f.tx = (rnd() * 2 - 1) * hw; f.ty = (rnd() * 2 - 1) * hh * 0.8; f.tz = (rnd() * 2 - 1) * hd; }
  const dx = tx - f.x, dy = ty - f.y, dz = tz - f.z, len = Math.hypot(dx, dy, dz) || 1;
  const sp = (f.speed || 40) * (hungry ? 1.8 : 1), steer = hungry ? 3 : 1.2;
  f.vx += ((dx / len) * sp - f.vx) * steer * dt; f.vy += ((dy / len) * sp * 0.5 - f.vy) * steer * dt; f.vz += ((dz / len) * sp - f.vz) * steer * dt;
  f.x = Math.max(-hw, Math.min(hw, f.x + f.vx * dt)); f.y = Math.max(-hh, Math.min(hh, f.y + f.vy * dt)); f.z = Math.max(-hd, Math.min(hd, f.z + f.vz * dt));
  return eaten;
}

function reducedMotion() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }
const CSS = `
.aq{position:relative;width:100%;height:100%;perspective:1100px;outline:none;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none}
.aq:focus-visible{box-shadow:0 0 0 3px #fff8,0 0 0 6px #2a6fdb}
.aq-tank,.aq-tank *{transform-style:preserve-3d;position:absolute;left:50%;top:50%}
.aq-face{pointer-events:none;border:2px solid rgba(255,255,255,.55);box-sizing:border-box;backface-visibility:visible}
.aq-glass{background:linear-gradient(115deg,rgba(255,255,255,.28) 0 8%,rgba(255,255,255,.04) 9% 60%,rgba(255,255,255,.18) 61% 64%,rgba(255,255,255,.03) 65%)}
.aq-fish{transition:none;will-change:transform}
.aq-fish .b{position:absolute;left:0;top:0;width:100%;height:100%;border-radius:55% 45% 45% 55%/60% 50% 50% 40%}
.aq-fish .t{position:absolute;left:-38%;top:15%;width:45%;height:70%;clip-path:polygon(0 0,100% 50%,0 100%,22% 50%)}
.aq-fish .e{position:absolute;left:auto;right:18%;top:28%;width:14%;height:22%;border-radius:50%;background:#111;box-shadow:0 0 0 2px #fff}
.aq-fish .m{position:absolute;left:0;top:0;font-size:inherit;line-height:1}
.aq-pellet{width:6px;height:6px;margin:-3px;border-radius:50%;background:#c9853a;box-shadow:inset -1px -1px 0 #7a4d1c}
.aq-bubble{width:8px;height:8px;margin:-4px;border-radius:50%;border:1.5px solid rgba(255,255,255,.75);animation:aq-rise var(--dur,4s) linear infinite;animation-delay:var(--delay,0s)}
@keyframes aq-rise{from{transform:translate3d(var(--x),var(--y0),var(--z)) scale(.6);opacity:0}10%{opacity:1}to{transform:translate3d(var(--x),var(--y1),var(--z)) scale(1.1);opacity:0}}
@media (prefers-reduced-motion:reduce){.aq-bubble{animation:none;opacity:.6;transform:translate3d(var(--x),var(--y0),var(--z))}}`;

export function createAquarium(container, opts = {}) {
  const o = { fish: [{ color: '#ff8a3d' }, { color: '#ffd23d', size: 26 }, { color: '#5ac8fa', size: 32 }], plants: 4, bubbles: 10, water: 'rgba(80,170,220,0.28)', gravel: '#d8c39a', label: 'Fish tank', yaw: -24, pitch: 10, ...opts };
  const reduced = reducedMotion();
  if (!document.getElementById('aq-css')) { const st = document.createElement('style'); st.id = 'aq-css'; st.textContent = CSS; document.head.appendChild(st); }
  const root = document.createElement('div'); root.className = 'aq'; root.tabIndex = 0; root.setAttribute('role', 'img');
  const tank = document.createElement('div'); tank.className = 'aq-tank'; root.appendChild(tank); container.appendChild(root);
  let box = { w: 400, h: 240, d: 200 }, yaw = o.yaw, pitch = o.pitch, fish = [], food = [], raf = 0, last = 0, drag = null;
  const div = (cls, css = '') => { const d = document.createElement('div'); d.className = cls; d.style.cssText = css; return d; };
  const place = (el, x, y, z, extra = '') => { el.style.transform = `translate(-50%,-50%) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) ${extra}`; };

  function build() {
    const r = container.getBoundingClientRect(); const W = Math.max(200, Math.min((r.width || 480) * 0.78, 620));
    box = { w: W, h: W * 0.6, d: W * 0.5 };
    tank.textContent = ''; const { w, h, d } = box;
    const face = (fw, fh, tf, bg, cls = 'aq-face') => { const f = div(cls, `width:${fw}px;height:${fh}px;margin:${-fh / 2}px 0 0 ${-fw / 2}px;background:${bg};transform:${tf}`); tank.appendChild(f); return f; };
    const water = `linear-gradient(180deg,rgba(255,255,255,.12),${o.water} 30%,${o.water})`;
    face(w, h, `translateZ(${-d / 2}px)`, `linear-gradient(180deg,${o.water},rgba(20,60,110,.45))`);
    face(d, h, `rotateY(90deg) translateZ(${-w / 2}px)`, water); face(d, h, `rotateY(90deg) translateZ(${w / 2}px)`, water);
    face(w, d, `rotateX(90deg) translateZ(${-h / 2}px)`, `radial-gradient(${o.gravel} 30%, transparent 32%) 0 0/9px 9px, ${o.gravel}`);
    face(w, d, `rotateX(90deg) translateZ(${h / 2 - 2}px)`, 'rgba(255,255,255,.08)');
    for (let i = 0; i < o.plants; i++) {
      const x = (-0.42 + (0.84 * (i + 0.5)) / o.plants) * w, z = (i % 2 ? -0.3 : 0.15) * d, ph = h * (0.35 + ((i * 37) % 30) / 100);
      for (const rot of [0, 90]) { const p = div('aq-face', `border:0;width:${ph * 0.35}px;height:${ph}px;margin:${-ph}px 0 0 ${-ph * 0.175}px;transform-origin:50% 100%;background:radial-gradient(ellipse at 50% 100%,#2f8a43 0 30%,transparent 31%),linear-gradient(90deg,transparent 45%,#3d9a4f 46% 54%,transparent 55%);border-radius:50% 50% 0 0/80% 80% 0 0;transform:translate3d(${x}px,${h / 2}px,${z}px) rotateY(${rot}deg)`); p.style.background = `radial-gradient(ellipse 30% 22% at 30% 40%,#46b45c 98%,transparent),radial-gradient(ellipse 30% 22% at 70% 62%,#3da352 98%,transparent),radial-gradient(ellipse 28% 20% at 35% 82%,#2f8a43 98%,transparent),linear-gradient(90deg,transparent 46%,#2f7a3d 47% 53%,transparent 54%)`; tank.appendChild(p); }
    }
    for (let i = 0; i < o.bubbles; i++) {
      const b = div('aq-bubble'); const x = ((i * 53) % 100 / 100 - 0.5) * w * 0.8, z = ((i * 29) % 100 / 100 - 0.5) * d * 0.7;
      b.style.setProperty('--x', `${x}px`); b.style.setProperty('--z', `${z}px`); b.style.setProperty('--y0', `${h / 2 - 10}px`); b.style.setProperty('--y1', `${-h / 2 + 8}px`);
      b.style.setProperty('--dur', `${3 + (i % 4)}s`); b.style.setProperty('--delay', `${-(i * 0.7)}s`); tank.appendChild(b);
    }
    for (const f of fish) tank.appendChild(f.el);
    for (const p of food) tank.appendChild(p.el);
    face(w, h, `translateZ(${d / 2}px)`, 'transparent', 'aq-face aq-glass');
    face(w, h * 0.02, `translateY(${-h / 2 + h * 0.06}px) translateZ(${d / 2}px)`, 'rgba(255,255,255,.25)');
    orient();
  }
  function orient() { tank.style.transform = `rotateX(${-pitch}deg) rotateY(${yaw}deg)`; }
  function describe() { const names = fish.map((f) => f.name).filter(Boolean); root.setAttribute('aria-label', `${o.label}: ${fish.length} fish${names.length ? ' (' + names.join(', ') + ')' : ''}. Drag or use arrow keys to turn; Enter feeds.`); }

  function addFish(spec = {}) {
    const size = spec.size || 30, el = div('aq-fish', `width:${size}px;height:${size * 0.6}px;font-size:${size}px`);
    if (spec.emoji) { const m = div('m'); m.textContent = spec.emoji; m.style.transform = spec.facesRight ? '' : 'scaleX(-1)'; el.appendChild(m); el.style.height = `${size}px`; }
    else { const c = spec.color || '#ff8a3d'; el.append(div('t', `background:${c}`), div('b', `background:radial-gradient(circle at 60% 35%,#fff7 0 12%,transparent 30%),${c}`), div('e')); }
    if (spec.name) el.title = spec.name;
    const { w, h, d } = box, rnd = Math.random;
    const f = { el, name: spec.name, x: (rnd() - 0.5) * w * 0.6, y: (rnd() - 0.5) * h * 0.5, z: (rnd() - 0.5) * d * 0.5, vx: 10, vy: 0, vz: 0, tx: 0, ty: 0, tz: 0, speed: (spec.speed || 30 + rnd() * 25) * (reduced ? 0.4 : 1), phase: rnd() * 6 };
    tank.insertBefore(el, tank.lastChild?.previousSibling || null); fish.push(f); draw(0); describe(); wake(); return f;
  }
  function feed(n = 5) {
    for (let i = 0; i < n; i++) { const el = div('aq-pellet'); const p = { el, x: (Math.random() - 0.5) * box.w * 0.7, y: -box.h / 2 + 4, z: (Math.random() - 0.5) * box.d * 0.6 }; food.push(p); tank.appendChild(el); place(el, p.x, p.y, p.z); }
    wake();
  }
  function draw(t) {
    for (const f of fish) {
      const heading = Math.atan2(-f.vz, f.vx) * 180 / Math.PI, wig = reduced ? 0 : Math.sin(t * 8 + f.phase) * 6;
      place(f.el, f.x, f.y, f.z, `rotateY(${heading.toFixed(1)}deg) rotateZ(${(Math.atan2(f.vy, Math.hypot(f.vx, f.vz)) * 57).toFixed(1)}deg) rotateY(${wig.toFixed(1)}deg)`);
    }
  }
  function frame(now) {
    raf = 0; if (document.hidden) { last = 0; return; }
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60); last = now;
    for (const p of food) { if (p.y < box.h / 2 - 6) p.y += 22 * dt; place(p.el, p.x, p.y, p.z); }
    for (const f of fish) { const e = stepFish(f, dt, box, food); if (e >= 0) { food[e].el.remove(); food.splice(e, 1); } }
    draw(now / 1000); raf = requestAnimationFrame(frame);
  }
  function wake() { if (!raf) raf = requestAnimationFrame(frame); }
  const onVis = () => { if (!document.hidden) wake(); };
  const onDown = (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; root.setPointerCapture?.(e.pointerId); root.style.cursor = 'grabbing'; };
  const onMove = (e) => { if (!drag) return; yaw = drag.yaw + (e.clientX - drag.x) * 0.4; pitch = Math.max(-30, Math.min(35, drag.pitch - (e.clientY - drag.y) * 0.3)); orient(); };
  const onUp = () => { drag = null; root.style.cursor = 'grab'; };
  const onKey = (e) => {
    const k = e.key; if (k === 'ArrowLeft') yaw -= 8; else if (k === 'ArrowRight') yaw += 8; else if (k === 'ArrowUp') pitch = Math.min(35, pitch + 5); else if (k === 'ArrowDown') pitch = Math.max(-30, pitch - 5);
    else if (k === 'Enter' || k === ' ') feed(4); else return; e.preventDefault(); orient();
  };
  root.addEventListener('pointerdown', onDown); root.addEventListener('pointermove', onMove); root.addEventListener('pointerup', onUp); root.addEventListener('pointercancel', onUp);
  root.addEventListener('keydown', onKey); root.addEventListener('dblclick', () => feed(4)); document.addEventListener('visibilitychange', onVis);
  build(); for (const s of o.fish) addFish(s); describe();
  const onResize = () => build(); addEventListener('resize', onResize);
  return {
    root, addFish, feed,
    rotate(y, p = pitch) { yaw = y; pitch = p; orient(); },
    get fish() { return fish.map((f) => ({ name: f.name, x: f.x, y: f.y, z: f.z })); },
    destroy() { cancelAnimationFrame(raf); removeEventListener('resize', onResize); document.removeEventListener('visibilitychange', onVis); root.remove(); },
  };
}
