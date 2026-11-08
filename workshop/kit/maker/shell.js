// kit/maker/shell.js — mini-app shell: header, optional sidebar, panels, status line, responsive, keyboard help.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createShell } from './shell.js';
//   const app = createShell(document.body, { title: 'Gauge converter', subtitle: 'Stays on this device', sidebar: true });
//   app.main.innerHTML = '<label>Stitches per 10 cm <input id="s" type="number"></label>';
//   app.sidebar.append(makeNav());                           // optional; null when sidebar: false
//   app.setStatus('Ready');                                  // polite live region for messages
//   app.addAction('Export', () => download());               // header button
//   app.addPanel('About the maths', '<p>…</p>', { collapsed: true });   // collapsible <details> in main
//   app.help([['?', 'Show this help'], ['Ctrl+S', 'Export']]);          // "?" key opens a help dialog
//   app.footer.textContent = 'Nothing leaves this page.';
//   // Styles are injected once (.sh-*), themed with kit/tokens.css variables when present.

export function createShell(container, { title = 'App', subtitle = '', sidebar = false } = {}) {
  injectStyles();
  const root = document.createElement('div'); root.className = 'sh' + (sidebar ? ' sh-has-side' : '');
  root.innerHTML = `<header class="sh-head"><div><h1 class="sh-title"></h1><p class="sh-sub"></p></div><div class="sh-actions"></div></header>${sidebar ? '<aside class="sh-side"></aside>' : ''}<main class="sh-main"></main><footer class="sh-foot"><span class="sh-status" role="status" aria-live="polite"></span><span class="sh-footnote"></span></footer>`;
  root.querySelector('.sh-title').textContent = title; root.querySelector('.sh-sub').textContent = subtitle; container.append(root);
  const main = root.querySelector('.sh-main'), actions = root.querySelector('.sh-actions'), status = root.querySelector('.sh-status');
  let helpRows = [];
  const api = {
    element: root, main, sidebar: root.querySelector('.sh-side'), footer: root.querySelector('.sh-footnote'), header: root.querySelector('.sh-head'),
    setStatus(text, { timeout = 4000 } = {}) { status.textContent = text; if (timeout) setTimeout(() => { if (status.textContent === text) status.textContent = ''; }, timeout); },
    addAction(label, onClick, { kbd } = {}) { const b = document.createElement('button'); b.type = 'button'; b.className = 'kit-btn sh-action'; b.textContent = label; if (kbd) b.title = kbd; b.addEventListener('click', onClick); actions.append(b); return b; },
    addPanel(heading, html, { collapsed = false } = {}) { const d = document.createElement('details'); d.className = 'sh-panel'; d.open = !collapsed; d.innerHTML = `<summary></summary><div class="sh-panel-body"></div>`; d.querySelector('summary').textContent = heading; const body = d.querySelector('.sh-panel-body'); if (typeof html === 'string') body.innerHTML = html; else body.append(html); main.append(d); return d; },
    help(rows) { helpRows = rows; },
    showHelp() { const dlg = document.createElement('dialog'); dlg.className = 'sh-help'; dlg.innerHTML = `<h2>Keyboard</h2><table>${helpRows.map(([k, d]) => `<tr><td><kbd>${k}</kbd></td><td>${d}</td></tr>`).join('')}</table><form method="dialog"><button class="kit-btn">Close</button></form>`; document.body.append(dlg); dlg.addEventListener('close', () => dlg.remove()); dlg.showModal ? dlg.showModal() : (dlg.open = true); },
  };
  root.addEventListener('keydown', (e) => { if (e.key === '?' && !/input|textarea|select/i.test(e.target.tagName) && helpRows.length) { e.preventDefault(); api.showHelp(); } });
  return api;
}
function injectStyles() {
  if (typeof document === 'undefined' || document.getElementById('sh-styles')) return;
  const st = document.createElement('style'); st.id = 'sh-styles';
  st.textContent = `.sh{display:grid;grid-template-areas:"head" "main" "foot";grid-template-rows:auto 1fr auto;min-height:100vh;background:var(--cream,#F7F2E9);color:var(--ink,#243A32);font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.sh-has-side{grid-template-areas:"head head" "side main" "foot foot";grid-template-columns:220px 1fr}@media (max-width:700px){.sh-has-side{grid-template-areas:"head" "side" "main" "foot";grid-template-columns:1fr}}
.sh-head{grid-area:head;display:flex;justify-content:space-between;align-items:flex-start;gap:16px;padding:20px 24px;border-bottom:1px solid var(--line,#DFD7C9);background:var(--milk,#FFFAF0)}
.sh-title{font:400 28px/1.1 Georgia,serif;margin:0;color:var(--green-dark,#0D3829)}.sh-sub{margin:4px 0 0;color:var(--muted,#766F62);font-size:14px}.sh-actions{display:flex;gap:8px;flex-wrap:wrap}
.sh-side{grid-area:side;padding:20px;border-right:1px solid var(--line,#DFD7C9)}.sh-main{grid-area:main;padding:24px;max-width:900px;width:100%;box-sizing:border-box}
.sh-foot{grid-area:foot;display:flex;justify-content:space-between;gap:16px;padding:12px 24px;border-top:1px solid var(--line,#DFD7C9);color:var(--muted,#766F62);font-size:14px}
.sh-panel{background:var(--milk,#FFFAF0);border:1px solid var(--line,#DFD7C9);border-radius:6px;padding:12px 16px;margin:16px 0}.sh-panel summary{cursor:pointer;font-weight:600}
.sh input,.sh select,.sh textarea{font:inherit;padding:8px 10px;border:1px solid var(--line,#DFD7C9);border-radius:4px;background:#fff;color:inherit}.sh :focus-visible{outline:3px solid var(--gold-light,#E7C890);outline-offset:2px}
.kit-btn{font:600 15px/1 inherit;padding:10px 16px;border-radius:6px;border:1px solid var(--gold,#BD955A);background:var(--green,#14503A);color:var(--milk,#FFFAF0);cursor:pointer;min-height:44px}.kit-btn:hover{background:var(--green-dark,#0D3829)}
.sh-help{border:1px solid var(--line,#DFD7C9);border-radius:8px;padding:20px;font:inherit}.sh-help td{padding:4px 12px 4px 0}.sh-help kbd{background:#eee;border-radius:4px;padding:2px 6px;font-family:monospace}`;
  document.head.appendChild(st);
}
