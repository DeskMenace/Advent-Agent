import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

const run = (...args: string[]) => execFileSync(process.execPath, ['--import', 'tsx', 'src/cli/main.ts', ...args], { encoding: 'utf8', timeout: 20_000 });

describe('advent-agent --version and --help print and exit (they must not start the companion)', () => {
  it('--version', () => { expect(run('--version').trim()).toMatch(/^\d+\.\d+\.\d+/); });
  it('-v', () => { expect(run('-v').trim()).toMatch(/^\d+\.\d+\.\d+/); });
  it('--help and -h', () => {
    expect(run('--help')).toContain('Usage:');
    expect(run('-h')).toContain('Usage:');
  });
});
