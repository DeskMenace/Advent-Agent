/**
 * Renderer registry (ARCHITECTURE §8, DESIGN_SPEC §8.2). New kinds register without touching the calendar;
 * unknown kinds fall back to a safe download view. Gift files come only from the gift origin.
 */
import type { ComponentType } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { RevealedGift } from '../../../src/shared/api.js';
import type { Artifact } from '../../../src/shared/gift.js';
import { downloadBlob, saveBlob } from '../api.js';
import { Markdown } from '../lib/markdown.js';
import { copyText, fileNameOf, toast } from '../lib/ui.js';
import { renderWav, ScorePlayer, singLyrics, validateScore, type Score } from '../lib/score-player.js';

export interface RendererProps {
  gift: RevealedGift;
  /** Absolute URL for a file inside the gift. */
  url: (path: string) => string;
  /** Reset counter from the action bar (interactive gifts). */
  resetKey: number;
  consented: boolean;
}

export interface RendererAction {
  id: string;
  label: string;
  kind: 'primary' | 'secondary' | 'ghost';
  onClick: () => void | Promise<void>;
}

export interface Renderer {
  kind: string;
  /** CSS modifier for the artifact frame. */
  frameClass?: string;
  Component: ComponentType<RendererProps>;
  /** Format-specific actions for the right panel. */
  actions?: (props: RendererProps, helpers: { reset: () => void }) => RendererAction[];
}

const registry = new Map<string, Renderer>();
export function registerRenderer(r: Renderer): void { registry.set(r.kind, r); }
export function getRenderer(kind: string): Renderer { return registry.get(kind) ?? registry.get('download')!; }
export function registeredKinds(): string[] { return [...registry.keys()]; }

function primaryPath(g: RevealedGift): string | undefined {
  return g.gift.manifest.primary ?? g.gift.manifest.artifacts.find((a) => a.role === 'primary')?.path ?? g.gift.manifest.artifacts[0]?.path;
}

function download(url: string, name: string) {
  return downloadBlob(url, name).catch((e) => toast((e as Error).message));
}

function downloadActions(props: RendererProps, roles: Artifact['role'][] = ['download', 'print', 'primary']): RendererAction[] {
  const seen = new Set<string>();
  return props.gift.gift.manifest.artifacts
    .filter((a) => roles.includes(a.role ?? 'asset') || a.path === primaryPath(props.gift))
    .filter((a) => (seen.has(a.path) ? false : (seen.add(a.path), true)))
    .map((a) => ({ id: `dl-${a.path}`, label: `Download ${a.title ?? fileNameOf(a.path)}`, kind: a.path === primaryPath(props.gift) ? 'primary' : 'secondary', onClick: () => download(props.url(a.path), fileNameOf(a.path)) }));
}

/* ---------- interactive HTML ---------- */
function Interactive(props: RendererProps) {
  const primary = primaryPath(props.gift)!;
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => { if (props.resetKey > 0 && ref.current) ref.current.src = props.url(primary); }, [props.resetKey]);
  return (
    <div class="media-inner media-edge">
      <iframe
        ref={ref}
        class="gift-frame"
        title={props.gift.gift.manifest.title}
        src={props.url(primary)}
        sandbox="allow-scripts allow-pointer-lock allow-downloads"
        referrerPolicy="no-referrer"
        allow="fullscreen"
      />
      <div class="frame-tools">
        <button type="button" aria-label="Start again" title="Start again" onClick={() => { if (ref.current) ref.current.src = props.url(primary); }}>↺</button>
        <button type="button" aria-label="Full screen" title="Full screen" onClick={() => ref.current?.parentElement?.parentElement?.requestFullscreen?.()}>⤢</button>
      </div>
    </div>
  );
}
registerRenderer({ kind: 'interactive-html', frameClass: 'media-dark', Component: Interactive, actions: (p, h) => [{ id: 'reset', label: 'Play from the beginning', kind: 'primary', onClick: h.reset }, { id: 'dl-page', label: 'Download the page (HTML)', kind: 'secondary', onClick: () => download(p.url(primaryPath(p.gift)!), fileNameOf(primaryPath(p.gift)!)) }, ...downloadActions(p, ['download']).filter((a) => a.id !== `dl-${primaryPath(p.gift)}`)] });

/* ---------- image ---------- */
function ImageView(props: RendererProps) {
  const primary = primaryPath(props.gift)!;
  const art = props.gift.gift.manifest.artifacts.find((a) => a.path === primary);
  const [zoom, setZoom] = useState(false);
  return (
    <div class="media-inner">
      <img class="gift-image" crossOrigin="anonymous" src={props.url(primary)} alt={art?.alt ?? props.gift.gift.manifest.title} style={zoom ? 'max-height:none;cursor:zoom-out' : 'cursor:zoom-in'} onClick={() => setZoom(!zoom)} />
    </div>
  );
}
registerRenderer({ kind: 'image', Component: ImageView, actions: (p) => downloadActions(p) });

