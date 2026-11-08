/**
 * Gift origin (127.0.0.1:4225): serves sealed gift files only, under per-process random tokens,
 * with a strict CSP, no cookies and CORP. Download-only files are never served inline.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, normalize, sep } from 'node:path';
import { Hono } from 'hono';
import { giftOriginHeaders } from '../intake/headers.js';
import { mimeFor } from '../intake/mime.js';
import type { CalendarService } from '../jobs/service.js';

export function createGiftApp(service: CalendarService): Hono {
  const app = new Hono();
  const appOrigin = `http://127.0.0.1:${service.appPort}`;
  const allowedHosts = new Set([`127.0.0.1:${service.giftPort}`, `localhost:${service.giftPort}`]);

  app.use('*', async (c, next) => {
    const host = c.req.header('host')?.toLowerCase();
    if (!host || !allowedHosts.has(host)) return c.text('Forbidden', 403);
    await next();
  });

  app.get('/g/:token/*', (c) => {
    const token = c.req.param('token');
    const resolved = service.resolveGiftToken(token);
    if (!resolved) return c.text('Not found', 404);
    const rel = decodeURIComponent(c.req.path.slice(`/g/${token}/`.length)).replace(/^\/+/, '') || 'index.html';
    if (rel.split('/').some((s) => s === '..' || s === '')) return c.text('Bad path', 400);
    const file = normalize(join(resolved.dir, ...rel.split('/')));
    if (!file.startsWith(resolved.dir + sep) || !existsSync(file) || !statSync(file).isFile()) return c.text('Not found', 404);
    if (rel.startsWith('.advent/') && rel !== '.advent/thumbnail.png') return c.text('Not found', 404);
    const record = resolved.state.gift!.files.find((f) => f.path === rel);
    const data = readFileSync(file);
    const consented = resolved.state.gift!.networkConsent;
    const headers: Record<string, string> = {
      ...giftOriginHeaders(`${appOrigin} http://localhost:${service.appPort}`, consented),
      'content-length': String(data.length),
      'access-control-allow-origin': appOrigin,
      vary: 'Origin',
    };
    if (record?.downloadOnly) {
      headers['content-type'] = 'application/octet-stream';
      headers['content-disposition'] = `attachment; filename="${rel.split('/').pop()!.replace(/"/g, '')}"`;
    } else {
      headers['content-type'] = contentTypeFor(rel);
    }
    if (c.req.query('download') !== undefined) headers['content-disposition'] = `attachment; filename="${rel.split('/').pop()!.replace(/"/g, '')}"`;
    return c.body(data, 200, headers);
  });

  app.options('/g/:token/*', (c) => c.body(null, 204, { 'access-control-allow-origin': appOrigin, 'access-control-allow-methods': 'GET', 'access-control-allow-headers': 'Range' }));

  app.notFound((c) => c.text('Not found', 404));
  return app;
}

function contentTypeFor(rel: string): string {
  const m = mimeFor(rel);
  if (m.startsWith('text/') || m === 'application/json' || m === 'image/svg+xml') return `${m}; charset=utf-8`;
  return m;
}
