// kit/art/svg.js — tiny SVG element helpers (DOM only inside functions; string builders work anywhere).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { svg, el, path, text, serialize, svgString } from './svg.js';
//   const root = svg(400, 300, { viewBox: '0 0 400 300' });              // <svg> with width/height/viewBox
//   root.append(el('rect', { x: 0, y: 0, width: 400, height: 300, fill: '#F7F2E9' }));
//   root.append(el('circle', { cx: 200, cy: 120, r: 60, fill: '#A82438' }));
//   root.append(path([[20, 280], [120, 200], [220, 260]], { stroke: '#243A32', fill: 'none', 'stroke-width': 3 }));
//   root.append(text('Door 7', 200, 290, { 'text-anchor': 'middle', 'font-family': 'Georgia, serif' }));
//   document.body.append(root);
//   const markup = serialize(root);                                           // for download or data: URI
//   svgString('circle', { cx: 1, cy: 1, r: 1 })  → '<circle cx="1" cy="1" r="1"/>'  (no DOM needed)

const NS = 'http://www.w3.org/2000/svg';

export function el(tag, attrs = {}, children = []) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  for (const c of [].concat(children)) node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}
export function svg(width, height, attrs = {}) {
  return el('svg', { xmlns: NS, width, height, viewBox: `0 0 ${width} ${height}`, role: 'img', ...attrs });
}
export function text(str, x, y, attrs = {}) { return el('text', { x, y, ...attrs }, [String(str)]); }
export function group(attrs = {}, children = []) { return el('g', attrs, children); }
/** Polyline-style path from points [[x,y],...]; `close` adds Z; `smooth` uses quadratic midpoints. */
export function path(points, attrs = {}, { close = false, smooth = false } = {}) { return el('path', { d: pathD(points, { close, smooth }), ...attrs }); }
export function pathD(points, { close = false, smooth = false } = {}) {
  if (!points.length) return '';
  let d = `M${points[0][0]} ${points[0][1]}`;
  if (smooth && points.length > 2) {
    for (let i = 1; i < points.length - 1; i++) { const [x0, y0] = points[i], [x1, y1] = points[i + 1]; d += ` Q${x0} ${y0} ${(x0 + x1) / 2} ${(y0 + y1) / 2}`; }
    const [lx, ly] = points[points.length - 1]; d += ` T${lx} ${ly}`;
  } else for (let i = 1; i < points.length; i++) d += ` L${points[i][0]} ${points[i][1]}`;
  return close ? d + ' Z' : d;
}
export function polygon(cx, cy, r, sides, attrs = {}, rotation = -Math.PI / 2) {
  const pts = Array.from({ length: sides }, (_, i) => { const a = rotation + (i / sides) * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
  return path(pts, attrs, { close: true });
}
export function star(cx, cy, outer, inner, points, attrs = {}) {
  const pts = []; for (let i = 0; i < points * 2; i++) { const r = i % 2 ? inner : outer, a = -Math.PI / 2 + (i / (points * 2)) * Math.PI * 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  return path(pts, attrs, { close: true });
}
/** Linear gradient in <defs>; returns the id to use as fill="url(#id)". */
export function gradient(root, id, stops, { x1 = 0, y1 = 0, x2 = 0, y2 = 1 } = {}) {
  let defs = root.querySelector('defs'); if (!defs) { defs = el('defs'); root.prepend(defs); }
  defs.append(el('linearGradient', { id, x1, y1, x2, y2 }, stops.map((s, i) => el('stop', { offset: s.offset ?? `${(i / (stops.length - 1)) * 100}%`, 'stop-color': s.color, 'stop-opacity': s.opacity }))));
  return `url(#${id})`;
}
export function serialize(node) { return new XMLSerializer().serializeToString(node); }
export function toDataURI(node) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialize(node)); }
/** String-only builder for environments without a DOM (or for building markup in templates). */
export function svgString(tag, attrs = {}, inner = '') {
  const a = Object.entries(attrs).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => ` ${k}="${String(v).replace(/"/g, '&quot;')}"`).join('');
  return inner ? `<${tag}${a}>${inner}</${tag}>` : `<${tag}${a}/>`;
}
