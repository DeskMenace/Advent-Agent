// kit/arcade/locks.js — escape-room primitives: code lock, riddle check, sequence lock, with normalisation (pure).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { normalize, codeLock, riddleLock, sequenceLock, room } from './locks.js';
//   const door  = codeLock('2412', { maxTries: 5 });                 // digits/letters; normalised compare
//   const riddle = riddleLock(['a candle', 'candle', 'Kerze'], { hint: 'It shrinks as it works.' });
//   const dial  = sequenceLock(['red', 'green', 'gold']);           // press in order; wrong press resets
//   door.try('24 12')      → { open: true, tries: 1 }
//   riddle.try('A Candle!') → { open: true }                           // case, accents, punctuation ignored
//   dial.push('red'); dial.push('green'); dial.push('gold'); dial.open → true
//   const escape = room({ door, riddle, dial }); escape.progress → { solved: 3, total: 3, done: true }
//   riddle.hintAfter(60000, now)                                      // returns hint text when 60 s elapsed since first try
//   normalize('Sankt-Gallen ') → 'sankt gallen'

export function normalize(s, { keepSpaces = true } = {}) {
  let t = String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  t = t.replace(/ß/g, 'ss').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  return keepSpaces ? t : t.replace(/ /g, '');
}

export function codeLock(code, { maxTries = Infinity, onOpen } = {}) {
  const target = normalize(code, { keepSpaces: false }); let open = false, tries = 0, firstTry = null;
  return {
    get open() { return open; }, get tries() { return tries; }, get locked() { return !open && tries >= maxTries; },
    try(input, now = Date.now()) {
      if (open) return { open, tries }; if (tries >= maxTries) return { open: false, tries, locked: true };
      tries++; firstTry ??= now;
      if (normalize(input, { keepSpaces: false }) === target) { open = true; onOpen && onOpen(); }
      return { open, tries, locked: !open && tries >= maxTries };
    },
    hintAfter(ms, now = Date.now()) { return firstTry != null && now - firstTry >= ms; },
    reset() { open = false; tries = 0; firstTry = null; },
  };
}

export function riddleLock(answers, { hint = '', partial = false, onOpen } = {}) {
  const set = (Array.isArray(answers) ? answers : [answers]).map((a) => normalize(a)); let open = false, tries = 0, firstTry = null;
  return {
    get open() { return open; }, get tries() { return tries; }, hint,
    try(input, now = Date.now()) {
      if (open) return { open }; tries++; firstTry ??= now;
      const n = normalize(input);
      const ok = set.some((a) => a === n || (partial && n.length >= 3 && (a.includes(n) || n.includes(a))));
      if (ok) { open = true; onOpen && onOpen(); }
      return { open, tries, close: !ok && set.some((a) => a.length > 3 && n.length > 3 && (a.startsWith(n.slice(0, 3)) || levenshtein(a, n) <= 2)) };
    },
    hintAfter(ms, now = Date.now()) { return firstTry != null && now - firstTry >= ms ? hint : ''; },
    reveal() { return answers[0] ?? answers; },
    reset() { open = false; tries = 0; firstTry = null; },
  };
}

export function sequenceLock(sequence, { resetOnError = true, onOpen, onError } = {}) {
  const seq = sequence.map((s) => normalize(s)); let pos = 0, open = false, errors = 0;
  return {
    get open() { return open; }, get position() { return pos; }, get errors() { return errors; }, get length() { return seq.length; },
    push(step) {
      if (open) return { open, position: pos };
      if (normalize(step) === seq[pos]) { pos++; if (pos === seq.length) { open = true; onOpen && onOpen(); } return { open, position: pos, ok: true }; }
      errors++; onError && onError(); if (resetOnError) pos = 0; return { open: false, position: pos, ok: false };
    },
    reset() { pos = 0; open = false; errors = 0; },
  };
}

/** Group locks and report progress. */
export function room(locks) {
  const entries = Object.entries(locks);
  return {
    locks, get progress() { const solved = entries.filter(([, l]) => l.open).length; return { solved, total: entries.length, done: solved === entries.length }; },
    reset() { for (const [, l] of entries) l.reset && l.reset(); },
  };
}

export function levenshtein(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
  return prev[n];
}
