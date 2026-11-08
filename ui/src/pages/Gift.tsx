/** Gift page (DESIGN_SPEC §8): artifact first, companion note second, honest actions. */
import { useEffect, useState } from 'preact/hooks';
import type { CalendarResponse, RevealedGift } from '../../../src/shared/api.js';
import { api, ApiError, saveBlob } from '../api.js';
import { Header } from '../components/Header.js';
import { Inline, Markdown } from '../lib/markdown.js';
import { announce, formatDate, toast } from '../lib/ui.js';
import { getRenderer } from '../renderers/index.js';
import { Link, navigate } from '../router.js';

export function GiftPage(props: { season: number; day: number }) {
  const { season, day } = props;
  const [gift, setGift] = useState<RevealedGift | null>(null);
  const [cal, setCal] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const [share, setShare] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = await api.calendar();
        if (!alive) return;
        setCal(c);
        const g = c.season.year === season ? await api.gift(day) : await api.archiveGift(season, day);
        if (!alive) return;
        setGift(g);
        announce(`Door ${day}: ${g.gift.manifest.title}. Your gift is unwrapped.`);
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        setTimeout(() => document.getElementById('gift-title')?.focus(), 50);
      } catch (e) {
        const err = e as ApiError;
        if (err.status === 423) { toast(err.message); navigate('/', { replace: true }); return; }
        if (err.status === 409 && err.code === 'not_revealed') { navigate(`/door/${day}`, { replace: true }); return; }
        if (!alive) return;
        setError(err.message);
      }
    })();
    return () => { alive = false; };
  }, [season, day]);

  if (error) return <div class="shell"><Header /><p class="empty">{error}</p><p style="text-align:center"><Link href="/" class="secondary-button">Back to your calendar</Link></p></div>;
  if (!gift || !cal) return <div class="gift-page"><div class="gift-shell"><p class="empty">Unwrapping…</p></div></div>;

  const m = gift.gift.manifest;
  const renderer = getRenderer(gift.gift.kind);
  const url = (path: string) => `${gift.baseUrl}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const needsConsent = m.network.length > 0;
  const consented = m.network.every((u) => gift.gift.networkConsent.includes(new URL(u).origin));
  const rprops = { gift, url, resetKey, consented };
  const actions = renderer.actions?.(rprops, { reset: () => setResetKey((k) => k + 1) }) ?? [];
  const current = cal.season.year === season;
  const prevDay = current ? cal.doors.slice(0, day - 1).reverse().find((d) => d.revealed)?.day : day > 1 ? day - 1 : undefined;
  const nextDay = current ? cal.doors.slice(day).find((d) => d.revealed)?.day : day < 24 ? day + 1 : undefined;
  const nextEligible = current ? cal.doors.find((d) => d.day > day && d.eligible && !d.revealed)?.day : undefined;
  const isDemo = cal.season.kind !== 'live';

  const back = () => {
    sessionStorage.setItem('advent-agent.focusDay', String(day));
    document.querySelector('.gift-page')?.classList.add('leave');
    setTimeout(() => navigate(current ? '/' : `/archive/${season}`), 230);
  };

  return (
    <div class="gift-page">
      <div class="gift-shell">
        <header class="gift-header">
          <button type="button" class="back-button" onClick={back}><span class="back-arrow" aria-hidden="true">←</span> Back to your calendar</button>
          <div class="gift-header-middle">A little something, just for you</div>
          <span class="gift-season">{isDemo ? 'Demo preview' : `Advent ${season}`}</span>
        </header>
        <main aria-label="Your gift">
          <div class="gift-top">
            <div class="gift-eyebrow">✳ &nbsp; December {day}{m.category ? <> &nbsp; / &nbsp; {m.category}</> : null}</div>
            <h1 class="gift-title" id="gift-title" tabIndex={-1}><Inline text={m.title} /></h1>
            {m.subtitle && <p class="gift-subtitle"><Inline text={m.subtitle} /></p>}
          </div>
          {needsConsent && !consented && (
            <div class="consent" role="region" aria-label="Network permission">
              <strong>This gift wants to load content from:</strong>
              <ul>{m.network.map((u) => <li key={u}>{new URL(u).origin}</li>)}</ul>
              Without your permission it renders without that content. Nothing else leaves your computer.
              <div class="button-row" style="margin-top:10px">
                <button class="primary-button" onClick={async () => { await api.consentNetwork(day, m.network.map((u) => new URL(u).origin)); setGift(await api.gift(day)); setResetKey((k) => k + 1); }}>Allow for this gift</button>
                <button class="ghost-button" onClick={() => toast('Kept offline. You can allow it later from this page.')}>Keep it offline</button>
              </div>
            </div>
          )}
          <div class="gift-columns">
            <section class={`gift-artbox ${renderer.frameClass ?? ''}`} aria-label="Your gift">
              <renderer.Component {...rprops} key={`${gift.gift.kind}-${resetKey}`} />
            </section>
            <aside class="gift-details">
              <div class="detail-stamp">Your gift is unwrapped</div>
              <h2 class="detail-head">{m.realWorld ? 'Prepared for you.' : 'Made for this moment.'}</h2>
              <p class="detail-intro">{describe(gift)}</p>
              <div class="note">
                <Markdown text={m.note} />
                <span class="sign">— your advent gift-maker{m.agent?.name ? ` (${m.agent.name})` : ''}</span>
              </div>
              {m.incomplete.length > 0 && (
                <div class="incomplete"><strong>Honest footnote:</strong> some parts are unfinished.<ul>{m.incomplete.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
              )}
              <div class="gift-actions">
                {actions.map((a) => <button key={a.id} type="button" class={`${a.kind}-button`} onClick={() => void a.onClick()}>{a.label}</button>)}
                <button type="button" class="ghost-button" onClick={() => setShare(true)}>Share a copy</button>
              </div>
              {m.realWorld && <BoughtMark day={day} gift={gift} onChange={setGift} disabled={!current} />}
              {gift.promo && <PromoSlip promo={gift.promo} />}
              <Feedback day={day} gift={gift} onChange={setGift} disabled={!current} />
              <p class="verification">
                Opened {formatDate(gift.revealedAt, cal.season.timeZone)}.{' '}
                {gift.gift.verification.render === 'passed' ? 'Test drive passed. ' : gift.gift.verification.render === 'failed' ? 'Test drive found issues. ' : ''}
                {gift.gift.files.length} file{gift.gift.files.length === 1 ? '' : 's'}, checked and sealed.
              </p>
            </aside>
          </div>
          <nav class="gift-nav" aria-label="Gift navigation">
            {prevDay ? <Link href={current ? `/gift/${season}/${prevDay}` : `/gift/${season}/${prevDay}`}>← Door {prevDay}</Link> : <span />}
            {nextDay ? (
              <Link href={`/gift/${season}/${nextDay}`}>Door {nextDay} →</Link>
            ) : nextEligible ? (
              <Link href="/" title={`Door ${nextEligible} is waiting on the calendar`}>Door {nextEligible} awaits →</Link>
            ) : (
              <span class="gift-nav"><button type="button" disabled title="The next door opens on its day">Next gift →</button></span>
            )}
          </nav>
          <footer class="gift-footer">Some doors open to things worth keeping. ✳</footer>
        </main>
      </div>
      {share && <ShareDialog day={day} onClose={() => setShare(false)} />}
    </div>
  );
}

function describe(g: RevealedGift): string {
  const k = g.gift.kind;
  const names: Record<string, string> = {
    'interactive-html': 'Something to play with. It runs in a sandbox on this page; reset it any time.',
    image: 'An image at full resolution. Save it, print it, make it your wallpaper.',
    audio: 'Something to listen to. Playback starts only when you press play.',
    video: 'A little film. It plays inline and can be saved.',
    document: 'Something to read, slowly. Copy or save the text whenever you like.',
    card: 'A card you can print at home or send on.',
    song: 'An original song: play it here, download it, or render it with any music tool using the sheet.',
    'real-world': 'A real thing in the real world, researched and prepared for you. You decide whether to buy or book.',
    link: 'Places to go on the web, picked for you.',
    download: 'Files to keep.',
  };
  return names[k] ?? 'A gift in a format of its own.';
}

function PromoSlip(props: { promo: NonNullable<RevealedGift['promo']> }) {
  return (
    <aside class="slip" aria-label="A note from the makers of this calendar">
      <div class="slip-eyebrow">Also in this envelope</div>
      <p>A little thank-you from the people who made this calendar: <strong>{props.promo.percent}% off Gary</strong>, the coworker nobody asked for.</p>
      <p><span class="code">{props.promo.code}</span></p>
      <p><a href={props.promo.url} target="_blank" rel="noopener noreferrer">Meet Gary at deskmenace.com ↗</a> · valid until {props.promo.expires}</p>
      <p style="font-size:11px;color:var(--muted)">From the makers, not from your agent. Your agent does not know about this slip.</p>
    </aside>
  );
}

function BoughtMark(props: { day: number; gift: RevealedGift; onChange: (g: RevealedGift) => void; disabled: boolean }) {
  const bought = Boolean(props.gift.bought);
  return (
    <div class="feedback">
      <div class="label">Your own note</div>
      <label class="check">
        <input type="checkbox" checked={bought} disabled={props.disabled} onChange={async (e) => { const v = (e.target as HTMLInputElement).checked; await api.bought(props.day, v); props.onChange({ ...props.gift, bought: v ? { at: new Date().toISOString() } : undefined }); }} />
        <span class="check-text">I bought it<small>Just for you. Your agent never buys anything; this mark stays on your computer.</small></span>
      </label>
    </div>
  );
}

function Feedback(props: { day: number; gift: RevealedGift; onChange: (g: RevealedGift) => void; disabled: boolean }) {
  const [note, setNote] = useState(props.gift.feedback?.note ?? '');
  const reaction = props.gift.feedback?.reaction;
  const set = async (r: 'loved_it' | 'not_my_thing' | 'too_personal') => {
    const next = reaction === r ? undefined : r;
    await api.feedback(props.day, { reaction: next, note: note || undefined });
    props.onChange({ ...props.gift, feedback: { reaction: next, note: note || undefined } });
    toast(next ? 'Noted. Your Secret Santa will remember.' : 'Reaction removed.');
  };
  if (props.disabled) return null;
  return (
    <div class="feedback">
      <div class="label">How was it? (optional, helps later gifts)</div>
      <div class="chips">
        <button type="button" class="chip" aria-pressed={reaction === 'loved_it'} onClick={() => set('loved_it')}>Loved it</button>
        <button type="button" class="chip" aria-pressed={reaction === 'not_my_thing'} onClick={() => set('not_my_thing')}>Not my thing</button>
        <button type="button" class="chip" aria-pressed={reaction === 'too_personal'} onClick={() => set('too_personal')}>Too personal</button>
      </div>
      <div class="field" style="margin-top:12px">
        <label for={`note-${props.day}`}>A word for your Secret Santa</label>
        <textarea id={`note-${props.day}`} rows={2} value={note} onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} onBlur={async () => { if (note !== (props.gift.feedback?.note ?? '')) { await api.feedback(props.day, { reaction, note: note || undefined }); props.onChange({ ...props.gift, feedback: { reaction, note: note || undefined } }); } }} />
      </div>
    </div>
  );
}

function ShareDialog(props: { day: number; onClose: () => void }) {
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof api.sharePreview>> | null>(null);
  const [stripNote, setStripNote] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.sharePreview(props.day).then(setPreview).catch((e) => toast((e as Error).message)); }, [props.day]);
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, []);
  const exportIt = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/share/${props.day}${stripNote ? '?note=off' : ''}`, { credentials: 'same-origin' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({ message: 'Export failed' }))).message);
      const name = r.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `advent-agent-day-${props.day}.html`;
      saveBlob(await r.blob(), name);
      toast('Saved. Share the file however you like; nothing was uploaded.');
      props.onClose();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="dialog-backdrop" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <h2 id="share-title">Share a copy</h2>
        <p class="page-sub" style="margin-bottom:14px">This saves a standalone HTML file on your computer. Nothing is uploaded; you decide where it goes. Here is the text it will contain:</p>
        {preview ? (
          <>
            <div class="preview"><strong>{preview.title}</strong>{preview.subtitle ? `\n${preview.subtitle}` : ''}{stripNote ? '\n\n(note removed)' : `\n\n${preview.note}`}</div>
            <label class="check"><input type="checkbox" checked={stripNote} onChange={(e) => setStripNote((e.target as HTMLInputElement).checked)} /><span class="check-text">Leave the note out<small>Notes can be personal. The gift itself stays in.</small></span></label>
            <p class="hint" style="font-size:12px;color:var(--muted-strong)">{preview.shareMark ? 'A small “Made by my AI agent · Advent Agent” mark sits in the corner. Turn it off in Settings.' : 'The Advent Agent mark is off in your Settings.'}</p>
          </>
        ) : <p class="empty">Preparing the preview…</p>}
        <div class="button-row" style="justify-content:flex-end;margin-top:14px">
          <button class="ghost-button" onClick={props.onClose}>Cancel</button>
          <button class="primary-button" disabled={!preview || busy} onClick={exportIt}>Save the file</button>
        </div>
      </div>
    </div>
  );
}
