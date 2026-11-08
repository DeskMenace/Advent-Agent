// kit/art/pixel.js — pixel-art buffer with palette, drawing ops and crisp export (buffer is pure; canvas inside functions).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createPixelArt } from './pixel.js';
//   const art = createPixelArt(32, 32, ['#00000000', '#243A32', '#A82438', '#E7C890', '#FFFAF0']);  // index 0 = transparent
//   art.set(10, 12, 2); art.rect(4, 20, 24, 6, 1); art.line(0, 0, 31, 31, 3);
//   art.fromRows(['..11..', '.1221.']);                     // '.' → 0, digits → palette index (optional sprite editor)
//   art.flipX(); art.get(10, 12) → 2
//   const canvas = art.toCanvas(12);                        // scale 12×, image-rendering: pixelated
//   container.append(canvas);
//   art.toSVGString(12)                                     // rect-per-pixel SVG string (no DOM needed)
//   await art.downloadPNG('fox-32x.png', 16);               // crisp export at 16×
//   art.fill(0, 0, 2) → flood fill;  art.clear(); art.clone()

/** Transparent: index 0, 'transparent', or an 8-digit hex colour with alpha 00 (e.g. '#00000000'). */
export function isTransparent(c) { return !c || c === 'transparent' || (c.length === 9 && c.toLowerCase().endsWith('00')) || (c.length === 5 && c.endsWith('0')); }

export function createPixelArt(w, h, palette = ['#00000000', '#000000', '#ffffff']) {
  const data = new Uint8Array(w * h);
  const inb = (x, y) => x >= 0 && y >= 0 && x < w && y < h;
  const art = {
    w, h, palette, data,
    get(x, y) { return inb(x, y) ? data[y * w + x] : 0; },
    set(x, y, i) { if (inb(x, y)) data[y * w + x] = i; return art; },
    clear(i = 0) { data.fill(i); return art; },
    rect(x, y, rw, rh, i, { outline = false } = {}) { for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) if (!outline || yy === y || yy === y + rh - 1 || xx === x || xx === x + rw - 1) art.set(xx, yy, i); return art; },
    line(x0, y0, x1, y1, i) { // Bresenham
      let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
      for (;;) { art.set(x0, y0, i); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
      return art;
    },
    circle(cx, cy, r, i, { filled = true } = {}) { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = x * x + y * y; if (d <= r * r + r && (filled || d >= (r - 1) * (r - 1))) art.set(cx + x, cy + y, i); } return art; },
    fill(x, y, i) { const target = art.get(x, y); if (!inb(x, y) || target === i) return art; const stack = [[x, y]];
      while (stack.length) { const [px, py] = stack.pop(); if (!inb(px, py) || data[py * w + px] !== target) continue; data[py * w + px] = i; stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]); } return art; },
    fromRows(rows, map = {}) { rows.forEach((row, y) => [...row].forEach((ch, x) => art.set(x, y, ch === '.' || ch === ' ' ? 0 : (map[ch] ?? (/\d/.test(ch) ? Number(ch) : 1))))); return art; },
    flipX() { for (let y = 0; y < h; y++) for (let x = 0; x < w / 2; x++) { const a = y * w + x, b = y * w + (w - 1 - x); [data[a], data[b]] = [data[b], data[a]]; } return art; },
    flipY() { for (let y = 0; y < h / 2; y++) for (let x = 0; x < w; x++) { const a = y * w + x, b = (h - 1 - y) * w + x; [data[a], data[b]] = [data[b], data[a]]; } return art; },
    clone() { const c = createPixelArt(w, h, palette.slice()); c.data.set(data); return c; },
    draw(ctx, scale = 1, ox = 0, oy = 0) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = data[y * w + x]; if (!i || isTransparent(palette[i])) continue; ctx.fillStyle = palette[i]; ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale); }
    },
    toCanvas(scale = 8) { const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale; c.style.imageRendering = 'pixelated'; c.style.width = c.width + 'px'; const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; art.draw(ctx, scale); return c; },
    toSVGString(scale = 8) {
      let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges">`;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = data[y * w + x]; if (i && !isTransparent(palette[i])) s += `<rect x="${x}" y="${y}" width="1" height="1" fill="${palette[i]}"/>`; }
      return s + '</svg>';
    },
    async downloadPNG(filename = 'pixel.png', scale = 8) {
      const c = art.toCanvas(scale); const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    },
  };
  return art;
}
