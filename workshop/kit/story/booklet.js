// kit/story/booklet.js — zine/booklet pager with keyboard paging, progress, print of all pages.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createBooklet, bookletCSS } from './booklet.js';
//   document.head.insertAdjacentHTML('beforeend', `<style>${bookletCSS()}</style>`);
//   const book = createBooklet(document.querySelector('#book'), {
//     pages: ['<h1>Cover</h1>', '<p>Page two…</p>', '<p>Page three…</p>'],   // HTML strings or elements
//     title: 'A tiny zine',
//   });
//   book.next(); book.prev(); book.go(0); book.index; book.length
//   // Keyboard: → / PageDown / Space next, ← / PageUp prev, Home/End. Swipe left/right on touch.
//   // Printing shows every page in order (page breaks between them).
//   book.onChange = (i) => console.log('page', i + 1);

export function createBooklet(container, { pages = [], title = 'Booklet', loop = false } = {}) {
  const root = document.createElement('section'); root.className = 'bk'; root.setAttribute('role', 'region'); root.setAttribute('aria-label', title); root.tabIndex = 0;
  const stage = document.createElement('div'); stage.className = 'bk-stage'; const nav = document.createElement('div'); nav.className = 'bk-nav no-print';
  const prev = btn('Previous page', '‹'), next = btn('Next page', '›'); const status = document.createElement('span'); status.className = 'bk-status'; status.setAttribute('aria-live', 'polite');
  nav.append(prev, status, next); root.append(stage, nav); container.append(root);
  const els = pages.map((p, i) => { const page = document.createElement('article'); page.className = 'bk-page page'; page.setAttribute('aria-label', `Page ${i + 1}`); if (typeof p === 'string') page.innerHTML = p; else page.append(p); stage.append(page); return page; });
  let index = 0;
  const api = {
    element: root, onChange: null, get index() { return index; }, get length() { return els.length; },
    go(i) { if (!els.length) return; if (loop) i = (i + els.length) % els.length; i = Math.max(0, Math.min(els.length - 1, i)); index = i;
      els.forEach((e, k) => { e.hidden = k !== i; }); status.textContent = `${i + 1} / ${els.length}`; prev.disabled = !loop && i === 0; next.disabled = !loop && i === els.length - 1; api.onChange && api.onChange(i); return api; },
    next() { return api.go(index + 1); }, prev() { return api.go(index - 1); },
  };
  prev.addEventListener('click', api.prev); next.addEventListener('click', api.next);
  root.addEventListener('keydown', (e) => { const k = e.key; if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); api.next(); } else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); api.prev(); } else if (k === 'Home') api.go(0); else if (k === 'End') api.go(els.length - 1); });
  let sx = null; root.addEventListener('pointerdown', (e) => { sx = e.clientX; }); root.addEventListener('pointerup', (e) => { if (sx == null) return; const dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40) dx < 0 ? api.next() : api.prev(); });
  return api.go(0);
}
function btn(label, text) { const b = document.createElement('button'); b.type = 'button'; b.className = 'bk-btn kit-btn'; b.setAttribute('aria-label', label); b.textContent = text; return b; }
export function bookletCSS() {
  return `.bk{max-width:640px;margin:24px auto;color:#243A32;font:18px/1.6 Georgia,serif}.bk:focus-visible{outline:3px solid #E7C890;outline-offset:4px}
.bk-page{background:#FFFAF0;border:1px solid #DFD7C9;border-radius:4px;padding:40px 36px;min-height:60vh;box-shadow:0 6px 24px rgba(36,58,50,.1)}.bk-page[hidden]{display:none}
.bk-nav{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:12px}.bk-status{color:#766F62;font:15px system-ui,sans-serif;min-width:5ch;text-align:center}
.bk-btn{min-width:44px;min-height:44px;font-size:24px}.bk-btn:disabled{opacity:.4;cursor:default}
@media print{.bk-page[hidden]{display:block!important}.bk-page{box-shadow:none;border:none;min-height:auto;page-break-after:always}}@media (max-width:520px){.bk-page{padding:24px 18px}}`;
}
