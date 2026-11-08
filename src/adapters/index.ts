/**
 * Launched-mode adapters. Flags for Claude Code, Codex and Gemini were verified on 8 Nov 2026 (docs/AGENT_COMPAT.md).
 * The others carry the handoff's indicative flags and are marked unverified until the smoke test confirms them.
 */
import { LAUNCHED_ADAPTERS, type LaunchedAdapterId } from '../shared/config.js';
import { detectCli, parseUsageGeneric, whichSync } from './detect.js';
import type { Adapter, AdapterCapabilities, Detection, LaunchContext, LaunchSpec } from './types.js';

const base = (over: Partial<AdapterCapabilities>): AdapterCapabilities => ({ headless: true, budgetEnforced: false, verified: false, canRunCommands: true, loadsOwnMemory: true, notes: [], ...over });

export const claudeCode: Adapter = {
  id: 'claude-code',
  label: 'Claude Code',
  binary: 'claude',
  detect: async () => detectCli('claude'),
  capabilities: () => base({ budgetEnforced: true, verified: true, notes: ['Budget enforced with --max-budget-usd when a spend cap is set.', 'Loads ~/.claude/CLAUDE.md and its own memory.'] }),
  launch(ctx) {
    const tools = ['Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'Bash(advent-agent:*)', 'Bash(node:*)', 'Bash(ls:*)', 'Bash(cat:*)', 'Bash(mkdir:*)', 'Bash(cp:*)', 'Bash(python3:*)', 'Bash(npx:*)', 'TodoWrite'];
    if (ctx.webResearch) tools.push('WebSearch', 'WebFetch');
    const args = ['-p', ctx.prompt, '--output-format', 'stream-json', '--verbose', '--no-session-persistence', '--add-dir', ctx.workshop, ...ctx.inspirationFolders.flatMap((f) => ['--add-dir', f]), '--allowedTools', ...tools];
    if (ctx.permissive) args.push('--permission-mode', 'bypassPermissions');
    else args.push('--permission-mode', 'acceptEdits', '--permission-prompts', 'none');
    if (ctx.usdCap) args.push('--max-budget-usd', String(ctx.usdCap));
    return { command: 'claude', args };
  },
  parseUsage: parseUsageGeneric,
};

export const codex: Adapter = {
  id: 'codex',
  label: 'Codex CLI',
  binary: 'codex',
  detect: async () => detectCli('codex'),
  capabilities: () => base({ verified: true, notes: ['Runs in the workspace-write sandbox: it may write only inside the workspace.', 'No token-limit flag: the budget is advisory.', 'Loads ~/.codex/AGENTS.md.'] }),
  launch(ctx) {
    const args = ['exec', '--json', '--skip-git-repo-check', '-C', ctx.workspace, '--sandbox', ctx.permissive ? 'danger-full-access' : 'workspace-write', '--add-dir', ctx.workshop, ...ctx.inspirationFolders.flatMap((f) => ['--add-dir', f]), '-o', `${ctx.workspace}/.codex-last-message.txt`];
    if (ctx.permissive) args.push('--dangerously-bypass-approvals-and-sandbox');
    args.push(ctx.prompt);
    return { command: 'codex', args };
  },
  parseUsage: parseUsageGeneric,
};

export const gemini: Adapter = {
  id: 'gemini',
  label: 'Gemini CLI',
  binary: 'gemini',
  detect: async () => detectCli('gemini'),
  capabilities: () => base({ verified: true, canRunCommands: false, notes: ['approval-mode auto_edit: file edits run, shell commands are denied, so progress and submission are handled by the calendar when it exits.', 'No token-limit flag: the budget is advisory.', 'Loads ~/.gemini/GEMINI.md.'] }),
  launch(ctx) {
    const args = ['-p', ctx.prompt, '--output-format', 'json', '--include-directories', ctx.workshop, ...ctx.inspirationFolders.flatMap((f) => ['--include-directories', f])];
    args.push('--approval-mode', ctx.permissive ? 'yolo' : 'auto_edit');
    return { command: 'gemini', args };
  },
  parseUsage: parseUsageGeneric,
};

function indicative(id: LaunchedAdapterId, label: string, binary: string, argsFor: (ctx: LaunchContext) => string[], notes: string[] = []): Adapter {
  return {
    id,
    label,
    binary,
    detect: async () => detectCli(binary),
    capabilities: () => base({ verified: false, notes: ['Flags are indicative (not verified on this machine). The smoke test records them in docs/AGENT_COMPAT.md.', ...notes] }),
    launch: (ctx) => ({ command: binary, args: argsFor(ctx) }),
    parseUsage: parseUsageGeneric,
  };
}

export const opencode = indicative('opencode', 'OpenCode', 'opencode', (ctx) => ['run', ctx.prompt]);
export const cursor = indicative('cursor', 'Cursor CLI', 'cursor-agent', (ctx) => ['-p', ctx.prompt]);
export const copilot = indicative('copilot', 'GitHub Copilot CLI', 'copilot', (ctx) => ['-p', ctx.prompt]);
export const goose = indicative('goose', 'Goose', 'goose', (ctx) => ['run', '-t', ctx.prompt]);
export const amp = indicative('amp', 'Amp', 'amp', (ctx) => ['-x', ctx.prompt]);

export const muse: Adapter = {
  id: 'muse',
  label: 'Muse Code (Meta)',
  binary: 'muse',
  detect: async () => {
    const d = detectCli('muse');
    return d.installed ? { ...d, note: 'No headless mode confirmed. Use connected or portable mode.' } : d;
  },
  capabilities: () => base({ headless: false, notes: ['No headless mode confirmed: offered as connected/portable only.'] }),
  launch: (ctx) => ({ command: 'muse', args: ['-p', ctx.prompt] }),
  parseUsage: parseUsageGeneric,
};

/** User-provided template: {prompt} {prompt_file} {workspace} {workshop} {day}. Split on whitespace, quotes respected. */
export const custom: Adapter = {
  id: 'custom',
  label: 'Custom command',
  binary: '',
  detect: async () => ({ installed: true, note: 'User-defined command; shown with a warning.' }),
  capabilities: () => base({ verified: false, loadsOwnMemory: false, notes: ['You are responsible for what this command does and which permissions it grants.'] }),
  launch(ctx) {
    const template = ctx.customCommand ?? '';
    const parts = splitCommand(template).map((p) =>
      p.replace(/\{prompt_file\}/g, ctx.promptFile).replace(/\{prompt\}/g, ctx.prompt).replace(/\{workspace\}/g, ctx.workspace).replace(/\{workshop\}/g, ctx.workshop).replace(/\{day\}/g, String(ctx.day)),
    );
    const [command, ...args] = parts;
    if (!command) throw new Error('The custom command is empty.');
    return { command, args };
  },
  parseUsage: parseUsageGeneric,
};

export function splitCommand(s: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quote: string | null = null;
  let has = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (quote) {
      if (c === quote) quote = null;
      else if (c === '\\' && quote === '"' && i + 1 < s.length) cur += s[++i];
      else cur += c;
    } else if (c === '"' || c === "'") { quote = c; has = true; }
    else if (/\s/.test(c)) { if (has || cur) { out.push(cur); cur = ''; has = false; } }
    else cur += c;
  }
  if (has || cur) out.push(cur);
  return out;
}

export const ADAPTERS: Record<LaunchedAdapterId, Adapter> = { 'claude-code': claudeCode, codex, gemini, muse, opencode, cursor, copilot, goose, amp, custom };

export function getAdapter(id: string): Adapter | undefined {
  return (LAUNCHED_ADAPTERS as readonly string[]).includes(id) ? ADAPTERS[id as LaunchedAdapterId] : undefined;
}

export async function detectAll(): Promise<Array<{ id: LaunchedAdapterId; label: string; detection: Detection; capabilities: AdapterCapabilities }>> {
  const out = [];
  for (const id of LAUNCHED_ADAPTERS) {
    if (id === 'custom') continue;
    const a = ADAPTERS[id];
    out.push({ id, label: a.label, detection: await a.detect(), capabilities: a.capabilities() });
  }
  return out;
}

export function resolveCommand(spec: LaunchSpec): string {
  return whichSync(spec.command) ?? spec.command;
}
