// kit/arcade/particles.js — tiny pooled particle system (pure update, canvas draw).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createEmitter } from './particles.js';
//   const sparks = createEmitter({ max: 300, gravity: 200, colors: ['#E7C890', '#BD955A', '#FFFAF0'] });
//   function onHit(x, y) { sparks.burst(x, y, 24, { speed: [60, 220], life: [0.4, 0.9], size: [1, 3] }); }
//   function update(dt) { sparks.update(dt); }
//   function render() { sparks.draw(ctx); }
//   // Snow: sparks.emit(Math.random() * w, -4, { vx: 0, vy: 40, life: 8, size: 2, color: '#fff' }) each frame
//   // Respect prefers-reduced-motion: if (loop.reducedMotion()) sparks.enabled = false;
//   // sparks.count → live particles; sparks.clear() on reset.

export function createEmitter({ max = 500, gravity = 0, drag = 0, colors = ['#ffffff'], shape = 'circle', random = Math.random } = {}) {
  const pool = []; const rnd = (a, b) => (Array.isArray(a) ? a[0] + random() * (a[1] - a[0]) : (a ?? b));
  const em = {
    enabled: true, get count() { return pool.length; },
    emit(x, y, o = {}) {
      if (!em.enabled || pool.length >= max) return null;
      const ang = o.angle != null ? rnd(o.angle) : random() * Math.PI * 2, sp = o.speed != null ? rnd(o.speed) : 0;
      const p = { x, y, vx: o.vx ?? Math.cos(ang) * sp, vy: o.vy ?? Math.sin(ang) * sp, life: rnd(o.life, 1), age: 0,
        size: rnd(o.size, 2), color: o.color || colors[Math.floor(random() * colors.length)], spin: rnd(o.spin, 0), rot: random() * 6.28, fade: o.fade !== false };
      pool.push(p); return p;
    },
    burst(x, y, n, o = {}) { for (let i = 0; i < n; i++) em.emit(x, y, o); },
    update(dt) {
      for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i]; p.age += dt;
        if (p.age >= p.life) { pool[i] = pool[pool.length - 1]; pool.pop(); continue; }
        p.vy += gravity * dt; if (drag) { const f = Math.max(0, 1 - drag * dt); p.vx *= f; p.vy *= f; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
      }
    },
    draw(ctx) {
      for (const p of pool) {
        const a = p.fade ? 1 - p.age / p.life : 1; ctx.globalAlpha = Math.max(0, a); ctx.fillStyle = p.color;
        if (shape === 'circle') { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2); ctx.restore(); }
      }
      ctx.globalAlpha = 1;
    },
    clear() { pool.length = 0; },
    particles: pool,
  };
  return em;
}
