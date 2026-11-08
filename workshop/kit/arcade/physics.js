// kit/arcade/physics.js — simple velocity, gravity, friction and bounce (pure functions).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createBody, step, bounceInBounds } from './physics.js';
//   const ball = createBody({ x: 50, y: 10, r: 8, vx: 120, vy: 0, bounce: 0.8 });
//   const world = { gravity: 900, friction: 0.2 };          // px/s², fraction of velocity lost per second
//   const bounds = { x: 0, y: 0, w: 360, h: 640 };
//   function update(dt) {
//     step(ball, dt, world);                                 // integrates velocity and position
//     bounceInBounds(ball, bounds);                          // reflects off edges using ball.bounce
//     if (ball.resting) ball.vy = 0;                         // true when it settled on the floor
//   }
//   // Rect bodies: createBody({ x, y, w, h }) use w/h instead of r.

export function createBody(o = {}) {
  const b = { x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, bounce: 0.6, mass: 1, resting: false, ...o };
  if (b.r != null && b.w == null) { b.w = b.r * 2; b.h = b.r * 2; }
  return b;
}
export function step(b, dt, { gravity = 0, friction = 0, maxSpeed = Infinity } = {}) {
  b.vx += (b.ax || 0) * dt; b.vy += ((b.ay || 0) + gravity) * dt;
  if (friction) { const f = Math.max(0, 1 - friction * dt); b.vx *= f; b.vy *= f; }
  const s = Math.hypot(b.vx, b.vy); if (s > maxSpeed) { b.vx *= maxSpeed / s; b.vy *= maxSpeed / s; }
  b.x += b.vx * dt; b.y += b.vy * dt;
  return b;
}
/** Keep a body inside bounds, reflecting velocity. Works with r (circle, x/y = centre) or w/h (rect, x/y = top-left). */
export function bounceInBounds(b, bounds, restThreshold = 20) {
  const circle = b.r != null;
  const left = circle ? b.x - b.r : b.x, right = circle ? b.x + b.r : b.x + b.w;
  const top = circle ? b.y - b.r : b.y, bottom = circle ? b.y + b.r : b.y + b.h;
  const k = b.bounce ?? 0.6; let hit = false; b.resting = false;
  if (left < bounds.x) { b.x += bounds.x - left; b.vx = Math.abs(b.vx) * k; hit = true; }
  if (right > bounds.x + bounds.w) { b.x -= right - (bounds.x + bounds.w); b.vx = -Math.abs(b.vx) * k; hit = true; }
  if (top < bounds.y) { b.y += bounds.y - top; b.vy = Math.abs(b.vy) * k; hit = true; }
  if (bottom > bounds.y + bounds.h) {
    b.y -= bottom - (bounds.y + bounds.h); b.vy = -Math.abs(b.vy) * k; hit = true;
    if (Math.abs(b.vy) < restThreshold) { b.vy = 0; b.resting = true; }
  }
  return hit;
}
/** Elastic-ish response between two circles with mass. */
export function collideCircles(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.0001, min = a.r + b.r;
  if (d >= min) return false;
  const nx = dx / d, ny = dy / d, overlap = min - d, ma = a.mass || 1, mb = b.mass || 1, tot = ma + mb;
  a.x -= nx * overlap * (mb / tot); a.y -= ny * overlap * (mb / tot);
  b.x += nx * overlap * (ma / tot); b.y += ny * overlap * (ma / tot);
  const rvx = b.vx - a.vx, rvy = b.vy - a.vy, vn = rvx * nx + rvy * ny; if (vn > 0) return true;
  const e = Math.min(a.bounce ?? 0.6, b.bounce ?? 0.6), j = (-(1 + e) * vn) / (1 / ma + 1 / mb);
  a.vx -= (j / ma) * nx; a.vy -= (j / ma) * ny; b.vx += (j / mb) * nx; b.vy += (j / mb) * ny;
  return true;
}
export function applyImpulse(b, ix, iy) { b.vx += ix / (b.mass || 1); b.vy += iy / (b.mass || 1); return b; }
