/** D36: the user decides. A spend limit reaches Claude Code as --max-budget-usd, for a gift and for a list check alike; "No limit" sends no flag. */
import { describe, expect, it } from 'vitest';
import { claudeCode } from '../../src/adapters/index.js';
import type { LaunchContext } from '../../src/adapters/types.js';

const ctx = (p: Partial<LaunchContext>): LaunchContext => ({
  task: 'gift', workspace: '/w', doorDir: '/w/doors/01', workshop: '/workshop', promptFile: '/w/PROMPT.txt', prompt: 'make', day: 1,
  webResearch: false, inspirationFolders: [], permissive: false, ...p,
});

describe('spend limit (D36)', () => {
  it('no limit: no budget flag, for a gift and for a list check', () => {
    expect(claudeCode.launch(ctx({})).args).not.toContain('--max-budget-usd');
    expect(claudeCode.launch(ctx({ task: 'list' })).args).not.toContain('--max-budget-usd');
  });
  it('a limit is passed as the user set it, for a gift and for a list check', () => {
    for (const task of ['gift', 'list'] as const) {
      const args = claudeCode.launch(ctx({ task, usdCap: 3 })).args;
      expect(args[args.indexOf('--max-budget-usd') + 1]).toBe('3');
    }
  });
  it('the calendar never chooses the model', () => {
    for (const task of ['gift', 'list'] as const) expect(claudeCode.launch(ctx({ task, usdCap: 3 })).args.join(' ')).not.toMatch(/--model\b/);
  });
});
