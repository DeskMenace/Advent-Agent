// kit/maker/clipboard.js — copy text with fallback, download text/JSON/blob, "Copied" feedback (DOM inside functions).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { copyText, downloadText, downloadJSON, copyButton } from './clipboard.js';
//   copyBtn.onclick = async () => { const ok = await copyText(textarea.value); status.textContent = ok ? 'Copied' : 'Select and copy manually'; };
//   downloadText('# Notes\n…', 'notes.md', 'text/markdown');
//   downloadJSON({ habits: [] }, 'habits.json');
//   const btn = copyButton(() => promptEl.textContent, { label: 'Copy prompt', done: 'Copied!' });   // self-resetting button
//   container.append(btn);
//   // copyText tries navigator.clipboard, then a hidden textarea + execCommand; returns true/false, never throws.
//   // In sandboxed iframes the Clipboard API may be unavailable: the fallback still works on a user gesture.
//   // Downloads use an <a download> with an object URL; filenames are sanitised with safeFilename().

export async function copyText(text) {
  try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); return true; } } catch {}
  try { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand && document.execCommand('copy'); ta.remove(); return !!ok; } catch { return false; }
}
export function safeFilename(name, fallback = 'download') { const s = String(name || '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 120); return s || fallback; }
export function downloadBlob(blob, filename) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = safeFilename(filename); a.rel = 'noopener'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
export function downloadText(text, filename = 'text.txt', mime = 'text/plain') { downloadBlob(new Blob([text], { type: mime + ';charset=utf-8' }), filename); }
export function downloadJSON(obj, filename = 'data.json') { downloadText(JSON.stringify(obj, null, 2), filename, 'application/json'); }
export function copyButton(getText, { label = 'Copy', done = 'Copied', fail = 'Could not copy', resetMs = 1800, className = 'kit-btn' } = {}) {
  const b = document.createElement('button'); b.type = 'button'; b.className = className; b.textContent = label;
  b.addEventListener('click', async () => { const ok = await copyText(typeof getText === 'function' ? getText() : String(getText)); b.textContent = ok ? done : fail; b.setAttribute('aria-live', 'polite'); setTimeout(() => { b.textContent = label; }, resetMs); });
  return b;
}
/** Read a text file the recipient picks (for import features). Resolves string or null. */
export function pickTextFile(accept = '.json,.txt,.md') {
  return new Promise((resolve) => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.addEventListener('change', () => { const f = i.files && i.files[0]; if (!f) return resolve(null); const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => resolve(null); r.readAsText(f); }); i.click(); });
}
