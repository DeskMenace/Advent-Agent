/**
 * Launched-mode adapters. Flags for Claude Code, Codex and Gemini were verified on 8 Nov 2026, Antigravity on 20 Nov 2026 (docs/AGENT_COMPAT.md).
 * The others carry the handoff's indicative flags and are marked unverified until the smoke test confirms them.
 */
import { realpathSync } from 'node:fs';
import { dirname } from 'node:path';
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
    const list = ctx.task === 'list';
    // Checking the list reads copied files and writes list.md: no shell, no web, no extra folders.
    const tools = list ? ['Read', 'Write', 'Glob', 'Grep'] : ['Read', 'Write', 'Edit', 'MultiEdit', 'Glob', 'Grep', 'Bash(advent-agent:*)', 'Bash(node:*)', 'Bash(ls:*)', 'Bash(cat:*)', 'Bash(mkdir:*)', 'Bash(cp:*)', 'Bash(python3:*)', 'Bash(npx:*)', 'TodoWrite'];
    if (ctx.webResearch && !list) tools.push('WebSearch', 'WebFetch');
    const dirs = list ? [] : ['--add-dir', ctx.workshop, ...ctx.inspirationFolders.flatMap((f) => ['--add-dir', f])];
    // The list check needs none of the user's skills, plugins or MCP servers: leaving them out keeps the fixed cost of every turn small.
    const lean = list ? ['--tools', 'Read,Write,Glob,Grep', '--disable-slash-commands', '--strict-mcp-config'] : [];
    const args = ['-p', ctx.prompt, '--output-format', 'stream-json', '--verbose', '--no-session-persistence', ...dirs, ...lean, '--allowedTools', ...tools];
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
    const dirs = ctx.task === 'list' ? [] : ['--add-dir', ctx.workshop, ...ctx.inspirationFolders.flatMap((f) => ['--add-dir', f])];
    const args = ['exec', '--json', '--skip-git-repo-check', '-C', ctx.workspace, '--sandbox', ctx.permissive ? 'danger-full-access' : 'workspace-write', ...dirs, '-o', `${ctx.workspace}/.codex-last-message.txt`];
    if (ctx.permissive) args.push('--dangerously-bypass-approvals-and-sandbox');
    args.push(ctx.prompt);
    return { command: 'codex', args };
  },
  parseUsage: parseUsageGeneric,
};

/**
 * Antigravity CLI (`agy`): Google's terminal agent for personal accounts since Gemini CLI stopped serving them (18 June 2026).
 * Flags verified against `agy --help` 1.5.13 on 20 Nov 2026 (docs/AGENT_COMPAT.md).
 * Headless mode cannot ask, and a question nobody can answer ends the run. So the run gets its own settings with --settings
 * (never saved to the user's settings.json).
 */
export const antigravity: Adapter = {
  id: 'antigravity',
  label: 'Antigravity CLI',
  binary: 'agy',
  detect: async () => detectCli('agy'),
  capabilities: () => base({ verified: true, notes: ['Runs in its terminal sandbox: commands may write only inside the workspace and have no network.', 'No spend-limit flag: the budget is advisory.', 'Loads ~/.gemini/AGENTS.md and ~/.gemini/GEMINI.md.'] }),
  launch(ctx) {
    const list = ctx.task === 'list';
    const folders = list ? [] : [ctx.workshop, ...ctx.inspirationFolders];
    const flags = ['--output-format', 'stream-json', ...folders.flatMap((f) => ['--add-dir', f])];
    if (ctx.permissive) return { command: 'agy', args: ['-p', ctx.prompt, ...flags, '--dangerously-skip-permissions'] };
    // The sandbox has no network, not even to this computer, so the `advent-agent` command cannot reach the calendar. The brief's
    // other route is used instead: the phase goes into .progress and the calendar submits ./gift when the agent exits.
    const note = list ? ' Paths in TASK.md are relative to the list folder: the file to read is list/sources/ALL.md. Read TASK.md, read that one file, write list/list.md, then stop. Do not run commands and do not open any other path: a refused request ends your work.' : ' You run in a sandbox with no network: the `advent-agent` command does not work here, so do not run it. Report progress by writing the phase name into the .progress file of that door\'s folder, leave the finished gift in its gift folder, then finish: the calendar checks and submits it when you exit. Never ask to run a command outside the sandbox: a refused request ends your work.';
    const args = ['-p', ctx.prompt + note, ...flags];
    // Sandbox: any command may run, but it can write only inside the workspace, cannot read the home folder and has no network
    // (observed with 1.5.13). An allow-list of commands is not usable here: the first command outside it ends the whole run.
    const web = ['read_url(*)', 'execute_url(*)', 'download_url(*)'];
    const permissions = {
      // A file read that would need a question ends the run, so reads are allowed up front: anywhere for a gift (as Claude Code's
      // Read and Codex's sandbox do), only the season folder for the list (it covers a mistyped path, not the home folder).
      allow: [list ? `read_file(${realDir(dirname(ctx.workspace))})` : 'read_file(*)', ...(ctx.webResearch && !list ? ['read_url(*)'] : [])],
      deny: [...(list ? ['command(*)'] : ['unsandboxed(*)']), 'mcp(*)', ...(ctx.webResearch && !list ? web.slice(1) : web)],
    };
    return { command: 'agy', args: [...args, '--sandbox', '--mode', 'accept-edits', '--settings', JSON.stringify({ toolPermission: 'proceed-in-sandbox', permissions })] };
  },
  parseUsage: parseUsageGeneric,
};

/** The path as the CLI sees it (on macOS a temp folder is a link into /private). */
function realDir(dir: string): string {
  try { return realpathSync(dir); } catch { return dir; }
}

export const gemini: Adapter = {
  id: 'gemini',
  label: 'Gemini CLI',
  binary: 'gemini',
  detect: async () => detectCli('gemini'),
  capabilities: () => base({ verified: true, canRunCommands: false, notes: ['approval-mode auto_edit: file edits run, shell commands are denied, so progress and submission are handled by the calendar when it exits.', 'No token-limit flag: the budget is advisory.', 'Loads ~/.gemini/GEMINI.md.'] }),
  launch(ctx) {
    // --skip-trust: without it Gemini CLI silently downgrades --approval-mode to "default" in an untrusted folder
    // (observed with 0.49.0), and every edit would wait for an approval nobody can give.
    const dirs = ctx.task === 'list' ? [] : ['--include-directories', ctx.workshop, ...ctx.inspirationFolders.flatMap((f) => ['--include-directories', f])];
    const args = ['-p', ctx.prompt, '--output-format', 'json', '--skip-trust', ...dirs];
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
      p.replace(/\{door\}/g, ctx.doorDir).replace(/\{prompt_file\}/g, ctx.promptFile).replace(/\{prompt\}/g, ctx.prompt).replace(/\{workspace\}/g, ctx.workspace).replace(/\{workshop\}/g, ctx.workshop).replace(/\{day\}/g, String(ctx.day)),
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
      // Only \" is an escape inside double quotes: every other backslash is kept, so Windows paths survive.
      else if (c === '\\' && quote === '"' && s[i + 1] === '"') cur += s[++i];
      else cur += c;
    } else if (c === '"' || c === "'") { quote = c; has = true; }
    else if (/\s/.test(c)) { if (has || cur) { out.push(cur); cur = ''; has = false; } }
    else cur += c;
  }
  if (has || cur) out.push(cur);
  return out;
}

export const ADAPTERS: Record<LaunchedAdapterId, Adapter> = { 'claude-code': claudeCode, codex, antigravity, gemini, opencode, cursor, copilot, goose, amp, custom };

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