/* ---------- audio ---------- */
function AudioView(props: RendererProps) {
  const primary = primaryPath(props.gift)!;
  return (
    <div class="media-inner">
      <div class="player">
        <audio controls crossOrigin="anonymous" preload="metadata" src={props.url(primary)}>Your browser cannot play this audio. Use the download below.</audio>
      </div>
    </div>
  );
}
registerRenderer({ kind: 'audio', frameClass: 'media-dark', Component: AudioView, actions: (p) => downloadActions(p) });

/* ---------- video ---------- */
function VideoView(props: RendererProps) {
  const primary = primaryPath(props.gift)!;
  const poster = props.gift.gift.manifest.artifacts.find((a) => a.role === 'thumbnail' || /poster/i.test(a.path))?.path;
  const captions = props.gift.gift.manifest.artifacts.filter((a) => a.role === 'caption' || a.path.endsWith('.vtt'));
  return (
    <div class="media-inner media-edge">
      <video controls crossOrigin="anonymous" playsInline preload="metadata" poster={poster ? props.url(poster) : undefined} aria-label={props.gift.gift.manifest.title}>
        <source src={props.url(primary)} />
        {captions.map((c) => <track key={c.path} kind="captions" src={props.url(c.path)} label={c.title ?? 'Captions'} default />)}
        Your browser cannot play this video. Use the download below.
      </video>
    </div>
  );
}
registerRenderer({ kind: 'video', frameClass: 'media-dark', Component: VideoView, actions: (p) => downloadActions(p) });

/* ---------- document (text, markdown, PDF) ---------- */
function useText(url: string | undefined): string | null {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    fetch(url).then((r) => r.text()).then((t) => { if (alive) setText(t); }).catch(() => { if (alive) setText(''); });
    return () => { alive = false; };
  }, [url]);
  return text;
}
function DocumentView(props: RendererProps) {
  const primary = primaryPath(props.gift)!;
  const lower = primary.toLowerCase();
  if (lower.endsWith('.pdf')) {
    return <div class="media-inner media-edge"><iframe class="gift-frame" title={props.gift.gift.manifest.title} src={props.url(primary)} sandbox="allow-scripts allow-pointer-lock allow-downloads" referrerPolicy="no-referrer" /></div>;
  }
  const text = useText(props.url(primary));
  const body = text === null ? '…' : text;
  const stripped = lower.endsWith('.md') || lower.endsWith('.markdown') ? body.replace(/^#\s+.*\n+/, '') : body;
  return (
    <div class="media-inner">
      <div class="paper-letter">
        {lower.endsWith('.md') || lower.endsWith('.markdown') ? <Markdown text={stripped} /> : <pre class="plain">{body}</pre>}
      </div>
    </div>
  );
}
registerRenderer({
  kind: 'document',
  frameClass: 'media-letter',
  Component: DocumentView,
  actions: (p) => [
    { id: 'copy', label: 'Copy the text', kind: 'secondary', onClick: async () => { const t = await fetch(p.url(primaryPath(p.gift)!)).then((r) => r.text()); toast((await copyText(t)) ? 'Copied.' : 'Could not copy.'); } },
    { id: 'print', label: 'Print', kind: 'ghost', onClick: () => window.print() },
    ...downloadActions(p),
  ],
});

/* ---------- card (SVG/PNG/PDF + print) ---------- */
function CardView(props: RendererProps) {
  const primary = primaryPath(props.gift)!;
  const art = props.gift.gift.manifest.artifacts.find((a) => a.path === primary);
  if (primary.toLowerCase().endsWith('.pdf')) return <div class="media-inner media-edge"><iframe class="gift-frame" title={props.gift.gift.manifest.title} src={props.url(primary)} sandbox="allow-scripts allow-downloads" referrerPolicy="no-referrer" /></div>;
  if (/\.(md|txt)$/i.test(primary)) return <DocumentView {...props} />;
  return <div class="media-inner"><img class="card-svg" crossOrigin="anonymous" src={props.url(primary)} alt={art?.alt ?? props.gift.gift.manifest.title} /></div>;
}
async function printImage(url: string, title: string): Promise<void> {
  const w = window.open('', '_blank', 'noopener,width=900,height=700');
  if (!w) { toast('Allow pop-ups to print.'); return; }
  w.document.write(`<!doctype html><title>${title.replace(/</g, '&lt;')}</title><style>body{margin:0;display:grid;place-items:center;min-height:100vh}img{max-width:100%;max-height:100vh}@page{margin:12mm}</style><img src="${url}" onload="setTimeout(()=>{print()},200)">`);
  w.document.close();
}
async function svgToPng(url: string, name: string): Promise<void> {
  const svg = await fetch(url).then((r) => r.text());
  const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await new Promise<void>((resolve) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = (im.naturalWidth || 1400) * 2;
      c.height = (im.naturalHeight || 980) * 2;
      c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
      c.toBlob((b) => { if (b) saveBlob(b, name); resolve(); }, 'image/png');
    };
    im.onerror = () => { toast('PNG export failed; use the SVG download.'); resolve(); };
    im.src = blobUrl;
  });
  URL.revokeObjectURL(blobUrl);
}
registerRenderer({
  kind: 'card',
  Component: CardView,
  actions: (p) => {
    const primary = primaryPath(p.gift)!;
    const acts: RendererAction[] = [{ id: 'print', label: 'Print the card', kind: 'primary', onClick: () => (/\.(svg|png|jpe?g|webp)$/i.test(primary) ? printImage(p.url(primary), p.gift.gift.manifest.title) : window.print()) }];
    if (primary.toLowerCase().endsWith('.svg') && !p.gift.gift.manifest.artifacts.some((a) => a.path.toLowerCase().endsWith('.png'))) {
      acts.push({ id: 'png', label: 'Download as PNG', kind: 'secondary', onClick: () => svgToPng(p.url(primary), fileNameOf(primary).replace(/\.svg$/i, '.png')) });
    }
    return [...acts, ...downloadActions(p)];
  },
});

