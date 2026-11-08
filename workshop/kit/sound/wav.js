// kit/sound/wav.js — WAV encoding; render a score offline (OfflineAudioContext) or with the pure-JS fallback renderer.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { encodeWav, renderScore, synthesizeScoreToWav, downloadWav } from './wav.js';
//   // Browser, full-quality: render the score with the kit synth through OfflineAudioContext
//   const blob = await renderScore(score, (ctx) => createSynth({ context: ctx }));   // pass synth.js's createSynth
//   downloadWav(blob, 'song.wav');
//   // Anywhere (Node too): simple built-in sine/triangle renderer → Uint8Array of a valid 16-bit PCM WAV
//   const bytes = synthesizeScoreToWav(score, { sampleRate: 22050 });
//   // Node: import { writeFileSync } from 'node:fs'; writeFileSync('gift/assets/song.wav', bytes);
//   // Browser: new Blob([bytes], { type: 'audio/wav' })
//   encodeWav({ sampleRate, channels: [Float32Array, ...] }) → ArrayBuffer      // from any AudioBuffer-like
//   // The quality gate decodes song.wav (wav_invalid): keep it 16-bit PCM, mono or stereo, 22.05–48 kHz.

export function encodeWav({ sampleRate, channels }) {
  const numCh = channels.length, len = channels[0].length, bytesPerSample = 2, blockAlign = numCh * bytesPerSample, dataSize = len * blockAlign;
  const buf = new ArrayBuffer(44 + dataSize), v = new DataView(buf); let p = 0;
  const str = (s) => { for (let i = 0; i < s.length; i++) v.setUint8(p++, s.charCodeAt(i)); }; const u32 = (n) => { v.setUint32(p, n, true); p += 4; }; const u16 = (n) => { v.setUint16(p, n, true); p += 2; };
  str('RIFF'); u32(36 + dataSize); str('WAVE'); str('fmt '); u32(16); u16(1); u16(numCh); u32(sampleRate); u32(sampleRate * blockAlign); u16(blockAlign); u16(16); str('data'); u32(dataSize);
  for (let i = 0; i < len; i++) for (let c = 0; c < numCh; c++) { const s = Math.max(-1, Math.min(1, channels[c][i] || 0)); v.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true); p += 2; }
  return buf;
}
export function audioBufferToWav(audioBuffer) {
  const channels = []; for (let c = 0; c < audioBuffer.numberOfChannels; c++) channels.push(audioBuffer.getChannelData(c));
  return encodeWav({ sampleRate: audioBuffer.sampleRate, channels });
}
/** Render with a synth factory `(offlineCtx) => synth` where synth has play(voice, midi, when, dur, vel). Resolves a Blob. */
export async function renderScore(score, synthFactory, { sampleRate = 44100, tail = 1.5, channels = 2 } = {}) {
  const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext; if (!OAC) throw new Error('OfflineAudioContext is not available');
  const b2s = (b) => (b * 60) / score.tempo; let total = 0; for (const tr of score.tracks) for (const n of tr.notes || []) total = Math.max(total, n.t + n.d);
  const ctx = new OAC(channels, Math.ceil((b2s(total) + tail) * sampleRate), sampleRate); const synth = synthFactory(ctx);
  for (const tr of score.tracks) for (const n of tr.notes || []) synth.play(tr.voice, n.p ?? 0, b2s(n.t) + 0.01, b2s(n.d), (n.v ?? 0.8) * (tr.gain ?? 1));
  const rendered = await ctx.startRendering(); return new Blob([audioBufferToWav(rendered)], { type: 'audio/wav' });
}
export function downloadWav(blob, filename = 'song.wav') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
/** Pure-JS renderer (no Web Audio): music-box-like sines, triangle bass, noise drums. Returns Uint8Array (WAV bytes). */
export function synthesizeScoreToWav(score, { sampleRate = 22050, tail = 1.0, gain = 0.5 } = {}) {
  const b2s = (b) => (b * 60) / score.tempo; let total = 0; for (const tr of score.tracks) for (const n of tr.notes || []) total = Math.max(total, n.t + n.d);
  const len = Math.ceil((b2s(total) + tail) * sampleRate), out = new Float32Array(len); let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  for (const tr of score.tracks) for (const n of tr.notes || []) {
    const start = Math.floor(b2s(n.t) * sampleRate), v = (n.v ?? 0.8) * (tr.gain ?? 1) * gain, voice = tr.voice;
    const f = 440 * Math.pow(2, ((n.p ?? 60) - 69) / 12);
    const dur = voice === 'kick' ? 0.3 : voice === 'snare' ? 0.18 : voice === 'hat' ? 0.05 : voice === 'musicbox' ? Math.max(0.4, b2s(n.d)) + 0.5 : b2s(n.d) + 0.2;
    const N = Math.min(len - start, Math.floor(dur * sampleRate));
    for (let i = 0; i < N; i++) {
      const t = i / sampleRate; let s = 0, env;
      if (voice === 'kick') { env = Math.exp(-t * 12); s = Math.sin(2 * Math.PI * (150 * Math.exp(-t * 8) + 40) * t); }
      else if (voice === 'snare') { env = Math.exp(-t * 20); s = rnd() * 0.7 + Math.sin(2 * Math.PI * 190 * t) * 0.3; }
      else if (voice === 'hat') { env = Math.exp(-t * 60); s = rnd(); }
      else if (voice === 'bass') { env = Math.min(1, t * 200) * (t < b2s(n.d) ? 1 : Math.exp(-(t - b2s(n.d)) * 20)); s = tri(f * t) * 0.7 + Math.sin(2 * Math.PI * f * t) * 0.3; }
      else if (voice === 'pad') { env = Math.min(1, t * 4) * (t < b2s(n.d) ? 1 : Math.exp(-(t - b2s(n.d)) * 3)); s = (Math.sin(2 * Math.PI * f * t) + Math.sin(2 * Math.PI * f * 1.005 * t) + tri(f / 2 * t) * 0.5) / 2.5 * 0.5; }
      else if (voice === 'pluck') { env = Math.exp(-t * 6) * Math.min(1, t * 300); s = sq(f * t) * 0.4 + tri(f * 2 * t) * 0.3; }
      else { env = Math.exp(-t * 4) * Math.min(1, t * 400); s = Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 4.1 * t) * Math.exp(-t * 10) + 0.12 * tri(f * 2 * t); }
      out[start + i] += s * env * v;
    }
  }
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i])); if (peak > 0.95) for (let i = 0; i < len; i++) out[i] *= 0.95 / peak;
  return new Uint8Array(encodeWav({ sampleRate, channels: [out] }));
}
const tri = (x) => 2 * Math.abs(2 * (x - Math.floor(x + 0.5))) - 1;
const sq = (x) => (x - Math.floor(x) < 0.5 ? 1 : -1);
/** Quick header check for tests and self-checks. */
export function isWav(bytes) { const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); const s = (o) => String.fromCharCode(...b.slice(o, o + 4)); return b.length > 44 && s(0) === 'RIFF' && s(8) === 'WAVE' && s(12) === 'fmt '; }
