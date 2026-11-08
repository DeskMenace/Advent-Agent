// kit/story/card.js — paper greeting-card renderer (front + inside), print-friendly, no DOM at module level.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { renderCard, cardCSS } from './card.js';
//   document.head.insertAdjacentHTML('beforeend', `<style>${cardCSS()}</style>`);
//   const card = renderCard(document.body, {
//     front: { title: 'Door 7', eyebrow: 'A small card', art: svgElementOrHTMLString },  // art: SVG/HTML string or element
//     inside: { heading: 'Dear you,', body: ['Paragraph one.', 'Paragraph two.'], sign: 'Your Secret Santa' },
//     flip: true,                                   // click/Enter flips between front and inside
//   });
//   card.show('inside'); card.show('front'); card.element
//   // Print: both faces print as two pages (print.js adds @page rules); hide the flip button with class no-print.
//   cardHTML(opts) → string, for building without a DOM

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function cardHTML({ front = {}, inside = {} } = {}) {
  const art = typeof front.art === 'string' ? front.art : '';
  const body = Array.isArray(inside.body) ? inside.body.map((p) => `<p>${esc(p)}</p>`).join('') : `<p>${esc(inside.body)}</p>`;
  return `<article class="card" aria-label="${esc(front.title || 'Card')}">
  <section class="card-face card-front page">${front.eyebrow ? `<p class="card-eyebrow">${esc(front.eyebrow)}</p>` : ''}<div class="card-art">${art}</div><h1 class="card-title">${esc(front.title)}</h1>${front.subtitle ? `<p class="card-subtitle">${esc(front.subtitle)}</p>` : ''}</section>
  <section class="card-face card-inside page" hidden>${inside.heading ? `<h2 class="card-heading">${esc(inside.heading)}</h2>` : ''}<div class="card-body">${body}</div>${inside.sign ? `<p class="card-sign">${esc(inside.sign)}</p>` : ''}</section>
</article>`;
}
export function renderCard(container, opts = {}) {
  const wrap = document.createElement('div'); wrap.innerHTML = cardHTML(opts); const el = wrap.firstElementChild;
  if (opts.front && opts.front.art && typeof opts.front.art !== 'string') el.querySelector('.card-art').append(opts.front.art);
  const faces = { front: el.querySelector('.card-front'), inside: el.querySelector('.card-inside') }; let current = 'front';
  const api = { element: el, get face() { return current; }, show(f) { current = f; faces.front.hidden = f !== 'front'; faces.inside.hidden = f !== 'inside'; btn && (btn.textContent = f === 'front' ? 'Open the card' : 'Close the card'); return api; }, flip() { return api.show(current === 'front' ? 'inside' : 'front'); } };
  let btn = null;
  if (opts.flip !== false) { btn = document.createElement('button'); btn.type = 'button'; btn.className = 'card-flip no-print kit-btn'; btn.textContent = 'Open the card'; btn.addEventListener('click', () => api.flip()); el.append(btn); }
  container.append(el); return api;
}
export function cardCSS() {
  return `.card{max-width:560px;margin:24px auto;font-family:Georgia,'Iowan Old Style',serif;color:#243A32}
.card-face{background:#FFFAF0;border:1px solid #DFD7C9;border-radius:6px;padding:40px 36px;min-height:420px;box-shadow:0 6px 24px rgba(36,58,50,.12);display:flex;flex-direction:column;justify-content:center;text-align:center}
.card-eyebrow{font:600 12px/1 system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#A82438;margin:0 0 16px}
.card-art{margin:0 auto 20px;max-width:100%}.card-art svg,.card-art img{max-width:100%;height:auto}
.card-title{font-size:clamp(28px,6vw,44px);font-weight:400;margin:0;line-height:1.1;color:#0D3829}.card-subtitle{color:#766F62;margin:10px 0 0}
.card-inside{text-align:left;font-size:19px;line-height:1.6}.card-heading{font-weight:400;font-size:26px;margin:0 0 12px}.card-body p{margin:0 0 1em}.card-sign{font-style:italic;text-align:right;margin-top:24px}
.card-flip{display:block;margin:16px auto 0}
@media print{.card-face[hidden]{display:flex!important}.card-face{box-shadow:none;border:none;page-break-after:always}.card-flip{display:none}}
@media (max-width:480px){.card-face{padding:28px 20px;min-height:320px}}`;
}
