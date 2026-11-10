import { describe, expect, it } from 'vitest';
import { splitCommand } from '../../src/adapters/index.js';

describe('custom command splitting', () => {
  it('keeps Windows paths intact inside double quotes, and still honours \\" and single quotes', () => {
    expect(splitCommand('"C:\\Program Files\\nodejs\\node.exe" "C:\\work\\agent.mjs" --day {day}')).toEqual(['C:\\Program Files\\nodejs\\node.exe', 'C:\\work\\agent.mjs', '--day', '{day}']);
    expect(splitCommand('agent --say "she said \\"hi\\""')).toEqual(['agent', '--say', 'she said "hi"']);
    expect(splitCommand("agent 'a b' c")).toEqual(['agent', 'a b', 'c']);
    expect(splitCommand('C:\\tools\\agent.exe --x')).toEqual(['C:\\tools\\agent.exe', '--x']);
  });
});
