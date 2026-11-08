// kit/sound/ambient.js — procedural rain, fire, wind and snow from filtered noise, with a slider mixer UI.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createAmbient, LAYERS } from './ambient.js';
//   const amb = createAmbient();                                  // AudioContext is created on first start() (user gesture)
//   startBtn.onclick = () => amb.start({ rain: 0.5, fire: 0.3, wind: 0.2, snow: 0.0 });
//   stopBtn.onclick  = () => amb.stop();
//   amb.set('rain', 0.8);                                         // 0..1 per layer, smooth ramps
//   amb.mixer(document.querySelector('#mixer'));                  // renders labelled range sliders + Play/Stop
//   amb.presets.winterEvening → { rain: 0.2, fire: 0.6, wind: 0.3, snow: 0.4 }
//   amb.levels → current levels (plain object; store/restore in memory)
//   // "snow" is a soft, slow, hushed noise bed; "fire" crackles; "wind" gusts with a slow LFO.
//   // No autoplay: nothing sounds until start() is called from a click or key.

export const LAYERS = ['rain', 'fire', 'wind', 'snow'];

export function createAmbient({ volume = 0.8 } = {}) {
  let ctx = null, master = null; const nodes = {}; const levels = { rain: 0, fire: 0, wind: 0, snow: 0 }; let running = false;
  const presets = { winterEvening: { rain: 0.2, fire: 0.6, wind: 0.3, snow: 0.4 }, stormOutside: { rain: 0.8, fire: 0.4, wind: 0.7, snow: 0.1 }, quietSnow: { rain: 0, fire: 0.1, wind: 0.15, snow: 0.7 }, cabin: { rain: 0.1, fire: 0.8, wind: 0.1, snow: 0.2 } };
  function noiseBuffer(seconds = 4) { const b = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let last = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; last = c === 0 ? w : (last + 0.02 * w) / 1.02; d[i] = c === 0 ? w : last * 3.5; } } return b; }
  function src(buf) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; }
  function layer(name) {
    const g = ctx.createGain(); g.gain.value = 0; g.connect(master); const buf = noiseBuffer();
    if (name === 'rain') { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.5; src(buf).connect(f); f.connect(g); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000; const g2 = ctx.createGain(); g2.gain.value = 0.3; src(buf).connect(hp); hp.connect(g2); g2.connect(g); }
    else if (name === 'wind') { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 2; src(buf).connect(f); f.connect(g); const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 350; lfo.connect(lg); lg.connect(f.frequency); lfo.start(); const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.11; const lg2 = ctx.createGain(); lg2.gain.value = 0.4; const vg = ctx.createGain(); vg.gain.value = 0.6; lfo2.connect(lg2); lg2.connect(vg.gain); lfo2.start(); f.disconnect(); f.connect(vg); vg.connect(g); }
    else if (name === 'snow') { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; src(buf).connect(f); const vg = ctx.createGain(); vg.gain.value = 0.35; f.connect(vg); vg.connect(g); const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05; const lg = ctx.createGain(); lg.gain.value = 0.1; lfo.connect(lg); lg.connect(vg.gain); lfo.start(); }
    else if (name === 'fire') { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; const bed = ctx.createGain(); bed.gain.value = 0.25; src(buf).connect(f); f.connect(bed); bed.connect(g);
      const crackle = ctx.createGain(); crackle.gain.value = 0; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500; src(buf).connect(hp); hp.connect(crackle); crackle.connect(g);
      const tick = () => { if (!running) return; const t = ctx.currentTime; crackle.gain.cancelScheduledValues(t); crackle.gain.setValueAtTime(0, t); crackle.gain.linearRampToValueAtTime(0.6 + Math.random() * 0.4, t + 0.005); crackle.gain.exponentialRampToValueAtTime(0.001, t + 0.04 + Math.random() * 0.06); nodes.fireTimer = setTimeout(tick, 60 + Math.random() * 400); }; tick(); }
    return g;
  }
  const api = {
    levels, presets, layers: LAYERS, get running() { return running; },
    async start(initial) {
      if (!ctx) { const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) throw new Error('Web Audio is not available'); ctx = new AC(); master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination); }
      if (ctx.state === 'suspended') await ctx.resume(); running = true;
      for (const n of LAYERS) if (!nodes[n]) nodes[n] = layer(n);
      if (initial) for (const [k, v] of Object.entries(initial)) api.set(k, v); else for (const n of LAYERS) api.set(n, levels[n]);
      master.gain.setTargetAtTime(volume, ctx.currentTime, 0.3);
    },
    set(name, v) { v = Math.max(0, Math.min(1, Number(v) || 0)); levels[name] = v; if (nodes[name] && ctx) nodes[name].gain.setTargetAtTime(v * v, ctx.currentTime, 0.4); },
    stop() { running = false; clearTimeout(nodes.fireTimer); if (ctx && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.4); },
    preset(name) { const p = presets[name]; if (p) for (const k of LAYERS) api.set(k, p[k] ?? 0); return p; },
    mixer(container, { labels = { rain: 'Rain', fire: 'Fire', wind: 'Wind', snow: 'Snow' } } = {}) {
      const root = document.createElement('div'); root.className = 'amb';
      for (const n of LAYERS) { const id = 'amb-' + n + '-' + Math.random().toString(36).slice(2, 6); const row = document.createElement('label'); row.htmlFor = id; row.style.display = 'block'; row.textContent = labels[n] + ' ';
        const r = document.createElement('input'); r.type = 'range'; r.id = id; r.min = '0'; r.max = '100'; r.value = String(Math.round(levels[n] * 100)); r.addEventListener('input', () => api.set(n, Number(r.value) / 100)); row.appendChild(r); root.appendChild(row); }
      const play = document.createElement('button'); play.type = 'button'; play.textContent = 'Play'; play.className = 'kit-btn'; const stop = document.createElement('button'); stop.type = 'button'; stop.textContent = 'Stop'; stop.className = 'kit-btn';
      play.addEventListener('click', () => api.start()); stop.addEventListener('click', () => api.stop()); root.append(play, stop); container.appendChild(root); return root;
    },
    async close() { api.stop(); if (ctx) await ctx.close(); ctx = null; master = null; for (const k of Object.keys(nodes)) delete nodes[k]; },
  };
  return api;
}
