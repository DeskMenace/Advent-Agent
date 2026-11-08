// kit/arcade/score.js — score counter with combo and in-memory high scores.
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { createScore } from './score.js';
//   const score = createScore({ keep: 5 });                 // keeps the 5 best runs in memory only
//   score.add(10);                                         // +10 (combo multiplier applies if active)
//   score.combo();                                         // raise multiplier (x2, x3…), reset with score.breakCombo()
//   score.onChange = (value) => hud.textContent = String(value);
//   if (gameOver) { const rank = score.submit('You'); if (rank === 0) say('New best!'); }
//   score.best                                             // highest submitted or current value
//   score.table()                                          // [{ name, value, at }] sorted desc
//   score.reset();                                         // new run (high scores stay)
//   score.format(12345) → "12,345"

export function createScore({ keep = 10, comboStep = 1, maxCombo = 8 } = {}) {
  let value = 0, multiplier = 1; const table = [];
  const s = {
    onChange: null,
    get value() { return value; }, get multiplier() { return multiplier; },
    get best() { return Math.max(value, table[0] ? table[0].value : 0); },
    add(n = 1) { value += Math.round(n * multiplier); s.onChange && s.onChange(value); return value; },
    set(n) { value = n; s.onChange && s.onChange(value); return value; },
    combo() { multiplier = Math.min(maxCombo, multiplier + comboStep); return multiplier; },
    breakCombo() { multiplier = 1; },
    /** Record the current run. Returns its rank (0 = best) or -1 if it did not make the table. */
    submit(name = 'You') {
      const entry = { name: String(name).slice(0, 24), value, at: Date.now() };
      table.push(entry); table.sort((a, b) => b.value - a.value);
      if (table.length > keep) table.length = keep;
      return table.indexOf(entry);
    },
    table() { return table.map((e) => ({ ...e })); },
    reset() { value = 0; multiplier = 1; s.onChange && s.onChange(value); },
    clearTable() { table.length = 0; },
    format(n = value) { try { return n.toLocaleString(); } catch { return String(n); } },
  };
  return s;
}
