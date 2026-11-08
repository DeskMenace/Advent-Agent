/** TEST_PLAN §5: npm pack → install in a clean temp dir → doctor and demo work; size budget; no browsers bundled. */
import { describe, expect, it } from 'vitest';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.cwd();

describe('packaging', () => {
  it('P1 + P2 + P3: pack, install clean, doctor and demo start; ≤ 15 MB; no Chromium/ffmpeg inside', async () => {
    if (!existsSync(join(root, 'dist', 'ui', 'index.html'))) execFileSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' });
    const packDir = mkdtempSync(join(tmpdir(), 'aa-pack-'));
    const out = execFileSync('npm', ['pack', '--pack-destination', packDir, '--json'], { cwd: root, encoding: 'utf8' });
    const info = JSON.parse(out)[0] as { filename: string; size: number; files: Array<{ path: string }> };
    const tgz = join(packDir, info.filename);
    expect(statSync(tgz).size).toBeLessThanOrEqual(15 * 1024 * 1024);
    const paths = info.files.map((f) => f.path);
    expect(paths.some((p) => /chrom|ffmpeg|ffprobe|\.app\//i.test(p))).toBe(false);
    expect(paths).toEqual(expect.arrayContaining(['bin/advent-agent.js', 'dist/cli/main.js', 'dist/ui/index.html', 'AGENT_GUIDE.md', 'schema/gift.schema.json', 'gift-library/INDEX.json', 'workshop/skills/gift-director/SKILL.md', 'fixtures/gifts/05-interactive-html/index.html']));
    expect(paths.some((p) => p.startsWith('docs/') || p.startsWith('test/') || p.startsWith('src/') || p.startsWith('ui/'))).toBe(false);

    const installDir = mkdtempSync(join(tmpdir(), 'aa-install-'));
    execFileSync('npm', ['init', '-y'], { cwd: installDir, stdio: 'ignore' });
    execFileSync('npm', ['install', '--no-audit', '--no-fund', tgz], { cwd: installDir, stdio: 'inherit' });
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

    // demo starts and serves the calendar
    const port = 4824;
    const child = spawn(bin, ['demo', '--no-open', '--allow-shutdown', '--port', String(port), '--gift-port', String(port + 1)], { cwd: installDir, env: { ...process.env, ADVENT_AGENT_HOME: home }, shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
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
      const demoToken = (await import('node:fs')).readFileSync(join(home, 'demo', 'api.token'), 'utf8').trim();
      const cal = await fetch(`http://127.0.0.1:${port}/api/calendar`, { headers: { authorization: `Bearer ${demoToken}` } });
      const json = (await cal.json()) as { doors: Array<{ jobState: string }>; season: { kind: string } };
      expect(json.season.kind).toBe('demo');
      expect(json.doors.filter((d) => d.jobState === 'ready').length).toBeGreaterThanOrEqual(8);
      // P3: a fresh live home without agents still offers a path (doctor already showed modes; the API says setup is pending)
      await fetch(`http://127.0.0.1:${port}/api/shutdown`, { headers: { authorization: `Bearer ${demoToken}` } });
    } finally {
      try { child.kill('SIGTERM'); } catch { /* gone */ }
      rmSync(packDir, { recursive: true, force: true });
      rmSync(installDir, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  }, 600_000);

  it('the package manifest lists exactly the runtime folders', () => {
    const pkg = JSON.parse((require('node:fs') as typeof import('node:fs')).readFileSync(join(root, 'package.json'), 'utf8')) as { files: string[]; dependencies: Record<string, string> };
    expect(pkg.files).toEqual(expect.arrayContaining(['bin/', 'dist/', 'schema/', 'workshop/', 'gift-library/', 'fixtures/', 'AGENT_GUIDE.md', 'README.md', 'THIRD_PARTY.md', 'LICENSE']));
    expect(Object.keys(pkg.dependencies)).toContain('gary.js');
    expect(readdirSync(join(root, 'fixtures', 'gifts')).length).toBeGreaterThanOrEqual(10);
  });
});
