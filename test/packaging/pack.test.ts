/** TEST_PLAN §5: npm pack → install in a clean temp dir → doctor and demo work; size budget; no browsers bundled. */
import { describe, expect, it } from 'vitest';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();

describe('packaging', () => {
  it('P1 + P2 + P3: pack, install clean, doctor and start work; first run asks for setup; ≤ 15 MB; no Chromium/ffmpeg inside', async () => {
    if (!existsSync(join(root, 'dist', 'ui', 'index.html'))) execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
    const packDir = mkdtempSync(join(tmpdir(), 'aa-pack-'));
    const out = execFileSync('npm', ['pack', '--pack-destination', packDir, '--json'], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
    const info = JSON.parse(out)[0] as { filename: string; size: number; files: Array<{ path: string }> };
    const tgz = join(packDir, info.filename);
    expect(statSync(tgz).size).toBeLessThanOrEqual(15 * 1024 * 1024);
    const paths = info.files.map((f) => f.path);
    expect(paths.some((p) => /chrom|ffmpeg|ffprobe|\.app\//i.test(p))).toBe(false);
    expect(paths).toEqual(expect.arrayContaining(['bin/advent-agent.js', 'dist/cli/main.js', 'dist/ui/index.html', 'schema/gift.schema.json', 'gift-library/INDEX.json', 'workshop/skills/gift-director/SKILL.md']));
    // D24: no user-facing demo, so the fixture gifts are not shipped.
    expect(paths.some((p) => p.startsWith('fixtures/'))).toBe(false);
    expect(paths.some((p) => p.startsWith('docs/') || p.startsWith('test/') || p.startsWith('src/') || p.startsWith('ui/'))).toBe(false);

    const installDir = mkdtempSync(join(tmpdir(), 'aa-install-'));
    execFileSync('npm', ['init', '-y'], { cwd: installDir, stdio: 'ignore', shell: process.platform === 'win32' });
    execFileSync('npm', ['install', '--no-audit', '--no-fund', tgz], { cwd: installDir, stdio: 'inherit', shell: process.platform === 'win32' });
    const bin = join(installDir, 'node_modules', '.bin', process.platform === 'win32' ? 'advent-agent.cmd' : 'advent-agent');
    expect(existsSync(bin)).toBe(true);
    const home = mkdtempSync(join(tmpdir(), 'aa-home-pack-'));
    const doctor = spawnSync(bin, ['doctor'], { cwd: installDir, encoding: 'utf8', env: { ...process.env, ADVENT_AGENT_HOME: home }, shell: process.platform === 'win32' });
    expect(doctor.status, doctor.stderr).toBe(0);
    expect(doctor.stdout).toMatch(/advent-agent \d/);
    expect(doctor.stdout).toMatch(/gary\.js: bundled/);
    expect(doctor.stdout).toMatch(/UI built: true/);
    expect(doctor.stdout).toMatch(/library: true/);
    const version = spawnSync(bin, ['version'], { cwd: installDir, encoding: 'utf8', shell: process.platform === 'win32' });
    expect(version.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);

    // start serves the calendar; a fresh home has no season and asks for setup (P3)
    const port = 4824;
    const child = spawn(bin, ['start', '--no-open', '--port', String(port), '--gift-port', String(port + 1)], { cwd: installDir, env: { ...process.env, ADVENT_AGENT_HOME: home }, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', (d) => (log += d));
    child.stderr.on('data', (d) => (log += d));
    try {
      const deadline = Date.now() + 60_000;
      let ok = false;
      while (Date.now() < deadline) {
        try { const r = await fetch(`http://127.0.0.1:${port}/`); if (r.ok && (await r.text()).includes('<div id="app">')) { ok = true; break; } } catch { /* wait */ }
        await new Promise((r) => setTimeout(r, 300));
      }
      expect(ok, log).toBe(true);
      const unauthorized = await fetch(`http://127.0.0.1:${port}/api/calendar`);
      expect(unauthorized.status).toBe(401);
      const token = (await import('node:fs')).readFileSync(join(home, 'api.token'), 'utf8').trim();
      const cal = await fetch(`http://127.0.0.1:${port}/api/calendar`, { headers: { authorization: `Bearer ${token}` } });
      const json = (await cal.json()) as { setupComplete: boolean; doors: Array<{ envelope: string }> };
      expect(json.setupComplete).toBe(false);
      expect(json.doors.every((d) => d.envelope === 'locked')).toBe(true);
      const demo = spawnSync(bin, ['demo'], { cwd: installDir, encoding: 'utf8', env: { ...process.env, ADVENT_AGENT_HOME: home }, shell: process.platform === 'win32' });
      expect(demo.status).not.toBe(0);
      expect(demo.stderr + demo.stdout).toMatch(/Unknown command: demo/);
    } finally {
      try { child.kill('SIGTERM'); } catch { /* gone */ }
      // A folder the started companion still holds (Windows) must not fail the test.
      for (const d of [packDir, installDir, home]) { try { rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* leave it for the OS temp cleaner */ } }
    }
  }, 600_000);

  it('the package manifest lists exactly the runtime folders', () => {
    const pkg = JSON.parse((require('node:fs') as typeof import('node:fs')).readFileSync(join(root, 'package.json'), 'utf8')) as { files: string[]; dependencies: Record<string, string> };
    expect(pkg.files).toEqual(expect.arrayContaining(['bin/', 'dist/', 'schema/', 'workshop/', 'gift-library/', 'README.md', 'THIRD_PARTY.md', 'LICENSE']));
    expect(pkg.files).not.toContain('fixtures/');
    expect(Object.keys(pkg.dependencies)).toContain('gary.js');
    expect(readdirSync(join(root, 'fixtures', 'gifts')).length).toBeGreaterThanOrEqual(10);
  });
});
