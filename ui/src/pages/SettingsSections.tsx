/** Sections shared by the setup wizard and the settings page. */
import { useEffect, useState } from 'preact/hooks';
import type { Config, Profile } from '../../../src/shared/config.js';
import { api } from '../api.js';
import { toast } from '../lib/ui.js';

export type Detect = Awaited<ReturnType<typeof api.detect>>;

const MODE_TABLE = [
  { mode: 'launched', title: 'Launched', who: 'Terminal agents installed here (Claude Code, Codex, Gemini CLI, …)', starts: 'The calendar, when you open a door or on a schedule', scheduled: 'Yes', surprise: 'Fully kept: output hidden, only spoiler-free phases shown', gifts: 'Everything: games, audio, multi-file, web research' },
  { mode: 'connected', title: 'Connected', who: 'Desktop apps that speak MCP (Claude Desktop, Codex desktop, Cursor, …)', starts: 'You: “Open door 7 of my Advent Agent calendar.”', scheduled: 'No', surprise: 'Partly: the chat shows tool calls', gifts: 'Everything, when the app can write files and run code' },
  { mode: 'portable', title: 'Portable', who: 'Any chat assistant or cloud agent (claude.ai, ChatGPT, Gemini, …)', starts: 'You paste a request, then drop the result in', scheduled: 'No', surprise: 'Partly: ask it to send the file without a preview', gifts: 'One self-contained HTML page, text, or a real-world proposal' },
  { mode: 'submit', title: 'Command line', who: 'Your own scripts and automations', starts: 'Whoever calls advent-agent submit', scheduled: 'If your script is', surprise: 'Up to you', gifts: 'Anything that fits the package format' },
] as const;

