/** Sections shared by the setup wizard and the settings page. */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Config, Profile } from '../../../src/shared/config.js';
import type { List, Persona, PersonaCandidate } from '../../../src/shared/list.js';
import { api } from '../api.js';
import { toast } from '../lib/ui.js';

export type Detect = Awaited<ReturnType<typeof api.detect>>;

const HOW_IT_WORKS = 'The calendar starts your agent when you open a door, or ahead of time on a schedule. It works out of sight: you only see spoiler-free progress.';

export function ConnectionSection(props: { cfg: Config; onChange: (p: Partial<Config>) => void; detect: Detect; withPersona?: boolean }) {
  const { cfg, detect } = props;
  const conn = cfg.connection;
  const set = (p: Partial<Config['connection']>) => props.onChange({ connection: { ...conn, ...p } });
  const installed = detect.adapters.filter((a) => a.detection.installed && a.capabilities.headless);
  return (
    <section class="section" style="margin-top:0">
      <div class="eyebrow">Your agent</div>
      <h1 class="page-title">Which agent?</h1>
      <p class="page-sub">{HOW_IT_WORKS}</p>
      {installed.length === 0 && <div class="notice warn">No supported terminal agent was found on your PATH. Install one (Claude Code, Codex, Antigravity CLI, …) and reopen this page, or use a custom command below.</div>}
      <div class="card-grid">
        {detect.adapters.map((a) => (
          <button key={a.id} type="button" class="choice-card" aria-pressed={conn.adapter === a.id} disabled={!a.detection.installed && a.id !== 'custom'} onClick={() => set({ mode: 'launched', adapter: a.id as Config['connection']['adapter'] })}>
            <span class="tag">{a.detection.installed ? `found${a.detection.version ? ` · ${a.detection.version}` : ''}` : 'not found'}{!a.capabilities.verified ? ' · flags unverified' : ''}</span>
            <strong class="choice-title">{a.label}</strong>
            <p>{a.detection.note ?? a.capabilities.notes[0] ?? ''}</p>
          </button>
        ))}
        <button type="button" class="choice-card" aria-pressed={conn.adapter === 'custom'} onClick={() => set({ mode: 'launched', adapter: 'custom' })}>
          <span class="tag">escape hatch</span><strong class="choice-title">Custom command</strong><p>Any other agent that can be started with a command.</p>
        </button>
      </div>
      {conn.adapter === 'custom' && (
        <div class="field" style="margin-top:14px">
          <label for="custom-cmd">Command template</label>
          <input id="custom-cmd" type="text" value={conn.customCommand ?? ''} onInput={(e) => set({ customCommand: (e.target as HTMLInputElement).value })} placeholder='my-agent run --prompt-file {prompt_file} --cwd {workspace}' />
          <span class="hint">Placeholders: <code class="inline">{'{prompt}'}</code> <code class="inline">{'{prompt_file}'}</code> <code class="inline">{'{workspace}'}</code> <code class="inline">{'{door}'}</code> <code class="inline">{'{workshop}'}</code> <code class="inline">{'{day}'}</code>. You are responsible for what this command does and which permissions it grants.</span>
        </div>
      )}
      {conn.adapter && conn.adapter !== 'custom' && (
        <label class="check">
          <input type="checkbox" checked={conn.permissive} onChange={(e) => set({ permissive: (e.target as HTMLInputElement).checked })} />
          <span class="check-text">Let the agent skip its own permission prompts<small>Off by default. The calendar never uses “skip all permissions” flags unless you turn this on. With it on, the agent can run any command on your computer while making a gift.</small></span>
        </label>
      )}
      {conn.permissive && <div class="notice warn">Permissive mode is on. Your agent runs without its usual guard rails during gift preparation.</div>}
      {conn.adapter && props.withPersona !== false && <PersonaPicker persona={cfg.persona} onPersona={(persona) => props.onChange({ persona })} />}
    </section>
  );
}

const KIND_LABEL: Record<PersonaCandidate['kind'], string> = { 'claude-agent': 'custom agent', 'claude-output-style': 'output style', 'claude-md': 'CLAUDE.md', 'codex-agents': 'AGENTS.md' };
const folderName = (p?: string) => (p ? p.split(/[\\/]/).filter(Boolean).pop() ?? p : 'all projects');

