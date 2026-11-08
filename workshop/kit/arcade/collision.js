// kit/arcade/collision.js — AABB and circle collision helpers (pure functions).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { aabb, circles, circleRect, pointInRect, overlapAABB } from './collision.js';
//   const player = { x: 10, y: 10, w: 20, h: 30 };
//   const wall   = { x: 25, y: 0, w: 10, h: 100 };
//   if (aabb(player, wall)) {
//     const push = overlapAABB(player, wall);         // smallest separating vector { x, y }
//     player.x += push.x; player.y += push.y;         // move the player out of the wall
//   }
//   if (circles({ x: 0, y: 0, r: 5 }, { x: 8, y: 0, r: 5 })) hit();
//   if (circleRect({ x: 30, y: 50, r: 4 }, wall)) bounce();
//   if (pointInRect(mouse.x, mouse.y, button)) click();

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
export function circles(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, r = a.r + b.r;
  return dx * dx + dy * dy < r * r;
}
export function pointInCircle(px, py, c) {
  const dx = px - c.x, dy = py - c.y; return dx * dx + dy * dy <= c.r * c.r;
}
export function circleRect(c, r) {
  const cx = Math.max(r.x, Math.min(c.x, r.x + r.w)), cy = Math.max(r.y, Math.min(c.y, r.y + r.h));
  const dx = c.x - cx, dy = c.y - cy; return dx * dx + dy * dy < c.r * c.r;
}
/** Minimum translation vector to move `a` out of `b`. {x:0,y:0} if not overlapping. */
export function overlapAABB(a, b) {
  if (!aabb(a, b)) return { x: 0, y: 0 };
  const ox = Math.min(a.x + a.w - b.x, b.x + b.w - a.x), oy = Math.min(a.y + a.h - b.y, b.y + b.h - a.y);
  if (ox < oy) return { x: (a.x + a.w / 2 < b.x + b.w / 2) ? -ox : ox, y: 0 };
  return { x: 0, y: (a.y + a.h / 2 < b.y + b.h / 2) ? -oy : oy };
}
/** Distance between two points. */
export function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
/** Rectangle fully inside bounds? */
export function inside(a, bounds) {
  return a.x >= bounds.x && a.y >= bounds.y && a.x + a.w <= bounds.x + bounds.w && a.y + a.h <= bounds.y + bounds.h;
}
