/**
 * App origin (127.0.0.1:4224): the UI, /api, SSE, gary.js assets. Every route checks Host and Origin;
 * /api requires the session cookie (UI) or a Bearer api.token (CLI, MCP, HTTP submissions).
 */
import { existsSync, readFileSync, statSync, createWriteStream, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, normalize, sep, extname } from 'node:path';
import { Hono, type Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { detectAll, getAdapter } from '../adapters/index.js';
import { garyPackageDir, packageVersion, UI_DIST_DIR, WORKSHOP_DIR, LIBRARY_DIR, AGENT_GUIDE_FILE } from '../core/package-paths.js';
import { deviceTimeZone, isValidTimeZone } from '../core/time.js';
import { mimeFor } from '../intake/mime.js';
import { findBrowser, installTestDriveBrowser } from '../intake/render.js';
import { ffprobePath } from '../intake/checks.js';
import { ApiError, type CalendarService } from '../jobs/service.js';
import { installService, serviceStatus, uninstallService } from '../jobs/service-install.js';
import { ConfigSchema, ProfileSchema, type Config } from '../shared/config.js';
import { InlineFileSchema, ProgressPhaseSchema } from '../shared/gift.js';
import type { GateInput } from '../intake/gate.js';
import { Auth } from './auth.js';
import { mcpConfigSnippets, installMcpConfig, type McpHostId } from '../mcp/hosts.js';
import { installSkills, uninstallSkills, skillTargets } from '../mcp/skills-install.js';
import { readIdeaIndex, readIdea, listWorkshop, readWorkshopGuide } from '../core/workshop.js';
import { setProviderKey, deleteProviderKey, keychainAvailable } from '../providers/keychain.js';
import { saveFile, saveOptions, shareInfo, shareLoop, shareStill, ShareError } from '../share/export.js';
import { labReviewSheet, saveLabReview } from '../lab/review.js';
import { buildReminderIcs } from '../core/reminder.js';

export interface AppDeps {
  service: CalendarService;
  auth: Auth;
  /** Called by `GET /api/shutdown` in test homes only. */
  onShutdown?: () => void;
}

const DaySchema = z.coerce.number().int().min(1).max(24);

export function createApp({ service, auth, onShutdown }: AppDeps): Hono {
  const app = new Hono();

  // --- Host / Origin guard on everything ----------------------------------------------------------
  app.use('*', async (c, next) => {
    if (!auth.hostOk(c.req.header('host'))) return c.text('Forbidden: unexpected Host', 403);
    if (!auth.originOk(c.req.header('origin'))) return c.text('Forbidden: unexpected Origin', 403);
    c.header('x-content-type-options', 'nosniff');
    c.header('referrer-policy', 'no-referrer');
    c.header('x-frame-options', 'DENY');
    await next();
  });

  // --- login exchange ----------------------------------------------------------------------------
  app.get('/auth', (c) => {
    const t = c.req.query('t');
    if (!auth.consumeLoginToken(t)) return c.html(loginHelpPage(), 401);
    c.header('set-cookie', auth.sessionCookieHeader());
    const to = c.req.query('to') ?? '/';
    return c.redirect(to.startsWith('/') && !to.startsWith('//') ? to : '/', 303);
  });

  // --- api auth ----------------------------------------------------------------------------------
  const api = new Hono();
  api.use('*', async (c, next) => {
    const bearer = auth.verifyBearer(c.req.header('authorization'));
    const cookie = auth.verifySessionCookie(c.req.header('cookie'));
    if (!bearer && !cookie) return c.json({ error: 'unauthorized', message: 'Open the calendar with `npx advent-agent` so this browser gets a session.' }, 401);
    c.set('authKind' as never, (bearer ? 'bearer' : 'cookie') as never);
    await next();
  });
  api.onError((err, c) => {
    if (err instanceof ApiError) return c.json({ error: err.code, message: err.message }, err.status as 400);
    if (err instanceof z.ZodError) return c.json({ error: 'invalid', message: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400);
    console.error(err);
    return c.json({ error: 'internal', message: 'Something went wrong inside the calendar.' }, 500);
  });

  // Session for the CLI: `advent-agent` with a running companion asks for a fresh login token.
  api.post('/auth/token', (c) => c.json({ token: auth.issueLoginToken() }));
  api.get('/whoami', (c) => c.json({ ok: true, version: packageVersion() }));

  // --- calendar ----------------------------------------------------------------------------------
  api.get('/calendar', (c) => c.json(service.calendar()));
  api.get('/events', (c) =>
    streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: 'calendar', data: JSON.stringify({ type: 'calendar' }) });
      let alive = true;
      const unsubscribe = service.events.onSse((ev) => { if (alive) void stream.writeSSE({ event: ev.type, data: JSON.stringify(ev) }); });
      const ping = setInterval(() => { if (alive) void stream.writeSSE({ event: 'ping', data: '{"type":"ping"}' }); }, 25_000);
      stream.onAbort(() => { alive = false; unsubscribe(); clearInterval(ping); });
      // Keep the handler open until the client goes away.
      await new Promise<void>((resolve) => { const check = setInterval(() => { if (!alive) { clearInterval(check); resolve(); } }, 1000); });
    }),
  );

  api.post('/doors/:day/open', (c) => c.json(service.open(DaySchema.parse(c.req.param('day')))));
  api.get('/doors/:day', (c) => {
    const day = DaySchema.parse(c.req.param('day'));
    const door = service.publicDoor(day);
    if (!door.eligible) throw new ApiError(423, 'locked', `Not yet! Door ${day} opens on December ${day}.`);
    return c.json(door);
  });
  api.post('/doors/:day/prepare', (c) => c.json(service.prepareEarly(DaySchema.parse(c.req.param('day')))));
  api.post('/doors/:day/retry', (c) => c.json(service.retry(DaySchema.parse(c.req.param('day')))));
  api.post('/doors/:day/cancel', (c) => c.json(service.cancel(DaySchema.parse(c.req.param('day')))));
  api.post('/doors/:day/reveal', (c) => c.json(service.reveal(DaySchema.parse(c.req.param('day')))));
  api.get('/doors/:day/gift', (c) => c.json(service.gift(DaySchema.parse(c.req.param('day')))));
  api.post('/doors/:day/feedback', async (c) => {
    const body = z.object({ reaction: z.enum(['loved_it', 'not_my_thing', 'too_personal']).optional(), note: z.string().max(2000).optional() }).parse(await c.req.json());
    return c.json(service.feedback(DaySchema.parse(c.req.param('day')), body));
  });
  api.post('/doors/:day/bought', async (c) => {
    const body = z.object({ bought: z.boolean(), note: z.string().max(500).optional() }).parse(await c.req.json());
    return c.json({ bought: service.markBought(DaySchema.parse(c.req.param('day')), body.bought, body.note) ?? null });
  });
  api.post('/doors/:day/network', async (c) => {
    const body = z.object({ origins: z.array(z.string().url()).max(10) }).parse(await c.req.json());
    return c.json({ allowed: service.consentNetwork(DaySchema.parse(c.req.param('day')), body.origins.map((o) => new URL(o).origin)) });
  });
  api.post('/doors/:day/submit', async (c) => {
    const day = DaySchema.parse(c.req.param('day'));
    const input = await gateInputFromRequest(c);
    return c.json(await service.submit(day, input, 'portable'));
  });

  // --- gifts shelf & archive ------------------------------------------------------------------------
  api.get('/gifts', (c) => c.json({ season: service.season()?.year ?? null, items: service.shelf() }));
  api.get('/archive', (c) => c.json({ seasons: service.archiveSeasons() }));
  api.get('/archive/:season', (c) => {
    const year = z.coerce.number().int().parse(c.req.param('season'));
    return c.json({ season: year, items: service.shelf(year) });
  });
  api.get('/archive/:season/:day', (c) => c.json(service.gift(DaySchema.parse(c.req.param('day')), z.coerce.number().int().parse(c.req.param('season')))));

  // --- settings & profile ------------------------------------------------------------------------------
  api.get('/settings', (c) => c.json(settingsView(service.config())));
  api.put('/settings', async (c) => {
    // Merge the raw patch onto the current config, then validate the whole thing: `.partial()` would re-apply
    // defaults for every missing key and silently reset settings.
    const raw = z.record(z.string(), z.unknown()).parse(await c.req.json());
    if (typeof raw.timeZone === 'string' && !isValidTimeZone(raw.timeZone)) throw new ApiError(400, 'bad_timezone', `${raw.timeZone} is not a known timezone.`);
    const cfg = service.store.saveConfig((cur) => {
      const merged = ConfigSchema.parse({ ...cur, ...raw });
      return { ...merged, providers: Array.isArray(raw.providers) ? merged.providers.map((p) => ({ ...p, hasKey: cur.providers.find((q) => q.id === p.id)?.hasKey ?? false })) : cur.providers };
    });
    service.updateSeasonFromConfig();
    service.events.emitSse({ type: 'calendar' });
    return c.json(settingsView(cfg));
  });
  api.post('/setup/complete', async (c) => {
    const raw = z.record(z.string(), z.unknown()).parse(await c.req.json().catch(() => ({})));
    const cfg = service.store.saveConfig((cur) => ConfigSchema.parse({ ...cur, ...raw, providers: cur.providers, setupComplete: true }));
    service.ensureSeason('live');
    service.updateSeasonFromConfig();
    // D15: Day 1 is made right after setup so door 1 opens instantly. A first install starts it when onboarding
    // (delivery + budget) is completed or dismissed, so the budget the user picks applies; a re-run of setup starts it now.
    if (cfg.onboardingDone) {
      try { service.prepareEarly(1); } catch (e) { console.error('day 1 preparation:', (e as Error).message); }
    }
    service.events.emitSse({ type: 'calendar' });
    return c.json(settingsView(cfg));
  });
  /** First-launch onboarding (handoff §0): save the choices (or the defaults when dismissed), then start Day 1. */
  api.post('/onboarding/complete', async (c) => {
    const raw = z.object({
      deliveryMode: z.enum(['on_demand', 'scheduled']).optional(),
      scheduleTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      unlockHour: z.number().int().min(0).max(23).optional(),
      generosity: z.enum(['light', 'standard', 'generous']).optional(),
    }).parse(await c.req.json().catch(() => ({})));
    const cfg = service.store.saveConfig((cur) => {
      const schedulable = cur.connection.mode === 'launched';
      return ConfigSchema.parse({
        ...cur,
        deliveryMode: schedulable ? (raw.deliveryMode ?? 'on_demand') : 'on_demand',
        scheduleTime: raw.scheduleTime ?? cur.scheduleTime,
        unlockHour: raw.unlockHour ?? cur.unlockHour,
        budgets: { ...cur.budgets, generosity: raw.generosity ?? 'standard' },
        onboardingDone: true,
      });
    });
    service.updateSeasonFromConfig();
    try { service.prepareEarly(1); } catch (e) { console.error('day 1 preparation:', (e as Error).message); }
    service.events.emitSse({ type: 'calendar' });
    return c.json(settingsView(cfg));
  });
  api.get('/profile', (c) => c.json(service.profile()));
  api.put('/profile', async (c) => {
    const raw = z.record(z.string(), z.unknown()).parse(await c.req.json());
    return c.json(service.store.saveProfile(ProfileSchema.parse({ ...service.profile(), ...raw })));
  });

  // --- setup helpers ---------------------------------------------------------------------------------------
  api.get('/setup/detect', async (c) => c.json({ adapters: await detectAll(), deviceTimeZone: deviceTimeZone(), platform: process.platform }));
  api.get('/doctor', async (c) => c.json(await doctor(service)));
  api.get('/mcp/config', (c) => c.json({ snippets: mcpConfigSnippets(), hosts: Object.keys(mcpConfigSnippets()) }));
  api.post('/mcp/install', async (c) => {
    const body = z.object({ host: z.string(), confirm: z.boolean().default(false) }).parse(await c.req.json());
    return c.json(installMcpConfig(body.host as McpHostId, body.confirm));
  });
  api.get('/skills/targets', (c) => c.json({ targets: skillTargets(service.config()) }));
  api.post('/skills/install', async (c) => {
    const body = z.object({ host: z.string(), confirm: z.boolean().default(false) }).parse(await c.req.json());
    const r = installSkills(body.host, body.confirm);
    if (r.installed) service.store.saveConfig((cur) => ({ ...cur, installedSkills: { ...cur.installedSkills, [body.host]: r.folder } }));
    return c.json(r);
  });
  api.post('/skills/uninstall', async (c) => {
    const body = z.object({ host: z.string() }).parse(await c.req.json());
    const r = uninstallSkills(body.host);
    service.store.saveConfig((cur) => { const next = { ...cur.installedSkills }; delete next[body.host]; return { ...cur, installedSkills: next }; });
    return c.json(r);
  });
  api.get('/service', (c) => c.json(serviceStatus({ homeRoot: process.env.ADVENT_AGENT_HOME })));
  api.post('/service/install', (c) => c.json(installService({ homeRoot: process.env.ADVENT_AGENT_HOME })));
  api.post('/service/uninstall', (c) => c.json(uninstallService({ homeRoot: process.env.ADVENT_AGENT_HOME })));
  api.post('/testdrive/install', async (c) => {
    const lines: string[] = [];
    const r = await installTestDriveBrowser((l) => lines.push(l));
    if (r.ok) service.store.saveConfig({ testDrive: { enabled: true } });
    return c.json({ ...r, lines: lines.slice(-20) });
  });
  api.post('/providers/:id/key', async (c) => {
    const body = z.object({ key: z.string().min(1).max(4000) }).parse(await c.req.json());
    const id = c.req.param('id');
    const r = await setProviderKey(id, body.key);
    if (r.ok) service.store.saveConfig((cur) => ({ ...cur, providers: cur.providers.map((p) => (p.id === id ? { ...p, hasKey: true } : p)) }));
    return c.json(r);
  });
  api.delete('/providers/:id/key', async (c) => {
    const id = c.req.param('id');
    const r = await deleteProviderKey(id);
    service.store.saveConfig((cur) => ({ ...cur, providers: cur.providers.map((p) => (p.id === id ? { ...p, hasKey: false } : p)) }));
    return c.json(r);
  });
  api.get('/providers/keychain', async (c) => c.json({ available: await keychainAvailable() }));

  // --- export / import / backup ---------------------------------------------------------------------------
  api.post('/export', async (c) => {
    const dir = join(tmpdir(), 'advent-agent-export');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `advent-agent-export-${Date.now()}.zip`);
    const r = await service.store.exportZip(file);
    const data = readFileSync(file);
    return c.body(data, 200, { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="advent-agent-${service.season()?.year ?? 'calendar'}.zip"`, 'x-files': String(r.files) });
  });
  api.post('/import', async (c) => {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) throw new ApiError(400, 'no_file', 'Send the export zip as "file".');
    const tmp = join(tmpdir(), `advent-agent-import-${Date.now()}.zip`);
    await new Promise<void>((res, rej) => { const ws = createWriteStream(tmp); file.stream().pipeTo(new WritableStream({ write(ch) { ws.write(Buffer.from(ch)); }, close() { ws.end(res); }, abort: rej })).catch(rej); });
    const r = await service.store.importZip(tmp);
    service.events.emitSse({ type: 'calendar' });
    return c.json(r);
  });
  api.get('/reminder.ics', (c) => {
    const season = service.season();
    const cfg = service.config();
    const ics = buildReminderIcs({ year: season?.year ?? new Date().getFullYear(), timeZone: season?.timeZone ?? cfg.timeZone, unlockHour: season?.unlockHour ?? cfg.unlockHour, url: `http://127.0.0.1:${service.appPort}/` });
    return c.body(ics, 200, { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'attachment; filename="advent-agent-doors.ics"' });
  });
  api.post('/backup', (c) => c.json({ folder: service.store.backup('manual') }));
  api.get('/share/:day/preview', (c) => c.json(shareInfo(service, DaySchema.parse(c.req.param('day')))));
  const shareOpts = (c: Context) => ({ blur: c.req.query('blur') === '1' });
  const shareFail = (c: Context, e: unknown) => {
    if (e instanceof ShareError) return c.json({ error: e.code, message: e.message }, 409);
    throw e;
  };
  api.get('/share/:day/still', async (c) => {
    const day = DaySchema.parse(c.req.param('day'));
    try {
      const r = await shareStill(service, day, shareOpts(c));
      return c.body(new Uint8Array(r.data), 200, { 'content-type': r.mime, 'content-disposition': `attachment; filename="advent-day-${day}.${r.mime === 'image/png' ? 'png' : r.mime.split('/')[1]}"` });
    } catch (e) { return shareFail(c, e); }
  });
  api.get('/share/:day/loop', async (c) => {
    const day = DaySchema.parse(c.req.param('day'));
    const format = (['mp4', 'gif', 'webm'] as const).find((f) => f === c.req.query('format'));
    try {
      const r = await shareLoop(service, day, { ...shareOpts(c), format });
      return c.body(new Uint8Array(r.data), 200, { 'content-type': r.mime, 'content-disposition': `attachment; filename="advent-day-${day}.${r.ext}"` });
    } catch (e) { return shareFail(c, e); }
  });
  api.get('/share/:day/download', (c) => {
    const day = DaySchema.parse(c.req.param('day'));
    const g = service.gift(day);
    const file = c.req.query('file') ?? '';
    if (!g.gift.files.some((f) => f.path === file)) throw new ApiError(404, 'not_found', 'No such file in this gift.');
    return serveFile(c, service.store.home.giftDir(g.season, day), file, { 'content-disposition': `attachment; filename="${file.split('/').pop()!.replace(/"/g, '')}"` });
  });
  // Save (D26): the gift itself in its natural format.
  api.get('/save/:day', (c) => c.json({ options: saveOptions(service, DaySchema.parse(c.req.param('day'))) }));
  api.get('/save/:day/file', async (c) => {
    const day = DaySchema.parse(c.req.param('day'));
    try {
      const r = await saveFile(service, day, c.req.query('id') ?? 'gift');
      return c.body(new Uint8Array(r.data), 200, { 'content-type': r.mime, 'content-disposition': `attachment; filename="${r.filename.replace(/"/g, '')}"` });
    } catch (e) { return shareFail(c, e); }
  });

  // --- demo & lab -----------------------------------------------------------------------------------
  api.post('/demo/day', async (c) => {
    const body = z.object({ day: z.number().int().min(0).max(24) }).parse(await c.req.json());
    service.setDemoDay(body.day);
    return c.json(service.calendar());
  });
  api.get('/lab/review', (c) => c.json(labReviewSheet(service)));
  api.post('/lab/review', async (c) => c.json(saveLabReview(service, await c.req.json())));
  api.get('/shutdown', (c) => {
    if (!onShutdown) throw new ApiError(404, 'not_found', 'Not available.');
    setTimeout(onShutdown, 50);
    return c.json({ ok: true });
  });

  // --- workshop / library (also used by MCP) ---------------------------------------------------------
  api.get('/workshop', (c) => c.json({ skills: listWorkshop() }));
  api.get('/workshop/:skill', (c) => {
    const text = readWorkshopGuide(c.req.param('skill'), c.req.query('file'));
    if (text === undefined) throw new ApiError(404, 'not_found', 'No such skill or file.');
    return c.text(text);
  });
  api.get('/ideas', (c) => c.json(readIdeaIndex(c.req.query('q'))));
  api.get('/ideas/:id', (c) => {
    const text = readIdea(c.req.param('id'));
    if (text === undefined) throw new ApiError(404, 'not_found', 'No such idea.');
    return c.text(text);
  });

  // --- agent-facing (bearer or cookie) -------------------------------------------------------------------
  api.get('/agent/context', (c) => {
    const day = c.req.query('day') ? DaySchema.parse(c.req.query('day')) : undefined;
    const mode = c.req.query('mode') as 'launched' | 'connected' | 'portable' | 'submit' | undefined;
    return c.json(service.agentContext(day, mode));
  });
  api.post('/agent/progress', async (c) => {
    const body = z.object({ day: DaySchema, phase: ProgressPhaseSchema }).parse(await c.req.json());
    service.progress(body.day, body.phase);
    return c.json({ ok: true });
  });
  api.post('/agent/start', async (c) => {
    const body = z.object({ day: DaySchema }).parse(await c.req.json());
    return c.json(service.startGift(body.day));
  });
  api.post('/agent/check', async (c) => {
    const input = await gateInputFromRequest(c);
    const day = c.req.query('day') ? DaySchema.parse(c.req.query('day')) : undefined;
    return c.json(await service.check(input, day));
  });
  api.post('/agent/submit', async (c) => {
    const input = await gateInputFromRequest(c);
    const day = DaySchema.parse(c.req.query('day') ?? (c.req.header('content-type')?.includes('json') ? ((await c.req.json().catch(() => ({}))) as { day?: number }).day : undefined));
    const mode = (c.req.query('mode') as 'launched' | 'connected' | 'portable' | 'submit' | undefined) ?? 'submit';
    return c.json(await service.submit(day, input, mode, c.req.query('adapter') ?? undefined));
  });

  api.post('/agent/generate', async (c) => {
    const body = z.object({ provider: z.string(), op: z.enum(['generateImage', 'generateAudio', 'synthesizeSpeech', 'generateVideo']), params: z.record(z.string(), z.unknown()).default({}), day: DaySchema }).parse(await c.req.json());
    return c.json(await service.generate(body.provider, body.op, body.params, body.day));
  });
  api.get('/agent/providers', (c) => c.json({ providers: service.config().providers.filter((p) => p.enabled).map((p) => ({ id: p.id, kind: p.kind, label: p.label, paidUse: p.paidUse, capPerGift: p.capPerGift })) }));

  app.route('/api', api);

  // --- gary.js from the installed package (never a CDN) ----------------------------------------------------
  app.get('/vendor/gary/*', (c) => {
    const dir = garyPackageDir();
    if (!dir) return c.text('gary.js is not installed', 404);
    const rel = c.req.path.slice('/vendor/gary/'.length);
    return serveFile(c, dir, rel, { 'cache-control': 'public, max-age=86400' });
  });

  // --- public docs for agents -------------------------------------------------------------------------------
  app.get('/agent-guide.md', (c) => (existsSync(AGENT_GUIDE_FILE) ? c.text(readFileSync(AGENT_GUIDE_FILE, 'utf8')) : c.text('missing', 404)));
  app.get('/schema/gift.schema.json', (c) => serveFile(c, join(WORKSHOP_DIR, '..', 'schema'), 'gift.schema.json'));
  app.get('/library/*', (c) => serveFile(c, LIBRARY_DIR, c.req.path.slice('/library/'.length)));

  // --- UI (SPA) -------------------------------------------------------------------------------------------
  app.get('*', (c) => {
    const rel = c.req.path.replace(/^\/+/, '');
    if (rel && !rel.startsWith('api/') && existsSync(join(UI_DIST_DIR, ...rel.split('/'))) && statSync(join(UI_DIST_DIR, ...rel.split('/'))).isFile()) {
      return serveFile(c, UI_DIST_DIR, rel, { 'cache-control': rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' });
    }
    const index = join(UI_DIST_DIR, 'index.html');
    if (!existsSync(index)) return c.html(missingUiPage(), 200);
    return c.html(readFileSync(index, 'utf8'), 200, { 'cache-control': 'no-cache', 'content-security-policy': appCsp(service) });
  });

  return app;
}

function appCsp(service: CalendarService): string {
  const gift = `http://127.0.0.1:${service.giftPort}`;
  return [
    `default-src 'self'`,
    `script-src 'self'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${gift}`,
    `media-src 'self' blob: ${gift}`,
    `font-src 'self' data:`,
    `connect-src 'self' ${gift}`,
    `frame-src ${gift}`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
  ].join('; ');
}

function serveFile(c: Context, root: string, rel: string, extra: Record<string, string> = {}) {
  const decoded = decodeURIComponent(rel).replace(/^\/+/, '');
  if (!decoded || decoded.split('/').some((s) => s === '..' || s === '')) return c.text('Bad path', 400);
  const file = normalize(join(root, ...decoded.split('/')));
  if (!file.startsWith(normalize(root) + sep) || !existsSync(file) || !statSync(file).isFile()) return c.text('Not found', 404);
  const data = readFileSync(file);
  const mime = mimeFor(file);
  const ct = mime.startsWith('text/') || mime === 'application/json' || mime === 'image/svg+xml' ? `${mime}; charset=utf-8` : mime;
  return c.body(data, 200, { 'content-type': extname(file) === '.md' ? 'text/markdown; charset=utf-8' : ct, 'content-length': String(data.length), ...extra });
}

async function gateInputFromRequest(c: Context): Promise<GateInput> {
  const ct = c.req.header('content-type') ?? '';
  if (ct.includes('multipart/form-data')) {
    const body = await c.req.parseBody({ all: true });
    const entries: Array<{ name: string; data: Buffer }> = [];
    for (const [key, value] of Object.entries(body)) {
      const values = Array.isArray(value) ? value : [value];
      for (const v of values) {
        if (v instanceof File) entries.push({ name: (v as File & { webkitRelativePath?: string }).webkitRelativePath || v.name, data: Buffer.from(await v.arrayBuffer()) });
        else if (key === 'text' && typeof v === 'string' && v.trim()) return { type: 'text', text: v, title: typeof body.title === 'string' ? body.title : undefined };
      }
    }
    if (entries.length === 0) throw new ApiError(400, 'empty', 'No files were sent.');
    if (entries.length === 1 && entries[0]!.name.toLowerCase().endsWith('.zip')) return { type: 'files', entries };
    return { type: 'files', entries };
  }
  const json = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof json.path === 'string') {
    if (!existsSync(json.path)) throw new ApiError(400, 'not_found', `${json.path} does not exist on this computer.`);
    return statSync(json.path).isDirectory() ? { type: 'folder', path: json.path } : { type: 'file', file: json.path };
  }
  if (typeof json.text === 'string') return { type: 'text', text: json.text, title: typeof json.title === 'string' ? json.title : undefined };
  if (Array.isArray(json.files)) {
    const files = z.array(InlineFileSchema).min(1).max(200).parse(json.files);
    return { type: 'files', entries: files.map((f) => ({ name: f.name, data: f.base64 !== undefined ? Buffer.from(f.base64, 'base64') : Buffer.from(f.text ?? '', 'utf8') })) };
  }
  throw new ApiError(400, 'bad_submission', 'Send multipart files, or JSON with "path", "text" or "files".');
}

export function settingsView(cfg: Config) {
  return { ...cfg, providers: cfg.providers.map((p) => ({ ...p })) };
}

export async function doctor(service: CalendarService) {
  const adapters = await detectAll();
  const browser = await findBrowser();
  const gary = garyPackageDir();
  const cfg = service.config();
  const adapter = cfg.connection.adapter ? getAdapter(cfg.connection.adapter) : undefined;
  return {
    version: packageVersion(),
    node: process.version,
    platform: process.platform,
    home: service.store.home.root,
    ports: { app: service.appPort, gift: service.giftPort },
    season: service.season() ?? null,
    setupComplete: cfg.setupComplete,
    connection: cfg.connection,
    configuredAdapter: adapter ? { id: adapter.id, label: adapter.label, capabilities: adapter.capabilities() } : null,
    adapters,
    browser: browser ? browser.label : null,
    ffprobe: ffprobePath() ?? null,
    gary: gary ? 'bundled' : 'missing',
    uiBuilt: existsSync(join(UI_DIST_DIR, 'index.html')),
    workshop: existsSync(WORKSHOP_DIR),
    library: existsSync(join(LIBRARY_DIR, 'INDEX.json')),
    keychain: await keychainAvailable(),
  };
}

function loginHelpPage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Advent Agent</title><style>body{font-family:Georgia,serif;background:#f7f2e9;color:#243a32;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:520px;padding:32px;background:#fffaf0;border:1px solid #dfd7c9;border-radius:6px}code{background:#efe7d8;padding:2px 6px;border-radius:3px}</style></head><body><main><h1>Almost there</h1><p>This browser has no session for your calendar yet. In a terminal, run:</p><p><code>npx advent-agent</code></p><p>It opens the calendar with a fresh one-time link. The link is only valid for two minutes and only on this computer.</p></main></body></html>`;
}

function missingUiPage(): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Advent Agent</title></head><body style="font-family:Georgia,serif;background:#f7f2e9;color:#243a32;padding:40px"><h1>The calendar UI is not built</h1><p>Run <code>npm run build</code> in the repository, or install the published package.</p></body></html>`;
}