/* ---------- song (score + player + WAV + render-it-yourself sheet) ---------- */
function SongView(props: RendererProps) {
  const song = props.gift.gift.manifest.song!;
  const [score, setScore] = useState<Score | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [lyric, setLyric] = useState('');
  const [sing, setSing] = useState(false);
  const player = useRef<ScorePlayer | null>(null);
  const stopSing = useRef<(() => void) | undefined>(undefined);
  const sheet = useText(song.renderSheet ? props.url(song.renderSheet) : undefined);
  useEffect(() => {
    fetch(props.url(song.score)).then((r) => r.json()).then((j) => setScore(validateScore(j))).catch((e) => setErr((e as Error).message));
    return () => { player.current?.stop(); stopSing.current?.(); };
  }, [song.score]);
  const lyrics = score ? [...(score.lyrics ?? []), ...score.tracks.flatMap((t) => t.lyrics ?? [])].sort((a, b) => a.t - b.t) : [];
  const play = async () => {
    if (!score) return;
    player.current?.stop();
    player.current = new ScorePlayer(score, (p, beat) => { setProgress(p); const cur = lyrics.filter((l) => l.t <= beat).at(-1); if (cur) setLyric(cur.text); }, () => { setPlaying(false); setProgress(0); setLyric(''); stopSing.current?.(); });
    setPlaying(true);
    await player.current.play();
    if (sing && lyrics.length) stopSing.current = singLyrics(score, lyrics);
  };
  const stop = () => { player.current?.stop(); stopSing.current?.(); setPlaying(false); setProgress(0); setLyric(''); };
  return (
    <div class="song-box">
      <div class="player" role="group" aria-label="Song player">
        {score?.title && <h3>{score.title}</h3>}
        {err && <div class="caption">The score could not be read.</div>}
        <div class="controls">
          <button type="button" onClick={playing ? stop : play} disabled={!score} aria-pressed={playing}>{playing ? '■ Stop' : '▶ Play'}</button>
          {lyrics.length > 0 && <button type="button" aria-pressed={sing} onClick={() => setSing(!sing)} title="A robot voice reads the lyrics in time. Clearly a robot.">{sing ? '🤖 Singing on' : '🤖 Robot singing'}</button>}
        </div>
        <progress value={progress} max={1} aria-label="Playback progress" />
        <div class="lyric" aria-live="off">{lyric}</div>
      </div>
      {sheet !== null && sheet && (
        <div class="sheet">
          <RenderSheet text={sheet} />
        </div>
      )}
    </div>
  );
}
/** The render-it-yourself sheet: markdown with a copy button for every code block and for the whole sheet. */
function RenderSheet(props: { text: string }) {
  const blocks = [...props.text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((m) => m[1]!.trim());
  return (
    <div>
      <div class="copy-row"><span /><button class="ghost-button" onClick={async () => toast((await copyText(props.text)) ? 'Copied.' : 'Could not copy.')}>Copy</button></div>
      <Markdown text={props.text} />
      {blocks.length > 0 && (
        <div class="button-row" style="margin-top:10px">
          {blocks.map((b, i) => <button key={i} class="ghost-button" onClick={async () => toast((await copyText(b)) ? 'Copied.' : 'Could not copy.')}>Copy prompt {blocks.length > 1 ? i + 1 : ''}</button>)}
        </div>
      )}
    </div>
  );
}
registerRenderer({
  kind: 'song',
  frameClass: 'media-plain',
  Component: SongView,
  actions: (p) => {
    const song = p.gift.gift.manifest.song!;
    const acts: RendererAction[] = [];
    if (song.wav) acts.push({ id: 'wav', label: 'Download WAV', kind: 'primary', onClick: () => download(p.url(song.wav!), fileNameOf(song.wav!)) });
    else acts.push({ id: 'wav-render', label: 'Download WAV (rendered here)', kind: 'primary', onClick: async () => { const s = validateScore(await fetch(p.url(song.score)).then((r) => r.json())); saveBlob(await renderWav(s), `${p.gift.gift.manifest.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.wav`); } });
    acts.push({ id: 'score', label: 'Download the score (JSON)', kind: 'secondary', onClick: () => download(p.url(song.score), fileNameOf(song.score)) });
    if (song.renderSheet) acts.push({ id: 'sheet', label: 'Download the render-it-yourself sheet', kind: 'secondary', onClick: () => download(p.url(song.renderSheet!), fileNameOf(song.renderSheet!)) });
    const songFiles = new Set([song.score, song.wav, song.renderSheet].filter(Boolean));
    return [...acts, ...downloadActions(p, ['download']).filter((a) => !songFiles.has(a.id.replace(/^dl-/, '')))];
  },
});

/* ---------- real-world proposal ---------- */
function RealWorldView(props: RendererProps) {
  const rw = props.gift.gift.manifest.realWorld!;
  const primary = props.gift.gift.manifest.primary;
  return (
    <div class="real-world">
      {primary && /\.(png|jpe?g|webp|svg|gif)$/i.test(primary) && <img class="gift-image" crossOrigin="anonymous" src={props.url(primary)} alt={props.gift.gift.manifest.artifacts.find((a) => a.path === primary)?.alt ?? ''} style="margin-bottom:18px" />}
      {rw.items.map((item, i) => (
        <article class="rw-item" key={i}>
          <h3>{item.name}</h3>
          <div class="rw-meta"><span>{item.vendor}</span></div>
          {item.price !== undefined && <div class="rw-price">{item.price.toFixed(2)} {item.currency}</div>}
          {item.notes && <p style="margin:0;font-size:13px;color:var(--muted-strong)">{item.notes}</p>}
          <a class="rw-link" href={item.url} target="_blank" rel="noopener noreferrer">{new URL(item.url).hostname} ↗</a>
        </article>
      ))}
    </div>
  );
}
registerRenderer({ kind: 'real-world', frameClass: 'media-plain', Component: RealWorldView, actions: (p) => downloadActions(p, ['download', 'print']) });

/* ---------- link ---------- */
function LinkView(props: RendererProps) {
  const links = props.gift.gift.manifest.links ?? [];
  return (
    <div class="media-inner">
      <ul class="links-list">{links.map((l, i) => <li key={i}><a href={l.url} target="_blank" rel="noopener noreferrer"><span>{l.label}</span><span aria-hidden="true">↗</span></a></li>)}</ul>
      {links.length === 0 && <p class="empty">No links were included.</p>}
    </div>
  );
}
registerRenderer({ kind: 'link', frameClass: 'media-plain', Component: LinkView, actions: (p) => downloadActions(p, ['download']) });

/* ---------- download fallback (unknown kinds, executables) ---------- */
function DownloadView(props: RendererProps) {
  const files = props.gift.gift.files.filter((f) => !f.path.startsWith('.advent/'));
  return (
    <div class="media-inner">
      <ul class="files-list">
        {files.map((f) => (
          <li key={f.path}>
            <span>{f.path}{f.downloadOnly && <em style="color:var(--red);margin-left:8px;font-size:11px">executable, download only</em>}</span>
            <span class="button-row"><span class="size">{(f.bytes / 1024).toFixed(0)} KB</span><a class="ghost-button" href={`${props.url(f.path)}?download`} download={fileNameOf(f.path)}>Save</a></span>
          </li>
        ))}
      </ul>
    </div>
  );
}
registerRenderer({ kind: 'download', frameClass: 'media-plain', Component: DownloadView, actions: () => [] });
