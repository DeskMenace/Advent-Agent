// kit/maker/terminal-frame.js — a terminal window for a small tool's share frame: real commands and real output, drawn as HTML.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { mountTerminal, terminalHtml } from './terminal-frame.js';
//   // Paste the real output of your tool (run it yourself in your workspace on sample files, never on theirs).
//   mountTerminal(document.querySelector('#term'), {
//     title: 'zsh — ~/Downloads', theme: 'night',
//     lines: [{ cmd: 'tidy-downloads' }, { out: 'Dry run: nothing moved yet.' }, { out: '  41 PDFs → Papers/', color: 'green' }],
//   });
//   const html = terminalHtml({ lines: [{ cmd: 'snow' }] });   // the same markup as a string (works in Node, no DOM)
//   window.adventCapture = { async prepare() { await mountTerminal(el, opts, { typed: false }); } };   // capture the finished screen
//   Themes: 'night' (default), 'paper', 'pine'. Colors: green, red, gold, blue, dim. Lines are text only: never HTML.
//   Reduced motion or { typed: false }: everything appears at once.

export const THEMES = {
  night: { bg: '#16181d', bar: '#24272e', fg: '#e8e6df', prompt: '#7fd28f', dim: '#8a8f99' },
  paper: { bg: '#fbf6ea', bar: '#ece3cf', fg: '#2c2a26', prompt: '#2f7d4a', dim: '#8b8272' },
  pine: { bg: '#10261d', bar: '#183629', fg: '#f3ecd9', prompt: '#f2c14e', dim: '#93a99c' },
};
const COLORS = { green: '#7fd28f', red: '#ef6f5e', gold: '#f2c14e', blue: '#7ab4f5', dim: null };

export function escapeText(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function lineHtml(line, theme, promptText) {
  if (line.cmd !== undefined) return `<div class="tf-line"><span style="color:${theme.prompt}">${escapeText(promptText)}</span> ${escapeText(line.cmd)}</div>`;
  const color = line.color === 'dim' ? theme.dim : COLORS[line.color] ?? theme.fg;
  return `<div class="tf-line" style="color:${color}">${escapeText(line.out ?? '') || '&nbsp;'}</div>`;
}

/** Returns the terminal window as an HTML string (no DOM needed). */
export function terminalHtml({ title = 'Terminal', lines = [], theme = 'night', prompt = '$', width = 720 } = {}) {
  const t = THEMES[theme] ?? THEMES.night;
  const dots = ['#ff5f57', '#febc2e', '#28c840'].map((c) => `<span style="width:12px;height:12px;border-radius:50%;background:${c};display:inline-block"></span>`).join('');
  return `<div class="tf" role="img" aria-label="${escapeText(title)}" style="max-width:${width}px;border-radius:12px;overflow:hidden;background:${t.bg};color:${t.fg};box-shadow:0 18px 50px rgba(0,0,0,.35);font:15px/1.55 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace">`
    + `<div class="tf-bar" style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:${t.bar}">${dots}<span style="flex:1;text-align:center;color:${t.dim};font-size:12px">${escapeText(title)}</span></div>`
    + `<div class="tf-body" style="padding:16px 18px;white-space:pre-wrap;word-break:break-word">${lines.map((l) => lineHtml(l, t, prompt)).join('')}</div></div>`;
}

function reducedMotion() { try { return !!(globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); } catch { return false; } }

/** Draws the terminal into `el`. Typed: commands appear letter by letter, output line by line. Resolves when done. */
export async function mountTerminal(el, options = {}, { typed = true, charMs = 35, lineMs = 120 } = {}) {
  const lines = options.lines ?? [];
  if (!typed || reducedMotion()) { el.innerHTML = terminalHtml(options); return; }
  const shown = [];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const line of lines) {
    if (line.cmd !== undefined) {
      for (let i = 1; i <= line.cmd.length; i++) { el.innerHTML = terminalHtml({ ...options, lines: [...shown, { cmd: line.cmd.slice(0, i) }] }); await wait(charMs); }
    } else {
      el.innerHTML = terminalHtml({ ...options, lines: [...shown, line] });
      await wait(lineMs);
    }
    shown.push(line);
  }
  el.innerHTML = terminalHtml(options);
}
