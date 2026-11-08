// kit/characters/character-rig.js — SVG character rig: idle breathing, eyes follow the pointer, react on tap, sleep when ignored, blinking.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createRig } from './character-rig.js';
//   const rig = createRig(document.querySelector('#pet'), { color: '#ffb3c7', sleepAfter: 20000, onReact: () => say('hi!') });
//   // Or bring your own art: an SVG string whose parts carry data-part="body|eye-l|eye-r|pupil-l|pupil-r|mouth|lid-l|lid-r".
//   createRig(el, { svg: mySvgString, maxPupil: 6 });
//   rig.state;                          // 'idle' | 'look' | 'react' | 'sleep'
//   rig.react(); rig.sleep(); rig.wake(); rig.blink(); rig.lookAt(x, y);   // x, y in client pixels
//   rig.setMouth('M40 70 Q60 85 80 70');  // swap the mouth path for an expression
//   window.adventCapture = { async prepare() { rig.lookAt(innerWidth, 0); } };
//   Click / Enter / Space reacts; pointer movement wakes and looks. Reduced motion: no breathing or squash, blinks still happen.
//   nextState(state, event) and pupilOffset(eye, pointer, maxR) are pure and testable.

/** Pupil offset from eye centre toward the pointer, clamped to radius `maxR`. Pure. */
export function pupilOffset(eye, pointer, maxR = 5) {
  const dx = pointer.x - eye.x, dy = pointer.y - eye.y; const d = Math.hypot(dx, dy);
  if (d === 0) return { x: 0, y: 0 };
  const k = Math.min(maxR, d / 12) / d; // eases in near the eye, saturates far away
  return { x: dx * k, y: dy * k };
}
/** State machine. Events: 'pointer', 'tap', 'reactEnd', 'idleTimeout', 'lookTimeout', 'wake'. Pure. */
export function nextState(state, event) {
  switch (event) {
    case 'tap': return 'react';
    case 'reactEnd': return 'idle';
    case 'pointer': return state === 'react' ? 'react' : 'look';
    case 'wake': return state === 'sleep' ? 'idle' : state;
    case 'lookTimeout': return state === 'look' ? 'idle' : state;
    case 'idleTimeout': return state === 'react' ? state : 'sleep';
    default: return state;
  }
}

