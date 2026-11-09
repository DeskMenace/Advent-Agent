/** Gift page /gifts/:day (handoff §1.5): the gift full-size, the note, Save / Share / Back. */
import { useEffect, useState } from 'preact/hooks';
import type { CalendarResponse, RevealedGift } from '../../../src/shared/api.js';
import { api, ApiError } from '../api.js';
import { SaveMenu, SharePanel } from '../components/SharePanel.js';
import { Footer, Header } from '../components/Header.js';
import { Inline } from '../lib/markdown.js';
import { AgentNote } from '../components/AgentNote.js';
import { getRenderer } from '../renderers/index.js';
import { Link, navigate } from '../router.js';

export function GiftPage(props: { season?: number; day: number }) {
  const { day } = props;
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
        const season = props.season ?? c.season.year;
        if (props.season === c.season.year) { navigate(`/gifts/${day}`, { replace: true }); return; }
        const g = season === c.season.year ? await api.gift(day) : await api.archiveGift(season, day);
        if (!alive) return;
        setGift(g);
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        setTimeout(() => document.getElementById('gift-title')?.focus(), 50);
      } catch (e) {
        const err = e as ApiError;
        if (err.status === 423 || (err.status === 409 && err.code === 'not_revealed')) { navigate('/', { replace: true }); return; }
        if (!alive) return;
        setError(err.message);
      }
    })();
    return () => { alive = false; };
  }, [props.season, day]);

  if (error) return <div class="shell"><Header current="shelf" /><p class="empty">{error}</p><p style="text-align:center"><Link href="/" class="secondary-button">Back to the calendar</Link></p></div>;
  if (!gift || !cal) return <div class="shell"><Header current="shelf" /></div>;

  const m = gift.gift.manifest;
  const renderer = getRenderer(gift.gift.kind);
  const url = (path: string) => `${gift.baseUrl}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const needsConsent = m.network.length > 0;
  const consented = m.network.every((u) => gift.gift.networkConsent.includes(new URL(u).origin));
  const rprops = { gift, url, resetKey, consented };
  const current = cal.season.year === gift.season;

  return (
    <div class="shell">
      <Header current="shelf" />
      <main class="gift-view" aria-label="Your gift">
        <Link href="/" class="back-link"><span aria-hidden="true">←</span> Back to the calendar</Link>
        {needsConsent && !consented && current && (
          <div class="consent" role="region" aria-label="Network permission">
            <strong>This gift wants to load content from:</strong>
            <ul>{m.network.map((u) => <li key={u}>{new URL(u).origin}</li>)}</ul>
            Without your permission it renders without that content. Nothing else leaves your computer.
            <div class="button-row" style="margin-top:10px">
              <button class="primary-button" onClick={async () => { await api.consentNetwork(day, m.network.map((u) => new URL(u).origin)); setGift(await api.gift(day)); setResetKey((k) => k + 1); }}>Allow for this gift</button>
            </div>
          </div>
        )}
        <section class={`gift-artbox ${renderer.frameClass ?? ''}`} aria-label="The gift">
          <renderer.Component {...rprops} key={`${gift.gift.kind}-${resetKey}`} />
        </section>
        <div class="gift-view-body">
          <div class="reveal-day">December {day}</div>
          <h1 class="reveal-title" id="gift-title" tabIndex={-1}><Inline text={m.title} /></h1>
          <AgentNote note={m.note} signature={m.signature} />
          <div class="action-row page-actions">
            {current && <SaveMenu day={day} />}
            {current && <button type="button" class="action-btn primary" onClick={() => setShare(true)}>Share</button>}
            <Link href="/" class="action-btn">Back to the calendar</Link>
          </div>
        </div>
      </main>
      <Footer />
      {share && <SharePanel day={day} onClose={() => setShare(false)} />}
    </div>
  );
}

