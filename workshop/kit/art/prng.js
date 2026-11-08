// kit/art/prng.js — seeded PRNG (mulberry32) + 2D value noise (pure).
// MIT License. Copyright (c) Advent Agent contributors. Inline freely into any gift.
//
// Usage (10 lines):
//   import { mulberry32, hashSeed, valueNoise2D, fbm2D, pick, shuffle, range } from './prng.js';
//   const seed = hashSeed('door-7');                 // string → 32-bit seed; or just use the day number
//   const rng = mulberry32(seed);                    // rng() in [0,1), deterministic
//   const n = valueNoise2D(seed);                    // n(x, y) in [0,1), smooth
//   for (let x = 0; x < w; x++) drawColumn(x, n(x / 40, 0.5) * h);
//   const terrain = fbm2D(seed, { octaves: 4 });     // layered noise, more detail
//   const color = pick(rng, ['#A82438', '#14503A', '#BD955A']);
//   const order = shuffle(rng, [1, 2, 3, 4]);        // new array, Fisher-Yates
//   const r = range(rng, 10, 20);                    // float in [10, 20)
//   const i = rangeInt(rng, 0, 5);                   // integer 0..5 inclusive

export function mulberry32(seed) {
  let a = (seed >>> 0) || 0x9E3779B9;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => t * t * (3 - 2 * t);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Lattice hash for noise: deterministic value in [0,1) for integer coords. */
function lattice(seed, ix, iy) {
  let h = (seed ^ Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function valueNoise2D(seed = 1) {
  return function (x, y = 0) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = smoothstep(x - ix), fy = smoothstep(y - iy);
    const a = lattice(seed, ix, iy), b = lattice(seed, ix + 1, iy), c = lattice(seed, ix, iy + 1), d = lattice(seed, ix + 1, iy + 1);
    return lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
  };
}
export function fbm2D(seed = 1, { octaves = 4, lacunarity = 2, gain = 0.5 } = {}) {
  const n = valueNoise2D(seed);
  return function (x, y = 0) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) { sum += n(x * freq + i * 17.3, y * freq + i * 11.7) * amp; norm += amp; amp *= gain; freq *= lacunarity; }
    return sum / norm;
  };
}
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const range = (rng, lo, hi) => lo + rng() * (hi - lo);
export const rangeInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
export function shuffle(rng, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
/** Approximate normal distribution (Box–Muller). */
export function gaussian(rng, mean = 0, sd = 1) { const u = 1 - rng(), v = rng(); return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