export function ConnectionSection(props: { cfg: Config; onChange: (p: Partial<Config>) => void; detect: Detect }) {
  const { cfg, detect } = props;
  const conn = cfg.connection;
  const set = (p: Partial<Config['connection']>) => props.onChange({ connection: { ...conn, ...p } });
  const [mcp, setMcp] = useState<Awaited<ReturnType<typeof api.mcpConfig>> | null>(null);
  const [mcpHost, setMcpHost] = useState<string>(conn.mcpHost ?? 'claude-desktop');
  const [diff, setDiff] = useState<Awaited<ReturnType<typeof api.mcpInstall>> | null>(null);
  useEffect(() => { if (conn.mode === 'connected' && !mcp) api.mcpConfig().then(setMcp).catch(() => undefined); }, [conn.mode]);
  const installed = detect.adapters.filter((a) => a.detection.installed && a.capabilities.headless);
  return (
    <section class="section" style="margin-top:0">
      <div class="eyebrow">Your agent</div>
      <h1 class="page-title">Who is your Secret Santa?</h1>
      <p class="page-sub">Four ways to connect, all first-class. Here is honestly what each can do.</p>
      <div class="card-grid">
        {MODE_TABLE.map((m) => (
          <button key={m.mode} type="button" class="choice-card" aria-pressed={conn.mode === m.mode} onClick={() => set({ mode: m.mode })}>
            <span class="tag">{m.scheduled === 'Yes' ? 'Can be scheduled' : 'You start the work'}</span>
            <strong class="choice-title">{m.title}</strong>
            <p>{m.who}</p>
          </button>
        ))}
      </div>
      <table class="honest-table">
        <thead><tr><th>Mode</th><th>Who starts the work</th><th>Scheduled?</th><th>Surprise kept?</th><th>Gifts possible</th></tr></thead>
        <tbody>{MODE_TABLE.map((m) => <tr key={m.mode} style={conn.mode === m.mode ? 'background:#fbf7ee' : ''}><td><strong>{m.title}</strong></td><td>{m.starts}</td><td>{m.scheduled}</td><td>{m.surprise}</td><td>{m.gifts}</td></tr>)}</tbody>
      </table>

      {conn.mode === 'launched' && (
        <>
          <h2 class="minor">Which terminal agent?</h2>
          {installed.length === 0 && <div class="notice warn">No supported terminal agent was found on your PATH. Install one, or pick another mode. You can also use a custom command below.</div>}
          <div class="card-grid">
            {detect.adapters.map((a) => (
              <button key={a.id} type="button" class="choice-card" aria-pressed={conn.adapter === a.id} disabled={!a.detection.installed && a.id !== 'custom'} onClick={() => set({ adapter: a.id as Config['connection']['adapter'] })}>
                <span class="tag">{a.detection.installed ? `found${a.detection.version ? ` · ${a.detection.version}` : ''}` : 'not found'}{!a.capabilities.verified ? ' · flags unverified' : ''}</span>
                <strong class="choice-title">{a.label}</strong>
                <p>{a.detection.note ?? a.capabilities.notes[0] ?? ''}</p>
              </button>
            ))}
            <button type="button" class="choice-card" aria-pressed={conn.adapter === 'custom'} onClick={() => set({ adapter: 'custom' })}>
              <span class="tag">escape hatch</span><strong class="choice-title">Custom command</strong><p>Any other agent that can be started with a command.</p>
            </button>
          </div>
          {conn.adapter === 'custom' && (
            <div class="field" style="margin-top:14px">
              <label for="custom-cmd">Command template</label>
              <input id="custom-cmd" type="text" value={conn.customCommand ?? ''} onInput={(e) => set({ customCommand: (e.target as HTMLInputElement).value })} placeholder='my-agent run --prompt-file {prompt_file} --cwd {workspace}' />
              <span class="hint">Placeholders: <code class="inline">{'{prompt}'}</code> <code class="inline">{'{prompt_file}'}</code> <code class="inline">{'{workspace}'}</code> <code class="inline">{'{workshop}'}</code> <code class="inline">{'{day}'}</code>. You are responsible for what this command does and which permissions it grants.</span>
            </div>
          )}
          {conn.adapter && conn.adapter !== 'custom' && (
            <label class="check">
              <input type="checkbox" checked={conn.permissive} onChange={(e) => set({ permissive: (e.target as HTMLInputElement).checked })} />
              <span class="check-text">Let the agent skip its own permission prompts<small>Off by default. The calendar never uses “skip all permissions” flags unless you turn this on. With it on, the agent can run any command on your computer while making a gift.</small></span>
            </label>
          )}
          {conn.permissive && <div class="notice warn">Permissive mode is on. Your agent runs without its usual guard rails during gift preparation.</div>}
        </>
      )}

      {conn.mode === 'connected' && mcp && (
        <>
          <h2 class="minor">Connect your app</h2>
          <p class="page-sub">Add the Advent Agent MCP server to your app, then open a door and tell the app: “Open door 7 of my Advent Agent calendar.” You might glimpse the wrapping paper in the chat.</p>
          <div class="chips" style="margin-bottom:12px">
            {Object.entries(mcp.snippets).map(([id, s]) => <button key={id} type="button" class="chip" aria-pressed={mcpHost === id} onClick={() => { setMcpHost(id); set({ mcpHost: id }); setDiff(null); }}>{s.label}</button>)}
          </div>
          <pre class="snippet">{mcp.snippets[mcpHost]?.snippet}</pre>
          <p class="hint" style="font-size:12px;color:var(--muted-strong)">{mcp.snippets[mcpHost]?.notes}{mcp.snippets[mcpHost]?.configPath ? ` File: ${mcp.snippets[mcpHost]?.configPath}` : ''}</p>
          <div class="button-row">
            <button class="secondary-button" onClick={async () => toast((await navigator.clipboard.writeText(mcp.snippets[mcpHost]?.snippet ?? '').then(() => true).catch(() => false)) ? 'Copied.' : 'Select and copy the snippet.')}>Copy</button>
            {mcp.snippets[mcpHost]?.configPath && <button class="secondary-button" onClick={async () => setDiff(await api.mcpInstall(mcpHost, false))}>Add it for me…</button>}
          </div>
          {diff && !diff.written && (
            <div class="notice">
              <strong>{diff.existed ? 'This would change' : 'This would create'} {diff.configPath}:</strong>
              <pre class="snippet" style="margin-top:8px;max-height:220px">{diff.after}</pre>
              <div class="button-row"><button class="primary-button" onClick={async () => { const r = await api.mcpInstall(mcpHost, true); setDiff(r); toast(r.message); }}>Write it</button><button class="ghost-button" onClick={() => setDiff(null)}>Cancel</button></div>
            </div>
          )}
          {diff?.written && <div class="notice">{diff.message}</div>}
        </>
      )}
      {conn.mode === 'portable' && <div class="notice">Each door will show a request you can paste into your assistant, plus a drop zone for the file it sends back. Cloud agents cannot reach this computer, so you carry the file across; that is the whole trick.</div>}
      {conn.mode === 'submit' && <div class="notice">Use <code class="inline">advent-agent submit &lt;path&gt; --day N</code> or POST to the local API with the token in <code class="inline">~/.advent-agent/api.token</code>. <code class="inline">advent-agent context --day N</code> prints the brief.</div>}
    </section>
  );
}

