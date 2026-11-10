import { describe, expect, it } from 'vitest';
import { formatDoctor, redactForReport, type DoctorData } from '../../src/cli/doctor.js';

const data: DoctorData = {
  version: '1.0.0', node: 'v22.1.0', platform: 'darwin', home: '/Users/alex/.advent-agent', ports: { app: 4224, gift: 4225 }, setupComplete: true,
  connection: { mode: 'launched', adapter: 'claude-code' },
  adapters: [{ label: 'Claude Code', detection: { installed: true, version: '2.1.0', path: '/Users/alex/.local/bin/claude' }, capabilities: { verified: true } }, { label: 'Goose', detection: { installed: false }, capabilities: { verified: false } }],
  browser: 'Chromium', ffprobe: '/opt/homebrew/bin/ffprobe', gary: 'bundled', uiBuilt: true, workshop: true, library: true, keychain: true,
  list: { lines: 12, checks: 2, personaSet: true },
  recentErrors: [{ day: 4, code: 'agent_rate_limited', message: 'Hit a limit. See /Users/alex/.advent-agent/seasons/2026/doors/04/log.txt or mail alex@example.com' }],
};

describe('advent-agent doctor', () => {
  it('shortens home paths and removes addresses', () => {
    expect(redactForReport('/Users/alex/Documents/x and C:\\Users\\Alex\\Desktop\\y and /home/sam/z', '/Users/alex')).toBe('~/Documents/x and ~\\Desktop\\y and ~/z');
    expect(redactForReport('mail alex@example.com now')).toBe('mail <email> now');
  });

  it('prints versions, agents, prerequisites, counts and recent errors, with no home path, name, address or list content', () => {
    const out = formatDoctor(data, '/Users/alex');
    expect(out).toContain('claude-code');
    expect(out).toContain('found 2.1.0 ~/.local/bin/claude');
    expect(out).toContain('list: 12 lines, 2 check(s) done · persona: set');
    expect(out).toContain('door 4: agent_rate_limited');
    expect(out).not.toMatch(/\/Users\/|alex|@example/);
  });

  it('says so when there are no errors', () => {
    expect(formatDoctor({ ...data, recentErrors: [] }, '/Users/alex')).toContain('recent errors:\n  none');
  });
});
