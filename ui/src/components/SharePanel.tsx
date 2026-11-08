/**
 * Share panel (D20, D21): privacy preview first, then Share (Web Share API with files where supported),
 * Download still / loop / standalone file, print files. Nothing is uploaded by the calendar.
 * When the companion could not stamp a file (no Chrome/Edge on this machine), the mark is added here.
 */
import { useEffect, useState } from 'preact/hooks';
import { saveBlob } from '../api.js';
import { copyText, toast } from '../lib/ui.js';

const MARK_TEXT = 'Made by my Advent Agent · more gifts at deskmenace.com';

interface ShareInfo {
  title: string;
  note: string;
  caption: string;
  privateText: string[];
  kind: string;
  shareMark: boolean;
  browser: boolean;
  ffmpeg: boolean;
  still: 'capture' | 'file' | 'unavailable';
  loop: 'capture' | 'file' | 'none';
  loopDurationMs?: number;
  downloads: Array<{ label: string; file: string }>;
  print: Array<{ service: string; url: string; product?: string; price?: number; currency?: string; checkedAt?: string; shipsTo?: string; file?: string }>;
}

async function get(path: string): Promise<Response> {
  const r = await fetch(path, { credentials: 'same-origin' });
  if (!r.ok) {
    const d = (await r.json().catch(() => ({}))) as { message?: string };
    throw new Error(d.message ?? `Export failed (${r.status})`);
  }
  return r;
}

function fileName(r: Response, fallback: string): string {
  return r.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? fallback;
}

