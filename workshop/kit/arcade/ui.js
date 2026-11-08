// kit/arcade/ui.js — pause/reset overlays, accessible buttons, HUD helpers (DOM only inside functions).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createOverlay, button, injectBaseStyles } from './ui.js';
//   injectBaseStyles();                                           // once; minimal focus-visible styles
//   const overlay = createOverlay(stage, {                        // stage: the game's container element
//     title: 'Paused', text: 'Press Escape or tap Resume.',
//     buttons: [{ label: 'Resume', onClick: () => loop.resume() }, { label: 'Reset', onClick: reset }],
//   });
//   loop.onPause = (p) => (p ? overlay.show() : overlay.hide());  // focus moves into the overlay and back
//   overlay.set({ title: 'Game over', text: `Score ${score.value}` });
//   const mute = button('Mute', toggleMute, { pressed: false });  // <button aria-pressed> toggle
//   stage.append(mute);

export function injectBaseStyles(id = 'kit-ui-styles') {
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const style = document.createElement('style'); style.id = id;
  style.textContent = `.kit-overlay{position:absolute;inset:0;display:grid;place-items:center;background:rgba(36,58,50,.72);color:#FFFAF0;text-align:center;padding:16px;z-index:10}
.kit-overlay[hidden]{display:none}.kit-overlay h2{font:600 28px/1.2 Georgia,serif;margin:0 0 8px}.kit-overlay p{margin:0 0 16px;max-width:36ch}
.kit-btn{font:600 16px/1 system-ui,sans-serif;padding:12px 18px;margin:4px;border-radius:6px;border:1px solid #BD955A;background:#14503A;color:#FFFAF0;cursor:pointer;min-width:44px;min-height:44px}
.kit-btn:hover{background:#0D3829}.kit-btn:focus-visible{outline:3px solid #E7C890;outline-offset:2px}.kit-btn[aria-pressed="true"]{background:#A82438}
@media (prefers-reduced-motion:reduce){.kit-overlay{transition:none}}`;
  document.head.appendChild(style);
}

export function button(label, onClick, { pressed, className = 'kit-btn', title } = {}) {
  const b = document.createElement('button'); b.type = 'button'; b.className = className; b.textContent = label;
  if (title) b.title = title;
  if (pressed !== undefined) { b.setAttribute('aria-pressed', String(pressed)); b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))); }
  b.addEventListener('click', (e) => onClick && onClick(e, b));
  return b;
}

export function createOverlay(container, { title = '', text = '', buttons = [] } = {}) {
  const el = document.createElement('div'); el.className = 'kit-overlay'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.hidden = true;
  const box = document.createElement('div'); const h = document.createElement('h2'); const p = document.createElement('p'); const row = document.createElement('div');
  h.id = 'kit-overlay-title-' + Math.random().toString(36).slice(2, 7); el.setAttribute('aria-labelledby', h.id);
  box.append(h, p, row); el.append(box);
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.appendChild(el);
  let lastFocus = null;
  const api = {
    element: el,
    set({ title: t, text: x, buttons: bs } = {}) {
      if (t !== undefined) h.textContent = t; if (x !== undefined) p.textContent = x;
      if (bs) { row.textContent = ''; for (const b of bs) row.appendChild(button(b.label, b.onClick, b)); }
      return api;
    },
    show() { lastFocus = document.activeElement; el.hidden = false; const first = el.querySelector('button'); first && first.focus(); return api; },
    hide() { el.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); return api; },
    get visible() { return !el.hidden; },
  };
  el.addEventListener('keydown', (e) => { // keep Tab inside the dialog
    if (e.key !== 'Tab') return; const f = Array.from(el.querySelectorAll('button')); if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  });
  return api.set({ title, text, buttons });
}

/** A small live region for score/status text (screen readers announce changes politely). */
export function createHud(container, { label = 'Status' } = {}) {
  const el = document.createElement('div'); el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-label', label); el.className = 'kit-hud';
  container.appendChild(el);
  return { element: el, set(text) { el.textContent = text; } };
}
