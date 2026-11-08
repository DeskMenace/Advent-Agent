// kit/art/palette.js — a few festive and non-festive palettes + helpers (pure).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { PALETTES, palette, contrast, readable, mix, withAlpha } from './palette.js';
//   const p = palette('advent');                         // { name, festive, bg, fg, accent, colors: [...] }
//   ctx.fillStyle = p.bg; ctx.fillRect(0, 0, w, h);
//   ctx.fillStyle = p.colors[i % p.colors.length];
//   contrast('#243A32', '#F7F2E9')  → 11.9                 // WCAG ratio
//   readable(p.bg)                  → '#243A32' or '#FFFAF0'  // ink that reads on bg
//   mix('#A82438', '#FFFAF0', 0.5)  → '#d48f94'
//   withAlpha('#14503A', 0.4)       → 'rgba(20,80,58,0.4)'
//   Object.keys(PALETTES)           → all names; p.festive tells you which are seasonal
//   palette(rng)                    → a random palette from a seeded rng

export const PALETTES = {
  advent:      { name: 'Advent paper', festive: true,  bg: '#F7F2E9', fg: '#243A32', accent: '#A82438', colors: ['#14503A', '#A82438', '#BD955A', '#E7C890', '#0D3829'] },
  candlelight: { name: 'Candlelight',  festive: true,  bg: '#1E1A17', fg: '#F7E7C9', accent: '#E7A33C', colors: ['#E7A33C', '#C9622C', '#F7E7C9', '#6B3F2A', '#2E2622'] },
  frost:       { name: 'Frost',        festive: true,  bg: '#0F1B2D', fg: '#E8F1FF', accent: '#9DD5FF', colors: ['#9DD5FF', '#5B8FC9', '#E8F1FF', '#2B4C7E', '#C7E6FF'] },
  gingerbread: { name: 'Gingerbread',  festive: true,  bg: '#FFF6E8', fg: '#4A2B1A', accent: '#B0583B', colors: ['#B0583B', '#D89A6A', '#4A2B1A', '#F2DCC2', '#7D9B76'] },
  nordic:      { name: 'Nordic',       festive: true,  bg: '#F4F1EC', fg: '#2B2F33', accent: '#B23A48', colors: ['#B23A48', '#2B2F33', '#8DA399', '#D9C9B6', '#F4F1EC'] },
  ocean:       { name: 'Ocean',        festive: false, bg: '#0B2A3A', fg: '#E6F4F1', accent: '#2EC4B6', colors: ['#2EC4B6', '#CBF3F0', '#FFBF69', '#FF9F1C', '#1B4965'] },
  meadow:      { name: 'Meadow',       festive: false, bg: '#F6F7EE', fg: '#2F3E2E', accent: '#7FB069', colors: ['#7FB069', '#D36135', '#E6AA68', '#282B28', '#B5C99A'] },
  ink:         { name: 'Ink',          festive: false, bg: '#FAFAF7', fg: '#141414', accent: '#1F4E79', colors: ['#141414', '#1F4E79', '#8C8C8C', '#C9C9C2', '#FAFAF7'] },
  dusk:        { name: 'Dusk',         festive: false, bg: '#2D1E2F', fg: '#F3E9F4', accent: '#F28482', colors: ['#F28482', '#F5CAC3', '#84A59D', '#F6BD60', '#6D597A'] },
  mono:        { name: 'Mono',         festive: false, bg: '#FFFFFF', fg: '#111111', accent: '#111111', colors: ['#111111', '#444444', '#888888', '#CCCCCC', '#FFFFFF'] },
};

export function palette(nameOrRng = 'advent') {
  if (typeof nameOrRng === 'function') { const keys = Object.keys(PALETTES); return { ...PALETTES[keys[Math.floor(nameOrRng() * keys.length)]] }; }
  return { ...(PALETTES[nameOrRng] || PALETTES.advent) };
}
export function hexToRgb(hex) {
  const h = hex.replace('#', ''); const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(f.slice(0, 6), 16); return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
export function rgbToHex({ r, g, b }) { return '#' + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join(''); }
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex); const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
export function contrast(a, b) { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
export function readable(bg, dark = '#243A32', light = '#FFFAF0') { return contrast(bg, dark) >= contrast(bg, light) ? dark : light; }
export function mix(a, b, t = 0.5) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t }); }
export function withAlpha(hex, alpha) { const { r, g, b } = hexToRgb(hex); return `rgba(${r},${g},${b},${alpha})`; }
export function hsl(h, s, l) { return `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`; }
