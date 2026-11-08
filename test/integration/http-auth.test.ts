import { afterEach, describe, expect, it } from 'vitest';
import http from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCli, testCompanion, type TestCompanion } from '../helpers/companion.js';

let t: TestCompanion;
afterEach(async () => { await t?.close(); });

describe('HTTP auth, Host and Origin checks', () => {
  it('I3.1 mutating and reading /api without a token or cookie → 401; with cookie → 200; with token → 200', async () => {
    t = await testCompanion({ config: { connection: { mode: 'portable', permissive: false } } });
    const none = await fetch(`${t.appUrl}/api/calendar`);
    expect(none.status).toBe(401);
    const post = await fetch(`${t.appUrl}/api/doors/8/open`, { method: 'POST' });
    expect(post.status).toBe(401);
    const cookie = await fetch(`${t.appUrl}/api/calendar`, { headers: { cookie: t.cookie } });
    expect(cookie.status).toBe(200);
    const bearer = await fetch(`${t.appUrl}/api/calendar`, { headers: { authorization: `Bearer ${t.token}` } });
    expect(bearer.status).toBe(200);
    const bad = await fetch(`${t.appUrl}/api/calendar`, { headers: { authorization: 'Bearer nope' } });
    expect(bad.status).toBe(401);
    const forged = await fetch(`${t.appUrl}/api/calendar`, { headers: { cookie: 'aa_session=9999999999999.forged' } });
    expect(forged.status).toBe(401);
  });

  it('the one-time login link sets an HttpOnly SameSite=Strict cookie and works once', async () => {
    t = await testCompanion();
    const url = t.companion.loginUrl('/settings');
    const r = await fetch(url, { redirect: 'manual' });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('/settings');
    const setCookie = r.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/HttpOnly/);
    expect(setCookie).toMatch(/SameSite=Strict/);
    const again = await fetch(url, { redirect: 'manual' });
    expect(again.status).toBe(401);
    // The token never appears in the API responses.
    const cal = await fetch(`${t.appUrl}/api/calendar`, { headers: { cookie: setCookie.split(';')[0]! } });
    expect(cal.status).toBe(200);
    expect(await cal.text()).not.toContain(t.token);
  });

  it('I3.2 a DNS-rebinding style Host is rejected on both origins', async () => {
    t = await testCompanion();
    const port = Number(new URL(t.appUrl).port);
    const giftPort = Number(new URL(t.giftUrl).port);
    // fetch() refuses to override Host, so use node:http which sends whatever we say (like a rebinding browser would).
    const raw = (p: number, path: string, host: string, headers: Record<string, string> = {}) => new Promise<number>((res, rej) => {
      const req = http.request({ host: '127.0.0.1', port: p, path, method: 'GET', headers: { host, ...headers } }, (r) => { r.resume(); res(r.statusCode ?? 0); });
      req.on('error', rej); req.end();
    });
    for (const host of ['evil.com', `evil.com:${port}`, `127.0.0.1.evil.com:${port}`, '0.0.0.0:' + port]) {
      expect(await raw(port, '/api/calendar', host, { authorization: `Bearer ${t.token}` }), host).toBe(403);
      expect(await raw(port, '/', host), host).toBe(403);
    }
    expect(await raw(giftPort, '/g/x/index.html', 'evil.com')).toBe(403);
    expect(await raw(port, '/api/calendar', `localhost:${port}`, { authorization: `Bearer ${t.token}` })).toBe(200);
  });

  it('I3.3 a cross-origin Origin header is rejected even with valid credentials', async () => {
    t = await testCompanion();
    const r = await fetch(`${t.appUrl}/api/doors/8/open`, { method: 'POST', headers: { origin: 'http://evil.example', authorization: `Bearer ${t.token}` } });
    expect(r.status).toBe(403);
    const nullOrigin = await fetch(`${t.appUrl}/api/calendar`, { headers: { origin: 'null', authorization: `Bearer ${t.token}` } });
    expect(nullOrigin.status).toBe(403);
    const ok = await fetch(`${t.appUrl}/api/calendar`, { headers: { origin: t.appUrl, authorization: `Bearer ${t.token}` } });
    expect(ok.status).toBe(200);
  });

  it('I3.4 the CLI submits with the token and fails without it', async () => {
    t = await testCompanion({ config: { connection: { mode: 'submit', permissive: false } } });
    const gift = join(t.home, 'cli-gift');
    mkdirSync(gift);
    writeFileSync(join(gift, 'gift.json'), JSON.stringify({ schema: 'advent-agent/gift@1', day: 3, title: 'CLI gift', note: 'Sent from the command line.', primary: 'poem.md', artifacts: [{ path: 'poem.md', kind: 'document' }] }));
    writeFileSync(join(gift, 'poem.md'), '# Poem\n\nSnow, quietly.');
    const env = { ADVENT_AGENT_HOME: t.home, ADVENT_AGENT_URL: t.appUrl };
    const bad = await runCli(['submit', gift, '--day', '3', '--json'], { ...env, ADVENT_AGENT_TOKEN: 'wrong' });
    expect(bad.status).toBe(1);
    const good = await runCli(['submit', gift, '--day', '3', '--json'], env);
    expect(good.status, good.stderr).toBe(0);
    expect(JSON.parse(good.stdout).ok).toBe(true);
    const door = await t.api<{ jobState: string }>('GET', '/api/doors/3');
    expect(door.data.jobState).toBe('ready');
    // check and progress from the CLI
    const check = await runCli(['check', gift, '--day', '3', '--json', '--no-render'], env);
    expect(JSON.parse(check.stdout).ok).toBe(true);
    await t.api('POST', '/api/doors/4/open');
    const prog = await runCli(['progress', 'making', '--day', '4'], env);
    expect(prog.status, prog.stderr).toBe(0);
    expect((await t.api<{ phase: string }>('GET', '/api/doors/4')).data.phase).toBe('making');
  });

  it('the gift origin serves only revealed gifts under unguessable tokens, with CSP and CORP headers', async () => {
    t = await testCompanion({ config: { connection: { mode: 'portable', permissive: false } } });
    await t.api('POST', '/api/doors/8/open');
    const sub = await t.api<{ ok: boolean }>('POST', '/api/doors/8/submit', { text: '# Hello\n\nA letter.' });
    expect(sub.data.ok).toBe(true);
    const guess = await fetch(`${t.giftUrl}/g/2026-08-anything/gift.md`);
    expect(guess.status).toBe(404);
    const revealed = await t.api<{ baseUrl: string }>('POST', '/api/doors/8/reveal');
    const file = await fetch(`${revealed.data.baseUrl}/gift.md`);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-security-policy')).toMatch(/frame-ancestors http:\/\/127\.0\.0\.1:/);
    expect(file.headers.get('content-security-policy')).toMatch(/connect-src 'none'/);
    expect(file.headers.get('cross-origin-resource-policy')).toBe('same-site');
    expect(file.headers.get('set-cookie')).toBeNull();
    expect(await file.text()).toContain('A letter.');
    const traversal = await fetch(`${revealed.data.baseUrl}/../../state.json`);
    expect([400, 404]).toContain(traversal.status);
    const sealedManifest = await fetch(`${revealed.data.baseUrl}/.advent/manifest.sealed.json`);
    expect(sealedManifest.status).toBe(404);
  });
});
