// kit/art/recorder.js — canvas → WebM via MediaRecorder, with graceful fallback (APIs touched only inside functions).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { recordingSupported, recordCanvas, downloadBlob } from './recorder.js';
//   if (!recordingSupported()) status.textContent = 'Your browser cannot record video; the animation still plays live.';
//   recBtn.onclick = async () => {
//     const blob = await recordCanvas(canvas, { seconds: 5, fps: 30, onProgress: (p) => bar.value = p });
//     if (!blob) return;                                 // null when unsupported or aborted
//     downloadBlob(blob, 'door-7-loop.webm');
//   };
//   // Keep drawing the canvas during the recording (your normal loop); the stream captures what is on screen.
//   // Optional: pass { mimeType: 'video/webm;codecs=vp9', bitsPerSecond: 4_000_000 }.
//   // Safari may lack MediaRecorder on canvas streams; always say so in the UI instead of failing silently.

export function recordingSupported() {
  try {
    return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
  } catch { return false; }
}
export function pickMimeType(candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}
/** Record `seconds` of the canvas. Resolves with a Blob, or null when unsupported. `signal` (AbortSignal) stops early and still resolves with what was captured. */
export function recordCanvas(canvas, { seconds = 5, fps = 30, mimeType, bitsPerSecond = 4_000_000, onProgress, signal } = {}) {
  if (!recordingSupported()) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const type = mimeType || pickMimeType(); const chunks = [];
    let rec; try { rec = new MediaRecorder(canvas.captureStream(fps), type ? { mimeType: type, videoBitsPerSecond: bitsPerSecond } : { videoBitsPerSecond: bitsPerSecond }); } catch (e) { return reject(e); }
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onerror = (e) => reject(e.error || new Error('Recording failed'));
    rec.onstop = () => { clearInterval(timer); resolve(new Blob(chunks, { type: rec.mimeType || type || 'video/webm' })); };
    const started = Date.now(); const timer = setInterval(() => { const p = Math.min(1, (Date.now() - started) / (seconds * 1000)); onProgress && onProgress(p); if (p >= 1) stop(); }, 100);
    const stop = () => { if (rec.state !== 'inactive') rec.stop(); };
    if (signal) signal.addEventListener('abort', stop, { once: true });
    rec.start(200);
  });
}
export function downloadBlob(blob, filename = 'recording.webm') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
/** Convenience: run `draw(t)` for `seconds` at `fps` on the canvas and record it. t is seconds since start (loop seam: design draw so draw(0) === draw(seconds)). */
export async function recordAnimation(canvas, draw, { seconds = 5, fps = 30, ...opts } = {}) {
  let running = true; const start = performance.now();
  const frame = () => { if (!running) return; draw((performance.now() - start) / 1000); requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
  try { return await recordCanvas(canvas, { seconds, fps, ...opts }); } finally { running = false; }
}
