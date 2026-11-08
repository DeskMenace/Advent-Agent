/** Preparation screen (DESIGN_SPEC §11, AGENT_CONNECTIONS §3, §6). Spoiler-free. */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { CalendarResponse, GateReport } from '../../../src/shared/api.js';
import type { PublicDoor } from '../../../src/shared/door.js';
import { api, ApiError, subscribe } from '../api.js';
import { Header } from '../components/Header.js';
import { announce, copyText, toast } from '../lib/ui.js';
import { Link, navigate } from '../router.js';

const PHASES = ['thinking', 'making', 'testing', 'wrapping'] as const;
const PHASE_LABEL: Record<string, string> = { thinking: 'Thinking', making: 'Making', testing: 'Testing', wrapping: 'Wrapping' };

export function DoorPage(props: { day: number }) {
  const { day } = props;
  const [door, setDoor] = useState<PublicDoor | null>(null);
  const [cal, setCal] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<GateReport | null>(null);
  const [busy, setBusy] = useState(false);
  const revealing = useRef(false);

  const load = async () => {
    try {
      const [d, c] = await Promise.all([api.door(day), api.calendar()]);
      setDoor(d);
      setCal(c);
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 423) { toast(err.message); navigate('/', { replace: true }); return; }
      setError(err.message);
    }
  };

  useEffect(() => {
    void load();
    return subscribe((ev) => {
      if (ev.type === 'door' && ev.door.day === day) setDoor(ev.door);
      if (ev.type === 'rollover' || ev.type === 'calendar') void load();
    });
  }, [day]);

  // The user opened this envelope; when the gift becomes ready we reveal it and move on.
  useEffect(() => {
    if (!door || !cal || door.jobState !== 'ready' || door.revealed || revealing.current) return;
    revealing.current = true;
    announce('Your gift is ready. Unwrapping.');
    api.reveal(day).then(() => navigate(`/gift/${cal.season.year}/${day}`, { replace: true })).catch((e) => { toast((e as Error).message); revealing.current = false; });
  }, [door?.jobState, cal?.season.year]);

  useEffect(() => {
    if (door?.revealed && cal) navigate(`/gift/${cal.season.year}/${day}`, { replace: true });
  }, [door?.revealed]);

  if (error) return <div class="shell"><Header /><p class="empty">{error}</p></div>;
  if (!door || !cal) return <div class="shell"><Header /><p class="empty">One moment…</p></div>;

  const mode = cal.season.mode;
  const phaseIndex = door.phase ? PHASES.indexOf(door.phase) : -1;
  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); setReport(null); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div class="gift-page">
      <div class="gift-shell">
        <header class="gift-header">
          <Link href="/" class="back-button"><span class="back-arrow" aria-hidden="true">←</span> Back to your calendar</Link>
          <div class="gift-header-middle">Door {day}</div>
          <span class="gift-season">{cal.season.kind !== 'live' ? 'Demo preview' : `Advent ${cal.season.year}`}</span>
        </header>
        <main class="prep" aria-label="Preparing your gift">
          <div class="glow" aria-hidden="true">✦</div>
          <div class="gift-eyebrow">December {day}</div>
          {door.jobState === 'failed' ? (
            <>
              <h1 class="gift-title">Not quite yet.</h1>
              <p class="gift-subtitle">{door.failure?.userMessage ?? 'Something went wrong while preparing this gift.'}</p>
              <div class="button-row" style="justify-content:center;margin-top:24px">
                {door.failure?.canRetry !== false && <button class="primary-button" disabled={busy} onClick={() => act(() => api.retry(day))}>Try again</button>}
                <Link href="/" class="secondary-button">Back to the calendar</Link>
              </div>
              {mode !== 'launched' && <DropArea day={day} onReport={setReport} />}
            </>
          ) : door.jobState === 'cancelled' ? (
            <>
              <h1 class="gift-title">Paused.</h1>
              <p class="gift-subtitle">You stopped the preparation. Nothing was spoiled; try again whenever you like.</p>
              <div class="button-row" style="justify-content:center;margin-top:24px">
                <button class="primary-button" disabled={busy} onClick={() => act(() => api.retry(day))}>Start again</button>
                <Link href="/" class="secondary-button">Back to the calendar</Link>
              </div>
            </>
          ) : door.jobState === 'ready' ? (
            <>
              <h1 class="gift-title">Your gift is ready.</h1>
              <p class="gift-subtitle">Unwrapping…</p>
            </>
          ) : mode === 'launched' ? (
            <>
              <h1 class="gift-title">Your Secret Santa is making something.</h1>
              <p class="gift-subtitle">{door.jobState === 'queued' ? 'Waking up your agent…' : door.jobState === 'validating' ? 'Adding the finishing touches…' : door.jobState === 'waiting_for_permission' ? door.permission?.message ?? 'Waiting for your permission.' : 'Nobody will see the work in progress, not even you. The gift appears here the moment it is wrapped.'}</p>
              <ol class="phases" aria-label="Progress">
                {PHASES.map((p, i) => <li key={p} class={`phase${i < phaseIndex ? ' done' : ''}`} aria-current={i === phaseIndex ? 'step' : undefined}>{PHASE_LABEL[p]}</li>)}
              </ol>
              {door.late && <p class="gift-subtitle">Prepared late because {door.late.reason}.</p>}
              <p class="gift-subtitle">You can leave this page; the preparation continues. Gifts usually take a few minutes.</p>
              <div class="button-row" style="justify-content:center;margin-top:24px">
                <Link href="/" class="secondary-button">Back to the calendar</Link>
                <button class="ghost-button" disabled={busy} onClick={() => act(() => api.cancel(day))}>Stop</button>
              </div>
            </>
          ) : mode === 'connected' ? (
            <ConnectedInstructions day={day} door={door} onCancel={() => act(() => api.cancel(day))} />
          ) : (
            <PortableInstructions day={day} door={door} report={report} onReport={setReport} onCancel={() => act(() => api.cancel(day))} />
          )}
          {report && !report.ok && <Problems report={report} />}
        </main>
      </div>
    </div>
  );
}

