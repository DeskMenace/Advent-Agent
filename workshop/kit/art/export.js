// kit/art/export.js — canvas → PNG download, SVG → PNG rasterise, data URI helpers (DOM inside functions).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { downloadCanvas, canvasToBlob, svgToPng, downloadSVG, downloadBlob, downloadText } from './export.js';
//   saveBtn.onclick = () => downloadCanvas(canvas, 'door-7.png');            // PNG download
//   const jpg = await canvasToBlob(canvas, 'image/jpeg', 0.9);                // Blob for an <a> or a zip
//   const png = await svgToPng(svgElement, { scale: 2, background: '#F7F2E9' });   // rasterise SVG → PNG Blob
//   downloadBlob(png, 'poster@2x.png');
//   downloadSVG(svgElement, 'poster.svg');                                    // the vector itself
//   downloadText('# Hello', 'note.md', 'text/markdown');
//   const uri = await blobToDataURL(png);                                     // inline into a single-file gift
//   // All functions are safe to import in Node; they touch the DOM only when called.
//   // Safari note: svgToPng needs explicit width/height attributes on the <svg>.

export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed'))), type, quality));
}
export function downloadBlob(blob, filename) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
export async function downloadCanvas(canvas, filename = 'image.png', type = 'image/png', quality) {
  const blob = await canvasToBlob(canvas, type, quality); downloadBlob(blob, filename); return blob;
}
export function downloadText(text, filename, mime = 'text/plain') { downloadBlob(new Blob([text], { type: mime + ';charset=utf-8' }), filename); }
export function svgMarkup(svgEl) {
  const clone = svgEl.cloneNode(true); if (!clone.getAttribute('xmlns')) clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(clone);
}
export function downloadSVG(svgEl, filename = 'image.svg') { downloadBlob(new Blob([svgMarkup(svgEl)], { type: 'image/svg+xml;charset=utf-8' }), filename); }
export function svgToPng(svgEl, { scale = 1, background = null, width, height } = {}) {
  return new Promise((resolve, reject) => {
    const w = width || Number(svgEl.getAttribute('width')) || svgEl.viewBox?.baseVal?.width || 800;
    const h = height || Number(svgEl.getAttribute('height')) || svgEl.viewBox?.baseVal?.height || 600;
    const img = new Image(); const url = URL.createObjectURL(new Blob([svgMarkup(svgEl)], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale); const ctx = c.getContext('2d');
      if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('Rasterise failed'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG could not be loaded as an image')); };
    img.src = url;
  });
}
export function blobToDataURL(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); }); }