/** Client-side mark for images the companion could not stamp. */
async function stampImageBlob(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    drawMark(g, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawMark(g: CanvasRenderingContext2D, w: number, h: number): void {
  const fs = Math.max(11, Math.round(w / 72));
  g.font = `600 ${fs}px -apple-system, Segoe UI, Arial, sans-serif`;
  const tw = g.measureText(MARK_TEXT).width;
  const pad = fs * 0.7;
  const bw = tw + pad * 2, bh = fs * 2, x = w - bw - fs, y = h - bh - fs;
  g.fillStyle = 'rgba(255,250,240,.9)';
  g.beginPath(); g.roundRect(x, y, bw, bh, bh / 2); g.fill();
  g.fillStyle = '#3b4a43';
  g.textBaseline = 'middle';
  g.fillText(MARK_TEXT, x + pad, y + bh / 2);
}

/** Client-side mark for a loop the agent provided (re-recorded through a canvas). */
async function stampVideoBlob(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  const v = document.createElement('video');
  v.src = url; v.muted = true; v.playsInline = true;
  await new Promise((r) => { v.onloadeddata = r; });
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  const g = c.getContext('2d')!;
  const rec = new MediaRecorder(c.captureStream(30), { mimeType: 'video/webm' });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<void>((r) => { rec.onstop = () => r(); });
  rec.start(200);
  await v.play();
  await new Promise<void>((r) => {
    const tick = () => { g.drawImage(v, 0, 0); drawMark(g, c.width, c.height); if (v.ended) r(); else requestAnimationFrame(tick); };
    tick();
  });
  rec.stop();
  await done;
  URL.revokeObjectURL(url);
  return new Blob(chunks, { type: 'video/webm' });
}

export function SharePanel(props: { day: number; onClose: () => void }) {
  const { day } = props;
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [blur, setBlur] = useState(true);
  const [includeNote, setIncludeNote] = useState(false);
  const [preview, setPreview] = useState<{ url: string; blob: Blob; name: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    get(`/api/share/${day}/preview`).then((r) => r.json()).then((i: ShareInfo) => { setInfo(i); if (!i.privateText.length) setBlur(false); }).catch((e) => toast((e as Error).message));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [day]);

  const q = () => `blur=${blur ? 1 : 0}&note=${includeNote ? 1 : 0}`;

  const loadStill = async (): Promise<{ blob: Blob; name: string }> => {
    const r = await get(`/api/share/${day}/still?${q()}`);
    let blob = await r.blob();
    if (r.headers.get('x-advent-stamped') === '0') blob = await stampImageBlob(blob);
    return { blob, name: fileName(r, `advent-agent-day-${day}.png`) };
  };

  useEffect(() => {
    if (!info || info.still === 'unavailable') return;
    let alive = true;
    setBusy('preview');
    loadStill().then((s) => {
      if (!alive) return;
      setPreview((old) => { if (old) URL.revokeObjectURL(old.url); return { url: URL.createObjectURL(s.blob), blob: s.blob, name: s.name }; });
    }).catch((e) => toast((e as Error).message)).finally(() => alive && setBusy(null));
    return () => { alive = false; };
  }, [info, blur]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast((e as Error).message); } finally { setBusy(null); }
  };

  const downloadLoop = () => run('loop', async () => {
    const r = await get(`/api/share/${day}/loop?${q()}`);
    let blob = await r.blob();
    if (r.headers.get('x-advent-stamped') === '0' && blob.type.startsWith('video/')) blob = await stampVideoBlob(blob);
    saveBlob(blob, fileName(r, `advent-agent-day-${day}-loop.webm`));
  });
  const downloadStandalone = () => run('file', async () => {
    const r = await get(`/api/share/${day}/standalone?${q()}`);
    saveBlob(await r.blob(), fileName(r, `advent-agent-day-${day}.html`));
  });
  const nativeShare = () => run('share', async () => {
    const still: { blob: Blob; name: string } = preview ?? (await loadStill());
    const file = new File([still.blob], still.name, { type: still.blob.type });
    const data = { files: [file], text: info?.caption, title: info?.title };
    if (navigator.canShare?.(data)) {
      await navigator.share(data).catch((e: Error) => { if (e.name !== 'AbortError') throw e; });
    } else {
      saveBlob(still.blob, still.name);
      const copied = info?.caption ? await copyText(info.caption) : false;
      toast(copied ? 'Saved the image and copied the caption. Paste it wherever you share.' : 'Saved the image. Share it wherever you like.');
    }
  });

  return (
    <div class="dialog-backdrop" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div class="dialog share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <h2 id="share-title">Share this gift</h2>
        <p class="page-sub" style="margin-bottom:12px">The calendar lives on your computer, so sharing means saving a picture, a short video or the gift itself as a file. Nothing is uploaded. Here is what would leave your computer:</p>
        {!info ? <p class="empty">Preparing the preview…</p> : (
          <>
            <div class="share-preview" aria-live="polite">
              {preview ? <img src={preview.url} alt={`Share image of ${info.title}${blur ? ', private details blurred' : ''}`} /> : <p class="empty">{info.still === 'unavailable' ? 'No picture can be made here: this computer has no Chrome or Edge, and the gift has no share image. You can still save the gift itself.' : busy === 'preview' ? 'Capturing…' : ''}</p>}
            </div>
            {info.privateText.length > 0 || info.still !== 'unavailable' ? (
              <label class="check"><input type="checkbox" checked={blur} onChange={(e) => setBlur((e.target as HTMLInputElement).checked)} /><span class="check-text">Blur private details<small>{info.privateText.length ? `Blurs ${info.privateText.map((t) => `“${t}”`).join(', ')} and anything your Secret Santa marked as private.` : 'Blurs anything your Secret Santa marked as private.'}</small></span></label>
            ) : null}
            <label class="check"><input type="checkbox" checked={includeNote} onChange={(e) => setIncludeNote((e.target as HTMLInputElement).checked)} /><span class="check-text">Include the note in the saved gift file<small>The note is often personal. Pictures and videos never include it.</small></span></label>
            <div class="copy-row"><span style="font-size:13px"><strong>Caption:</strong> {info.caption}</span><button class="ghost-button" onClick={async () => toast((await copyText(info.caption)) ? 'Caption copied.' : 'Could not copy.')}>Copy</button></div>
            <div class="gift-actions" style="margin-top:12px">
              <button class="primary-button" disabled={Boolean(busy) || info.still === 'unavailable'} onClick={nativeShare}>{busy === 'share' ? 'Opening…' : 'Share…'}</button>
              <button class="secondary-button" disabled={!preview} onClick={() => preview && saveBlob(preview.blob, preview.name)}>Download picture (1080×1350)</button>
              {info.loop !== 'none' && <button class="secondary-button" disabled={Boolean(busy)} onClick={downloadLoop}>{busy === 'loop' ? 'Recording…' : `Download short video${info.loop === 'capture' ? ` (${Math.round((info.loopDurationMs ?? 6000) / 1000)} s${info.ffmpeg ? ', MP4' : ', WebM'})` : ''}`}</button>}
              <button class="secondary-button" disabled={Boolean(busy)} onClick={downloadStandalone}>{busy === 'file' ? 'Packing…' : 'Download the gift as a file'}</button>
              {info.downloads.map((d) => <a key={d.file} class="ghost-button" href={`/api/share/${day}/download?file=${encodeURIComponent(d.file)}`} download>{d.label}</a>)}
            </div>
            {info.print.length > 0 && (
              <div class="feedback">
                <div class="label">Print it for real (you order, if you want)</div>
                <ul class="files-list">{info.print.map((p) => <li key={p.url}><span>{p.service}{p.product ? ` · ${p.product}` : ''}{p.price !== undefined ? ` · ${p.price} ${p.currency ?? ''}` : ''}{p.checkedAt ? ` (checked ${p.checkedAt})` : ''}{p.shipsTo ? ` · ships to ${p.shipsTo}` : ''}</span><a class="ghost-button" href={p.url} target="_blank" rel="noopener noreferrer">Open ↗</a></li>)}</ul>
              </div>
            )}
            <p class="hint" style="font-size:12px;color:var(--muted-strong);margin-top:12px">{info.shareMark ? 'Exports carry a small “Made by my Advent Agent” mark in the corner. You can turn it off in Settings.' : 'The Advent Agent mark is off in your Settings.'}</p>
          </>
        )}
        <div class="button-row" style="justify-content:flex-end;margin-top:8px"><button class="ghost-button" onClick={props.onClose}>Close</button></div>
      </div>
    </div>
  );
}