function Problems(props: { report: GateReport }) {
  return (
    <div class="problems" role="alert">
      <strong>The gift needs a fix before it can go into the envelope:</strong>
      <ul>{props.report.problems.filter((p) => p.severity === 'error').map((p, i) => <li key={i}>{p.message}</li>)}</ul>
    </div>
  );
}

function ConnectedInstructions(props: { day: number; door: PublicDoor; onCancel: () => void }) {
  const phrase = `Open door ${props.day} of my Advent Agent calendar.`;
  const working = props.door.jobState === 'preparing' || props.door.jobState === 'validating';
  const phaseIndex = props.door.phase ? PHASES.indexOf(props.door.phase) : -1;
  return (
    <>
      <h1 class="gift-title">{working ? 'Your Secret Santa is on it.' : 'Your Secret Santa works when you call them.'}</h1>
      {working ? (
        <>
          <p class="gift-subtitle">Your agent has started. You might glimpse the wrapping paper in its tool calls; the gift itself appears here when it is wrapped.</p>
          <ol class="phases" aria-label="Progress">{PHASES.map((p, i) => <li key={p} class={`phase${i < phaseIndex ? ' done' : ''}`} aria-current={i === phaseIndex ? 'step' : undefined}>{PHASE_LABEL[p]}</li>)}</ol>
        </>
      ) : (
        <>
          <p class="gift-subtitle">Tell your agent, in Claude Desktop or any app connected through MCP:</p>
          <div class="copybox" style="max-width:520px;margin:18px auto 0">
            <p style="font:italic 22px/1.4 var(--serif);color:var(--green);margin:0">“{phrase}”</p>
            <button class="secondary-button" onClick={async () => toast((await copyText(phrase)) ? 'Copied.' : 'Select and copy the sentence above.')}>Copy the sentence</button>
          </div>
          <p class="gift-subtitle" style="margin-top:18px">You might glimpse the wrapping paper: chat apps show tool calls. The gift itself stays sealed until it lands here.</p>
        </>
      )}
      <div class="button-row" style="justify-content:center;margin-top:24px">
        <Link href="/" class="secondary-button">Back to the calendar</Link>
        <button class="ghost-button" onClick={props.onCancel}>Stop</button>
      </div>
    </>
  );
}

