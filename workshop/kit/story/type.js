// kit/story/type.js — handwritten and editorial typography with SYSTEM font stacks only (no font files bundled, no network).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { STACKS, typeCSS, applyType } from './type.js';
//   document.head.insertAdjacentHTML('beforeend', `<style>${typeCSS()}</style>`);   // .t-hand .t-serif .t-sans .t-mono .t-display classes
//   el.className = 't-hand';                            // handwriting look: 'Caveat','Bradley Hand','Segoe Print',… cursive
//   applyType(el, 'serif', { size: 19, leading: 1.6 }); // inline style with a stack
//   STACKS.hand  → "'Caveat', 'Bradley Hand', 'Segoe Print', 'Noteworthy', 'Comic Sans MS', cursive"
//   // IMPORTANT: no font files ship with the kit and gifts must not load fonts from the web.
//   // These stacks use fonts the recipient's OS may have; the last entry is a generic family that always works.
//   // Open-licence fonts (OFL) may be embedded as base64 @font-face by the agent if it has the file; otherwise rely on stacks.
//   inkCSS() → a subtle "ink on paper" text treatment (slight tilt, soft shadow), reduced-motion safe

export const STACKS = {
  hand: "'Caveat', 'Bradley Hand', 'Segoe Print', 'Noteworthy', 'Comic Sans MS', cursive",
  handNeat: "'Patrick Hand', 'Kalam', 'Segoe Print', 'Marker Felt', 'Chalkboard SE', cursive",
  serif: "Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', 'Times New Roman', serif",
  display: "'Playfair Display', 'Didot', 'Bodoni 72', 'Georgia', serif",
  sans: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  mono: "'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  typewriter: "'American Typewriter', 'Courier Prime', 'Courier New', Courier, monospace",
};
export function typeCSS() {
  return `.t-hand{font-family:${STACKS.hand};font-size:1.25em;line-height:1.45}.t-hand-neat{font-family:${STACKS.handNeat};font-size:1.15em}
.t-serif{font-family:${STACKS.serif}}.t-display{font-family:${STACKS.display};font-weight:400;letter-spacing:-.01em}.t-sans{font-family:${STACKS.sans}}.t-mono{font-family:${STACKS.mono}}.t-typewriter{font-family:${STACKS.typewriter}}
.t-eyebrow{font-family:${STACKS.sans};font-size:12px;font-weight:600;letter-spacing:.18em;text-transform:uppercase}
.t-measure{max-width:65ch}.t-paper{background:#FFFAF0;color:#243A32}`;
}
export function applyType(el, stack = 'serif', { size, leading, weight } = {}) {
  el.style.fontFamily = STACKS[stack] || stack; if (size) el.style.fontSize = size + 'px'; if (leading) el.style.lineHeight = String(leading); if (weight) el.style.fontWeight = String(weight); return el;
}
export function inkCSS() {
  return `.t-ink{color:#1d2a36;text-shadow:0 0 .4px rgba(29,42,54,.35);transform:rotate(-.6deg);display:inline-block}
.t-ink-blue{color:#1f3b73}@media (prefers-reduced-motion:reduce){.t-ink{transform:none}}`;
}
/** Rough text width estimate (for layout without measuring): average glyph ≈ 0.5em for sans, 0.55em for serif. */
export function estimateWidth(text, fontSize = 16, stack = 'sans') { const k = stack === 'mono' ? 0.6 : stack === 'serif' || stack === 'display' ? 0.55 : stack.startsWith('hand') ? 0.5 : 0.5; return text.length * fontSize * k; }
