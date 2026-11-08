// kit/arcade/loop.js — fixed-step game loop with pause/resume, reduced-motion aware.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createLoop } from './loop.js';           // or paste this file inline and drop `export`
//   const state = { x: 0 };
//   const loop = createLoop({
//     update(dt) { state.x += 60 * dt; },             // dt is a fixed step in seconds (default 1/60)
//     render(alpha) { ctx.clearRect(0,0,w,h); ctx.fillRect(state.x, 20, 10, 10); },
//   });
//   loop.start();                                     // requestAnimationFrame-driven
//   document.addEventListener('keydown', (e) => { if (e.key === 'Escape') loop.toggle(); });
//   if (loop.reducedMotion()) particles.enabled = false;   // respect prefers-reduced-motion
//   loop.onPause = (paused) => overlay.hidden = !paused;

export function createLoop({ update, render, step = 1 / 60, maxFrame = 0.25 } = {}) {
  let running = false, paused = false, acc = 0, last = 0, raf = 0, frames = 0;
  const loop = {
    onPause: null,
    get running() { return running && !paused; },
    get paused() { return paused; },
    get frames() { return frames; },
    reducedMotion() {
      try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
    },
    /** Advance the simulation manually by `seconds` (useful for tests and for stepping while paused). */
    tick(seconds) {
      acc += Math.min(maxFrame, seconds);
      while (acc >= step) { update && update(step); acc -= step; frames++; }
      render && render(acc / step);
    },
    start() {
      if (running) return;
      running = true; paused = false; last = 0;
      const frame = (now) => {
        if (!running) return;
        if (!paused) { if (last) loop.tick((now - last) / 1000); }
        last = now;
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    },
    stop() { running = false; if (raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf); raf = 0; },
    pause() { if (!paused) { paused = true; loop.onPause && loop.onPause(true); } },
    resume() { if (paused) { paused = false; last = 0; loop.onPause && loop.onPause(false); } },
    toggle() { paused ? loop.resume() : loop.pause(); },
    /** Pause automatically when the tab is hidden. Call once; returns a disposer. */
    pauseWhenHidden() {
      if (typeof document === 'undefined') return () => {};
      const h = () => { if (document.hidden) loop.pause(); };
      document.addEventListener('visibilitychange', h);
      return () => document.removeEventListener('visibilitychange', h);
    },
  };
  return loop;
}