export function defaultBlobSVG(color = '#9fd8c8') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="A small blob creature">
<ellipse cx="60" cy="112" rx="34" ry="5" fill="rgba(0,0,0,.15)" data-part="shadow"/>
<g data-part="body"><path d="M60 18 C92 18 106 48 106 76 C106 100 86 110 60 110 C34 110 14 100 14 76 C14 48 28 18 60 18Z" fill="${color}"/>
<ellipse cx="44" cy="38" rx="12" ry="7" fill="rgba(255,255,255,.45)" transform="rotate(-25 44 38)"/>
<g data-part="eye-l"><ellipse cx="45" cy="64" rx="9" ry="10" fill="#fff"/><circle data-part="pupil-l" cx="45" cy="65" r="4.5" fill="#222"/><rect data-part="lid-l" x="34" y="53" width="22" height="22" fill="${color}" transform="scale(1 0)" style="transform-origin:45px 54px"/></g>
<g data-part="eye-r"><ellipse cx="75" cy="64" rx="9" ry="10" fill="#fff"/><circle data-part="pupil-r" cx="75" cy="65" r="4.5" fill="#222"/><rect data-part="lid-r" x="64" y="53" width="22" height="22" fill="${color}" transform="scale(1 0)" style="transform-origin:75px 54px"/></g>
<path data-part="mouth" d="M52 84 Q60 91 68 84" fill="none" stroke="#222" stroke-width="3" stroke-linecap="round"/>
<ellipse cx="34" cy="80" rx="6" ry="3.5" fill="rgba(255,120,140,.45)"/><ellipse cx="86" cy="80" rx="6" ry="3.5" fill="rgba(255,120,140,.45)"/></g>
<g data-part="zzz" opacity="0" font-family="system-ui,sans-serif" font-weight="700" fill="#556"><text x="92" y="22" font-size="12">z</text><text x="100" y="12" font-size="9">z</text></g>
</svg>`;
}

const CSS = `.rig{display:inline-block;touch-action:manipulation;cursor:pointer;outline:none;-webkit-tap-highlight-color:transparent}
.rig:focus-visible svg{outline:3px solid currentColor;outline-offset:4px;border-radius:12px}
.rig svg{width:100%;height:100%;overflow:visible;display:block}
.rig [data-part=body]{transform-box:fill-box;transform-origin:50% 100%;transition:transform .25s cubic-bezier(.3,1.6,.5,1)}
.rig.is-idle [data-part=body],.rig.is-look [data-part=body]{animation:rig-breathe 3.2s ease-in-out infinite}
.rig.is-sleep [data-part=body]{animation:rig-breathe 5s ease-in-out infinite}
.rig.is-react [data-part=body]{animation:rig-squash .6s cubic-bezier(.3,1.6,.5,1)}
.rig [data-part^=lid]{transition:transform .07s}
.rig.is-sleep [data-part=zzz]{animation:rig-z 2.4s ease-in-out infinite}
@keyframes rig-breathe{50%{transform:scale(1.025,.975)}}
@keyframes rig-squash{0%{transform:scale(1)}25%{transform:scale(1.18,.8)}55%{transform:scale(.92,1.12) translateY(-8%)}100%{transform:scale(1)}}
@keyframes rig-z{0%{opacity:0;transform:translate(0,4px)}40%{opacity:1}100%{opacity:0;transform:translate(6px,-8px)}}
@media (prefers-reduced-motion:reduce){.rig [data-part=body]{animation:none!important;transition:none}.rig.is-sleep [data-part=zzz]{animation:none;opacity:1}}`;

export function createRig(root, { svg, color, maxPupil = 4.5, sleepAfter = 25000, lookFor = 2500, blinkEvery = [2500, 6000], onReact, onState, random = Math.random } = {}) {
  if (!document.getElementById('rig-style')) { const st = document.createElement('style'); st.id = 'rig-style'; st.textContent = CSS; document.head.appendChild(st); }
  root.classList.add('rig'); root.tabIndex = 0; root.setAttribute('role', 'button'); if (!root.getAttribute('aria-label')) root.setAttribute('aria-label', 'Poke the character');
  root.innerHTML = svg || defaultBlobSVG(color);
  const svgEl = root.querySelector('svg'); const part = (n) => root.querySelector(`[data-part="${n}"]`) || root.querySelector(`#${n}`);
  const pupils = [part('pupil-l'), part('pupil-r')].filter(Boolean); const lids = [part('lid-l'), part('lid-r')].filter(Boolean);
  const eyes = [part('eye-l'), part('eye-r')]; const mouth = part('mouth'); const zzz = part('zzz');
  const restMouth = mouth && mouth.getAttribute('d');
  let state = 'idle', blinkTimer = 0, sleepTimer = 0, lookTimer = 0, reactTimer = 0, closed = false;
  const api = { get state() { return state; } };
  function setLids(v) { closed = v; for (const l of lids) l.setAttribute('transform', `scale(1 ${v ? 1 : 0})`); if (!lids.length) for (const p of pupils) p.style.opacity = v ? '0' : '1'; }
  function set(next) {
    if (next === state) return; const prev = state; state = next;
    root.classList.remove('is-idle', 'is-look', 'is-react', 'is-sleep'); root.classList.add(`is-${state}`);
    setLids(state === 'sleep'); if (state === 'sleep') centerPupils();
    if (mouth && restMouth) mouth.setAttribute('d', state === 'sleep' ? restMouth.replace(/Q(\s*[\d.]+)\s+([\d.]+)/, (m, x, y) => `Q${x} ${Number(y) - 4}`) : state === 'react' ? restMouth.replace(/Q(\s*[\d.]+)\s+([\d.]+)/, (m, x, y) => `Q${x} ${Number(y) + 6}`) : restMouth);
    if (zzz && state !== 'sleep') zzz.setAttribute('opacity', '0'); else if (zzz) zzz.removeAttribute('opacity');
    onState && onState(state, prev);
  }
  function send(ev) { set(nextState(state, ev)); }
  function centerPupils() { for (const p of pupils) p.setAttribute('transform', ''); }
  function resetSleep() { clearTimeout(sleepTimer); if (sleepAfter > 0) sleepTimer = setTimeout(() => send('idleTimeout'), sleepAfter); }
  function scheduleBlink() { clearTimeout(blinkTimer); const [a, b] = blinkEvery; blinkTimer = setTimeout(() => { if (state !== 'sleep') api.blink(); scheduleBlink(); }, a + random() * (b - a)); }
  api.blink = () => { if (closed) return; setLids(true); setTimeout(() => { if (state !== 'sleep') setLids(false); if (random() < 0.2 && state !== 'sleep') setTimeout(() => { setLids(true); setTimeout(() => state !== 'sleep' && setLids(false), 90); }, 140); }, 110); };
  api.lookAt = (cx, cy) => {
    if (state === 'sleep') return; const ctm = svgEl.getScreenCTM && svgEl.getScreenCTM(); if (!ctm) return;
    const pt = svgEl.createSVGPoint(); pt.x = cx; pt.y = cy; const local = pt.matrixTransform(ctm.inverse());
    pupils.forEach((p, i) => { const eye = eyes[i]; const bb = (eye || p).getBBox(); const o = pupilOffset({ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }, local, maxPupil); p.setAttribute('transform', `translate(${o.x.toFixed(2)} ${o.y.toFixed(2)})`); });
  };
  api.react = () => { if (state === 'sleep') { send('wake'); } send('tap'); clearTimeout(reactTimer); reactTimer = setTimeout(() => send('reactEnd'), 650); resetSleep(); onReact && onReact(); };
  api.sleep = () => { clearTimeout(sleepTimer); send('idleTimeout'); };
  api.wake = () => { send('wake'); resetSleep(); };
  api.setMouth = (d) => mouth && mouth.setAttribute('d', d);
  const onMove = (e) => { if (state === 'sleep') { send('wake'); } send('pointer'); api.lookAt(e.clientX, e.clientY); resetSleep(); clearTimeout(lookTimer); lookTimer = setTimeout(() => { send('lookTimeout'); centerPupils(); }, lookFor); };
  const onKey = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); api.react(); } };
  root.addEventListener('click', api.react); root.addEventListener('keydown', onKey); window.addEventListener('pointermove', onMove, { passive: true });
  api.destroy = () => { clearTimeout(blinkTimer); clearTimeout(sleepTimer); clearTimeout(lookTimer); clearTimeout(reactTimer); window.removeEventListener('pointermove', onMove); root.removeEventListener('click', api.react); root.removeEventListener('keydown', onKey); };
  root.classList.add('is-idle'); resetSleep(); scheduleBlink();
  return api;
}
