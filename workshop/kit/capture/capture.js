// kit/capture/capture.js — the share capture hook (window.adventCapture), private marks, ready(), canvas → PNG/WebM.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { register, markPrivate, ready, canvasToPNG, recordCanvas, downloadBlob } from './capture.js';
//   register({
//     async still() { card.open({ instant: true }); await ready.fonts(); },     // most showable state for the 1080×1350 still
//     async loop() { globe.reset(); setTimeout(() => globe.shake(1), 300); },  // start the motion for the 3–10 s loop
//   });
//   markPrivate(document.querySelector('.their-address'));                    // blurrable in the privacy preview
//   const shot = await canvasToPNG(canvas);  downloadBlob(shot, 'share.png');   // your own share.png fallback
//   const clip = await recordCanvas(canvas, { seconds: 6 });  if (clip) downloadBlob(clip, 'share.webm');
//   // Keep the bottom-right 160×48 px clear (the calendar adds its mark). No logos, links or hashtags.
//   // isCapturing() is true while the calendar prepares a capture: hide hints, cursors and buttons then.

/** Bottom-right area the calendar reserves for its share mark (CSS px at the capture size). */
export const SHARE_MARK = { width: 160, height: 48, corner: 'bottom-right' };
export const STILL_SIZE = { width: 1080, height: 1350 };
export const LOOP_SIZE = { width: 1080, height: 1920 };
export const KINDS = ['still', 'loop'];

let capturing = null;

/**
 * Define window.adventCapture. `handlers` = { still?: async () => {}, loop?: async () => {}, any?: async (kind) => {} }.
 * A missing kind falls back to `any`, then to the other kind, so a gift with one handler still captures.
 * While prepare runs, <html> gets the class `advent-capturing` and data-advent-capture="<kind>".
 * Returns an unregister function.
 */
export function register(handlers = {}, { target = globalThis, settleMs = 150 } = {}) {
  const hook = {
    kinds: KINDS.filter((k) => typeof handlers[k] === 'function' || typeof handlers.any === 'function'),
    async prepare(kind = 'still') {
      const k = KINDS.includes(kind) ? kind : 'still';
      const fn = handlers[k] || handlers.any || handlers[k === 'still' ? 'loop' : 'still'];
      capturing = k; setCaptureFlag(k);   // the flag stays until done(), so hints stay hidden during the screenshot/recording
      if (typeof fn === 'function') await fn.call(hook, k);
      await waitFrames(2); if (settleMs) await sleep(settleMs);
      return { kind: k, ok: true };
    },
    done() { capturing = null; setCaptureFlag(null); },
  };
  target.adventCapture = hook;
  return () => { if (target.adventCapture === hook) delete target.adventCapture; };
}
export function isCapturing() { return capturing !== null; }
export function captureKind() { return capturing; }
function setCaptureFlag(kind) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (kind) { root.classList.add('advent-capturing'); root.dataset.adventCapture = kind; }
  else { root.classList.remove('advent-capturing'); delete root.dataset.adventCapture; }
}
/** CSS to hide UI chrome while capturing: add class "advent-hide-on-capture" to hints and buttons. */
export const CAPTURE_CSS = '.advent-capturing .advent-hide-on-capture{visibility:hidden!important}.advent-capturing *{cursor:none!important}';
export function injectCaptureStyles(doc = document) {
  if (doc.getElementById('advent-capture-css')) return;
  const s = doc.createElement('style'); s.id = 'advent-capture-css'; s.textContent = CAPTURE_CSS; doc.head.appendChild(s);
}

/** Mark an element (or a list/selector) as private: the privacy preview offers to blur it. */
export function markPrivate(target, on = true) {
  const els = typeof target === 'string' ? Array.from(document.querySelectorAll(target)) : target && typeof target.length === 'number' && !target.nodeType ? Array.from(target) : [target];
  for (const el of els) { if (!el || !el.setAttribute) continue; if (on) el.setAttribute('data-advent-private', ''); else el.removeAttribute('data-advent-private'); }
  return els.length;
}
/** Return an HTML attribute string for string-built markup: `<span ${privateAttr()}>Alex</span>`. */
export const privateAttr = () => 'data-advent-private';
export function privateElements(root = document) { return Array.from(root.querySelectorAll('[data-advent-private]')); }

/** Does a rect (CSS px, relative to the capture viewport) overlap the reserved share-mark corner? */
export function overlapsShareMark(rect, viewport = STILL_SIZE) {
  const mx = viewport.width - SHARE_MARK.width, my = viewport.height - SHARE_MARK.height;
  return rect.x < viewport.width && rect.x + rect.width > mx && rect.y < viewport.height && rect.y + rect.height > my;
}

