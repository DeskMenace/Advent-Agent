// kit/art/wallpaper.js — render one drawing at common phone/desktop sizes and export PNGs (canvas inside functions).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { SIZES, renderAt, exportWallpaper, exportAll, safeArea } from './wallpaper.js';
//   function draw(ctx, w, h, seed) {                       // ONE renderer for every size; use w/h, not fixed pixels
//     ctx.fillStyle = '#0F1B2D'; ctx.fillRect(0, 0, w, h);
//     const safe = safeArea(w, h);                           // { top, bottom } quiet zones for clock/dock on phones
//     ctx.fillStyle = '#E7C890'; ctx.fillRect(w * 0.1, safe.top, w * 0.8, h - safe.top - safe.bottom);
//   }
//   const canvas = renderAt(draw, SIZES.find((s) => s.id === 'phone-1170'), 7);   // returns a canvas
//   await exportWallpaper(draw, SIZES[0], { seed: 7, filename: 'door-7-phone.png' });   // triggers a download
//   buttons.append(...SIZES.map((s) => sizeButton(s, () => exportWallpaper(draw, s, { seed: 7 }))));
//   await exportAll(draw, { seed: 7, prefix: 'door-7' });  // every size, one after another

export const SIZES = [
  { id: 'phone-1170', w: 1170, h: 2532, label: 'Phone 1170×2532', kind: 'phone' },
  { id: 'phone-1284', w: 1284, h: 2778, label: 'Phone 1284×2778', kind: 'phone' },
  { id: 'phone-1080', w: 1080, h: 2400, label: 'Phone 1080×2400', kind: 'phone' },
  { id: 'desktop-1080', w: 1920, h: 1080, label: 'Desktop 1920×1080', kind: 'desktop' },
  { id: 'desktop-1440', w: 2560, h: 1440, label: 'Desktop 2560×1440', kind: 'desktop' },
  { id: 'desktop-4k', w: 3840, h: 2160, label: 'Desktop 3840×2160', kind: 'desktop' },
  { id: 'laptop-retina', w: 2880, h: 1800, label: 'Laptop 2880×1800', kind: 'desktop' },
];

/** Quiet zones: on phones keep the top ~12% (clock) and bottom ~15% (dock) calm. */
export function safeArea(w, h) { const phone = h > w; return { top: phone ? Math.round(h * 0.12) : Math.round(h * 0.04), bottom: phone ? Math.round(h * 0.15) : Math.round(h * 0.06), left: Math.round(w * 0.04), right: Math.round(w * 0.04) }; }

export function renderAt(draw, size, seed = 0) {
  const canvas = document.createElement('canvas'); canvas.width = size.w; canvas.height = size.h;
  const ctx = canvas.getContext('2d'); draw(ctx, size.w, size.h, seed, size); return canvas;
}
export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality));
}
export function downloadBlob(blob, filename) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
export async function exportWallpaper(draw, size, { seed = 0, filename, type = 'image/png', quality } = {}) {
  const canvas = renderAt(draw, size, seed); const blob = await canvasToBlob(canvas, type, quality);
  downloadBlob(blob, filename || `wallpaper-${size.w}x${size.h}.${type === 'image/jpeg' ? 'jpg' : 'png'}`); return blob;
}
export async function exportAll(draw, { seed = 0, prefix = 'wallpaper', sizes = SIZES } = {}) {
  const out = []; for (const s of sizes) { out.push(await exportWallpaper(draw, s, { seed, filename: `${prefix}-${s.w}x${s.h}.png` })); await new Promise((r) => setTimeout(r, 300)); } return out;
}
export function sizeButton(size, onClick) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = size.label; b.className = 'kit-btn'; b.addEventListener('click', onClick); return b;
}
/** Preview thumbnail scaled to a max edge, keeping aspect. */
export function thumbnail(draw, size, seed = 0, maxEdge = 240) {
  const scale = maxEdge / Math.max(size.w, size.h); const c = document.createElement('canvas'); c.width = Math.round(size.w * scale); c.height = Math.round(size.h * scale);
  const ctx = c.getContext('2d'); ctx.scale(scale, scale); draw(ctx, size.w, size.h, seed, size); return c;
}
