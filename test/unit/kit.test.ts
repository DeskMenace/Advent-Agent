import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const KIT = resolve(__dirname, '..', '..', 'workshop', 'kit');
const load = (rel: string) => import(pathToFileURL(join(KIT, rel)).href);

function jsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) jsFiles(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

describe('every kit module imports in Node without a DOM', () => {
  for (const file of jsFiles(KIT)) {
    it(file.slice(KIT.length + 1), async () => {
      const mod = await import(pathToFileURL(file).href);
      expect(Object.keys(mod).length).toBeGreaterThan(0);
    });
  }
});

describe('art/prng', () => {
  it('is deterministic and in range', async () => {
    const { mulberry32, hashSeed, valueNoise2D, shuffle } = await load('art/prng.js');
    const a = mulberry32(42), b = mulberry32(42);
    const seqA = Array.from({ length: 5 }, () => a()), seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
    for (const v of seqA) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
    expect(hashSeed('door-7')).toBe(hashSeed('door-7'));
    expect(hashSeed('door-7')).not.toBe(hashSeed('door-8'));
    const n = valueNoise2D(7);
    expect(n(1.5, 2.5)).toBe(n(1.5, 2.5));
    expect(n(3, 3)).toBeGreaterThanOrEqual(0);
    expect(n(3, 3)).toBeLessThan(1);
    expect(Math.abs(n(1, 1) - n(1.01, 1))).toBeLessThan(0.1); // smooth
    expect(shuffle(mulberry32(3), [1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe('arcade/collision', () => {
  it('AABB, circle and separation math', async () => {
    const { aabb, circles, circleRect, pointInRect, overlapAABB } = await load('arcade/collision.js');
    expect(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
    expect(circles({ x: 0, y: 0, r: 5 }, { x: 8, y: 0, r: 5 })).toBe(true);
    expect(circles({ x: 0, y: 0, r: 5 }, { x: 10, y: 0, r: 5 })).toBe(false);
    expect(circleRect({ x: 12, y: 5, r: 3 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(true);
    expect(circleRect({ x: 14, y: 5, r: 3 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(false);
    expect(pointInRect(5, 5, { x: 0, y: 0, w: 10, h: 10 })).toBe(true);
    const mtv = overlapAABB({ x: 8, y: 0, w: 10, h: 10 }, { x: 10, y: -5, w: 10, h: 20 });
    expect(mtv).toEqual({ x: -8, y: 0 });
    expect(overlapAABB({ x: 0, y: 0, w: 1, h: 1 }, { x: 5, y: 5, w: 1, h: 1 })).toEqual({ x: 0, y: 0 });
  });
});

describe('arcade/physics', () => {
  it('integrates gravity and bounces inside bounds', async () => {
    const { createBody, step, bounceInBounds } = await load('arcade/physics.js');
    const ball = createBody({ x: 50, y: 10, r: 5, vy: 0, bounce: 0.5 });
    step(ball, 1, { gravity: 100 });
    expect(ball.vy).toBe(100);
    expect(ball.y).toBe(110);
    const hit = bounceInBounds(ball, { x: 0, y: 0, w: 100, h: 100 });
    expect(hit).toBe(true);
    expect(ball.y + ball.r).toBeLessThanOrEqual(100);
    expect(ball.vy).toBeLessThan(0);
  });
});

describe('arcade/wordgrid', () => {
  it('places words, numbers them, and checks answers', async () => {
    const { placeWords, fillRandom, checkAnswer, checkSelection, cellsOf, findSelected, solvedAll, clues, renderGridHTML } = await load('arcade/wordgrid.js');
    const words = [{ word: 'SNOW', clue: 'Falls softly' }, { word: 'LANTERN', clue: 'Carried light' }, { word: 'Café', clue: 'Hot' }, { word: 'STAR', clue: 'Up there' }];
    const puzzle = placeWords(words, { size: 10, seed: 7 });
    expect(puzzle.unplaced).toEqual([]);
    expect(puzzle.placements).toHaveLength(4);
    // every placement's cells hold its letters
    for (const p of puzzle.placements) for (const [i, [r, c]] of cellsOf(p).entries()) expect(puzzle.grid[r][c]).toBe(p.word[i]);
    expect(puzzle.placements.map((p: { number: number }) => p.number).every((n: number) => n >= 1)).toBe(true);
    const cafe = puzzle.placements.findIndex((p: { word: string }) => p.word === 'CAFE');
    expect(cafe).toBeGreaterThanOrEqual(0);
    expect(checkAnswer(puzzle, cafe, 'café')).toBe(true);
    expect(checkAnswer(puzzle, cafe, 'cafes')).toBe(false);
    expect(solvedAll(puzzle, puzzle.placements.map((p: { word: string }) => p.word.toLowerCase()))).toBe(true);
    // deterministic for the same seed
    const again = placeWords(words, { size: 10, seed: 7 });
    expect(again.grid).toEqual(puzzle.grid);
    // word search
    const filled = fillRandom(puzzle, { seed: 7 });
    expect(filled.flat().every((c: string) => /^[A-Z]$/.test(c))).toBe(true);
    const snow = puzzle.placements.find((p: { word: string }) => p.word === 'SNOW');
    expect(checkSelection(filled, cellsOf(snow), ['snow', 'star'])).toBe('SNOW');
    expect(checkSelection(filled, cellsOf(snow).reverse(), ['snow'])).toBe('SNOW');
    expect(findSelected(puzzle, cellsOf(snow))).toBe(snow);
    const c = clues(puzzle);
    expect(c.across.length + c.down.length).toBe(4);
    expect(renderGridHTML(puzzle)).toContain('<table class="wg"');
    // reports what does not fit
    const tiny = placeWords(['ABCDEFGHIJ'], { size: 4, seed: 1 });
    expect(tiny.unplaced).toHaveLength(1);
  });
});

describe('arcade/quiz', () => {
  it('scores, tiers and summarises', async () => {
    const { createQuiz } = await load('arcade/quiz.js');
    const quiz = createQuiz([
      { q: 'A', choices: ['x', 'y'], answer: 0 },
      { q: 'B', choices: ['x', 'y', 'z'], answer: [1, 2], points: 2 },
      { q: 'C', choices: ['x', 'y'], answer: 1 },
    ], { tiers: [{ min: 0, text: 'low' }, { min: 3, text: 'high' }] });
    expect(quiz.current().total).toBe(3);
    expect(quiz.answer(0)).toMatchObject({ correct: true, points: 1, done: false });
    quiz.moveFocus(1); quiz.moveFocus(1);
    expect(quiz.focus).toBe(2);
    expect(quiz.answer()).toMatchObject({ correct: true, points: 2 });
    expect(quiz.answer(0)).toMatchObject({ correct: false, points: 0, done: true });
    const s = quiz.summary();
    expect(s).toMatchObject({ score: 3, max: 4, correct: 2, total: 3 });
    expect(s.tier.text).toBe('high');
    expect(quiz.done).toBe(true);
    quiz.reset();
    expect(quiz.score).toBe(0);
    expect(quiz.current().index).toBe(0);
  });
});

describe('arcade/locks', () => {
  it('normalises and opens locks', async () => {
    const { normalize, codeLock, riddleLock, sequenceLock, room } = await load('arcade/locks.js');
    expect(normalize('  Sankt-Gallen! ')).toBe('sankt gallen');
    expect(normalize('Über Straße', { keepSpaces: false })).toBe('uberstrasse');
    expect(normalize('Café crème')).toBe('cafe creme');
    const door = codeLock('2412', { maxTries: 2 });
    expect(door.try('24 12').open).toBe(true);
    const door2 = codeLock('2412', { maxTries: 2 });
    door2.try('1'); expect(door2.try('2')).toMatchObject({ open: false, locked: true });
    expect(door2.try('2412').open).toBe(false);
    const riddle = riddleLock(['a candle', 'Kerze'], { hint: 'It shrinks.' });
    expect(riddle.try('A CANDLE!').open).toBe(true);
    const r2 = riddleLock(['a candle']);
    expect(r2.try('candles').open).toBe(false);
    expect(r2.hintAfter(1000, 0)).toBe('');
    const seq = sequenceLock(['Red', 'green', 'GOLD']);
    seq.push('red'); seq.push('blue');
    expect(seq.position).toBe(0);
    expect(seq.errors).toBe(1);
    seq.push('red'); seq.push('Green'); expect(seq.push('gold').open).toBe(true);
    const escape = room({ door, riddle, seq });
    expect(escape.progress).toEqual({ solved: 3, total: 3, done: true });
    escape.reset();
    expect(escape.progress.solved).toBe(0);
  });
});

describe('arcade/score', () => {
  it('keeps high scores in memory', async () => {
    const { createScore } = await load('arcade/score.js');
    const s = createScore({ keep: 2 });
    s.add(10); s.combo(); s.add(10);
    expect(s.value).toBe(30);
    expect(s.submit('A')).toBe(0);
    s.reset(); s.add(50); expect(s.submit('B')).toBe(0);
    s.reset(); s.add(5); expect(s.submit('C')).toBe(-1);
    expect(s.table().map((e: { name: string }) => e.name)).toEqual(['B', 'A']);
    expect(s.best).toBe(50);
  });
});

describe('arcade/loop', () => {
  it('steps deterministically without requestAnimationFrame', async () => {
    const { createLoop } = await load('arcade/loop.js');
    let updates = 0, renders = 0;
    const loop = createLoop({ update: () => updates++, render: () => renders++, step: 0.1 });
    loop.tick(0.25);
    expect(updates).toBe(2);
    expect(renders).toBe(1);
    expect(loop.reducedMotion()).toBe(false);
    loop.pause(); expect(loop.paused).toBe(true); loop.toggle(); expect(loop.paused).toBe(false);
  });
});

describe('sound/score', () => {
  it('validates, measures and schedules', async () => {
    const { validate, totalBeats, schedule, EXAMPLE, lyricsAt, transpose, beatsToSeconds } = await load('sound/score.js');
    expect(validate(EXAMPLE)).toEqual({ ok: true, errors: [] });
    expect(totalBeats(EXAMPLE)).toBe(8);
    expect(beatsToSeconds(8, 120)).toBe(4);
    const bad = validate({ tempo: 0, tracks: [] });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join(' ')).toMatch(/tempo/);
    expect(bad.errors.join(' ')).toMatch(/tracks/);
    expect(validate({ tempo: 90, tracks: [{ voice: 'musicbox', notes: [{ t: -1, p: 200, d: 0 }] }] }).errors).toHaveLength(3);
    expect(validate({ tempo: 90, tracks: [{ voice: 'kick', notes: [{ t: 0, d: 1 }] }] }).ok).toBe(true); // drums need no pitch
    const ev = schedule(EXAMPLE, { startTime: 1 });
    expect(ev[0].time).toBe(1);
    expect(ev.map((e: { time: number }) => e.time)).toEqual([...ev.map((e: { time: number }) => e.time)].sort((a, b) => a - b));
    expect(ev.find((e: { voice: string }) => e.voice === 'bass').duration).toBeCloseTo(beatsToSeconds(4, 90));
    expect(lyricsAt(EXAMPLE, 2.5).text).toBe('door');
    expect(lyricsAt(EXAMPLE, -1)).toBeNull();
    expect(transpose(EXAMPLE, 2).tracks[0].notes[0].p).toBe(74);
  });
});

describe('sound/wav', () => {
  it('renders a valid WAV in pure JS and encodes headers', async () => {
    const { synthesizeScoreToWav, isWav, encodeWav } = await load('sound/wav.js');
    const { EXAMPLE } = await load('sound/score.js');
    const bytes: Uint8Array = synthesizeScoreToWav(EXAMPLE, { sampleRate: 8000 });
    expect(isWav(bytes)).toBe(true);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint32(40, true)).toBe(bytes.length - 44);
    let peak = 0; for (let i = 44; i < bytes.length; i += 2) peak = Math.max(peak, Math.abs(view.getInt16(i, true)));
    expect(peak).toBeGreaterThan(1000); // not silent
    const buf = encodeWav({ sampleRate: 44100, channels: [new Float32Array([0, 1, -1]), new Float32Array([0, 0, 0])] });
    expect(buf.byteLength).toBe(44 + 3 * 2 * 2);
  });
});

describe('sound/sing', () => {
  it('groups lyrics into phrases without speechSynthesis', async () => {
    const { groupLyrics, singingSupported, createSinger, ROBOT_LABEL } = await load('sound/sing.js');
    const { EXAMPLE } = await load('sound/score.js');
    expect(singingSupported()).toBe(false);
    const groups = groupLyrics(EXAMPLE);
    expect(groups.length).toBeGreaterThanOrEqual(1);
    expect(groups.map((g: { text: string }) => g.text).join(' ')).toBe('Open the door and see');
    const singer = createSinger(EXAMPLE);
    expect(singer.start()).toBe(false);
    expect(ROBOT_LABEL).toMatch(/robot/i);
  });
});

describe('art/palette', () => {
  it('has well-formed festive and non-festive palettes', async () => {
    const { PALETTES, palette, contrast, readable, mix } = await load('art/palette.js');
    const names = Object.keys(PALETTES);
    expect(names.length).toBeGreaterThanOrEqual(6);
    expect(names.some((n) => PALETTES[n].festive)).toBe(true);
    expect(names.some((n) => !PALETTES[n].festive)).toBe(true);
    for (const n of names) {
      const p = PALETTES[n];
      expect(p.name).toBeTruthy();
      expect(p.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.fg).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.colors.length).toBeGreaterThanOrEqual(3);
      expect(contrast(p.bg, p.fg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(palette('nope').name).toBe(PALETTES.advent.name);
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(readable('#000000')).toBe('#FFFAF0');
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('art/print + art/wallpaper', () => {
  it('exposes presets and the required sizes', async () => {
    const { pageCSS, zinePageOrder, PRESETS } = await load('art/print.js');
    expect(pageCSS('postcard')).toContain('@page { size: 148mm 105mm');
    expect(zinePageOrder()).toEqual([8, 1, 2, 7, 6, 3, 4, 5]);
    expect(Object.keys(PRESETS)).toEqual(expect.arrayContaining(['a4-card', 'letter-card', 'postcard', 'zine-fold']));
    const { SIZES, safeArea } = await load('art/wallpaper.js');
    const dims = SIZES.map((s: { w: number; h: number }) => `${s.w}x${s.h}`);
    for (const d of ['1170x2532', '1284x2778', '1080x2400', '1920x1080', '2560x1440', '3840x2160', '2880x1800']) expect(dims).toContain(d);
    expect(safeArea(1170, 2532).top).toBeGreaterThan(safeArea(1920, 1080).top);
  });
});

describe('art/pixel + art/svg', () => {
  it('draws into the buffer and exports an SVG string without a DOM', async () => {
    const { createPixelArt } = await load('art/pixel.js');
    const art = createPixelArt(4, 4, ['#00000000', '#ff0000', '#00ff00']);
    art.fromRows(['....', '..2.']).rect(0, 0, 2, 2, 1).set(3, 3, 2);
    expect(art.get(0, 0)).toBe(1);
    expect(art.get(2, 1)).toBe(2);
    expect(art.get(3, 3)).toBe(2);
    art.flipX();
    expect(art.get(0, 3)).toBe(2);
    const svg = art.toSVGString(2);
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect((svg.match(/<rect/g) || []).length).toBe(6);
    const { svgString, pathD } = await load('art/svg.js');
    expect(svgString('circle', { cx: 1, cy: 1, r: 1 })).toBe('<circle cx="1" cy="1" r="1"/>');
    expect(pathD([[0, 0], [1, 1]], { close: true })).toBe('M0 0 L1 1 Z');
  });
});

describe('story/fiction', () => {
  it('runs choices with flags, undo and restart; validates stories', async () => {
    const { createStory, validateStory } = await load('story/fiction.js');
    const story = {
      start: 'hall',
      nodes: {
        hall: { text: 'A door. A window. Coins: {{coins}}', choices: [{ text: 'Door', to: 'door', set: { brave: true, coins: '+1' } }, { text: 'Window', to: 'win', if: { brave: true } }] },
        door: { text: 'Through.', choices: [{ text: 'Back', to: 'hall' }] },
        win: { text: 'The end.', end: true },
      },
    };
    expect(validateStory(story)).toEqual({ ok: true, errors: [] });
    const run = createStory(story, { initialFlags: { coins: 0 } });
    expect(run.node.text).toContain('Coins: 0');
    expect(run.choices.map((c: { text: string }) => c.text)).toEqual(['Door']); // window hidden until brave
    expect(run.choose(0)).toBe(true);
    expect(run.id).toBe('door');
    expect(run.flags).toEqual({ coins: 1, brave: true });
    run.choose(0);
    expect(run.id).toBe('hall');
    expect(run.choices.map((c: { text: string }) => c.text)).toEqual(['Door', 'Window']);
    expect(run.history).toEqual(['hall', 'door']);
    run.choose(1);
    expect(run.ended).toBe(true);
    expect(run.back()).toBe(true);
    expect(run.id).toBe('hall');
    expect(run.canBack).toBe(true);
    run.restart();
    expect(run.id).toBe('hall');
    expect(run.flags).toEqual({ coins: 0 });
    expect(run.canBack).toBe(false);
    const bad = validateStory({ start: 'x', nodes: { a: { text: 'a', choices: [{ text: 'go', to: 'missing' }] } } });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join(' ')).toMatch(/missing/);
  });
});

describe('story + maker string builders', () => {
  it('build HTML without a DOM and store data with the in-memory fallback', async () => {
    const { cardHTML } = await load('story/card.js');
    expect(cardHTML({ front: { title: 'Door <7>' }, inside: { body: ['Hi'] } })).toContain('Door &lt;7&gt;');
    const { letterHTML } = await load('story/letter.js');
    expect(letterHTML({ paragraphs: ['a', 'b'] }).match(/<p>/g)!.length).toBe(2);
    const { comicHTML } = await load('story/comic.js');
    expect(comicHTML({ panels: [{ art: '<svg/>', bubbles: [{ text: 'Hi' }] }] })).toContain('cp-bubble');
    const { cheatsheetHTML, kbd } = await load('maker/cheatsheet.js');
    expect(kbd('Ctrl+P')).toBe('<kbd>Ctrl</kbd><span class="cs-plus">+</span><kbd>P</kbd>');
    expect(cheatsheetHTML({ title: 'T', groups: [{ heading: 'G', rows: [{ key: 'A', value: 'b' }] }], blankRows: 1 })).toContain('cs-blank');
    const { STACKS } = await load('story/type.js');
    expect(STACKS.hand).toContain("'Caveat'");
    const { createStorage } = await load('maker/storage.js');
    const store = createStorage('t');
    expect(store.persistent).toBe(false);
    expect(store.set('a', { x: 1 })).toBe(true);
    expect(store.get('a')).toEqual({ x: 1 });
    expect(store.get('missing', 'dflt')).toBe('dflt');
    expect(store.keys()).toEqual(['a']);
    expect(store.importJSON(store.exportJSON())).toBe(1);
    store.remove('a');
    expect(store.keys()).toEqual([]);
    const { safeFilename } = await load('maker/clipboard.js');
    expect(safeFilename('a/b:c?.txt')).toBe('a-b-c-.txt');
  });
});
