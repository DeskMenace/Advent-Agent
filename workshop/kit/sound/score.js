// kit/sound/score.js — the score JSON format: validate, totalBeats, schedule, lyrics helpers (pure).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { validate, totalBeats, schedule, beatsToSeconds, EXAMPLE } from './score.js';
//   const score = { tempo: 84, key: 'G major', timeSignature: '3/4', tracks: [
//     { voice: 'musicbox', notes: [{ t: 0, p: 67, d: 1, v: 0.8 }, { t: 1, p: 71, d: 1 }], lyrics: [{ t: 0, text: 'Snow' }] },
//     { voice: 'bass', notes: [{ t: 0, p: 43, d: 3, v: 0.6 }] } ] };
//   const { ok, errors } = validate(score); if (!ok) console.error(errors);
//   const seconds = beatsToSeconds(totalBeats(score), score.tempo);             // length for the progress bar
//   const start = synth.now() + 0.1;
//   for (const ev of schedule(score, { startTime: start })) synth.play(ev.voice, ev.pitch, ev.time, ev.duration, ev.velocity);
//   lyricsAt(score, beat) → { t, text } | null;   transpose(score, 2) → new score

export const VOICES = ['musicbox', 'pad', 'pluck', 'bass', 'kick', 'snare', 'hat'];
export const DRUMS = ['kick', 'snare', 'hat'];

export const EXAMPLE = {
  title: 'Two bars', tempo: 90, key: 'C major', timeSignature: '4/4',
  tracks: [
    { voice: 'musicbox', notes: [{ t: 0, p: 72, d: 1, v: 0.8 }, { t: 1, p: 76, d: 1, v: 0.7 }, { t: 2, p: 79, d: 2, v: 0.8 }, { t: 4, p: 76, d: 1 }, { t: 5, p: 72, d: 3 }], lyrics: [{ t: 0, text: 'Open' }, { t: 1, text: 'the' }, { t: 2, text: 'door' }, { t: 4, text: 'and' }, { t: 5, text: 'see' }] },
    { voice: 'bass', notes: [{ t: 0, p: 48, d: 4, v: 0.6 }, { t: 4, p: 43, d: 4, v: 0.6 }] },
  ],
};

export function validate(score) {
  const errors = []; const num = (v) => typeof v === 'number' && Number.isFinite(v);
  if (!score || typeof score !== 'object') return { ok: false, errors: ['score must be an object'] };
  if (!num(score.tempo) || score.tempo <= 0) errors.push('tempo must be a positive number (BPM)');
  if (score.timeSignature !== undefined && !/^\d+\/\d+$/.test(String(score.timeSignature))) errors.push('timeSignature must look like "4/4"');
  if (!Array.isArray(score.tracks) || score.tracks.length === 0) errors.push('tracks must be a non-empty array');
  else score.tracks.forEach((tr, i) => {
    if (!tr || typeof tr !== 'object') return errors.push(`tracks[${i}] must be an object`);
    if (typeof tr.voice !== 'string' || !tr.voice) errors.push(`tracks[${i}].voice is required (${VOICES.join(', ')})`);
    if (tr.gain !== undefined && (!num(tr.gain) || tr.gain < 0 || tr.gain > 1)) errors.push(`tracks[${i}].gain must be 0–1`);
    if (!Array.isArray(tr.notes)) errors.push(`tracks[${i}].notes must be an array`);
    else tr.notes.forEach((n, j) => {
      if (!n || !num(n.t) || n.t < 0) errors.push(`tracks[${i}].notes[${j}].t must be a beat >= 0`);
      if (!n || !num(n.d) || n.d <= 0) errors.push(`tracks[${i}].notes[${j}].d must be > 0 beats`);
      if (!n || !DRUMS.includes(tr.voice) && (!num(n.p) || n.p < 0 || n.p > 127)) errors.push(`tracks[${i}].notes[${j}].p must be MIDI 0–127`);
      if (n && n.v !== undefined && (!num(n.v) || n.v < 0 || n.v > 1)) errors.push(`tracks[${i}].notes[${j}].v must be 0–1`);
    });
    if (tr.lyrics !== undefined) { if (!Array.isArray(tr.lyrics)) errors.push(`tracks[${i}].lyrics must be an array`); else tr.lyrics.forEach((l, j) => { if (!l || !num(l.t) || typeof l.text !== 'string') errors.push(`tracks[${i}].lyrics[${j}] needs t (beat) and text`); }); }
  });
  return { ok: errors.length === 0, errors };
}
export function totalBeats(score) {
  let end = 0;
  for (const tr of score.tracks || []) { for (const n of tr.notes || []) end = Math.max(end, n.t + n.d); for (const l of tr.lyrics || []) end = Math.max(end, l.t); }
  return end;
}
export const beatsToSeconds = (beats, tempo) => (beats * 60) / tempo;
export const secondsToBeats = (seconds, tempo) => (seconds * tempo) / 60;
export function beatsPerBar(score) { const m = String(score.timeSignature || '4/4').match(/^(\d+)\/(\d+)$/); return m ? Number(m[1]) : 4; }
export function totalSeconds(score) { return beatsToSeconds(totalBeats(score), score.tempo); }

/** Flatten to absolute-time events sorted by time. */
export function schedule(score, { startTime = 0, tempo = score.tempo } = {}) {
  const out = [];
  (score.tracks || []).forEach((tr, trackIndex) => {
    const gain = tr.gain ?? 1;
    for (const n of tr.notes || []) out.push({ time: startTime + beatsToSeconds(n.t, tempo), duration: beatsToSeconds(n.d, tempo), beat: n.t, voice: tr.voice, pitch: n.p ?? 0, velocity: (n.v ?? 0.8) * gain, trackIndex });
  });
  return out.sort((a, b) => a.time - b.time);
}
export function allLyrics(score) { return (score.tracks || []).flatMap((tr) => tr.lyrics || []).sort((a, b) => a.t - b.t); }
export function lyricsAt(score, beat) { let cur = null; for (const l of allLyrics(score)) { if (l.t <= beat) cur = l; else break; } return cur; }
export function transpose(score, semitones) {
  return { ...score, tracks: score.tracks.map((tr) => ({ ...tr, notes: DRUMS.includes(tr.voice) ? tr.notes : tr.notes.map((n) => ({ ...n, p: Math.min(127, Math.max(0, n.p + semitones)) })) })) };
}
/** Build note lists quickly: seq('musicbox', 60, [[72,1],[74,1],[76,2]], 0) → notes starting at beat 0. */
export function seq(pitchesAndDurations, start = 0, v = 0.8) {
  let t = start; return pitchesAndDurations.map(([p, d]) => { const n = p == null ? null : { t, p, d, v }; t += d; return n; }).filter(Boolean);
}