export function TimeSection(props: { cfg: Config; onChange: (p: Partial<Config>) => void; deviceTimeZone: string; frozen?: boolean }) {
  const zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [props.deviceTimeZone, 'UTC'];
  return (
    <section class="section" style="margin-top:0">
      <div class="eyebrow">Time</div>
      <h1 class="page-title">When do doors open?</h1>
      <p class="page-sub">Door N opens on December N at the hour you pick, in your calendar’s timezone. The timezone is frozen for the season, so travelling does not shift your doors.</p>
      {props.frozen && <div class="notice">The season has started, so its timezone and hour are frozen. Changes here apply to the next season.</div>}
      <div class="field">
        <label for="tz">Timezone</label>
        <select id="tz" value={props.cfg.timeZone} disabled={props.frozen} onChange={(e) => props.onChange({ timeZone: (e.target as HTMLSelectElement).value })}>
          {!zones.includes(props.cfg.timeZone) && <option value={props.cfg.timeZone}>{props.cfg.timeZone}</option>}
          {zones.map((z) => <option key={z} value={z}>{z}{z === props.deviceTimeZone ? ' (this device)' : ''}</option>)}
        </select>
      </div>
      <div class="field">
        <label for="hour">Unlock hour</label>
        <select id="hour" value={props.cfg.unlockHour} disabled={props.frozen} onChange={(e) => props.onChange({ unlockHour: Number((e.target as HTMLSelectElement).value) })}>
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00{h === 0 ? ' (midnight)' : h === 7 ? ' (a morning reveal)' : ''}</option>)}
        </select>
        <span class="hint">Locks prevent accidental spoilers. They are not a vault: changing your computer’s clock unlocks doors.</span>
      </div>
    </section>
  );
}

