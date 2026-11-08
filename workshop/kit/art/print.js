// kit/art/print.js — @page / print CSS helpers for A4 and Letter cards, postcards and zine folds (pure strings).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { pageCSS, PRESETS, injectPrintCSS, zinePageOrder } from './print.js';
//   injectPrintCSS('a4-card');                       // adds <style> with @page size, margins, .no-print, .page breaks
//   // Markup: <section class="page page-front">…</section><section class="page page-inside">…</section>
//   // Each .page prints on its own sheet; .no-print hides UI on paper.
//   const css = pageCSS('postcard', { margin: '8mm' }); // or build the string yourself and inline it
//   PRESETS['letter-card'].size              → '8.5in 11in'
//   zinePageOrder()                          → [8, 1, 2, 7, 6, 3, 4, 5] (A4 8-page fold, positions in the 2×4 grid)
//   // Zine: lay pages into a 4×2 grid in that order; the top row is rotated 180° (class .zine-top).
//   // Always test with "Print → Save as PDF": margins, page count, and that no buttons print.
//   window.print();                          // from a button with class="no-print"

export const PRESETS = {
  'a4-card':      { size: 'A4', orientation: 'portrait',  margin: '12mm', note: 'Fold in half: front on the right half of page 1, inside on page 2.' },
  'a4-landscape': { size: 'A4 landscape', orientation: 'landscape', margin: '12mm' },
  'letter-card':  { size: '8.5in 11in', orientation: 'portrait', margin: '0.5in', note: 'US Letter, fold in half.' },
  'postcard':     { size: '148mm 105mm', orientation: 'landscape', margin: '6mm', note: 'A6 postcard; front image on page 1, address side on page 2.' },
  'a5':           { size: 'A5', orientation: 'portrait', margin: '10mm' },
  'poster-a3':    { size: 'A3', orientation: 'portrait', margin: '10mm' },
  'zine-fold':    { size: 'A4 landscape', orientation: 'landscape', margin: '5mm', note: '8 mini pages on one sheet, one cut, folded; see zinePageOrder().' },
};

export function pageCSS(preset = 'a4-card', { margin, extra = '' } = {}) {
  const p = PRESETS[preset] || PRESETS['a4-card'];
  return `@page { size: ${p.size}; margin: ${margin || p.margin}; }
@media print {
  html, body { background: #fff !important; color: #000; margin: 0; }
  .no-print, button, [role="button"], nav { display: none !important; }
  .page { page-break-after: always; break-after: page; box-shadow: none !important; margin: 0 !important; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  a { color: inherit; text-decoration: none; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ${extra}
}
@media screen {
  .page { background: #FFFAF0; box-shadow: 0 2px 12px rgba(0,0,0,.12); margin: 16px auto; }
}`;
}
export function injectPrintCSS(preset, opts, id = 'kit-print-css') {
  if (typeof document === 'undefined') return '';
  let s = document.getElementById(id); if (!s) { s = document.createElement('style'); s.id = id; document.head.appendChild(s); }
  s.textContent = pageCSS(preset, opts); return s.textContent;
}
/** 8-page zine: grid positions (top row left→right, then bottom row) hold these page numbers. Top row is printed upside down. */
export function zinePageOrder() { return [8, 1, 2, 7, 6, 3, 4, 5]; }
export function zineCSS() {
  return `.zine-sheet { display: grid; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(2, 1fr); width: 277mm; height: 190mm; }
.zine-page { border: 0.2mm dashed #bbb; padding: 6mm; overflow: hidden; font-size: 10pt; }
.zine-top { transform: rotate(180deg); }
@media print { .zine-page { border-color: transparent; } }`;
}
/** Human-friendly dimensions for a preset (mm). */
export function presetSizeMm(preset) {
  const map = { A4: [210, 297], 'A4 landscape': [297, 210], A5: [148, 210], A3: [297, 420], '8.5in 11in': [215.9, 279.4], '148mm 105mm': [148, 105] };
  const p = PRESETS[preset]; return p ? map[p.size] || null : null;
}
