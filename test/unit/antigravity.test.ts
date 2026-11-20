import { describe, expect, it } from 'vitest';
import { antigravity, getAdapter } from '../../src/adapters/index.js';
import { parseUsageGeneric } from '../../src/adapters/detect.js';
import type { LaunchContext } from '../../src/adapters/types.js';

const ctx = (over: Partial<LaunchContext> = {}): LaunchContext => ({ task: 'gift', doorDir: '/w/doors/01', workspace: '/season/workspace', workshop: '/ws', promptFile: '/w/P', prompt: 'p', day: 1, webResearch: false, inspirationFolders: [], permissive: false, ...over });
const settingsOf = (args: string[]) => JSON.parse(args[args.indexOf('--settings') + 1]!) as { toolPermission: string; permissions: { allow: string[]; deny: string[] } };

describe('Antigravity CLI adapter (agy 1.5.13, 20 November 2026)', () => {
  it('is registered and launches agy headless with stream-json', () => {
    expect(getAdapter('antigravity')).toBe(antigravity);
    const spec = antigravity.launch(ctx());
    expect(spec.command).toBe('agy');
    expect(spec.args[0]).toBe('-p');
    expect(spec.args[1]).toMatch(/^p You run in a sandbox with no network/);
    expect(spec.args.slice(2, 4)).toEqual(['--output-format', 'stream-json']);
  });

  it('a gift runs in the sandbox, with settings for this run only and no web', () => {
    const { args } = antigravity.launch(ctx({ inspirationFolders: ['/pics'] }));
    expect(args).toContain('--sandbox');
    expect(args.join(' ')).toContain('--mode accept-edits');
    expect(args.join(' ')).toContain('--add-dir /ws --add-dir /pics');
    expect(args).not.toContain('--dangerously-skip-permissions');
    expect(args).not.toContain('--model');
    const s = settingsOf(args);
    expect(s.toolPermission).toBe('proceed-in-sandbox');
    expect(s.permissions.allow).toEqual(['read_file(*)']);
    expect(s.permissions.deny).toEqual(['unsandboxed(*)', 'mcp(*)', 'read_url(*)', 'execute_url(*)', 'download_url(*)']);
  });

  it('web research allows reading pages, nothing more', () => {
    const s = settingsOf(antigravity.launch(ctx({ webResearch: true })).args);
    expect(s.permissions.allow).toContain('read_url(*)');
    expect(s.permissions.deny).toEqual(['unsandboxed(*)', 'mcp(*)', 'execute_url(*)', 'download_url(*)']);
  });

  it('checking the list gets no shell, no web and no extra folders, whatever the settings say', () => {
    const { args } = antigravity.launch(ctx({ task: 'list', webResearch: true, inspirationFolders: ['/pics'] }));
    expect(args).not.toContain('--add-dir');
    expect(args[1]).toMatch(/^p Paths in TASK\.md are relative to the list folder/);
    const s = settingsOf(args);
    expect(s.permissions.allow).toEqual(['read_file(/season)']);
    expect(s.permissions.deny).toEqual(['command(*)', 'mcp(*)', 'read_url(*)', 'execute_url(*)', 'download_url(*)']);
  });

  it('the permissive option is the only way to skip permissions', () => {
    const { args } = antigravity.launch(ctx({ permissive: true }));
    expect(args).toContain('--dangerously-skip-permissions');
    expect(args).not.toContain('--settings');
    expect(args[1]).toBe('p');
  });

  it('reads token usage from the result event', () => {
    const out = '{"event":"result","result":{"status":"SUCCESS","usage":{"input_tokens":9693,"output_tokens":22,"thinking_tokens":21,"cache_read_tokens":0,"total_tokens":9715}}}';
    expect(parseUsageGeneric(out)).toEqual({ tokens: 9715, usd: undefined });
  });
});
