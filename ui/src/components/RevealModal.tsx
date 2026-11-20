/**
 * Gift reveal (handoff §1.4): a wrapped present that wobbles while the agent works, then unwraps into the gift.
 * Closing during preparation is safe: the door keeps preparing and turns back into an unopened envelope when ready.
 * The gift is marked opened (and lands on the shelf) the moment the unwrap starts.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { CalendarResponse, RevealedGift } from '../../../src/shared/api.js';
import type { PublicDoor } from '../../../src/shared/door.js';
import { api, subscribe } from '../api.js';
import { Inline } from '../lib/markdown.js';
import { AgentNote } from './AgentNote.js';
import { emitAdvent } from '../lib/site.js';
import { announce, prefersReducedMotion, sleep, toast } from '../lib/ui.js';
import { getRenderer } from '../renderers/index.js';
import { navigate } from '../router.js';
import { Bow } from './Board.js';
import { SaveMenu, SharePanel } from './SharePanel.js';

/** Spoiler-free lines for the agent's progress (report_progress phases and job states). */
const PHASE_LINE: Record<string, string> = {
  queued: 'Waking up your Secret Santa…',
  thinking: 'Thinking of you…',
  making: 'Cutting the paper…',
  testing: 'Choosing the ribbon…',
  wrapping: 'Tying the bow…',
  validating: 'Checking the knots…',
  list: 'Your Secret Santa is checking its list…',
};

type Stage = 'loading' | 'unwrapping' | 'revealed';

export function Present(props: { state: 'wobble' | 'still' | 'unwrap' }) {
  return (
    <div class={`present ${props.state}`} aria-hidden="true">
      <div class="present-lid"><Bow class="present-bow" /></div>
      <div class="present-box" />
      <div class="present-shadow" />
    </div>
  );
}

export function RevealModal(props: { day: number; cal: CalendarResponse; onClose: () => void }) {
  const { day, cal } = props;
  const [door, setDoor] = useState<PublicDoor>(() => cal.doors[day - 1]!);
  const [stage, setStage] = useState<Stage>('loading');
  const [gift, setGift] = useState<RevealedGift | null>(null);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const shownAt = useRef(Date.now());
  const unwrapping = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  const reduced = prefersReducedMotion();

  // Start the job if nothing is in progress yet, then follow the door.
  useEffect(() => {
    const unsub = subscribe((ev) => { if (ev.type === 'door' && ev.door.day === day) setDoor(ev.door); });
    if (door.eligible && door.jobState === 'not_requested') {
      api.open(day).then((d) => { setDoor(d); emitAdvent('gift:preparing', day); }).catch((e) => toast((e as Error).message));
      announce(`Opening door ${day}. Your Secret Santa gets to work.`);
    } else {
      api.door(day).then(setDoor).catch(() => undefined);
    }
    dialog.current?.focus();
    return unsub;
  }, [day]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !share) props.onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); };
  }, [share]);

  // Ready and unlocked: play the present for at least ~1.2 s, then unwrap.
  useEffect(() => {
    if (!door.eligible || door.jobState !== 'ready' || unwrapping.current) return;
    unwrapping.current = true;
    (async () => {
      const wait = 1200 - (Date.now() - shownAt.current);
      if (wait > 0 && !reduced) await sleep(wait);
      setStage('unwrapping');
      announce('Your gift is ready. Unwrapping.');
      try {
        const g = await api.reveal(day);
        emitAdvent('gift:revealed', day);
        await sleep(reduced ? 150 : 1050);
        setGift(g);
        setStage('revealed');
        announce(`Door ${day}: ${g.gift.manifest.title}.`);
      } catch (e) {
        toast((e as Error).message);
        unwrapping.current = false;
        setStage('loading');
      }
    })();
  }, [door.jobState, door.eligible]);

  const act = async (fn: () => Promise<PublicDoor>) => {
    setBusy(true);
    try { setDoor(await fn()); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };

  const failed = door.jobState === 'failed' || door.jobState === 'cancelled';
  const sealedEarly = !door.eligible && !door.wrapping && !failed; // wrapped before its day (Day 1, the finale)
  const working = !failed && !sealedEarly && door.jobState !== 'ready' && door.jobState !== 'waiting_for_permission';
  const line = failed ? (door.failure?.userMessage ?? 'Your Secret Santa got tangled in the ribbon.')
    : sealedEarly ? `Wrapped. It opens on December ${day}.`
    : door.jobState === 'waiting_for_permission' ? (door.permission?.message ?? 'Waiting for your permission.')
    : PHASE_LINE[door.phase ?? ''] ?? PHASE_LINE[door.jobState] ?? (door.jobState === 'ready' ? 'Here it comes…' : 'Your Secret Santa is wrapping…');

  return (
    <div class="reveal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div class={`reveal stage-${stage}`} role="dialog" aria-modal="true" aria-label={`December ${day}`} tabIndex={-1} ref={dialog}>
        <button type="button" class="icon-close" aria-label="Close" onClick={props.onClose}>×</button>
        {stage !== 'revealed' ? (
          <div class="reveal-wrap">
            <div class="reveal-day">December {day}</div>
            <Present state={stage === 'unwrapping' ? 'unwrap' : failed || sealedEarly ? 'still' : 'wobble'} />
            {stage === 'loading' && (
              <>
                <p class="reveal-line" aria-live="polite">{line}</p>
                {working && <p class="reveal-note">You can close this page. Keep the terminal that runs the calendar open: closing it stops the wrapping.</p>}
                {failed && (door.eligible || door.failure?.code === 'interrupted') && door.failure?.canRetry !== false && <button type="button" class="primary-button" disabled={busy} onClick={() => act(() => api.retry(day))}>Try again</button>}
              </>
            )}
          </div>
        ) : gift && <RevealedView gift={gift} day={day} onShare={() => setShare(true)} onFullPage={() => { props.onClose(); navigate(`/gifts/${day}`); }} />}
      </div>
      {share && <SharePanel day={day} onClose={() => setShare(false)} />}
    </div>
  );
}

function RevealedView(props: { gift: RevealedGift; day: number; onShare: () => void; onFullPage: () => void }) {
  const g = props.gift;
  const m = g.gift.manifest;
  const renderer = getRenderer(g.gift.kind);
  const url = (path: string) => `${g.baseUrl}/${path.split('/').map(encodeURIComponent).join('/')}`;
  const consented = m.network.every((u) => g.gift.networkConsent.includes(new URL(u).origin));
  return (
    <div class="revealed">
      <section class={`reveal-art gift-artbox ${renderer.frameClass ?? ''}`} aria-label="Your gift">
        <renderer.Component gift={g} url={url} resetKey={0} consented={consented} />
      </section>
      <div class="reveal-body">
        <div class="reveal-day">December {props.day}</div>
        <h2 class="reveal-title"><Inline text={m.title} /></h2>
        <AgentNote note={m.note} signature={m.signature} />
        <div class="action-row">
          <button type="button" class="action-btn primary" onClick={props.onShare}>Share</button>
          <SaveMenu day={props.day} />
          <button type="button" class="action-btn" onClick={props.onFullPage}>Open full page</button>
        </div>
      </div>
    </div>
  );
}
