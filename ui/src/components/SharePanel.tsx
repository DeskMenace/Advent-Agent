/**
 * Share sheet (handoff §1.6, D20, D26) and Save menu. Gifts live on this computer, so every share exports the gift
 * (no mark, D26) and then hands the user off to the network. The privacy preview always comes first.
 * Never loads a network's SDK or scripts; nothing is uploaded by the calendar.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import { saveBlob } from '../api.js';
import { copyText, toast } from '../lib/ui.js';
import { CopyIcon, Facebook, Instagram, ShareIcon, TikTok, XLogo } from './Icons.js';

export interface ShareInfo {
  title: string;
  /** Fixed caption and link (D26), from the companion so there is one source of truth. */
  caption: string;
  url: string;
  privateText: string[];
  kind: string;
  browser: boolean;
  ffmpeg: boolean;
  still: 'capture' | 'file' | 'unavailable';
  loop: 'capture' | 'file' | 'none';
  loopDurationMs?: number;
}

type Media = { blob: Blob; name: string };

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

export function loadShareInfo(day: number): Promise<ShareInfo> {
  return get(`/api/share/${day}/preview`).then((r) => r.json() as Promise<ShareInfo>);
}

async function exportStill(day: number, blur: boolean): Promise<Media> {
  const r = await get(`/api/share/${day}/still?blur=${blur ? 1 : 0}`);
  return { blob: await r.blob(), name: fileName(r, `advent-day-${day}.png`) };
}

async function exportLoop(day: number, blur: boolean, info: ShareInfo): Promise<Media> {
  const r = await get(`/api/share/${day}/loop?blur=${blur ? 1 : 0}${info.ffmpeg ? '&format=mp4' : ''}`);
  return { blob: await r.blob(), name: fileName(r, `advent-day-${day}.${info.ffmpeg ? 'mp4' : 'webm'}`) };
}

function canShareFiles(): boolean {
  try {
    return Boolean(navigator.canShare?.({ files: [new File([''], 'gift.png', { type: 'image/png' })] }));
  } catch {
    return false;
  }
}

const canCopyImage = () => typeof window !== 'undefined' && 'ClipboardItem' in window && Boolean(navigator.clipboard?.write);