/** "Who is your Secret Santa?": the agent itself (default), or one of the user's personas found by a file scan. */
export function PersonaPicker(props: { persona?: Persona; onPersona: (p: Persona | undefined) => void; changeOnly?: boolean }) {
  const [choice, setChoice] = useState<'agent' | 'persona'>(props.persona ? 'persona' : 'agent');
  const [candidates, setCandidates] = useState<PersonaCandidate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { if (choice === 'persona' && !candidates) api.personaCandidates().then((r) => setCandidates(r.candidates)).catch((e) => { toast((e as Error).message); setCandidates([]); }); }, [choice]);
  const pick = async (body: Parameters<typeof api.setPersona>[0]) => {
    setBusy(true);
    try { props.onPersona((await api.setPersona(body)).persona ?? undefined); } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div class="persona-picker" style="margin-top:28px">
      <h2 class="minor">Who is your Secret Santa?</h2>
      <div class="choices two" role="radiogroup" aria-label="Who is your Secret Santa?">
        <button type="button" role="radio" class="choice" aria-checked={choice === 'agent'} onClick={() => { setChoice('agent'); if (props.persona) void pick(null); }}>
          <span class="choice-name">Just my agent</span>
        </button>
        <button type="button" role="radio" class="choice" aria-checked={choice === 'persona'} onClick={() => setChoice('persona')}>
          <span class="choice-name">One of my personas</span>
        </button>
      </div>
      {choice === 'persona' && (
        <div class="persona-list" style="margin-top:14px">
          {candidates === null && <p class="muted-line">Looking through your agent setup…</p>}
          {candidates?.length === 0 && <p class="muted-line">No personas found. Choose a file instead.</p>}
          {candidates && candidates.length > 0 && (
            <div class="choice-stack" role="radiogroup" aria-label="Your personas">
              {groupByProject(candidates).map((g) => (
                <div key={g.project ?? 'user'} class="persona-group" role="group" aria-label={g.project ? folderName(g.project) : 'Your own agents'}>
                  <p class="muted-line small" style="margin:10px 0 4px"><strong>{g.project ? folderName(g.project) : 'Your own agents'}</strong></p>
                  {g.items.map((c) => {
                    const twins = candidates.filter((o) => o.id !== c.id && o.name.trim().toLowerCase() === c.name.trim().toLowerCase());
                    return (
                      <button key={c.id} type="button" role="radio" class="choice persona-option" aria-checked={props.persona?.sourcePath === c.sourcePath} disabled={busy} onClick={() => pick({ candidateId: c.id })}>
                        <span class="choice-name">{c.name}{twins.length > 0 && <span class="muted-line small"> · same name in {twins.map((t) => folderName(t.project)).join(', ')}</span>}</span>
                        <span class="choice-copy small" title={c.sourcePath}>{c.project ?? 'Your Claude setup'} · {KIND_LABEL[c.kind]}</span>
                        <span class="choice-copy">{c.preview}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
          <div class="button-row" style="margin-top:12px">
            <button type="button" class="secondary-button" disabled={busy} onClick={() => file.current?.click()}>Choose a file…</button>
            <input ref={file} type="file" accept=".md,.txt,text/markdown,text/plain" style="display:none" onChange={async (e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (f) await pick({ fileName: f.name, text: await f.text() });
              (e.target as HTMLInputElement).value = '';
            }} />
          </div>
          {props.persona && <p class="muted-line small">Your Secret Santa is <strong>{props.persona.name}</strong>. Its notes will be signed with that name.</p>}
        </div>
      )}
    </div>
  );
}

function groupByProject(list: PersonaCandidate[]): Array<{ project: string | undefined; items: PersonaCandidate[] }> {
  const groups = new Map<string | undefined, PersonaCandidate[]>();
  for (const c of list) groups.set(c.project, [...(groups.get(c.project) ?? []), c]);
  return [...groups.entries()].map(([project, items]) => ({ project, items })).sort((a, b) => (a.project === undefined ? -1 : b.project === undefined ? 1 : 0));
}

/** Settings: the persona that is set, with Change and Refresh. */
export function PersonaSettings(props: { persona?: Persona; onPersona: (p: Persona | undefined) => void }) {
  const [changing, setChanging] = useState(false);
  return (
    <section>
      <h2 class="settings-h">Your Secret Santa</h2>
      {props.persona ? (
        <>
          <p class="page-sub" style="margin-bottom:12px"><strong>{props.persona.name}</strong> <span class="muted-line small">· from {props.persona.sourcePath}</span></p>
          <div class="button-row">
            <button type="button" class="secondary-button" onClick={() => setChanging(!changing)}>Change</button>
            <button type="button" class="ghost-button" onClick={async () => { props.onPersona((await api.refreshPersona()).persona ?? undefined); toast('Refreshed from its source file.'); }}>Refresh</button>
          </div>
        </>
      ) : (
        <>
          <p class="page-sub" style="margin-bottom:12px">Just your agent.</p>
          <button type="button" class="secondary-button" onClick={() => setChanging(!changing)}>Change</button>
        </>
      )}
      {changing && <PersonaPicker persona={props.persona} onPersona={props.onPersona} />}
    </section>
  );
}

/** "Your Secret Santa's list": what it found out, editable, plus a paste box for what a chat app knows. Review is optional. */
export function ListSection(props: { profile: Profile; onProfile: (p: Profile) => void }) {
  const [list, setList] = useState<(List & { checking: boolean }) | null>(null);
  const [pasted, setPasted] = useState('');
  const [draft, setDraft] = useState('');
  useEffect(() => {
    let alive = true;
    const load = () => api.list().then((l) => { if (alive) { setList(l); setPasted((cur) => cur || l.pasted); } }).catch(() => undefined);
    void load();
    const t = setInterval(() => { if (list?.checking) void load(); }, 4000);
    return () => { alive = false; clearInterval(t); };
  }, [list?.checking]);
  if (!list) return <section><h2 class="settings-h">Your Secret Santa’s list</h2><p class="muted-line">Opening the list…</p></section>;
  const save = async (lines: Array<{ id?: string; text: string }>) => setList(await api.saveList({ lines }));
  const last = list.checks.at(-1);
  return (
    <section>
      <h2 class="settings-h">Your Secret Santa’s list <span class="optional">optional to review</span></h2>
      <p class="page-sub" style="margin-bottom:14px">What your Secret Santa knows about you. It checks the list before Door 1 and again on December 8 and 15. Everything stays on your computer.</p>
      {list.checking && <p class="muted-line" role="status">Your Secret Santa is checking its list…</p>}
      {list.lines.length === 0 && !list.checking && <p class="muted-line">Nothing on the list yet.</p>}
      <ul class="list-lines" style="list-style:none;padding:0;margin:0 0 12px">
        {list.lines.map((l) => (
          <li key={l.id} class="list-line" style="display:flex;gap:8px;align-items:center;margin:6px 0">
            <input type="text" aria-label="List line" value={l.text} style="flex:1" onChange={(e) => { const text = (e.target as HTMLInputElement).value; void save(list.lines.map((x) => (x.id === l.id ? { id: x.id, text } : { id: x.id, text: x.text }))); }} />
            {l.source && <span class="muted-line small" style="white-space:nowrap">{l.source}</span>}
            <button type="button" class="ghost-button" aria-label={`Delete: ${l.text}`} onClick={() => void save(list.lines.filter((x) => x.id !== l.id).map((x) => ({ id: x.id, text: x.text })))}>Delete</button>
          </li>
        ))}
      </ul>
      <div class="button-row">
        <input type="text" aria-label="Add a line to the list" placeholder="Add something it should know" value={draft} style="flex:1;min-width:200px" onInput={(e) => setDraft((e.target as HTMLInputElement).value)} onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { e.preventDefault(); void save([...list.lines.map((x) => ({ id: x.id, text: x.text })), { text: draft.trim() }]).then(() => setDraft('')); } }} />
        <button type="button" class="secondary-button" disabled={!draft.trim()} onClick={() => void save([...list.lines.map((x) => ({ id: x.id, text: x.text })), { text: draft.trim() }]).then(() => setDraft(''))}>Add</button>
        <button type="button" class="ghost-button" disabled={list.checking} onClick={async () => { await api.checkList(); setList({ ...list, checking: true }); }}>{last ? 'Check it again' : 'Check the list now'}</button>
      </div>
      <div class="field" style="margin-top:20px">
        <label for="list-paste">Paste what your Claude or ChatGPT app knows about you</label>
        <textarea id="list-paste" value={pasted} onInput={(e) => setPasted((e.target as HTMLTextAreaElement).value)} onBlur={async () => { if (pasted !== list.pasted) setList(await api.saveList({ pasted })); }} placeholder="Ask your app: what do you know about me?" />
        <span class="hint">Ask your app: “What do you know about me?” and paste the answer. It is merged into the list on the next check.</span>
      </div>
      <AboutYouSection profile={props.profile} onProfile={props.onProfile} />
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

/** Scheduled delivery needs the companion running at that hour: the login service. */
export function ServiceNotice() {
  const [svc, setSvc] = useState<Awaited<ReturnType<typeof api.service>> | null>(null);
  useEffect(() => { api.service().then(setSvc).catch(() => undefined); }, []);
  return (
    <div class="notice" style="margin-top:16px">
      <strong>The calendar must be running at that hour.</strong> Install the small login service and the companion starts quietly when you log in. If your computer is asleep, it catches up when it wakes.
      <div class="button-row" style="margin-top:10px">
        {svc && !svc.installed && <button class="primary-button" onClick={async () => { const r = await api.serviceInstall(); toast(r.message); setSvc(await api.service()); }}>Install the login service</button>}
        {svc?.installed && <button class="ghost-button" onClick={async () => { const r = await api.serviceUninstall(); toast(r.message); setSvc(await api.service()); }}>Remove the login service</button>}
        {svc && <span style="font-size:12px;color:var(--muted-strong)">{svc.installed ? 'Installed' : 'Not installed'}{svc.running ? ' · running' : ''}</span>}
      </div>
    </div>
  );
}

/** "About you" (handoff §1.7): short optional fields passed to the agent as the profile (D7). */
export function AboutYouSection(props: { profile: Profile; onProfile: (p: Profile) => void }) {
  const { profile } = props;
  const list = (v: string[]) => v.join(', ');
  const parse = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
  const browserLanguage = (() => { try { return new Intl.DisplayNames([navigator.language], { type: 'language' }).of(navigator.language) ?? navigator.language; } catch { return navigator.language; } })();
  return (
    <section>
      <h3 class="minor" style="margin-top:28px">Anything it might not know</h3>
      <div class="field"><label for="p-name">What to call you</label><input id="p-name" type="text" value={profile.name} onChange={(e) => props.onProfile({ ...profile, name: (e.target as HTMLInputElement).value })} /></div>
      <div class="field"><label for="p-loves">Things you love</label><input id="p-loves" type="text" value={list(profile.hobbies)} placeholder="comma-separated" onChange={(e) => props.onProfile({ ...profile, hobbies: parse((e.target as HTMLInputElement).value) })} /></div>
      <div class="field"><label for="p-people">People or pets</label><input id="p-people" type="text" value={list([...profile.people, ...profile.pets])} placeholder="comma-separated" onChange={(e) => props.onProfile({ ...profile, people: parse((e.target as HTMLInputElement).value), pets: [] })} /></div>
      <div class="field"><label for="p-avoid">Topics to avoid</label><input id="p-avoid" type="text" value={list(profile.avoid)} placeholder="comma-separated" onChange={(e) => props.onProfile({ ...profile, avoid: parse((e.target as HTMLInputElement).value) })} /></div>
      <div class="field"><label for="p-lang">Gift language</label><input id="p-lang" type="text" value={profile.language} placeholder={browserLanguage} onChange={(e) => props.onProfile({ ...profile, language: (e.target as HTMLInputElement).value })} /></div>
    </section>
  );
}

export function InspirationSection(props: { cfg: Config; onChange: (p: Partial<Config>) => void }) {
  return (
    <section class="section" style="margin-top:0">
      <div class="eyebrow">Inspiration</div>
      <h1 class="page-title">Folders your agent may look at.</h1>
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
      <div class="eyebrow">Suggestions</div>
      <h1 class="page-title">Buying and booking.</h1>
      <label class="check"><input type="checkbox" checked={b.realWorldSuggestions} onChange={(e) => set({ realWorldSuggestions: (e.target as HTMLInputElement).checked })} /><span class="check-text">Allow suggestions to buy or book<small><strong>Your agent never buys or books anything.</strong> You decide.</small></span></label>
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
      <label class="check"><input type="checkbox" checked={cfg.permissions.giftNetwork} onChange={(e) => props.onChange({ permissions: { ...cfg.permissions, giftNetwork: (e.target as HTMLInputElement).checked } })} /><span class="check-text">Gifts may ask to load content from the web<small>Off by default: gifts are self-contained. On, a gift can ask for specific websites and you consent per gift.</small></span></label>
      <label class="check"><input type="checkbox" checked={cfg.gary.show} onChange={(e) => props.onChange({ gary: { show: (e.target as HTMLInputElement).checked } })} /><span class="check-text">Show Gary on the calendar<small>A small animated coworker wanders the calendar page. Right-click him for options; he never covers the envelopes for long. Hidden automatically when your system prefers reduced motion.</small></span></label>
      <h2 class="minor">Gift test drive</h2>
      <p class="page-sub" style="margin-bottom:8px">Before sealing a gift, the calendar can load it off-screen in a headless browser, catch errors and take a private thumbnail. It needs a browser engine (about 150 MB). Without it, that step is skipped and marked as such.</p>
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
