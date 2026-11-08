# Score JSON format (Sound Studio)

```ts
interface Score {
  tempo: number;            // BPM, > 0, required
  key?: string;             // free text, e.g. "G major", "D dorian"
  timeSignature?: string;   // "4/4" (default), "3/4", "6/8"
  title?: string;
  tracks: Track[];          // at least one
}
interface Track {
  voice: 'musicbox' | 'pad' | 'pluck' | 'bass' | 'kick' | 'snare' | 'hat' | string; // unknown voices fall back to pluck
  gain?: number;            // 0–1, default 1
  notes: Note[];            // may be empty for a lyrics-only track
  lyrics?: Lyric[];         // optional, aligned by beat
}
interface Note {
  t: number;                // start, in beats from 0
  p: number;                // MIDI pitch 0–127 (ignored by kick/snare/hat)
  d: number;                // duration in beats, > 0
  v?: number;               // velocity 0–1, default 0.8
}
interface Lyric {
  t: number;                // beat at which the syllable starts
  text: string;             // one syllable or word; use "-" to tie
}
```

## Functions in `kit/sound/score.js`

- `validate(score) → { ok, errors: string[] }`: structural check with readable messages (missing tempo, empty tracks, bad note fields, negative beats, lyrics without `t`).
- `totalBeats(score) → number`: the last note end (or last lyric) in beats.
- `beatsToSeconds(beats, tempo)`, `secondsToBeats(seconds, tempo)`.
- `schedule(score, { startTime = 0, tempo = score.tempo }) → Event[]`: flattened `{ time, duration, voice, pitch, velocity, trackIndex }` list sorted by time; drive any synth with it.
- `lyricsAt(score, beat)`: the lyric active at a beat, for the player's lyric line.
- `transpose(score, semitones)`: new score with all pitched notes shifted.
- `EXAMPLE`: a tiny valid score for tests and demos.

## Conventions

- Beat 0 is the first beat of bar 1. Bars are `timeSignature` numerator beats long.
- Pitch 60 = C4. Music box sounds best 60–96, bass 36–55, pad 48–79.
- Keep `d` at or below the gap to the next note on the same voice unless you want overlap (pads yes, music box rarely).
- The file is UTF-8 JSON, under 200 KB. Name it `score.json`.
