// kit/paper/envelope.js — CSS-3D envelope: the flap swings open, then the letter slides out (click, drag up or keyboard).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createEnvelope } from './envelope.js';
//   const env = createEnvelope(document.querySelector('#stage'), {
//     to: 'For Ana, by hand', seal: '❦', letter: '<h2>Dear Ana,</h2><p>The office plant has a message.</p>',
//     width: 340, height: 220, paper: '#efe4cf', inner: '#c9573f', letterPaper: '#fffaf0',
//     onOpen: () => status.textContent = 'Opened', onLetterClick: () => showFullLetter(),
//   });
//   env.open(); env.close(); env.toggle(); env.setProgress(0.3);       // 0–0.45 flap, 0.5–1 letter slides out
//   window.adventCapture = { async prepare() { await env.open({ instant: true }); } };
//   // Drag the envelope upward to pull the letter out by hand; release snaps open/closed.
//   // Keyboard: Enter/Space toggles, Escape closes. Reduced motion: no animation. env.destroy() cleans up.

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
/** Split overall progress into the two phases. flap: degrees 0–180; letter: 0–1; flapBehind: the flap is past vertical and must sit behind the letter. */
export function envelopePhases(p) {
  const q = clamp(p);
  const flap = 180 * easeInOutCubic(clamp(q / 0.45));
  const letter = easeOutCubic(clamp((q - 0.5) / 0.5));
  return { flap, letter, flapBehind: flap > 90 };
}
/** Vertical drag → progress: dragging up by `travel` px opens fully. */
export function dragToProgress(startProgress, dy, travel) { return clamp(startProgress - dy / Math.max(1, travel)); }

export const CSS = `
.kenv{position:relative;display:flex;justify-content:center;align-items:flex-end;perspective:1400px;width:var(--kenv-w);max-width:100%;height:calc(var(--kenv-h)*(1.1 + var(--kenv-rise)));touch-action:none;user-select:none;-webkit-user-select:none}
.kenv-body{position:relative;width:var(--kenv-w);height:var(--kenv-h);transform-style:preserve-3d;cursor:pointer;outline:none;margin-bottom:calc(var(--kenv-h)*.05)}
.kenv-body:focus-visible{box-shadow:0 0 0 3px var(--kenv-focus,#3b6fd8)}
.kenv-paper{background-color:var(--kenv-paper);background-image:radial-gradient(rgba(60,40,10,.07) .8px,transparent 1.2px),radial-gradient(rgba(255,255,255,.5) .8px,transparent 1.2px),linear-gradient(160deg,rgba(255,255,255,.35),rgba(0,0,0,.06));background-size:7px 7px,11px 11px,100% 100%;background-position:0 0,3px 5px,0 0}
.kenv-back,.kenv-pocket,.kenv-flap,.kenv-flap>div{position:absolute;left:0;top:0;width:100%;height:100%}
.kenv-back{background-color:var(--kenv-inner);border-radius:4px;box-shadow:0 16px 28px rgba(0,0,0,.2);transform:translateZ(0)}
.kenv-letter{position:absolute;left:6%;width:88%;top:5%;height:90%;box-sizing:border-box;padding:6% 7%;overflow:hidden;border-radius:2px;background-color:var(--kenv-letter);box-shadow:0 2px 8px rgba(0,0,0,.15);font-size:calc(var(--kenv-h)*.07)}
.kenv-letter.kenv-paper{background-color:var(--kenv-letter)}
.kenv-pocket{clip-path:polygon(0 0,50% 56%,100% 0,100% 100%,0 100%);border-radius:0 0 4px 4px;transform:translateZ(2px);display:flex;align-items:flex-end;justify-content:center;padding-bottom:9%;box-sizing:border-box;font-size:calc(var(--kenv-h)*.09);text-align:center}
.kenv-pocket::after{content:"";position:absolute;inset:0;background:linear-gradient(to top right,transparent 49.6%,rgba(0,0,0,.08) 50%,transparent 50.6%),linear-gradient(to top left,transparent 49.6%,rgba(0,0,0,.08) 50%,transparent 50.6%);pointer-events:none}
.kenv-flap{transform-origin:50% 0;transform-style:preserve-3d}
.kenv-flap>div{backface-visibility:hidden;-webkit-backface-visibility:hidden}
.kenv-tri{position:absolute;inset:0;clip-path:polygon(0 0,100% 0,50% 60%)}
.kenv-flap-out>.kenv-tri{filter:brightness(.97)}
.kenv-flap-in{transform:rotateX(180deg)}
.kenv-flap-in>.kenv-tri{background-color:var(--kenv-inner)}
.kenv-seal{position:absolute;left:50%;top:60%;transform:translate(-50%,-62%) translateZ(4px);width:calc(var(--kenv-h)*.2);height:calc(var(--kenv-h)*.2);border-radius:50%;background:radial-gradient(circle at 35% 30%,#e06a5a,#9c2a22 70%);color:#fbe6dc;display:flex;align-items:center;justify-content:center;font-size:calc(var(--kenv-h)*.1);box-shadow:0 2px 4px rgba(0,0,0,.3);backface-visibility:hidden;-webkit-backface-visibility:hidden;pointer-events:none}
`;
export function injectStyles(doc = document) {
  if (doc.getElementById('kit-envelope-css')) return;
  const s = doc.createElement('style'); s.id = 'kit-envelope-css'; s.textContent = CSS; doc.head.appendChild(s);
}
function put(el, content) { if (content == null) return; if (typeof content === 'string') el.innerHTML = content; else el.appendChild(content); }

