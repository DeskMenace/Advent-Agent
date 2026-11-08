/**
 * Per-user login service so scheduled mode can prepare gifts while no browser is open (ARCHITECTURE §3).
 * launchd LaunchAgent on macOS, systemd --user unit on Linux, Task Scheduler task on Windows.
 * Definitions are generated as files (tested); the real install shells out to the platform tool.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { binPath } from '../core/package-paths.js';

export const SERVICE_LABEL = 'com.deskmenace.advent-agent';

export interface ServiceDefinition {
  platform: 'darwin' | 'linux' | 'win32';
  path: string;
  content: string;
  installCommand: string[];
  uninstallCommand: string[];
  statusCommand: string[];
}

export interface ServiceInput {
  nodePath?: string;
  binPath?: string;
  homeRoot?: string;
  platform?: NodeJS.Platform;
  homeDir?: string;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function serviceDefinition(input: ServiceInput = {}): ServiceDefinition {
  const node = input.nodePath ?? process.execPath;
  const bin = input.binPath ?? binPath();
  const platform = input.platform ?? process.platform;
  const home = input.homeDir ?? homedir();
  const envHome = input.homeRoot ? input.homeRoot : undefined;
  const args = [bin, 'start', '--no-open'];

  if (platform === 'darwin') {
    const path = join(home, 'Library', 'LaunchAgents', `${SERVICE_LABEL}.plist`);
    const envBlock = envHome ? `\n  <key>EnvironmentVariables</key>\n  <dict>\n    <key>ADVENT_AGENT_HOME</key>\n    <string>${xmlEscape(envHome)}</string>\n  </dict>` : '';
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(node)}</string>
${args.map((a) => `    <string>${xmlEscape(a)}</string>`).join('\n')}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <dict>
    <key>SuccessfulExit</key>
    <false/>
  </dict>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${xmlEscape(join(home, 'Library', 'Logs', 'advent-agent.log'))}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(join(home, 'Library', 'Logs', 'advent-agent.log'))}</string>${envBlock}
</dict>
</plist>
`;
    return {
      platform: 'darwin',
      path,
      content,
      installCommand: ['launchctl', 'load', '-w', path],
      uninstallCommand: ['launchctl', 'unload', '-w', path],
      statusCommand: ['launchctl', 'list', SERVICE_LABEL],
    };
  }
  if (platform === 'win32') {
    const path = join(home, 'AppData', 'Local', 'advent-agent', 'task.xml');
    const arguments_ = args.map((a) => `"${a}"`).join(' ');
    const content = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Advent Agent companion (prepares scheduled gifts while you are logged in)</Description>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
    </LogonTrigger>
  </Triggers>
  <Settings>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <StartWhenAvailable>true</StartWhenAvailable>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>5</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${xmlEscape(node)}</Command>
      <Arguments>${xmlEscape(arguments_)}</Arguments>
    </Exec>
  </Actions>
</Task>
`;
    return {
      platform: 'win32',
      path,
      content,
      installCommand: ['schtasks', '/Create', '/TN', 'Advent Agent', '/XML', path, '/F'],
      uninstallCommand: ['schtasks', '/Delete', '/TN', 'Advent Agent', '/F'],
      statusCommand: ['schtasks', '/Query', '/TN', 'Advent Agent'],
    };
  }
  const path = join(home, '.config', 'systemd', 'user', 'advent-agent.service');
  const content = `[Unit]
Description=Advent Agent companion (prepares scheduled gifts)
After=network.target

[Service]
Type=simple
ExecStart=${[node, ...args].map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}
Restart=on-failure
RestartSec=30${envHome ? `\nEnvironment=ADVENT_AGENT_HOME=${envHome}` : ''}

[Install]
WantedBy=default.target
`;
  return {
    platform: 'linux',
    path,
    content,
    installCommand: ['systemctl', '--user', 'enable', '--now', 'advent-agent.service'],
    uninstallCommand: ['systemctl', '--user', 'disable', '--now', 'advent-agent.service'],
    statusCommand: ['systemctl', '--user', 'is-active', 'advent-agent.service'],
  };
}

export interface ServiceResult {
  ok: boolean;
  message: string;
  definition: ServiceDefinition;
}

export function installService(input: ServiceInput = {}): ServiceResult {
  const def = serviceDefinition(input);
  mkdirSync(join(def.path, '..'), { recursive: true });
  writeFileSync(def.path, def.content);
  if (def.platform === 'linux') spawnSync('systemctl', ['--user', 'daemon-reload'], { shell: false, encoding: 'utf8' });
  const r = spawnSync(def.installCommand[0]!, def.installCommand.slice(1), { shell: false, encoding: 'utf8', timeout: 30_000 });
  const ok = r.status === 0;
  return { ok, message: ok ? `Installed. The companion now starts when you log in (${def.path}).` : `Install failed: ${(r.stderr || r.stdout || r.error?.message || '').trim()}`, definition: def };
}

export function uninstallService(input: ServiceInput = {}): ServiceResult {
  const def = serviceDefinition(input);
  const r = spawnSync(def.uninstallCommand[0]!, def.uninstallCommand.slice(1), { shell: false, encoding: 'utf8', timeout: 30_000 });
  if (existsSync(def.path)) rmSync(def.path, { force: true });
  const ok = r.status === 0 || !existsSync(def.path);
  return { ok, message: ok ? 'Removed. The companion no longer starts at login.' : `Uninstall failed: ${(r.stderr || r.stdout || '').trim()}`, definition: def };
}

export function serviceStatus(input: ServiceInput = {}): { installed: boolean; running: boolean; detail: string; definition: ServiceDefinition } {
  const def = serviceDefinition(input);
  const installed = existsSync(def.path);
  const r = spawnSync(def.statusCommand[0]!, def.statusCommand.slice(1), { shell: false, encoding: 'utf8', timeout: 15_000 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  const running = r.status === 0 && (def.platform !== 'linux' || out.startsWith('active'));
  return { installed, running, detail: out.split('\n')[0] ?? '', definition: def };
}
