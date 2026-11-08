/**
 * Minimal Sound Studio player for the UI (D9): plays a score JSON with Web Audio voices (music box / synth / drums),
 * renders WAV offline, optional robot "singing" through speechSynthesis. No autoplay. Mirrors workshop/kit/sound.
 */
export interface ScoreNote { t: number; p: number; d: number; v?: number }
export interface ScoreTrack { voice?: string; notes: ScoreNote[]; gain?: number; lyrics?: Array<{ t: number; text: string }> }
export interface Score { tempo: number; key?: string; title?: string; timeSignature?: string; tracks: ScoreTrack[]; lyrics?: Array<{ t: number; text: string }> }

export function validateScore(raw: unknown): Score {
  const s = raw as Score;
  if (!s || typeof s !== 'object') throw new Error('score is not an object');
  if (typeof s.tempo !== 'number' || s.tempo <= 0) throw new Error('score.tempo must be a positive number');
  if (!Array.isArray(s.tracks) || s.tracks.length === 0) throw new Error('score.tracks is empty');
  for (const t of s.tracks) if (!Array.isArray(t.notes)) throw new Error('track.notes must be an array');
  return s;
}

export function totalBeats(score: Score): number {
  let max = 0;
  for (const t of score.tracks) for (const n of t.notes) max = Math.max(max, n.t + n.d);
  return max;
}

export function midiToHz(p: number): number {
  return 440 * Math.pow(2, (p - 69) / 12);
}

type Ctx = AudioContext | OfflineAudioContext;

function voice(ctx: Ctx, dest: AudioNode, kind: string, note: ScoreNote, when: number, dur: number, gain: number): void {
  const v = (note.v ?? 0.8) * gain;
  if (kind === 'kick' || kind === 'snare' || kind === 'hat' || kind === 'drums') {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    if (kind === 'hat' || (kind === 'drums' && note.p >= 42)) {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 6000;
      g.gain.setValueAtTime(v * 0.4, when);
      src.connect(hp).connect(g).connect(dest);
      src.start(when);
      return;
    }
    osc.type = 'sine';
    const f0 = kind === 'snare' || (kind === 'drums' && note.p === 38) ? 180 : 120;
    osc.frequency.setValueAtTime(f0, when);
    osc.frequency.exponentialRampToValueAtTime(40, when + 0.15);
    g.gain.setValueAtTime(v, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + 0.25);
    osc.connect(g).connect(dest);
    osc.start(when);
    osc.stop(when + 0.3);
    return;
  }
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const hz = midiToHz(note.p);
  if (kind === 'music-box' || kind === 'musicbox' || !kind) {
    osc.type = 'sine';
    const partial = ctx.createOscillator();
    partial.type = 'sine';
    partial.frequency.value = hz * 3.01;
    const pg = ctx.createGain();
    pg.gain.setValueAtTime(v * 0.25, when);
    pg.gain.exponentialRampToValueAtTime(0.0005, when + Math.min(0.6, dur));
    partial.connect(pg).connect(dest);
    partial.start(when);
    partial.stop(when + Math.min(0.7, dur + 0.1));
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(v, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, when + Math.max(0.3, dur * 1.6));
    osc.frequency.value = hz;
    osc.connect(g).connect(dest);
    osc.start(when);
    osc.stop(when + Math.max(0.35, dur * 1.6) + 0.05);
    return;
  }
  osc.type = kind === 'bass' ? 'triangle' : kind === 'pluck' ? 'sawtooth' : kind === 'pad' ? 'triangle' : 'square';
  osc.frequency.value = hz;
  const attack = kind === 'pad' ? 0.15 : 0.01;
  const release = kind === 'pad' ? 0.4 : 0.12;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(v * (kind === 'pad' ? 0.35 : 0.5), when + attack);
  g.gain.setValueAtTime(v * (kind === 'pad' ? 0.35 : 0.5), when + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0005, when + dur + release);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = kind === 'bass' ? 600 : 2400;
  osc.connect(filter).connect(g).connect(dest);
  osc.start(when);
  osc.stop(when + dur + release + 0.05);
}

export function scheduleScore(ctx: Ctx, dest: AudioNode, score: Score, startAt: number): number {
  const spb = 60 / score.tempo;
  for (const track of score.tracks) {
    const gain = track.gain ?? 1;
    for (const n of track.notes) voice(ctx, dest, (track.voice ?? 'music-box').toLowerCase(), n, startAt + n.t * spb, Math.max(0.05, n.d * spb), gain);
  }
  return totalBeats(score) * spb;
}

export class ScorePlayer {
  private ctx?: AudioContext;
  private master?: GainNode;
  private startedAt = 0;
  private raf?: number;
  playing = false;
  constructor(private readonly score: Score, private readonly onTick: (progress: number, beat: number) => void, private readonly onEnd: () => void) {}

  get duration(): number { return (totalBeats(this.score) * 60) / this.score.tempo; }

  async play(): Promise<void> {
    this.stop();
    this.ctx = new AudioContext();
    await this.ctx.resume();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.startedAt = this.ctx.currentTime + 0.1;
    const total = scheduleScore(this.ctx, this.master, this.score, this.startedAt) + 1.2;
    this.playing = true;
    const tick = () => {
      if (!this.ctx || !this.playing) return;
      const elapsed = this.ctx.currentTime - this.startedAt;
      const progress = Math.min(1, Math.max(0, elapsed / total));
      this.onTick(progress, (elapsed * this.score.tempo) / 60);
      if (elapsed >= total) { this.stop(); this.onEnd(); return; }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.playing = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    void this.ctx?.close().catch(() => undefined);
    this.ctx = undefined;
  }
}

/** Render to a 44.1 kHz mono WAV Blob offline. */
export async function renderWav(score: Score): Promise<Blob> {
  const rate = 44100;
  const seconds = (totalBeats(score) * 60) / score.tempo + 1.5;
  const ctx = new OfflineAudioContext(1, Math.ceil(rate * seconds), rate);
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  scheduleScore(ctx, master, score, 0.05);
  const buffer = await ctx.startRendering();
  return encodeWav(buffer);
}

export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const length = buffer.length * channels * 2;
  const out = new ArrayBuffer(44 + length);
  const view = new DataView(out);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + length, true); str(8, 'WAVE'); str(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true); view.setUint32(28, buffer.sampleRate * channels * 2, true); view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true); str(36, 'data'); view.setUint32(40, length, true);
  let offset = 44;
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c]![i]!));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([out], { type: 'audio/wav' });
}

/** Robot rendition of the lyrics, timed to the score. Clearly a robot; feature-detected. */
export function singLyrics(score: Score, lyrics: Array<{ t: number; text: string }>): (() => void) | undefined {
  if (typeof speechSynthesis === 'undefined') return undefined;
  const spb = 60 / score.tempo;
  const timers = lyrics.map((l) => window.setTimeout(() => {
    const u = new SpeechSynthesisUtterance(l.text);
    u.rate = 1;
    u.pitch = 1.1;
    speechSynthesis.speak(u);
  }, l.t * spb * 1000 + 100));
  return () => { timers.forEach(clearTimeout); speechSynthesis.cancel(); };
}