export function DeliverySection(props: { cfg: Config; onChange: (p: Partial<Config>) => void }) {
  const { cfg } = props;
  const [svc, setSvc] = useState<Awaited<ReturnType<typeof api.service>> | null>(null);
  useEffect(() => { api.service().then(setSvc).catch(() => undefined); }, []);
  const canSchedule = cfg.connection.mode === 'launched';
  return (
    <section class="section" style="margin-top:0">
      <div class="eyebrow">Delivery</div>
      <h1 class="page-title">When does your agent work?</h1>
      <div class="card-grid">
        <button type="button" class="choice-card" aria-pressed={cfg.deliveryMode === 'on_demand'} onClick={() => props.onChange({ deliveryMode: 'on_demand' })}>
          <span class="tag">default</span><strong class="choice-title">On demand</strong><p>You open the door, your agent makes the gift then. You watch spoiler-free phases while it works, usually a few minutes.</p>
        </button>
        <button type="button" class="choice-card" aria-pressed={cfg.deliveryMode === 'scheduled'} disabled={!canSchedule} onClick={() => props.onChange({ deliveryMode: 'scheduled' })}>
          <span class="tag">{canSchedule ? 'launched agents only' : 'needs a launched agent'}</span><strong class="choice-title">Scheduled</strong><p>Your agent prepares each gift ahead of time, at an hour you choose. The gift waits sealed behind the door until you open it.</p>
        </button>
      </div>
      {cfg.deliveryMode === 'scheduled' && (
        <>
          <div class="field" style="margin-top:18px">
            <label for="sched">Prepare at</label>
            <input id="sched" type="time" value={cfg.scheduleTime} onChange={(e) => props.onChange({ scheduleTime: (e.target as HTMLInputElement).value })} />
          </div>
          <label class="check"><input type="checkbox" checked={cfg.prepareDayBefore} onChange={(e) => props.onChange({ prepareDayBefore: (e.target as HTMLInputElement).checked })} /><span class="check-text">The day before<small>Prepare door N on December N−1 at that time (recommended: overnight).</small></span></label>
          <div class="notice">
            <strong>The calendar must be running at that hour.</strong> A browser tab is not enough. Install the small login service and the companion starts when you log in, quietly, and prepares gifts in the background. If your computer is asleep, it catches up when it wakes and says so honestly.
            <div class="button-row" style="margin-top:10px">
              {svc && !svc.installed && <button class="primary-button" onClick={async () => { const r = await api.serviceInstall(); toast(r.message); setSvc(await api.service()); }}>Install the login service</button>}
              {svc?.installed && <button class="ghost-button" onClick={async () => { const r = await api.serviceUninstall(); toast(r.message); setSvc(await api.service()); }}>Remove the login service</button>}
              {svc && <span style="font-size:12px;color:var(--muted-strong)">{svc.installed ? `Installed (${svc.definition.path})` : 'Not installed'}{svc.running ? ' · running' : ''}</span>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export function ProfileSection(props: { cfg: Config; onChange: (p: Partial<Config>) => void; profile: Profile; onProfile: (p: Profile) => void }) {
  const { profile } = props;
  const list = (v: string[]) => v.join(', ');
  const parse = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
  const field = (key: 'hobbies' | 'dislikes' | 'avoid' | 'people' | 'pets', label: string, hint: string) => (
    <div class="field" key={key}>
      <label for={`p-${key}`}>{label}</label>
      <input id={`p-${key}`} type="text" value={list(profile[key])} onChange={(e) => props.onProfile({ ...profile, [key]: parse((e.target as HTMLInputElement).value) })} placeholder="comma-separated" />
      <span class="hint">{hint}</span>
    </div>
  );
  return (
    <section class="section" style="margin-top:0">
      <div class="eyebrow">Personal touch</div>
      <h1 class="page-title">A few hints, all optional.</h1>
      <p class="page-sub">Your agent already knows you the way it normally does (its own memory and instructions still load). This small profile is passed with every door; leave anything blank. A universal delight beats a forced reference.</p>
      {field('hobbies', 'Hobbies and loves', 'Skiing, sourdough, 90s films…')}
      <div class="field"><label for="p-humour">Sense of humour</label><input id="p-humour" type="text" value={profile.humour} onChange={(e) => props.onProfile({ ...profile, humour: (e.target as HTMLInputElement).value })} placeholder="dry, silly, gentle…" /></div>
      {field('dislikes', 'Dislikes', 'Things to steer away from.')}
      {field('avoid', 'Topics to avoid', 'Anything the agent should never touch.')}
      {field('people', 'People who may appear', 'First names are enough. Protect others’ privacy.')}
      {field('pets', 'Pets', 'Only if you want pet gifts.')}
      <div class="field"><label for="p-lang">Language for gifts</label><input id="p-lang" type="text" value={profile.language} onChange={(e) => props.onProfile({ ...profile, language: (e.target as HTMLInputElement).value })} placeholder="English, Français, Deutsch…" /></div>
      <div class="field"><label for="p-acc">Accessibility</label><input id="p-acc" type="text" value={profile.accessibility} onChange={(e) => props.onProfile({ ...profile, accessibility: (e.target as HTMLInputElement).value })} placeholder="e.g. large text, no flashing, captions" /></div>
      <div class="field"><label for="p-notes">Anything else</label><textarea id="p-notes" value={profile.notes} onChange={(e) => props.onProfile({ ...profile, notes: (e.target as HTMLTextAreaElement).value })} /></div>
      <h2 class="minor">Folders your agent may look at for inspiration</h2>
      <p class="page-sub" style="margin-bottom:8px">Read-only, empty by default. A launched agent never browses your other folders unless you list them here.</p>
      <div class="field">
        <textarea aria-label="Inspiration folders, one per line" value={props.cfg.permissions.inspirationFolders.join('\n')} onChange={(e) => props.onChange({ permissions: { ...props.cfg.permissions, inspirationFolders: (e.target as HTMLTextAreaElement).value.split('\n').map((s) => s.trim()).filter(Boolean) } })} placeholder="/Users/you/Pictures/holidays" />
        <span class="hint">One absolute path per line.</span>
      </div>
    </section>
  );
}

export function BudgetSection(props: { cfg: Config; onChange: (p: Partial<Config>) => void }) {
  const b = props.cfg.budgets;
  const set = (p: Partial<Config['budgets']>) => props.onChange({ budgets: { ...b, ...p } });
  return (
    <section class="section" style="margin-top:0">
      <div class="eyebrow">Budgets</div>
      <h1 class="page-title">How much effort, how modest?</h1>
      <p class="page-sub">Your agent uses its normal plan or billing. Token targets are advisory unless your agent’s CLI enforces a cap (Claude Code does, with a dollar cap).</p>
      <div class="field"><label for="tok">Token target per gift</label><input id="tok" type="number" min={2000} step={1000} value={b.tokenTarget} onChange={(e) => set({ tokenTarget: Number((e.target as HTMLInputElement).value) || 25000 })} /><span class="hint">25,000 by default. One polished modest gift beats an ambitious broken one.</span></div>
      <div class="field"><label for="usd">Spend cap per gift (USD, optional)</label><input id="usd" type="number" min={0} step={0.5} value={b.usdCapPerGift ?? ''} onChange={(e) => set({ usdCapPerGift: (e.target as HTMLInputElement).value ? Number((e.target as HTMLInputElement).value) : undefined })} /><span class="hint">Enforced by agents that support it; otherwise advisory and labelled as such.</span></div>
      <h2 class="minor">Real-world suggestions</h2>
      <label class="check"><input type="checkbox" checked={b.realWorldSuggestions} onChange={(e) => set({ realWorldSuggestions: (e.target as HTMLInputElement).checked })} /><span class="check-text">Allow gifts that are real objects or experiences<small>Your agent researches and prepares a purchase-ready proposal (item, vendor, price with date checked, link, what’s left for you). <strong>It never buys or books.</strong></small></span></label>
      {b.realWorldSuggestions && (
        <div class="card-grid">
          <div class="field"><label for="pc">Price ceiling per gift</label><div class="button-row"><input id="pc" type="number" min={0} step={1} value={b.priceCeilingPerGift?.amount ?? ''} placeholder="unset = keep it modest" onChange={(e) => { const v = (e.target as HTMLInputElement).value; set({ priceCeilingPerGift: v ? { amount: Number(v), currency: b.priceCeilingPerGift?.currency ?? 'CHF' } : undefined }); }} /><input aria-label="Currency" type="text" maxLength={3} style="width:70px" value={b.priceCeilingPerGift?.currency ?? 'CHF'} onChange={(e) => set({ priceCeilingPerGift: b.priceCeilingPerGift ? { ...b.priceCeilingPerGift, currency: (e.target as HTMLInputElement).value.toUpperCase() } : undefined })} /></div></div>
          <div class="field"><label for="ps">Season total (optional)</label><input id="ps" type="number" min={0} step={1} value={b.priceCeilingSeason?.amount ?? ''} onChange={(e) => { const v = (e.target as HTMLInputElement).value; set({ priceCeilingSeason: v ? { amount: Number(v), currency: b.priceCeilingPerGift?.currency ?? 'CHF' } : undefined }); }} /></div>
        </div>
      )}
    </section>
  );
}

export function ExtrasSection(props: { cfg: Config; onChange: (p: Partial<Config>) => void; setup?: boolean }) {
  const { cfg } = props;
  const [drive, setDrive] = useState<string | null>(null);
  const [keychain, setKeychain] = useState<boolean | null>(null);
  useEffect(() => { api.keychain().then((k) => setKeychain(k.available)).catch(() => setKeychain(false)); }, []);
  return (
    <section class="section" style="margin-top:0">
      <div class="eyebrow">Extras</div>
      <h1 class="page-title">A few more switches.</h1>
      <label class="check"><input type="checkbox" checked={cfg.permissions.webResearch} onChange={(e) => props.onChange({ permissions: { ...cfg.permissions, webResearch: (e.target as HTMLInputElement).checked } })} /><span class="check-text">Allow web research<small>Lets your agent look things up (real products, places, references). Launched agents get their web tools only when this is on.</small></span></label>
      <label class="check"><input type="checkbox" checked={cfg.permissions.giftNetwork} onChange={(e) => props.onChange({ permissions: { ...cfg.permissions, giftNetwork: (e.target as HTMLInputElement).checked } })} /><span class="check-text">Gifts may ask to load content from the web<small>Off by default: gifts are self-contained. On, a gift can declare origins (e.g. a map) and you consent per gift.</small></span></label>
      <label class="check"><input type="checkbox" checked={cfg.gary.show} onChange={(e) => props.onChange({ gary: { show: (e.target as HTMLInputElement).checked } })} /><span class="check-text">Show Gary on the calendar<small>A small animated coworker wanders the calendar page. Right-click him for options; he never covers the envelopes for long. Hidden automatically when your system prefers reduced motion.</small></span></label>
      <label class="check"><input type="checkbox" checked={cfg.share.mark} onChange={(e) => props.onChange({ share: { mark: (e.target as HTMLInputElement).checked } })} /><span class="check-text">Show the Advent Agent mark on shared gifts<small>A small “Made by my AI agent · Advent Agent” corner mark on files you export. Nothing is ever uploaded.</small></span></label>
      <h2 class="minor">Gift test drive</h2>
      <p class="page-sub" style="margin-bottom:8px">Before sealing an interactive gift, the calendar can load it off-screen in a headless browser, catch errors and take a private thumbnail. It needs a browser engine (about 150 MB). Without it, that step is skipped and marked as such.</p>
      <div class="button-row">
        <button class="secondary-button" disabled={drive === '…'} onClick={async () => { setDrive('…'); const r = await api.testDriveInstall(); setDrive(r.message); toast(r.message); }}>{cfg.testDrive.enabled ? 'Reinstall the test-drive browser' : 'Enable gift test drive (~150 MB)'}</button>
        {drive && drive !== '…' && <span style="font-size:12px;color:var(--muted-strong)">{drive}</span>}
        {drive === '…' && <span style="font-size:12px;color:var(--muted-strong)">Downloading…</span>}
      </div>
      <details class="advanced">
        <summary>Advanced: your own creative providers (optional)</summary>
        <p class="page-sub" style="margin-top:0">The calendar needs no API keys. If you want, add your own provider for music, images, speech or video. Keys live in your OS keychain only and are used through narrow adapters, never handed to the agent as text. Paid use stays off until you enable it with a cap. No provider is recommended here.</p>
        {keychain === false && <div class="notice warn">The OS keychain module is not available on this installation, so keys cannot be stored. They are never written to disk in plain text.</div>}
        <ProviderList cfg={cfg} onChange={props.onChange} keychain={Boolean(keychain)} />
      </details>
      {!props.setup && null}
    </section>
  );
}

function ProviderList(props: { cfg: Config; onChange: (p: Partial<Config>) => void; keychain: boolean }) {
  const providers = props.cfg.providers;
  const update = (id: string, patch: Partial<Config['providers'][number]>) => props.onChange({ providers: providers.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  const [keyInput, setKeyInput] = useState<Record<string, string>>({});
  const add = () => {
    const id = `provider-${providers.length + 1}`;
    props.onChange({ providers: [...providers, { id, kind: 'image', adapter: 'openai-compatible-image', label: '', enabled: false, paidUse: false, hasKey: false }] });
  };
  return (
    <div>
      {providers.map((p) => (
        <div class="paper" key={p.id} style="padding:16px;margin:12px 0">
          <div class="card-grid">
            <div class="field"><label>Label</label><input type="text" value={p.label} onChange={(e) => update(p.id, { label: (e.target as HTMLInputElement).value })} /></div>
            <div class="field"><label>Kind</label><select value={p.kind} onChange={(e) => update(p.id, { kind: (e.target as HTMLSelectElement).value as Config['providers'][number]['kind'] })}><option value="image">image</option><option value="music">music</option><option value="speech">speech</option><option value="video">video</option></select></div>
            <div class="field"><label>Adapter</label><select value={p.adapter} onChange={(e) => update(p.id, { adapter: (e.target as HTMLSelectElement).value })}><option value="openai-compatible-image">OpenAI-compatible image API (reference adapter)</option><option value="custom">Other (contributed adapter id)</option></select></div>
            <div class="field"><label>Base URL</label><input type="url" value={p.baseUrl ?? ''} onChange={(e) => update(p.id, { baseUrl: (e.target as HTMLInputElement).value || undefined })} placeholder="https://api.example.com/v1" /></div>
            <div class="field"><label>Model</label><input type="text" value={p.model ?? ''} onChange={(e) => update(p.id, { model: (e.target as HTMLInputElement).value || undefined })} /></div>
          </div>
          <div class="field"><label>API key</label><div class="button-row"><input type="password" aria-label={`API key for ${p.label || p.id}`} value={keyInput[p.id] ?? ''} onInput={(e) => setKeyInput({ ...keyInput, [p.id]: (e.target as HTMLInputElement).value })} placeholder={p.hasKey ? 'stored in your keychain' : 'paste a key'} disabled={!props.keychain} /><button class="secondary-button" disabled={!props.keychain || !keyInput[p.id]} onClick={async () => { const r = await api.setKey(p.id, keyInput[p.id]!); toast(r.message); if (r.ok) { update(p.id, { hasKey: true }); setKeyInput({ ...keyInput, [p.id]: '' }); } }}>Store</button>{p.hasKey && <button class="ghost-button" onClick={async () => { await api.deleteKey(p.id); update(p.id, { hasKey: false }); }}>Forget</button>}</div><span class="hint">Who charges: the provider you chose. What is sent: the agent’s generation request (prompt, parameters), nothing from your calendar.</span></div>
          <label class="check"><input type="checkbox" checked={p.enabled} onChange={(e) => update(p.id, { enabled: (e.target as HTMLInputElement).checked })} /><span class="check-text">Enabled</span></label>
          <label class="check"><input type="checkbox" checked={p.paidUse} onChange={(e) => update(p.id, { paidUse: (e.target as HTMLInputElement).checked })} /><span class="check-text">Allow paid use<small>Off by default. Requires a per-gift cap.</small></span></label>
          {p.paidUse && <div class="card-grid"><div class="field"><label>Cap per gift</label><input type="number" min={0} step={0.5} value={p.capPerGift?.amount ?? ''} onChange={(e) => update(p.id, { capPerGift: { amount: Number((e.target as HTMLInputElement).value), currency: 'USD' } })} /></div><div class="field"><label>Season cap</label><input type="number" min={0} step={1} value={p.capSeason?.amount ?? ''} onChange={(e) => update(p.id, { capSeason: { amount: Number((e.target as HTMLInputElement).value), currency: 'USD' } })} /></div></div>}
          <button class="inline-button" onClick={() => props.onChange({ providers: providers.filter((x) => x.id !== p.id) })}>Remove this provider</button>
        </div>
      ))}
      <button class="ghost-button" onClick={add}>Add a provider</button>
    </div>
  );
}