function PortableInstructions(props: { day: number; door: PublicDoor; report: GateReport | null; onReport: (r: GateReport | null) => void; onCancel: () => void }) {
  const [request, setRequest] = useState<string>('');
  useEffect(() => {
    api.agentContext(props.day, 'portable').then((ctx) => {
      const profile = ctx.recipient ? Object.entries(ctx.recipient).map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : String(v)}`).join('\n') : '- (nothing shared)';
      const recent = ctx.history.length ? ctx.history.slice(-5).map((h) => `- Door ${h.day}: ${h.title} (${h.kind})`).join('\n') : '- none yet';
      setRequest([
        `You are my Secret Santa for an Advent calendar. Today is ${ctx.date}. Please make the gift for door ${ctx.day}.`,
        '',
        'Follow this guide: https://raw.githubusercontent.com/suchipizza/Advent-Agent/main/AGENT_GUIDE.md',
        '',
        'About me (only what I chose to share):',
        profile,
        '',
        'Gifts I already received this season (avoid repeating them, callbacks welcome):',
        recent,
        '',
        `Rules: never buy or book anything for me (a proposal with vendor, price, date checked and a link is fine). Keep real-world suggestions ${ctx.budgets.priceCeilingPerGift ? `under ${ctx.budgets.priceCeilingPerGift.amount} ${ctx.budgets.priceCeilingPerGift.currency}` : 'modest'}. Don't invent facts about me.`,
        '',
        'Send me the result as ONE self-contained HTML file attached (with the embedded manifest from the guide), or as plain text. Don’t show me a preview and don’t describe it; just say "Your gift is wrapped."',
      ].join('\n'));
    }).catch(() => setRequest(`You are my Secret Santa for an Advent calendar. Please make the gift for door ${props.day}. Follow https://raw.githubusercontent.com/suchipizza/Advent-Agent/main/AGENT_GUIDE.md and send me one self-contained HTML file or plain text. Never buy or book anything. Don't show me a preview.`));
  }, [props.day]);
  return (
    <>
      <h1 class="gift-title">Ask your assistant, then drop the gift here.</h1>
      <p class="gift-subtitle">Works with any chat assistant or cloud agent. You might glimpse the wrapping paper while it works, so ask it to send the file without a preview.</p>
      <div class="instructions">
        <div class="copybox">
          <div class="control-label">1 · Copy this request into your assistant</div>
          <textarea aria-label="Request for your assistant" readOnly value={request} />
          <button class="secondary-button" onClick={async () => toast((await copyText(request)) ? 'Copied.' : 'Select the text and copy it.')}>Copy the request</button>
        </div>
        <div style="height:18px" />
        <div class="control-label">2 · Drop what it made</div>
        <DropArea day={props.day} onReport={props.onReport} />
      </div>
      <div class="button-row" style="justify-content:center;margin-top:24px">
        <Link href="/" class="secondary-button">Back to the calendar</Link>
        <button class="ghost-button" onClick={props.onCancel}>Stop</button>
      </div>
    </>
  );
}

/** Drop zone + paste box used on the preparation screen and the shelf (AGENT_CONNECTIONS §6). */
export function DropArea(props: { day: number; onReport: (r: GateReport | null) => void; onDone?: () => void }) {
  const [over, setOver] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const send = async (fn: () => Promise<GateReport>) => {
    setBusy(true);
    try {
      const r = await fn();
      props.onReport(r);
      if (r.ok) { toast('Sealed. Your gift is in the envelope.'); props.onDone?.(); }
      else announce('The gift needs a fix. See the list of problems.');
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const sendFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    const form = new FormData();
    for (const f of list) form.append('files', f, (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name);
    void send(() => api.submitFiles(props.day, form));
  };
  return (
    <div>
      <div
        class={`dropzone${over ? ' over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer?.files) sendFiles(e.dataTransfer.files); }}
      >
        <p style="margin:0 0 10px"><strong>Drop the gift here</strong>: one HTML file, a zip, or media files (image, audio, video, PDF).</p>
        <button class="secondary-button" disabled={busy} onClick={() => input.current?.click()}>Choose files</button>
        <input ref={input} type="file" multiple onChange={(e) => { const f = (e.target as HTMLInputElement).files; if (f) sendFiles(f); }} />
      </div>
      <div class="copybox" style="margin-top:12px">
        <label class="control-label" for={`paste-${props.day}`}>Or paste text (a letter, a poem, a proposal)</label>
        <textarea id={`paste-${props.day}`} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="# A title on the first line&#10;&#10;Then the text…" />
        <button class="primary-button" disabled={busy || !text.trim()} onClick={() => send(() => api.submitText(props.day, text))}>Seal it into door {props.day}</button>
      </div>
    </div>
  );
}
