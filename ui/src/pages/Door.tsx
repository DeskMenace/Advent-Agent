/** Pieces of the preparation flow for connected and portable modes, shown inside the reveal modal. Spoiler-free. */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GateReport } from '../../../src/shared/api.js';
import { api } from '../api.js';
import { announce, copyText, toast } from '../lib/ui.js';

/** Connected mode: the sentence to say to the agent (AGENT_CONNECTIONS §3). */
export function ConnectedPrompt(props: { day: number; early?: boolean }) {
  const phrase = props.early ? `Prepare door ${props.day} of my Advent Agent calendar.` : `Open door ${props.day} of my Advent Agent calendar.`;
  return (
    <div class="prompt-box">
      <p class="prompt-phrase">“{phrase}”</p>
      <button type="button" class="ghost-button" onClick={async () => toast((await copyText(phrase)) ? 'Copied.' : 'Select and copy the sentence above.')}>Copy</button>
    </div>
  );
}

export function Problems(props: { report: GateReport }) {
  return (
    <div class="problems" role="alert">
      <strong>The gift needs a fix before it can go into the envelope:</strong>
      <ul>{props.report.problems.filter((p) => p.severity === 'error').map((p, i) => <li key={i}>{p.message}</li>)}</ul>
    </div>
  );
}

/** The copyable request for a chat assistant (portable mode, AGENT_CONNECTIONS §6). */
export function PortableRequest(props: { day: number }) {
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
        `Rules: never buy or book anything for me. Keep suggestions ${ctx.budgets.priceCeilingPerGift ? `under ${ctx.budgets.priceCeilingPerGift.amount} ${ctx.budgets.priceCeilingPerGift.currency}` : 'modest'}. Don't invent facts about me.`,
        '',
        `Budget tier: ${ctx.budget.tier}.${ctx.season.anchor === 'day1' ? ' This is door 1 (see "Door 1 and December 24" in the guide).' : ctx.season.anchor === 'finale' ? ' This is December 24 (see "Door 1 and December 24" in the guide).' : ''}`,
        '',
        'Send me the result as ONE self-contained HTML file attached (with the embedded manifest from the guide). Don’t show me a preview and don’t describe it; just say "Your gift is wrapped."',
      ].join('\n'));
    }).catch(() => setRequest(`You are my Secret Santa for an Advent calendar. Please make the gift for door ${props.day}. Follow https://raw.githubusercontent.com/suchipizza/Advent-Agent/main/AGENT_GUIDE.md and send me one self-contained HTML file or plain text. Never buy or book anything. Don't show me a preview.`));
  }, [props.day]);
  return (
    <div class="copybox">
      <div class="control-label">Copy this request into your assistant</div>
      <textarea aria-label="Request for your assistant" readOnly value={request} />
      <button class="secondary-button" onClick={async () => toast((await copyText(request)) ? 'Copied.' : 'Select the text and copy it.')}>Copy the request</button>
    </div>
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
        <p style="margin:0 0 10px"><strong>Drop what your assistant sent here.</strong></p>
        <button class="secondary-button" disabled={busy} onClick={() => input.current?.click()}>Choose files</button>
        <input ref={input} type="file" multiple onChange={(e) => { const f = (e.target as HTMLInputElement).files; if (f) sendFiles(f); }} />
      </div>
      <div class="copybox" style="margin-top:12px">
        <label class="control-label" for={`paste-${props.day}`}>Or paste text</label>
        <textarea id={`paste-${props.day}`} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} placeholder="# A title on the first line&#10;&#10;Then the text…" />
        <button class="primary-button" disabled={busy || !text.trim()} onClick={() => send(() => api.submitText(props.day, text))}>Seal it into door {props.day}</button>
      </div>
    </div>
  );
}