// ── ready(): promise utilities ──────────────────────────────────────────────
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function waitFrames(n = 1) {
  if (typeof requestAnimationFrame !== 'function') return sleep(16 * n);
  return new Promise((r) => { const f = () => (--n <= 0 ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
}
/**
 * A deferred "ready" signal plus helpers. `const r = ready(); … r.resolve();  await r;` (thenable).
 * Also: ready.dom(), ready.fonts(), ready.images(root), ready.all([...], timeoutMs).
 */
export function ready() {
  let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; });
  let settled = false;
  return { promise, resolve: (v) => { settled = true; resolve(v); }, reject: (e) => { settled = true; reject(e); }, get settled() { return settled; }, then: (a, b) => promise.then(a, b) };
}
ready.dom = () => (typeof document === 'undefined' || document.readyState !== 'loading' ? Promise.resolve() : new Promise((r) => document.addEventListener('DOMContentLoaded', () => r(), { once: true })));
ready.fonts = () => (typeof document !== 'undefined' && document.fonts && document.fonts.ready ? document.fonts.ready.then(() => undefined) : Promise.resolve());
ready.images = (root = document) => Promise.all(Array.from(root.querySelectorAll('img')).map((img) => (img.complete ? (img.decode ? img.decode().catch(() => {}) : null) : new Promise((r) => { img.addEventListener('load', r, { once: true }); img.addEventListener('error', r, { once: true }); }))));
/** Resolve when every promise settles or after timeoutMs (never rejects; a capture should not hang). */
ready.all = (promises, timeoutMs = 4000) => Promise.race([Promise.allSettled(promises), sleep(timeoutMs)]);
export function withTimeout(promise, ms, fallback) { return Promise.race([promise, sleep(ms).then(() => fallback)]); }

// ── canvas → PNG / WebM (self-contained copy of art/export.js + art/recorder.js) ──
export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality }).then(resolve, reject);   // OffscreenCanvas
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas export failed (tainted or empty canvas?)'))), type, quality);
  });
}
export const canvasToPNG = (canvas) => canvasToBlob(canvas, 'image/png');
/** Draw `canvas` onto a new canvas of the share size, letterboxed (cover or contain) on `background`. */
export function fitToShare(canvas, { width = STILL_SIZE.width, height = STILL_SIZE.height, fit = 'cover', background = '#fff' } = {}) {
  const out = document.createElement('canvas'); out.width = width; out.height = height;
  const g = out.getContext('2d'); g.fillStyle = background; g.fillRect(0, 0, width, height);
  const s = fit === 'contain' ? Math.min(width / canvas.width, height / canvas.height) : Math.max(width / canvas.width, height / canvas.height);
  const w = canvas.width * s, h = canvas.height * s; g.drawImage(canvas, (width - w) / 2, (height - h) / 2, w, h);
  return out;
}
export function recordingSupported() {
  try { return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'; } catch { return false; }
}
export function pickMimeType(candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}
/** Record `seconds` (clamped to the share loop's 3–10 s unless clamp:false) of a canvas. Resolves Blob or null when unsupported. */
export function recordCanvas(canvas, { seconds = 6, fps = 30, mimeType, bitsPerSecond = 4_000_000, onProgress, signal, clamp = true } = {}) {
  if (!recordingSupported()) return Promise.resolve(null);
  const secs = clamp ? clampLoopSeconds(seconds) : seconds;
  return new Promise((resolve, reject) => {
    const type = mimeType || pickMimeType(); const chunks = [];
    let rec; try { rec = new MediaRecorder(canvas.captureStream(fps), type ? { mimeType: type, videoBitsPerSecond: bitsPerSecond } : { videoBitsPerSecond: bitsPerSecond }); } catch (e) { return reject(e); }
    const stop = () => { if (rec.state !== 'inactive') rec.stop(); };
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onerror = (e) => reject(e.error || new Error('Recording failed'));
    rec.onstop = () => { clearInterval(timer); resolve(new Blob(chunks, { type: rec.mimeType || type || 'video/webm' })); };
    const started = Date.now(); const timer = setInterval(() => { const p = Math.min(1, (Date.now() - started) / (secs * 1000)); onProgress && onProgress(p); if (p >= 1) stop(); }, 100);
    if (signal) signal.addEventListener('abort', stop, { once: true });
    rec.start(200);
  });
}
export function clampLoopSeconds(s) { return Math.min(10, Math.max(3, Number(s) || 6)); }
export function downloadBlob(blob, filename = 'share.png') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
