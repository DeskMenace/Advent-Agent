import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { labReviewSheet, saveLabReview, LabReviewSchema } from '../../src/lab/review.js';
import { CalendarService } from '../../src/jobs/service.js';
import { LIBRARY_DIR, PACKAGE_ROOT } from '../../src/core/package-paths.js';

let home: string;
beforeEach(() => { home = mkdtempSync(join(tmpdir(), 'aa-lab-')); });
afterEach(() => { rmSync(home, { recursive: true, force: true }); });

describe('gift lab review (L1/L2)', () => {
  it('lists lab doors with their idea and agent, saves a review file and can approve an idea', async () => {
    const service = new CalendarService({ homeRoot: home, allowRealAgents: false });
    service.store.saveConfig({ setupComplete: true, connection: { mode: 'submit', permissive: false } });
    service.ensureSeason('lab', 2026);
    writeFileSync(service.store.home.demoFile, JSON.stringify({ simulatedDay: 24 }));
    const season = service.season()!;
    mkdirSync(service.store.home.doorDir(season.year, 1), { recursive: true });
    writeFileSync(join(service.store.home.doorDir(season.year, 1), 'lab.json'), JSON.stringify({ idea: 'jelly-fruit', agent: 'claude-code' }));
    await service.submit(1, { type: 'text', text: '# A fortune\n\nYou will find a sock.' }, 'submit', 'lab-test');
    service.reveal(1);
    const sheet = labReviewSheet(service);
    expect(sheet.season).toBe(2026);
    expect(sheet.items[0]).toMatchObject({ day: 1, idea: 'jelly-fruit', agent: 'claude-code', state: 'ready', revealed: true, title: 'A fortune' });
    expect(sheet.reviewsFile).toMatch(/docs[\\/]lab-reviews[\\/]\d{4}-\d{2}-\d{2}\.md$/);

    // Use a scratch copy of the idea file so the repo's library is not modified by the test.
    const ideaFile = join(LIBRARY_DIR, 'ideas', 'jelly-fruit.md');
    const original = readFileSync(ideaFile, 'utf8');
    const reviewsDir = join(PACKAGE_ROOT, 'docs', 'lab-reviews');
    const existed = existsSync(reviewsDir);
    try {
      const r = saveLabReview(service, { day: 1, idea: 'jelly-fruit', agent: 'claude-code', works: 'yes', delight: 4, feltPersonal: 'n/a', noteQuality: 5, problems: '', approveIdea: true });
      expect(existsSync(r.saved)).toBe(true);
      const text = readFileSync(r.saved, 'utf8');
      expect(text).toContain('## Door 1 · A fortune');
      expect(text).toContain('- Delight: 4/5');
      expect(text).toContain('- Approve idea: yes');
      expect(r.approved).toBe('jelly-fruit');
      expect(readFileSync(ideaFile, 'utf8')).toMatch(/^status: approved/m);
    } finally {
      writeFileSync(ideaFile, original);
      if (!existed) rmSync(reviewsDir, { recursive: true, force: true });
    }
    expect(() => LabReviewSchema.parse({ day: 1, works: 'maybe', delight: 9, feltPersonal: 'yes', noteQuality: 3 })).toThrow();
  });
});
