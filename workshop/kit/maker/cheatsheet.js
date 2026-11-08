// kit/maker/cheatsheet.js — cheat-sheet layout: grouped key/value rows in print-friendly columns (HTML string + CSS).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { cheatsheetHTML, cheatsheetCSS } from './cheatsheet.js';
//   document.head.insertAdjacentHTML('beforeend', `<style>${cheatsheetCSS()}</style>`);
//   document.body.innerHTML = cheatsheetHTML({
//     title: 'Editor shortcuts', subtitle: 'The ones you said you forget', columns: 3,
//     groups: [
//       { heading: 'Navigation', rows: [{ key: 'Ctrl+P', value: 'Go to file' }, { key: 'Ctrl+G', value: 'Go to line' }] },
//       { heading: 'Editing', rows: [{ key: 'Alt+↑', value: 'Move line up', note: 'also with a selection' }] },
//     ], footer: 'Add your own:', blankRows: 2 });
//   // Keys render as <kbd>; "+" splits combos. Prints on one A4/Letter page in landscape by default (see print.js for @page).
//   // Pair with kit/art/print.js injectPrintCSS('a4-landscape') and a "Print" button with class no-print.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function kbd(key) { return String(key).split(/\s*\+\s*/).map((k) => `<kbd>${esc(k)}</kbd>`).join('<span class="cs-plus">+</span>'); }
export function cheatsheetHTML({ title, subtitle, groups = [], columns = 3, footer, blankRows = 0 } = {}) {
  const g = groups.map((grp) => `<section class="cs-group"><h2>${esc(grp.heading)}</h2><table>${(grp.rows || []).map((r) => `<tr><td class="cs-key">${r.key ? kbd(r.key) : ''}</td><td class="cs-val">${esc(r.value)}${r.note ? `<small>${esc(r.note)}</small>` : ''}</td></tr>`).join('')}</table></section>`).join('');
  const blanks = blankRows ? `<section class="cs-group cs-blank"><h2>${esc(footer || 'Your own')}</h2><table>${Array.from({ length: blankRows }, () => '<tr><td class="cs-key">&nbsp;</td><td class="cs-val">&nbsp;</td></tr>').join('')}</table></section>` : '';
  return `<article class="cs page" style="--cols:${columns}"><header class="cs-head"><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</header><div class="cs-cols">${g}${blanks}</div>${footer && !blankRows ? `<footer class="cs-foot">${esc(footer)}</footer>` : ''}</article>`;
}
export function cheatsheetCSS() {
  return `.cs{max-width:1100px;margin:16px auto;padding:24px;background:#FFFAF0;color:#243A32;font:14px/1.4 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;border:1px solid #DFD7C9}
.cs-head h1{font:400 30px/1.1 Georgia,serif;margin:0;color:#0D3829}.cs-head p{margin:4px 0 16px;color:#766F62}
.cs-cols{columns:var(--cols,3);column-gap:28px}.cs-group{break-inside:avoid;margin:0 0 18px}.cs-group h2{font:600 12px/1 inherit;letter-spacing:.14em;text-transform:uppercase;color:#A82438;margin:0 0 6px;border-bottom:1px solid #DFD7C9;padding-bottom:4px}
.cs table{width:100%;border-collapse:collapse}.cs td{padding:4px 0;vertical-align:top;border-bottom:1px dotted #DFD7C9}.cs-key{width:40%;white-space:nowrap}.cs-val small{display:block;color:#766F62}
.cs kbd{display:inline-block;font:600 12px/1 'SF Mono',Menlo,Consolas,monospace;background:#fff;border:1px solid #BD955A;border-bottom-width:2px;border-radius:4px;padding:3px 6px}.cs-plus{margin:0 3px;color:#766F62}
.cs-blank td{height:22px}.cs-foot{margin-top:12px;color:#766F62}
@media (max-width:700px){.cs-cols{columns:1}}@media print{.cs{border:none;margin:0;padding:0}.cs-cols{columns:var(--cols,3)}}`;
}
