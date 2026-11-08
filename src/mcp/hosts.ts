/**
 * MCP host configuration: copy-paste snippets and "add it for me" for known config files
 * (AGENT_CONNECTIONS §3). Writing always shows the diff first and needs confirm=true.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { binPath } from '../core/package-paths.js';

export type McpHostId = 'claude-desktop' | 'codex' | 'gemini' | 'cursor' | 'claude-code' | 'generic';

export interface HostSnippet {
  label: string;
  configPath?: string;
  format: 'json' | 'toml' | 'command';
  snippet: string;
  notes: string;
}

function serverCommand(): { command: string; args: string[] } {
  return { command: process.execPath, args: [binPath(), 'mcp'] };
}

export function mcpConfigSnippets(): Record<McpHostId, HostSnippet> {
  const { command, args } = serverCommand();
  const jsonEntry = JSON.stringify({ mcpServers: { 'advent-agent': { command, args } } }, null, 2);
  const home = homedir();
  const claudeDesktopPath = process.platform === 'darwin'
    ? join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
    : process.platform === 'win32'
      ? join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json')
      : join(home, '.config', 'Claude', 'claude_desktop_config.json');
  return {
    'claude-desktop': { label: 'Claude Desktop', configPath: claudeDesktopPath, format: 'json', snippet: jsonEntry, notes: 'Add under "mcpServers", then restart Claude Desktop. Then say: "Open door 7 of my Advent Agent calendar."' },
    codex: { label: 'Codex (desktop & CLI)', configPath: join(home, '.codex', 'config.toml'), format: 'toml', snippet: `[mcp_servers.advent-agent]\ncommand = ${JSON.stringify(command)}\nargs = ${JSON.stringify(args)}\n`, notes: 'Append to ~/.codex/config.toml.' },
    gemini: { label: 'Gemini CLI', configPath: join(home, '.gemini', 'settings.json'), format: 'json', snippet: jsonEntry, notes: 'Merge into ~/.gemini/settings.json under "mcpServers".' },
    cursor: { label: 'Cursor', configPath: join(home, '.cursor', 'mcp.json'), format: 'json', snippet: jsonEntry, notes: 'Merge into ~/.cursor/mcp.json.' },
    'claude-code': { label: 'Claude Code', format: 'command', snippet: `claude mcp add advent-agent -- ${JSON.stringify(command)} ${args.map((a) => JSON.stringify(a)).join(' ')}`, notes: 'Run once in a terminal.' },
    generic: { label: 'Any MCP client (stdio)', format: 'json', snippet: jsonEntry, notes: 'Stdio transport. The server starts the calendar companion if it is not running.' },
  };
}

export interface InstallResult {
  host: McpHostId;
  configPath?: string;
  existed: boolean;
  before: string;
  after: string;
  written: boolean;
  message: string;
}

/** Computes the new file content; writes it only when confirm is true. */
export function installMcpConfig(host: McpHostId, confirm: boolean): InstallResult {
  const snippets = mcpConfigSnippets();
  const s = snippets[host];
  if (!s) return { host, existed: false, before: '', after: '', written: false, message: 'Unknown host.' };
  if (!s.configPath) return { host, existed: false, before: '', after: s.snippet, written: false, message: 'This host has no config file to edit; run the command shown.' };
  const existed = existsSync(s.configPath);
  const before = existed ? readFileSync(s.configPath, 'utf8') : '';
  let after: string;
  const { command, args } = serverCommand();
  if (s.format === 'json') {
    let obj: Record<string, unknown> = {};
    if (before.trim()) {
      try { obj = JSON.parse(before) as Record<string, unknown>; } catch { return { host, configPath: s.configPath, existed, before, after: '', written: false, message: `${s.configPath} is not valid JSON; paste the snippet by hand.` }; }
    }
    const servers = (obj.mcpServers as Record<string, unknown> | undefined) ?? {};
    servers['advent-agent'] = { command, args };
    obj.mcpServers = servers;
    after = JSON.stringify(obj, null, 2) + '\n';
  } else {
    const block = s.snippet;
    if (/^\[mcp_servers\.advent-agent\]/m.test(before)) {
      after = before.replace(/\[mcp_servers\.advent-agent\][\s\S]*?(?=\n\[|$)/, block.trimEnd());
    } else {
      after = before.trimEnd() + (before.trim() ? '\n\n' : '') + block;
    }
  }
  if (!confirm) return { host, configPath: s.configPath, existed, before, after, written: false, message: 'Review the change and confirm to write it.' };
  mkdirSync(join(s.configPath, '..'), { recursive: true });
  writeFileSync(s.configPath, after);
  return { host, configPath: s.configPath, existed, before, after, written: true, message: `Written to ${s.configPath}. Restart ${s.label} to pick it up.` };
}
