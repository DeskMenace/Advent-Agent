// kit/sound/sing.js — "robot rendition": speechSynthesis speaks the lyrics in time with the score (feature-detected).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { singingSupported, createSinger, ROBOT_LABEL } from './sing.js';
//   if (!singingSupported()) toggle.disabled = true;                 // no speechSynthesis → hide the feature, no error
//   label.textContent = ROBOT_LABEL;                                 // always show: "Robot rendition (browser voice)"
//   const singer = createSinger(score, { lang: 'en', rate: 1.0 });
//   playBtn.onclick = () => { player.play(); if (toggle.checked) singer.start(); };   // user gesture first; never autoplay
//   stopBtn.onclick = () => { player.stop(); singer.stop(); };
//   // The singer speaks each lyric at its beat, pitch-hinted from the nearest note (coarse: browsers allow 0–2 pitch).
//   singer.phraseGroups  → lyrics grouped by beat gaps so the voice does not stutter one syllable at a time
//   singer.setVoiceByLang('de');                                     // pick an installed voice by language prefix
//   // Label it honestly in the UI: it is a browser voice reading lyrics, not singing.

export const ROBOT_LABEL = 'Robot rendition (browser voice)';
export function singingSupported() { try { return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined'; } catch { return false; } }

export function groupLyrics(score, { maxGapBeats = 1.5 } = {}) {
  const lyrics = (score.tracks || []).flatMap((tr) => tr.lyrics || []).sort((a, b) => a.t - b.t);
  const notes = (score.tracks || []).flatMap((tr) => (tr.notes || []).map((n) => ({ ...n, voice: tr.voice }))).filter((n) => !['kick', 'snare', 'hat'].includes(n.voice));
  const groups = [];
  for (const l of lyrics) {
    const near = notes.reduce((best, n) => (best == null || Math.abs(n.t - l.t) < Math.abs(best.t - l.t) ? n : best), null);
    const last = groups[groups.length - 1];
    if (last && l.t - last.endBeat <= maxGapBeats && !/[.!?]$/.test(last.text)) { last.text += (l.text.startsWith('-') ? l.text.slice(1) : ' ' + l.text); last.endBeat = l.t; last.pitches.push(near ? near.p : 60); }
    else groups.push({ beat: l.t, endBeat: l.t, text: l.text.replace(/^-/, ''), pitches: [near ? near.p : 60] });
  }
  return groups;
}

export function createSinger(score, { lang = 'en', rate = 1, volume = 1, pitchRange = [0.6, 1.6], midiRange = [55, 84] } = {}) {
  const groups = groupLyrics(score); const b2ms = (b) => (b * 60000) / score.tempo; let timers = []; let voice = null;
  const api = {
    phraseGroups: groups, label: ROBOT_LABEL,
    setVoiceByLang(prefix) { if (!singingSupported()) return null; voice = speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith(prefix.toLowerCase())) || null; return voice; },
    start({ fromBeat = 0, delayMs = 60 } = {}) {
      if (!singingSupported()) return false; api.stop();
      for (const g of groups) {
        if (g.beat < fromBeat) continue;
        const avg = g.pitches.reduce((a, b) => a + b, 0) / g.pitches.length; const f = Math.min(1, Math.max(0, (avg - midiRange[0]) / (midiRange[1] - midiRange[0])));
        const u = new SpeechSynthesisUtterance(g.text); u.lang = lang; u.rate = rate; u.volume = volume; u.pitch = pitchRange[0] + f * (pitchRange[1] - pitchRange[0]); if (voice) u.voice = voice;
        timers.push(setTimeout(() => speechSynthesis.speak(u), delayMs + b2ms(g.beat - fromBeat)));
      }
      return true;
    },
    stop() { for (const t of timers) clearTimeout(t); timers = []; if (singingSupported()) speechSynthesis.cancel(); },
  };
  return api;
}
