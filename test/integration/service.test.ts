import { describe, expect, it } from 'vitest';
import { serviceDefinition, SERVICE_LABEL } from '../../src/jobs/service-install.js';

const input = { nodePath: '/usr/local/bin/node', binPath: '/opt/advent-agent/bin/advent-agent.js', homeDir: '/Users/test', homeRoot: '/Users/test/.advent-agent' } as const;

describe('service definitions (file output only)', () => {
  it('I5.1 launchd plist', () => {
    const d = serviceDefinition({ ...input, platform: 'darwin' });
    expect(d.path).toBe('/Users/test/Library/LaunchAgents/com.deskmenace.advent-agent.plist');
    expect(d.content).toContain(`<string>${SERVICE_LABEL}</string>`);
    expect(d.content).toContain('<string>/usr/local/bin/node</string>');
    expect(d.content).toContain('<string>/opt/advent-agent/bin/advent-agent.js</string>');
    expect(d.content).toContain('<string>start</string>');
    expect(d.content).toContain('<string>--no-open</string>');
    expect(d.content).toContain('<key>RunAtLoad</key>');
    expect(d.content).toContain('ADVENT_AGENT_HOME');
    expect(d.installCommand).toEqual(['launchctl', 'load', '-w', d.path]);
    expect(d.uninstallCommand[0]).toBe('launchctl');
  });
  it('I5.2 systemd --user unit', () => {
    const d = serviceDefinition({ ...input, platform: 'linux' });
    expect(d.path).toBe('/Users/test/.config/systemd/user/advent-agent.service');
    expect(d.content).toMatch(/^\[Unit\]/);
    expect(d.content).toContain('ExecStart=/usr/local/bin/node /opt/advent-agent/bin/advent-agent.js start --no-open');
    expect(d.content).toContain('Environment=ADVENT_AGENT_HOME=/Users/test/.advent-agent');
    expect(d.content).toContain('WantedBy=default.target');
    expect(d.installCommand).toEqual(['systemctl', '--user', 'enable', '--now', 'advent-agent.service']);
  });
  it('I5.3 Windows Task Scheduler XML', () => {
    const d = serviceDefinition({ ...input, platform: 'win32' });
    expect(d.path).toMatch(/task\.xml$/);
    expect(d.content).toContain('<LogonTrigger>');
    expect(d.content).toContain('<Command>/usr/local/bin/node</Command>');
    expect(d.content).toContain('&quot;start&quot; &quot;--no-open&quot;');
    expect(d.installCommand.slice(0, 2)).toEqual(['schtasks', '/Create']);
    expect(d.uninstallCommand.slice(0, 2)).toEqual(['schtasks', '/Delete']);
  });
  it('escapes paths with spaces and XML characters', () => {
    const d = serviceDefinition({ ...input, binPath: '/Users/t/My Apps/<x>/bin/advent-agent.js', platform: 'darwin' });
    expect(d.content).toContain('/Users/t/My Apps/&lt;x&gt;/bin/advent-agent.js');
    const l = serviceDefinition({ ...input, binPath: '/Users/t/My Apps/bin/advent-agent.js', platform: 'linux' });
    expect(l.content).toContain('"/Users/t/My Apps/bin/advent-agent.js"');
  });
});