export function createEnvelope(container, {
  to = '', seal = '', letter = '', width = 340, height = 220, paper = '#efe4cf', inner = '#c9573f', letterPaper = '#fffaf0',
  rise = 0.65, duration = 1600, label = 'Envelope', onOpen, onClose, onLetterClick, onProgress,
} = {}) {
  const doc = container.ownerDocument || document; injectStyles(doc);
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const root = doc.createElement('div'); root.className = 'kenv';
  for (const [k, v] of [['--kenv-w', width + 'px'], ['--kenv-h', height + 'px'], ['--kenv-paper', paper], ['--kenv-inner', inner], ['--kenv-letter', letterPaper], ['--kenv-rise', String(rise)]]) root.style.setProperty(k, v);
  const body = doc.createElement('div'); body.className = 'kenv-body'; body.tabIndex = 0; body.setAttribute('role', 'button');
  body.setAttribute('aria-label', label + ': press Enter to open or close'); body.setAttribute('aria-expanded', 'false');
  const back = doc.createElement('div'); back.className = 'kenv-back';
  const letterEl = doc.createElement('div'); letterEl.className = 'kenv-letter kenv-paper'; put(letterEl, letter);
  const pocket = doc.createElement('div'); pocket.className = 'kenv-pocket kenv-paper'; put(pocket, to);
  const flap = doc.createElement('div'); flap.className = 'kenv-flap';
  const tri = (cls) => { const t = doc.createElement('div'); t.className = 'kenv-tri' + (cls ? ' ' + cls : ''); return t; };
  const flapOut = doc.createElement('div'); flapOut.className = 'kenv-flap-out'; flapOut.appendChild(tri('kenv-paper'));
  const flapIn = doc.createElement('div'); flapIn.className = 'kenv-flap-in'; flapIn.appendChild(tri());
  if (seal) { const s = doc.createElement('div'); s.className = 'kenv-seal'; s.setAttribute('aria-hidden', 'true'); put(s, seal); flapOut.appendChild(s); }
  flap.append(flapOut, flapIn);
  body.append(back, letterEl, pocket, flap); root.appendChild(body); container.appendChild(root);

  let p = 0, anim = 0, wasOpen = false;
  function render() {
    const { flap: deg, letter: l, flapBehind } = envelopePhases(p);
    flap.style.transform = `translateZ(${flapBehind ? -1 : 3}px) rotateX(${deg}deg)`;
    letterEl.style.transform = `translateZ(1px) translateY(${-l * rise * height}px)`;
    body.setAttribute('aria-expanded', String(p > 0.5));
    const open = p > 0.98;
    if (open && !wasOpen) { wasOpen = true; onOpen && onOpen(); } else if (p < 0.02 && wasOpen) { wasOpen = false; onClose && onClose(); }
    onProgress && onProgress(p);
  }
  function setProgress(v) { cancelAnimationFrame(anim); goal = null; anim = 0; p = clamp(v); render(); }
  let goal = null;   // where the running animation is heading, so toggle() mid-animation reverses it
  function animateTo(target, { instant = false } = {}) {
    cancelAnimationFrame(anim); goal = target;
    if (instant || reduced() || typeof requestAnimationFrame !== 'function') { p = target; render(); return Promise.resolve(); }
    const from = p, ms = duration * Math.abs(target - from) || 1, t0 = performance.now();
    return new Promise((resolve) => {
      const step = (now) => { const t = clamp((now - t0) / ms); p = from + (target - from) * t; render(); if (t < 1) anim = requestAnimationFrame(step); else { anim = 0; resolve(); } };
      anim = requestAnimationFrame(step);
    });
  }
  let drag = null;
  const down = (e) => { if (e.button > 0) return; drag = { y: e.clientY, start: p, moved: false, id: e.pointerId, target: e.target }; try { body.setPointerCapture(e.pointerId); } catch {} };
  const move = (e) => { if (!drag || e.pointerId !== drag.id) return; const dy = e.clientY - drag.y; if (Math.abs(dy) > 6) drag.moved = true; if (drag.moved) setProgress(dragToProgress(drag.start, dy, height * 1.2)); };
  const up = (e) => {
    if (!drag || e.pointerId !== drag.id) return; const d = drag; drag = null;
    if (d.moved) { animateTo(p > 0.5 ? 1 : 0); return; }
    if (p > 0.98 && onLetterClick && letterEl.contains(d.target)) { onLetterClick(); return; }
    toggle();
  };
  const key = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } else if (e.key === 'Escape') close(); };
  body.addEventListener('pointerdown', down); body.addEventListener('pointermove', move); body.addEventListener('pointerup', up); body.addEventListener('pointercancel', up); body.addEventListener('keydown', key);
  const open = (o) => animateTo(1, o), close = (o) => animateTo(0, o), toggle = (o) => animateTo((goal ?? p) > 0.5 ? 0 : 1, o);
  render();
  return {
    el: root, body, letter: letterEl, open, close, toggle, setProgress, get progress() { return p; }, get isOpen() { return p > 0.5; },
    destroy() { cancelAnimationFrame(anim); body.removeEventListener('pointerdown', down); body.removeEventListener('pointermove', move); body.removeEventListener('pointerup', up); body.removeEventListener('pointercancel', up); body.removeEventListener('keydown', key); root.remove(); },
  };
}
