import { describe, expect, it } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadPromo, promoFor } from '../../src/core/promo.js';
import type { Promo } from '../../src/shared/config.js';

const promo: Promo = { enabled: true, day: 6, code: 'GARY20', percent: 20, expires: '2027-01-31', url: 'https://deskmenace.com/?ref=aa-voucher&code=<code>' };

describe('promo slip', () => {
  it('U7.1 only on the configured day', () => {
    expect(promoFor(promo, 6, true, '2026-12-06')).toBeDefined();
    expect(promoFor(promo, 5, true, '2026-12-06')).toBeUndefined();
    expect(promoFor(promo, 7, true, '2026-12-07')).toBeUndefined();
  });
  it('U7.2 only after reveal, and also when opened late', () => {
    expect(promoFor(promo, 6, false, '2026-12-06')).toBeUndefined();
    expect(promoFor(promo, 6, true, '2026-12-20')).toBeDefined();
  });
  it('U7.3 hidden after expiry', () => {
    expect(promoFor(promo, 6, true, '2027-01-31')).toBeDefined();
    expect(promoFor(promo, 6, true, '2027-02-01')).toBeUndefined();
  });
  it('U7.4 hidden when disabled or the code is unset', () => {
    expect(promoFor({ ...promo, enabled: false }, 6, true, '2026-12-06')).toBeUndefined();
    expect(promoFor({ ...promo, code: '' }, 6, true, '2026-12-06')).toBeUndefined();
    expect(promoFor({ ...promo, code: '<SET AT RELEASE>' }, 6, true, '2026-12-06')).toBeUndefined();
    expect(promoFor(undefined, 6, true, '2026-12-06')).toBeUndefined();
  });
  it('substitutes the code into the URL', () => {
    expect(promoFor(promo, 6, true, '2026-12-06')?.url).toBe('https://deskmenace.com/?ref=aa-voucher&code=GARY20');
  });
  it('loads the shipped promo.json (code unset until release → never shown)', () => {
    const shipped = loadPromo();
    expect(shipped?.day).toBe(6);
    expect(shipped?.percent).toBe(20);
    const dir = mkdtempSync(join(tmpdir(), 'aa-promo-'));
    const f = join(dir, 'promo.json');
    writeFileSync(f, JSON.stringify(promo));
    expect(loadPromo(f)?.code).toBe('GARY20');
    writeFileSync(f, '{"enabled": true}');
    expect(loadPromo(f)).toBeUndefined();
  });
});
