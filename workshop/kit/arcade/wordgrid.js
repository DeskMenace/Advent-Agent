// kit/arcade/wordgrid.js — crossword / word-search engine: place words, render grid, check answers (pure).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { placeWords, fillRandom, renderGridHTML, checkAnswer, checkSelection } from './wordgrid.js';
//   const words = [{ word: 'SNOW', clue: 'Falls softly' }, { word: 'LANTERN', clue: 'Light you carry' }];
//   const puzzle = placeWords(words, { size: 9, seed: 7, crossings: true });   // crossword-style (crossings preferred)
//   console.log(puzzle.unplaced);                                               // words that did not fit: choose shorter ones
//   const grid = fillRandom(puzzle, { seed: 7 });                               // word search: fill blanks with letters
//   container.innerHTML = renderGridHTML(puzzle, { numbers: true, blanks: true }); // crossword cells (blanks hidden)
//   checkAnswer(puzzle, 0, 'snow')          → true                              // answer for placement 0 (case-insensitive)
//   checkSelection(grid, [[0,0],[0,1],[0,2],[0,3]])  → 'SNOW' or null            // word-search selection by cells
//   puzzle.placements[i] → { word, clue, row, col, dir: 'across'|'down', number }
//   solvedAll(puzzle, answers) → boolean

function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function normalizeWord(w) {
  return String(w).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function canPlace(grid, size, word, r, c, dir) {
  const dr = dir === 'down' ? 1 : 0, dc = dir === 'across' ? 1 : 0; let crossings = 0;
  if (r + dr * (word.length - 1) >= size || c + dc * (word.length - 1) >= size) return -1;
  const before = grid[r - dr]?.[c - dc], after = grid[r + dr * word.length]?.[c + dc * word.length];
  if (before || after) return -1;
  for (let i = 0; i < word.length; i++) {
    const rr = r + dr * i, cc = c + dc * i, cell = grid[rr][cc];
    if (cell) { if (cell !== word[i]) return -1; crossings++; continue; }
    // avoid touching parallel words sideways
    if (dir === 'across' ? (grid[rr - 1]?.[cc] || grid[rr + 1]?.[cc]) : (grid[rr]?.[cc - 1] || grid[rr]?.[cc + 1])) return -1;
  }
  return crossings;
}

export function placeWords(entries, { size, seed = 1, crossings = true, dirs = ['across', 'down'] } = {}) {
  const items = entries.map((e) => (typeof e === 'string' ? { word: e } : e)).map((e) => ({ ...e, word: normalizeWord(e.word) })).filter((e) => e.word.length > 1);
  const longest = items.reduce((m, e) => Math.max(m, e.word.length), 0);
  size = size || Math.max(longest + 2, Math.ceil(Math.sqrt(items.reduce((s, e) => s + e.word.length, 0) * 2)));
  const rng = mulberry(seed);
  const grid = Array.from({ length: size }, () => Array(size).fill(''));
  const placements = [], unplaced = [];
  const sorted = [...items].sort((a, b) => b.word.length - a.word.length);
  for (const item of sorted) {
    let best = null;
    const candidates = [];
    for (const dir of dirs) for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
      const x = canPlace(grid, size, item.word, r, c, dir); if (x >= 0) candidates.push({ r, c, dir, x });
    }
    if (!candidates.length) { unplaced.push(item); continue; }
    if (crossings && placements.length) {
      const withCross = candidates.filter((k) => k.x > 0);
      best = (withCross.length ? withCross : candidates)[Math.floor(rng() * (withCross.length ? withCross.length : candidates.length))];
    } else best = candidates[Math.floor(rng() * candidates.length)];
    const dr = best.dir === 'down' ? 1 : 0, dc = best.dir === 'across' ? 1 : 0;
    for (let i = 0; i < item.word.length; i++) grid[best.r + dr * i][best.c + dc * i] = item.word[i];
    placements.push({ ...item, row: best.r, col: best.c, dir: best.dir, length: item.word.length });
  }
  // crossword numbering: by start cell, reading order
  const starts = [...placements].sort((a, b) => a.row - b.row || a.col - b.col); let n = 0; const numAt = new Map();
  for (const p of starts) { const k = p.row + ',' + p.col; if (!numAt.has(k)) numAt.set(k, ++n); p.number = numAt.get(k); }
  return { size, grid, placements, unplaced };
}

/** Fill empty cells with letters (word-search). Returns a new grid; `puzzle.grid` is left alone. */
export function fillRandom(puzzle, { seed = 1, alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' } = {}) {
  const rng = mulberry(seed);
  return puzzle.grid.map((row) => row.map((c) => c || alphabet[Math.floor(rng() * alphabet.length)]));
}

export function checkAnswer(puzzle, index, answer) {
  const p = puzzle.placements[index]; return !!p && normalizeWord(answer) === p.word;
}
export function solvedAll(puzzle, answers) { return puzzle.placements.every((_, i) => checkAnswer(puzzle, i, answers[i] ?? '')); }

/** Word search: cells [[r,c],...] in order; returns the matched word (either direction) or null. */
export function checkSelection(grid, cells, words) {
  const s = cells.map(([r, c]) => grid[r]?.[c] ?? '').join(''); const rev = s.split('').reverse().join('');
  const list = words ? words.map(normalizeWord) : null;
  if (list) return list.includes(s) ? s : list.includes(rev) ? rev : null;
  return s || null;
}
/** Word search: find a placement whose cells equal the selection (any direction). */
export function findSelected(puzzle, cells) {
  const key = cells.map(([r, c]) => r + ',' + c).join('|'), rkey = [...cells].reverse().map(([r, c]) => r + ',' + c).join('|');
  return puzzle.placements.find((p) => { const k = cellsOf(p).map(([r, c]) => r + ',' + c).join('|'); return k === key || k === rkey; }) || null;
}
export function cellsOf(p) { const dr = p.dir === 'down' ? 1 : 0, dc = p.dir === 'across' ? 1 : 0; return Array.from({ length: p.length }, (_, i) => [p.row + dr * i, p.col + dc * i]); }

/** Minimal HTML table; CSS classes: .wg, .wg-cell, .wg-blank, .wg-num. Add inputs yourself for a crossword UI. */
export function renderGridHTML(puzzle, { numbers = true, blanks = true, letters = false, grid = puzzle.grid } = {}) {
  const nums = new Map(); for (const p of puzzle.placements) nums.set(p.row + ',' + p.col, p.number);
  let html = '<table class="wg" role="grid">';
  for (let r = 0; r < puzzle.size; r++) {
    html += '<tr>';
    for (let c = 0; c < puzzle.size; c++) {
      const ch = grid[r][c], blank = !ch && blanks, n = numbers && nums.get(r + ',' + c);
      html += `<td class="wg-cell${blank ? ' wg-blank' : ''}" data-r="${r}" data-c="${c}"${blank ? ' aria-hidden="true"' : ' role="gridcell"'}>${n ? `<span class="wg-num">${n}</span>` : ''}${letters && ch ? ch : ''}</td>`;
    }
    html += '</tr>';
  }
  return html + '</table>';
}
export function clues(puzzle) {
  const by = (d) => puzzle.placements.filter((p) => p.dir === d).sort((a, b) => a.number - b.number).map((p) => ({ number: p.number, clue: p.clue || '', length: p.length, index: puzzle.placements.indexOf(p) }));
  return { across: by('across'), down: by('down') };
}