function openTab(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Hand-off URLs for each network (D26). Exported for tests. */
export function intentUrl(network: 'x' | 'facebook' | 'instagram' | 'tiktok', caption: string, link: string): string {
  switch (network) {
    case 'x': return `https://x.com/intent/post?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(link)}`;
    case 'facebook': return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
    case 'instagram': return 'https://www.instagram.com/';
    case 'tiktok': return 'https://www.tiktok.com/upload';
  }
}

async function toPng(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob;
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d')!.drawImage(img, 0, 0);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SharePanel(props: { day: number; onClose: () => void }) {
  const { day } = props;
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [blur, setBlur] = useState(true);
  const [still, setStill] = useState<(Media & { url: string }) | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadShareInfo(day).then((i) => { setInfo(i); if (!i.privateText.length) setBlur(false); }).catch((e) => toast((e as Error).message));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); props.onClose(); } };
    window.addEventListener('keydown', onKey, true);
    dialog.current?.focus();
    return () => window.removeEventListener('keydown', onKey, true);
  }, [day]);

  useEffect(() => {
    if (!info || info.still === 'unavailable') return;
    let alive = true;
    setBusy('preview');
    exportStill(day, blur).then((s) => {
      if (!alive) return;
      setStill((old) => { if (old) URL.revokeObjectURL(old.url); return { ...s, url: URL.createObjectURL(s.blob) }; });
    }).catch((e) => toast((e as Error).message)).finally(() => alive && setBusy(null));
    return () => { alive = false; };
  }, [info, blur]);

  const animated = info ? info.loop !== 'none' : false;
  const run = async (label: string, fn: () => Promise<void> | void) => {
    setBusy(label);
    try { await fn(); } catch (e) { toast((e as Error).message); } finally { setBusy(null); }
  };
  const needStill = (): Media => { if (!still) throw new Error('The picture is still being prepared.'); return still; };

  const native = () => run('native', async () => {
    // The still keeps the user gesture alive (recording a loop first would make the browser refuse the share sheet).
    const s = needStill();
    const file = new File([s.blob], s.name, { type: s.blob.type });
    await navigator.share({ files: [file], text: `${info!.caption} ${info!.url}` }).catch((e: Error) => { if (e.name !== 'AbortError') throw e; });
  });
  const x = () => run('x', () => {
    const s = needStill();
    saveBlob(s.blob, s.name);
    openTab(intentUrl('x', info!.caption, info!.url));
    toast('Image saved. Add it to your post.');
  });
  const facebook = () => run('facebook', () => {
    const s = needStill();
    saveBlob(s.blob, s.name);
    openTab(intentUrl('facebook', info!.caption, info!.url));
    toast('Image saved. Add it to your post.');
  });
  // Instagram and TikTok: links aren't clickable there, so only the caption is copied.
  const instagram = () => run('instagram', async () => {
    await copyText(info!.caption);
    openTab(intentUrl('instagram', info!.caption, info!.url));
    const media = animated ? await exportLoop(day, blur, info!) : needStill();
    saveBlob(media.blob, media.name);
    toast('Saved and caption copied. Upload it on Instagram.');
  });
  const tiktok = () => run('tiktok', async () => {
    await copyText(info!.caption);
    openTab(intentUrl('tiktok', info!.caption, info!.url));
    const media = animated ? await exportLoop(day, blur, info!) : needStill();
    saveBlob(media.blob, media.name);
    toast('Saved and caption copied. Upload it on TikTok.');
  });
  const copyImage = () => run('copy-image', async () => {
    const png = await toPng(needStill().blob);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    toast('Image copied.');
  });

  const disabled = Boolean(busy) || !still;
  return (
    <div class="dialog-backdrop share-backdrop" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div class="dialog share-sheet" role="dialog" aria-modal="true" aria-labelledby="share-title" tabIndex={-1} ref={dialog}>
        <div class="sheet-head">
          <h2 id="share-title">Share</h2>
          <button type="button" class="icon-close" aria-label="Close" onClick={props.onClose}>×</button>
        </div>
        {!info ? <p class="empty">…</p> : (
          <>
            <div class="share-preview" aria-live="polite">
              {still ? <img src={still.url} alt={`What will be shared${blur ? ', private details blurred' : ''}`} />
                : <p class="empty">{info.still === 'unavailable' ? 'No picture can be made on this computer.' : '…'}</p>}
            </div>
            <label class="toggle-row">
              <input type="checkbox" checked={blur} onChange={(e) => setBlur((e.target as HTMLInputElement).checked)} />
              <span>Blur private details{info.privateText.length ? <small> ({info.privateText.length})</small> : null}</span>
            </label>
            <div class="share-grid">
              {canShareFiles() && <button type="button" class="share-btn wide" data-share="native" disabled={disabled} onClick={native}><ShareIcon /> Share…</button>}
              <button type="button" class="share-btn" data-share="x" disabled={disabled} onClick={x}><XLogo /> X</button>
              <button type="button" class="share-btn" data-share="facebook" disabled={disabled} onClick={facebook}><Facebook /> Facebook</button>
              <button type="button" class="share-btn" data-share="instagram" disabled={disabled} onClick={instagram}><Instagram /> {busy === 'instagram' ? 'Recording…' : 'Instagram'}</button>
              <button type="button" class="share-btn" data-share="tiktok" disabled={disabled} onClick={tiktok}><TikTok /> {busy === 'tiktok' ? 'Recording…' : 'TikTok'}</button>
              {canCopyImage() && <button type="button" class="share-btn" data-share="copy-image" disabled={disabled} onClick={copyImage}><CopyIcon /> Copy image</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface SaveOption { id: string; label: string; format: string }

/** Save menu: the gift itself in its natural format, then the agent's own extra files (D26). */
export function SaveMenu(props: { day: number }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SaveOption[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    if (!options) get(`/api/save/${props.day}`).then((r) => r.json()).then((d: { options: SaveOption[] }) => setOptions(d.options)).catch((e) => toast((e as Error).message));
    const onDoc = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onKey, true); };
  }, [open]);
  const save = async (o: SaveOption) => {
    setBusy(o.id);
    try {
      const r = await get(`/api/save/${props.day}/file?id=${encodeURIComponent(o.id)}`);
      saveBlob(await r.blob(), fileName(r, `advent-day-${props.day}`));
      setOpen(false);
    } catch (e) { toast((e as Error).message); } finally { setBusy(null); }
  };
  return (
    <div class="save-menu" ref={root}>
      <button type="button" class="action-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>Save</button>
      {open && (
        <div class="menu" role="menu">
          {!options ? <span class="menu-note">…</span> : options.map((o) => (
            <button key={o.id} role="menuitem" type="button" data-save={o.id} disabled={Boolean(busy)} onClick={() => save(o)}>
              {busy === o.id ? '…' : o.label}<small>{o.format}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
