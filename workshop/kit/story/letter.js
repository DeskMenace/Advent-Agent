// kit/story/letter.js — a letter on paper: date line, salutation, paragraphs, signature; optional typewriter reveal.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { renderLetter, letterCSS } from './letter.js';
//   document.head.insertAdjacentHTML('beforeend', `<style>${letterCSS()}</style>`);
//   const letter = renderLetter(document.body, {
//     date: '7 December', salutation: 'Dear reader,',
//     paragraphs: ['First paragraph.', 'Second paragraph.'],
//     closing: 'Warmly,', signature: 'Your Secret Santa', ps: 'P.S. Look behind the fox.',
//     reveal: 'typewriter',                          // 'none' | 'typewriter' (skipped under prefers-reduced-motion)
//   });
//   letter.finish();                                 // show everything immediately (also bound to a Skip button)
//   letterHTML(opts) → string

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function letterHTML({ date, salutation, paragraphs = [], closing, signature, ps, handwriting = false } = {}) {
  return `<article class="letter page${handwriting ? ' letter-hand' : ''}">${date ? `<p class="letter-date">${esc(date)}</p>` : ''}${salutation ? `<p class="letter-salutation">${esc(salutation)}</p>` : ''}
<div class="letter-body">${paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n')}</div>
${closing ? `<p class="letter-closing">${esc(closing)}</p>` : ''}${signature ? `<p class="letter-signature">${esc(signature)}</p>` : ''}${ps ? `<p class="letter-ps">${esc(ps)}</p>` : ''}</article>`;
}
export function renderLetter(container, opts = {}) {
  const wrap = document.createElement('div'); wrap.innerHTML = letterHTML(opts); const el = wrap.firstElementChild; container.append(el);
  const reduced = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } })();
  const api = { element: el, finish() { for (const p of el.querySelectorAll('[data-full]')) { p.textContent = p.dataset.full; delete p.dataset.full; } el.querySelector('.letter-skip')?.remove(); timers.forEach(clearTimeout); } };
  const timers = [];
  if (opts.reveal === 'typewriter' && !reduced) {
    const ps = Array.from(el.querySelectorAll('.letter-body p')); let delay = 0;
    for (const p of ps) { const full = p.textContent; p.dataset.full = full; p.textContent = ''; for (let i = 1; i <= full.length; i++) { timers.push(setTimeout(() => { if (p.dataset.full !== undefined) p.textContent = full.slice(0, i); }, delay)); delay += full[i - 1] === ' ' ? 18 : 28; } delay += 350; }
    const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'letter-skip no-print kit-btn'; skip.textContent = 'Show the whole letter'; skip.addEventListener('click', api.finish); el.append(skip);
    timers.push(setTimeout(() => skip.remove(), delay));
  }
  return api;
}
export function letterCSS() {
  return `.letter{max-width:620px;margin:24px auto;background:#FFFAF0;color:#243A32;border:1px solid #DFD7C9;border-radius:4px;padding:48px 44px;font:19px/1.65 Georgia,'Iowan Old Style',serif;box-shadow:0 6px 24px rgba(36,58,50,.1)}
.letter-date{text-align:right;color:#766F62;font-size:15px;margin:0 0 24px}.letter-salutation{margin:0 0 16px}.letter-body p{margin:0 0 1em}
.letter-closing{margin:24px 0 4px}.letter-signature{font-style:italic;font-size:22px;margin:0}.letter-ps{margin-top:24px;color:#766F62}
.letter-hand .letter-body,.letter-hand .letter-signature{font-family:'Caveat','Bradley Hand','Segoe Print','Comic Sans MS',cursive;font-size:23px}
.letter-skip{margin-top:16px}@media (max-width:520px){.letter{padding:28px 20px;font-size:17px}}@media print{.letter{box-shadow:none;border:none}.letter-skip{display:none}}`;
}
