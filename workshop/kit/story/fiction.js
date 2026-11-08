// kit/story/fiction.js — interactive-fiction runner over a choices JSON, with history/undo and flags (pure engine + DOM renderer).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createStory, validateStory, renderStory } from './fiction.js';
//   const story = { start: 'hall', nodes: {
//     hall: { text: 'A door. A window.', choices: [{ text: 'Door', to: 'door', set: { brave: true } }, { text: 'Window', to: 'win', if: { key: true } }] },
//     door: { text: 'You step through.', choices: [{ text: 'Again', to: 'hall' }] },
//     win:  { text: 'The end.', end: true } } };
//   console.log(validateStory(story));                 // { ok, errors } — catches missing targets before the recipient does
//   const run = createStory(story);                     // run.node, run.choices (filtered by flags), run.flags, run.history
//   run.choose(0); run.back(); run.restart(); run.canBack
//   renderStory(document.querySelector('#story'), run); // accessible DOM: choices as buttons, keys 1–9, U = undo, R = restart
//   // Choice text may use {{flag}} to show a flag's value; `set` can also increment numbers: { coins: '+1' }.

export function validateStory(story) {
  const errors = []; if (!story || typeof story !== 'object') return { ok: false, errors: ['story must be an object'] };
  if (!story.nodes || typeof story.nodes !== 'object') errors.push('nodes must be an object');
  if (!story.start || !story.nodes?.[story.start]) errors.push(`start "${story.start}" is not a node`);
  for (const [id, n] of Object.entries(story.nodes || {})) {
    if (typeof n.text !== 'string') errors.push(`node ${id} needs text`);
    const choices = n.choices || []; if (!n.end && choices.length === 0) errors.push(`node ${id} has no choices and is not an end`);
    choices.forEach((c, i) => { if (!c.to || !story.nodes[c.to]) errors.push(`node ${id} choice ${i} points to missing "${c.to}"`); if (typeof c.text !== 'string') errors.push(`node ${id} choice ${i} needs text`); });
  }
  const seen = new Set(); const stack = story.start ? [story.start] : []; while (stack.length) { const id = stack.pop(); if (seen.has(id) || !story.nodes?.[id]) continue; seen.add(id); for (const c of story.nodes[id].choices || []) stack.push(c.to); }
  for (const id of Object.keys(story.nodes || {})) if (!seen.has(id)) errors.push(`node ${id} is unreachable`);
  return { ok: errors.length === 0, errors };
}
function passes(cond, flags) { if (!cond) return true; return Object.entries(cond).every(([k, v]) => (v === true ? !!flags[k] : v === false ? !flags[k] : flags[k] === v)); }
function apply(set, flags) { const f = { ...flags }; for (const [k, v] of Object.entries(set || {})) { if (typeof v === 'string' && /^[+-]\d+$/.test(v)) f[k] = (Number(f[k]) || 0) + Number(v); else f[k] = v; } return f; }
const fill = (text, flags) => String(text).replace(/\{\{(\w+)\}\}/g, (_, k) => (flags[k] ?? ''));

export function createStory(story, { initialFlags = {} } = {}) {
  let current = story.start, flags = { ...initialFlags }; const history = []; const listeners = new Set();
  const api = {
    get id() { return current; }, get node() { const n = story.nodes[current]; return { ...n, text: fill(n.text, flags) }; }, get flags() { return { ...flags }; },
    get history() { return history.map((h) => h.id); }, get canBack() { return history.length > 0; }, get ended() { return !!story.nodes[current].end || api.choices.length === 0; },
    get choices() { return (story.nodes[current].choices || []).map((c, index) => ({ ...c, index, text: fill(c.text, flags) })).filter((c) => passes(c.if, flags)); },
    choose(i) { const c = api.choices[i]; if (!c) return false; history.push({ id: current, flags }); flags = apply(c.set, flags); current = c.to; if (story.nodes[current].set) flags = apply(story.nodes[current].set, flags); emit(); return true; },
    back() { const h = history.pop(); if (!h) return false; current = h.id; flags = h.flags; emit(); return true; },
    restart() { current = story.start; flags = { ...initialFlags }; history.length = 0; emit(); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
  function emit() { for (const fn of listeners) fn(api); }
  return api;
}
export function renderStory(container, run, { labels = { back: 'Undo', restart: 'Start again', end: 'The end.' } } = {}) {
  const root = document.createElement('section'); root.className = 'if'; root.setAttribute('aria-live', 'polite'); root.tabIndex = 0; container.append(root);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function draw() {
    const node = run.node, choices = run.choices;
    root.innerHTML = `<div class="if-text">${node.text.split(/\n\n+/).map((p) => `<p>${esc(p)}</p>`).join('')}</div>
<ol class="if-choices">${choices.map((c, i) => `<li><button type="button" class="if-choice kit-btn" data-i="${i}"><kbd>${i + 1}</kbd> ${esc(c.text)}</button></li>`).join('')}</ol>
${run.ended ? `<p class="if-end">${esc(labels.end)}</p>` : ''}<div class="if-nav no-print"><button type="button" class="if-back kit-btn" ${run.canBack ? '' : 'disabled'}>${esc(labels.back)}</button><button type="button" class="if-restart kit-btn">${esc(labels.restart)}</button></div>`;
    root.querySelectorAll('.if-choice').forEach((b) => b.addEventListener('click', () => run.choose(Number(b.dataset.i))));
    root.querySelector('.if-back').addEventListener('click', () => run.back()); root.querySelector('.if-restart').addEventListener('click', () => run.restart());
  }
  root.addEventListener('keydown', (e) => { if (/^[1-9]$/.test(e.key)) { run.choose(Number(e.key) - 1); e.preventDefault(); } else if (e.key === 'u' || e.key === 'Backspace') { run.back(); e.preventDefault(); } else if (e.key === 'r') run.restart(); });
  run.onChange(draw); draw(); return root;
}
export function fictionCSS() {
  return `.if{max-width:620px;margin:24px auto;padding:32px;background:#FFFAF0;color:#243A32;border:1px solid #DFD7C9;border-radius:6px;font:19px/1.6 Georgia,serif}.if:focus-visible{outline:3px solid #E7C890}
.if-choices{list-style:none;padding:0;margin:20px 0 0}.if-choices li{margin:8px 0}.if-choice{width:100%;text-align:left;font-size:17px}.if-choice kbd{opacity:.7;margin-right:6px}
.if-end{font-style:italic;color:#766F62}.if-nav{display:flex;gap:8px;margin-top:20px}.if-nav .kit-btn{background:transparent;color:#14503A}`;
}
