/**
 * "Share" export (DESK_MENACE_INTEGRATION §2): a standalone, privacy-checked HTML copy of a revealed gift,
 * with the Advent Agent mark (unless disabled in Settings). Nothing is uploaded; the user shares the file.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CalendarService } from '../jobs/service.js';
import { mimeFor } from '../intake/mime.js';
import { scanText } from '../intake/secrets.js';

export const SHARE_MARK_URL = 'https://deskmenace.com/advent?ref=aa-share';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function buildShareHtml(service: CalendarService, day: number, opts: { stripNote?: boolean } = {}): Promise<{ html: string; filename: string }> {
  const revealed = service.gift(day);
  const { gift } = revealed;
  const dir = service.store.home.giftDir(revealed.season, day);
  const m = gift.manifest;
  const title = m.title;
  const note = opts.stripNote ? '' : m.note;
  // Privacy check: the note and title must not carry secrets or home paths (defense in depth after the gate).
  const hits = scanText([title, note, m.subtitle ?? ''].join('\n'), { apiToken: service.store.apiToken() });
  if (hits.length) throw new Error('The text contains something that looks private; export was stopped.');

  let body = '';
  const primary = m.primary;
  const primaryMime = primary ? mimeFor(primary) : '';
  const dataUri = (rel: string) => {
    const data = readFileSync(join(dir, ...rel.split('/')));
    return `data:${mimeFor(rel)};base64,${data.toString('base64')}`;
  };
  if (gift.kind === 'interactive-html' && primary) {
    const html = readFileSync(join(dir, ...primary.split('/')), 'utf8');
    body = `<iframe sandbox="allow-scripts allow-pointer-lock" title="${esc(title)}" srcdoc="${esc(html)}" style="width:100%;height:70vh;border:0;background:#fff"></iframe>`;
  } else if (gift.kind === 'image' && primary) {
    body = `<img src="${dataUri(primary)}" alt="${esc(m.artifacts.find((a) => a.path === primary)?.alt ?? title)}" style="max-width:100%;height:auto;display:block;margin:0 auto">`;
  } else if (gift.kind === 'audio' && primary) {
    body = `<audio controls preload="metadata" src="${dataUri(primary)}" style="width:100%"></audio>`;
  } else if (gift.kind === 'video' && primary) {
    body = `<video controls playsinline preload="metadata" src="${dataUri(primary)}" style="max-width:100%;display:block;margin:0 auto"></video>`;
  } else if ((gift.kind === 'document' || gift.kind === 'card') && primary && (primaryMime === 'text/plain' || primaryMime === 'text/markdown')) {
    body = `<pre style="white-space:pre-wrap;font:17px/1.8 Georgia,serif;background:#fffaf1;padding:32px;border:1px solid #e5d2b5">${esc(readFileSync(join(dir, ...primary.split('/')), 'utf8'))}</pre>`;
  } else if (gift.kind === 'card' && primary && primaryMime === 'image/svg+xml') {
    body = `<img src="${dataUri(primary)}" alt="${esc(title)}" style="max-width:100%;height:auto;display:block;margin:0 auto">`;
  } else if (gift.kind === 'real-world' && m.realWorld) {
    body = `<ul style="list-style:none;padding:0">${m.realWorld.items.map((i) => `<li style="padding:14px 0;border-bottom:1px solid #e5d2b5"><strong>${esc(i.name)}</strong> · ${esc(i.vendor)}${i.price !== undefined ? ` · ${i.price} ${esc(i.currency ?? '')}` : ''} <small>(checked ${esc(i.checkedAt)})</small><br><a href="${esc(i.url)}" rel="noopener noreferrer" target="_blank">${esc(i.url)}</a>${i.notes ? `<br><em>${esc(i.notes)}</em>` : ''}</li>`).join('')}</ul><p><strong>What's left for you:</strong> ${esc(m.realWorld.whatsLeft)}</p><p><small>Prepared by an AI agent. Nothing has been ordered or booked.</small></p>`;
  } else if (gift.kind === 'link' && m.links?.length) {
    body = `<ul>${m.links.map((l) => `<li><a href="${esc(l.url)}" rel="noopener noreferrer" target="_blank">${esc(l.label)}</a></li>`).join('')}</ul>`;
  } else {
    body = `<p>This gift is a ${esc(gift.kind)} that cannot be embedded in a single page. The files travel with the calendar export.</p>`;
  }
  const mark = revealed.shareMark
    ? `<a class="mark" href="${SHARE_MARK_URL}" rel="noopener noreferrer" target="_blank">Made by my AI agent · Advent Agent</a>`
    : '';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{margin:0;background:#f7f2e9;color:#243a32;font-family:Arial,Helvetica,sans-serif}main{max-width:960px;margin:0 auto;padding:32px 20px 80px}.eyebrow{color:#a82438;font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:800;text-align:center}h1{font:400 clamp(36px,6vw,64px)/1.07 Georgia,serif;color:#0d3829;text-align:center;letter-spacing:-.04em;margin:12px 0 28px}.art{background:#ede0c9;border:12px solid #fffaf3;box-shadow:0 16px 45px #4739271b;padding:16px}.note{margin:28px auto 0;max-width:640px;padding:23px 22px;background:#f5ecdc;border-left:2px solid #cfa765;font:italic 17px/1.7 Georgia,serif;color:#53674c}.note span{display:block;font:800 10px Arial;letter-spacing:.12em;text-transform:uppercase;color:#a38969;margin-top:16px}.mark{position:fixed;right:14px;bottom:12px;font-size:11px;color:#766f62;text-decoration:none;background:#fffaf0;border:1px solid #dfd7c9;padding:6px 10px;border-radius:3px}</style></head>
<body><main><div class="eyebrow">December ${day}${m.category ? ` / ${esc(m.category)}` : ''}</div><h1>${esc(title)}</h1>${m.subtitle ? `<p style="text-align:center;color:#807568">${esc(m.subtitle)}</p>` : ''}<div class="art">${body}</div>${note ? `<div class="note">${esc(note).replace(/\n/g, '<br>')}<span>— my advent gift-maker</span></div>` : ''}</main>${mark}</body></html>`;
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'gift';
  return { html, filename: `advent-agent-day-${day}-${slug}.html` };
}
