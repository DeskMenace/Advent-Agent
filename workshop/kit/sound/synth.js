// kit/sound/synth.js — Web Audio voices: music box, pad, pluck, bass, kick/snare/hat; ADSR; master gain.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createSynth, mtof } from './synth.js';
//   const synth = createSynth();                              // nothing is created until the first user gesture
//   playBtn.onclick = async () => {
//     await synth.resume();                                   // creates/unlocks the AudioContext on click
//     const t = synth.now();
//     synth.play('musicbox', 72, t, 0.5, 0.8);                // voice, midi pitch, when (s), duration (beats→s yourself), velocity
//     synth.play('bass', 48, t, 1.0);  synth.play('kick', 0, t + 0.5, 0.2);
//   };
//   synth.setVolume(0.6);  synth.mute(true);  synth.stopAll();
//   const offline = createSynth({ context: new OfflineAudioContext(2, 44100 * 10, 44100) });   // for WAV export

export const VOICES = ['musicbox', 'pad', 'pluck', 'bass', 'kick', 'snare', 'hat'];
export function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

const ENV = { // attack, decay, sustain level, release (seconds / 0..1)
  musicbox: { a: 0.002, d: 0.25, s: 0.0, r: 0.6 }, pad: { a: 0.25, d: 0.3, s: 0.7, r: 0.8 }, pluck: { a: 0.003, d: 0.18, s: 0.15, r: 0.25 }, bass: { a: 0.005, d: 0.12, s: 0.6, r: 0.15 },
};

export function createSynth({ context = null, volume = 0.8 } = {}) {
  let ctx = context, master = null, muted = false; const live = new Set(); let noiseBuf = null;
  function ensure() {
    if (ctx && master) return ctx;
    if (!ctx) { const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) throw new Error('Web Audio is not available'); ctx = new AC(); }
    master = ctx.createGain(); master.gain.value = muted ? 0 : volume;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination); return ctx;
  }
  function noise() { if (noiseBuf) return noiseBuf; const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return (noiseBuf = b); }
  function adsr(g, t, dur, env, vel) {
    const peak = Math.max(0.0001, vel); g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + env.a); g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * env.s) || 0.0001, t + env.a + env.d);
    const end = Math.max(t + env.a + env.d, t + dur); g.gain.setValueAtTime(Math.max(0.0001, peak * env.s) || 0.0001, end); g.gain.exponentialRampToValueAtTime(0.0001, end + env.r); return end + env.r;
  }
  function osc(type, freq, t, stop, detune = 0) { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune; o.start(t); o.stop(stop + 0.05); live.add(o); o.onended = () => live.delete(o); return o; }
  const voices = {
    musicbox(f, t, dur, vel) { const g = ctx.createGain(); const end = adsr(g, t, Math.min(dur, 0.3), ENV.musicbox, vel * 0.5); g.connect(master);
      osc('sine', f, t, end).connect(g); const g2 = ctx.createGain(); g2.gain.value = 0.25; g2.connect(g); osc('sine', f * 4.1, t, end).connect(g2); const g3 = ctx.createGain(); g3.gain.value = 0.12; g3.connect(g); osc('triangle', f * 2, t, end).connect(g3); },
    pad(f, t, dur, vel) { const g = ctx.createGain(); const end = adsr(g, t, dur, ENV.pad, vel * 0.25); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; g.connect(lp); lp.connect(master);
      osc('sawtooth', f, t, end, -6).connect(g); osc('sawtooth', f, t, end, 6).connect(g); osc('triangle', f / 2, t, end).connect(g); },
    pluck(f, t, dur, vel) { const g = ctx.createGain(); const end = adsr(g, t, dur, ENV.pluck, vel * 0.5); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(f * 6, t); lp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.2); g.connect(lp); lp.connect(master);
      osc('square', f, t, end).connect(g); const g2 = ctx.createGain(); g2.gain.value = 0.3; g2.connect(g); osc('triangle', f * 2, t, end).connect(g2); },
    bass(f, t, dur, vel) { const g = ctx.createGain(); const end = adsr(g, t, dur, ENV.bass, vel * 0.6); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; g.connect(lp); lp.connect(master);
      osc('sawtooth', f, t, end).connect(g); osc('sine', f, t, end).connect(g); },
    kick(_f, t, _d, vel) { const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3); g.connect(master); const o = osc('sine', 150, t, t + 0.3); o.frequency.exponentialRampToValueAtTime(40, t + 0.25); o.connect(g); },
    snare(_f, t, _d, vel) { const g = ctx.createGain(); g.gain.setValueAtTime(vel * 0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200; g.connect(hp); hp.connect(master);
      const s = ctx.createBufferSource(); s.buffer = noise(); s.start(t); s.stop(t + 0.2); s.connect(g); const g2 = ctx.createGain(); g2.gain.setValueAtTime(vel * 0.4, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); g2.connect(master); osc('triangle', 190, t, t + 0.1).connect(g2); },
    hat(_f, t, _d, vel) { const g = ctx.createGain(); g.gain.setValueAtTime(vel * 0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000; g.connect(hp); hp.connect(master);
      const s = ctx.createBufferSource(); s.buffer = noise(); s.start(t); s.stop(t + 0.06); s.connect(g); },
  };
  return {
    get context() { return ctx; }, voices: VOICES,
    async resume() { ensure(); if (ctx.state === 'suspended' && ctx.resume) await ctx.resume(); return ctx; },
    now() { return ensure().currentTime; },
    play(voice, midi, when, dur = 0.5, vel = 0.8) { ensure(); (voices[voice] || voices.pluck)(mtof(midi), when ?? ctx.currentTime, Math.max(0.02, dur), Math.min(1, Math.max(0, vel))); },
    setVolume(v) { volume = v; if (master && !muted) master.gain.setTargetAtTime(v, ctx.currentTime, 0.02); },
    mute(on = !muted) { muted = on; if (master) master.gain.setTargetAtTime(on ? 0 : volume, ctx.currentTime, 0.02); return muted; },
    get muted() { return muted; },
    stopAll() { for (const o of live) { try { o.stop(); } catch {} } live.clear(); },
    async close() { if (ctx && ctx.close && !context) await ctx.close(); ctx = null; master = null; },
  };
}
