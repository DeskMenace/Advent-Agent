// kit/story/comic.js — comic panel layout: grid of panels with captions and speech bubbles (HTML string + DOM helper).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { comicHTML, renderComic, comicCSS } from './comic.js';
//   document.head.insertAdjacentHTML('beforeend', `<style>${comicCSS()}</style>`);
//   renderComic(document.body, {
//     title: 'The Lantern', columns: 2,
//     panels: [
//       { art: '<svg …>…</svg>', caption: 'Night one.', bubbles: [{ text: 'Is it snowing?', x: 10, y: 8 }] },   // x,y in % of panel
//       { art: svgElement, bubbles: [{ text: 'Always.', x: 55, y: 60, tail: 'left' }], wide: true },             // wide spans 2 columns
//     ],
//   });
//   // Text is real HTML (readable, searchable, scales); art is any SVG/HTML string or element.
//   comicHTML(opts) → string

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function comicHTML({ title, panels = [], columns = 2 } = {}) {
  const ps = panels.map((p, i) => `<figure class="cp${p.wide ? ' cp-wide' : ''}" aria-label="Panel ${i + 1}"><div class="cp-art">${typeof p.art === 'string' ? p.art : ''}</div>
${(p.bubbles || []).map((b) => `<p class="cp-bubble cp-tail-${b.tail || 'bottom'}" style="left:${b.x ?? 10}%;top:${b.y ?? 10}%">${esc(b.text)}</p>`).join('')}
${p.caption ? `<figcaption class="cp-caption">${esc(p.caption)}</figcaption>` : ''}</figure>`).join('\n');
  return `<section class="comic" style="--cols:${columns}">${title ? `<h1 class="comic-title">${esc(title)}</h1>` : ''}<div class="comic-grid">${ps}</div></section>`;
}
export function renderComic(container, opts = {}) {
  const wrap = document.createElement('div'); wrap.innerHTML = comicHTML(opts); const el = wrap.firstElementChild;
  el.querySelectorAll('.cp-art').forEach((a, i) => { const art = opts.panels[i] && opts.panels[i].art; if (art && typeof art !== 'string') a.append(art); });
  container.append(el); return el;
}
export function comicCSS() {
  return `.comic{max-width:900px;margin:24px auto;padding:0 16px;color:#243A32}.comic-title{font:400 clamp(28px,5vw,40px) Georgia,serif;text-align:center;margin:0 0 16px}
.comic-grid{display:grid;grid-template-columns:repeat(var(--cols,2),1fr);gap:12px}.cp{position:relative;margin:0;background:#FFFAF0;border:3px solid #26302A;aspect-ratio:1;overflow:hidden}.cp-wide{grid-column:span 2}
.cp-art{position:absolute;inset:0}.cp-art svg,.cp-art img{width:100%;height:100%;display:block}
.cp-bubble{position:absolute;max-width:60%;margin:0;background:#fff;border:2px solid #26302A;border-radius:18px;padding:8px 12px;font:600 14px/1.3 system-ui,sans-serif}
.cp-bubble::after{content:'';position:absolute;width:12px;height:12px;background:#fff;border:2px solid #26302A;border-top:none;border-left:none;transform:rotate(45deg)}
.cp-tail-bottom::after{bottom:-8px;left:20px}.cp-tail-left::after{left:-8px;top:40%;transform:rotate(135deg)}.cp-tail-right::after{right:-8px;top:40%;transform:rotate(-45deg)}.cp-tail-none::after{display:none}
.cp-caption{position:absolute;left:0;right:0;bottom:0;margin:0;background:#F7F2E9;border-top:2px solid #26302A;padding:6px 10px;font:italic 14px Georgia,serif}
@media (max-width:560px){.comic-grid{grid-template-columns:1fr}.cp-wide{grid-column:span 1}}@media print{.cp{break-inside:avoid}}`;
}
