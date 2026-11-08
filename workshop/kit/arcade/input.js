// kit/arcade/input.js — unified keyboard + touch + pointer input, gamepad-lite.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createInput } from './input.js';
//   const input = createInput(canvas);                 // listens on the element (pointer/touch) and window (keys)
//   function update(dt) {
//     input.poll();                                    // reads gamepads if present
//     if (input.down('left'))  player.x -= 200 * dt;   // actions: left right up down action pause
//     if (input.pressed('action')) jump();             // true only on the frame the action started
//     if (input.pointer.down) aimAt(input.pointer.x, input.pointer.y);   // element-local coords
//     input.endFrame();                                // clears per-frame "pressed" flags
//   }
//   input.bindButton(document.querySelector('#btn-jump'), 'action');   // on-screen touch buttons
//   input.destroy();                                   // on reset/unload

const DEFAULT_KEYS = {
  left: ['ArrowLeft', 'a', 'A'], right: ['ArrowRight', 'd', 'D'], up: ['ArrowUp', 'w', 'W'], down: ['ArrowDown', 's', 'S'],
  action: [' ', 'Enter', 'z', 'Z'], pause: ['Escape', 'p', 'P'],
};

export function createInput(element, { keys = DEFAULT_KEYS, swipeThreshold = 24 } = {}) {
  const state = new Map(); const pressedNow = new Set(); const releasedNow = new Set();
  const keyToAction = new Map();
  for (const [action, list] of Object.entries(keys)) for (const k of list) keyToAction.set(k, action);
  const pointer = { x: 0, y: 0, down: false, dx: 0, dy: 0, swipe: null };
  const disposers = [];
  const set = (action, on) => {
    if (!action) return;
    const was = state.get(action) || false;
    state.set(action, on);
    if (on && !was) pressedNow.add(action);
    if (!on && was) releasedNow.add(action);
  };
  const on = (target, type, fn, opts) => { if (!target || !target.addEventListener) return; target.addEventListener(type, fn, opts); disposers.push(() => target.removeEventListener(type, fn, opts)); };
  const local = (e) => {
    const r = element && element.getBoundingClientRect ? element.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 };
    const sx = element && element.width ? element.width / r.width : 1, sy = element && element.height ? element.height / r.height : 1;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  };
  let start = null;
  if (typeof window !== 'undefined') {
    on(window, 'keydown', (e) => { const a = keyToAction.get(e.key); if (a) { set(a, true); if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault(); } });
    on(window, 'keyup', (e) => set(keyToAction.get(e.key), false));
    on(window, 'blur', () => { for (const a of state.keys()) set(a, false); pointer.down = false; });
  }
  if (element) {
    on(element, 'pointerdown', (e) => { const p = local(e); Object.assign(pointer, p, { down: true, dx: 0, dy: 0, swipe: null }); start = p; element.setPointerCapture && element.setPointerCapture(e.pointerId); set('action', true); });
    on(element, 'pointermove', (e) => { const p = local(e); pointer.dx = p.x - pointer.x; pointer.dy = p.y - pointer.y; pointer.x = p.x; pointer.y = p.y; });
    on(element, 'pointerup', (e) => { const p = local(e); pointer.down = false; set('action', false);
      if (start) { const dx = p.x - start.x, dy = p.y - start.y; if (Math.hypot(dx, dy) >= swipeThreshold) pointer.swipe = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); } start = null; });
    on(element, 'pointercancel', () => { pointer.down = false; set('action', false); start = null; });
    on(element, 'touchstart', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    on(element, 'contextmenu', (e) => e.preventDefault());
  }
  return {
    pointer,
    down(action) { return state.get(action) || false; },
    pressed(action) { return pressedNow.has(action); },
    released(action) { return releasedNow.has(action); },
    /** Axis -1..1 from left/right or up/down. */
    axis(neg, pos) { return (state.get(pos) ? 1 : 0) - (state.get(neg) ? 1 : 0); },
    /** Programmatic press (for on-screen buttons and tests). */
    press(action) { set(action, true); }, release(action) { set(action, false); },
    bindButton(btn, action) {
      on(btn, 'pointerdown', (e) => { e.preventDefault(); set(action, true); });
      on(btn, 'pointerup', () => set(action, false)); on(btn, 'pointerleave', () => set(action, false));
      on(btn, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(action, true); } });
      on(btn, 'keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') set(action, false); });
    },
    /** Gamepad-lite: first connected pad; left stick / d-pad, button 0 = action, button 9 = pause. */
    poll() {
      if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
      const pad = Array.from(navigator.getGamepads() || []).find(Boolean); if (!pad) return;
      const x = pad.axes[0] || 0, y = pad.axes[1] || 0, b = pad.buttons;
      set('left', x < -0.5 || (b[14] && b[14].pressed)); set('right', x > 0.5 || (b[15] && b[15].pressed));
      set('up', y < -0.5 || (b[12] && b[12].pressed)); set('down', y > 0.5 || (b[13] && b[13].pressed));
      if (b[0]) set('action', b[0].pressed); if (b[9]) set('pause', b[9].pressed);
    },
    endFrame() { pressedNow.clear(); releasedNow.clear(); pointer.swipe = null; pointer.dx = 0; pointer.dy = 0; },
    destroy() { for (const d of disposers) d(); disposers.length = 0; state.clear(); },
  };
}
