/** Settings (DESIGN_SPEC §10): everything from setup, plus skills, service, data, danger zone. */
import { useEffect, useState } from 'preact/hooks';
import type { CalendarResponse } from '../../../src/shared/api.js';
import type { Config, Profile } from '../../../src/shared/config.js';
import { api, saveBlob } from '../api.js';
import { Footer, Header } from '../components/Header.js';
import { BudgetChoice, DeliveryChoice, SpendLimit } from '../components/Onboarding.js';
import { toast } from '../lib/ui.js';
import { BudgetSection, ConnectionSection, ExtrasSection, InspirationSection, ListSection, PersonaSettings, ServiceNotice, TimeSection, type Detect } from './SettingsSections.js';

export function SettingsPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [detect, setDetect] = useState<Detect | null>(null);
  const [cal, setCal] = useState<CalendarResponse | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    Promise.all([api.settings(), api.profile(), api.detect(), api.calendar()]).then(([c, p, d, k]) => { setCfg(c); setProfile(p); setDetect(d); setCal(k); }).catch((e) => toast((e as Error).message));
  }, []);
  if (!cfg || !profile || !detect || !cal) return <div class="shell"><Header current="settings" /><p class="empty">Opening the drawer…</p></div>;
  const patch = (p: Partial<Config>) => { setCfg({ ...cfg, ...p }); setDirty(true); };
  const save = async () => {
    try {
      const c = await api.saveSettings(cfg);
      await api.saveProfile(profile);
      setCfg(c);
      setDirty(false);
      toast('Saved.');
    } catch (e) { toast((e as Error).message); }
  };
  const frozen = cal.eligibleThrough > 0 && cal.season.kind === 'live';
  return (
    <div class="shell">
      <Header current="settings" />
      <main style="padding-top:40px;max-width:860px;margin:0 auto">
        <p class="home-eyebrow" style="justify-content:flex-start">Settings</p>
        <h1 class="page-title">Your calendar, your rules.</h1>
        <div class="paper settings-block">
          <h2 class="settings-h">Delivery</h2>
          <p class="settings-q">When does your Secret Santa work?</p>
          <DeliveryChoice mode={cfg.connection.mode} delivery={cfg.deliveryMode} scheduleTime={cfg.scheduleTime} unlockHour={cfg.unlockHour} frozenUnlock={frozen}
            onChange={(p) => patch({ ...(p.delivery ? { deliveryMode: p.delivery } : {}), ...(p.scheduleTime ? { scheduleTime: p.scheduleTime } : {}), ...(p.unlockHour !== undefined ? { unlockHour: p.unlockHour } : {}) })} />
          {cfg.deliveryMode === 'scheduled' && cfg.connection.mode === 'launched' && <ServiceNotice />}
        </div>
        <div class="paper settings-block">
          <h2 class="settings-h">Budget</h2>
          <p class="settings-q">How generous is your Secret Santa?</p>
          <BudgetChoice value={cfg.budgets.generosity} onChange={(g) => patch({ budgets: { ...cfg.budgets, generosity: g } })} />
          <SpendLimit value={cfg.budgets.usdCapPerGift} onChange={(usd) => patch({ budgets: { ...cfg.budgets, usdCapPerGift: usd } })} />
        </div>
        <div class="paper settings-block"><ListSection profile={profile} onProfile={(p) => { setProfile(p); setDirty(true); }} /></div>
        <div class="paper settings-block"><PersonaSettings persona={cfg.persona} onPersona={(persona) => setCfg((cur) => (cur ? { ...cur, persona } : cur))} /></div>
        <div class="paper settings-block">
          <h2 class="settings-h">Reminder</h2>
          <p class="page-sub" style="margin-bottom:14px">One event a day in your own calendar app, when a door opens. A local file: no account, no tracking.</p>
          <a class="secondary-button" href="/api/reminder.ics" download="advent-agent-doors.ics">Remind me when a door opens</a>
        </div>
        <div class="paper settings-block"><ConnectionSection cfg={cfg} onChange={patch} detect={detect} withPersona={false} /></div>
        <details class="advanced settings-more">
          <summary>More settings</summary>
        <div class="paper" style="margin-top:20px"><TimeSection cfg={cfg} onChange={patch} deviceTimeZone={detect.deviceTimeZone} frozen={frozen} /></div>
        <div class="paper" style="margin-top:20px"><BudgetSection cfg={cfg} onChange={patch} /></div>
        <div class="paper" style="margin-top:20px"><InspirationSection cfg={cfg} onChange={patch} /></div>
        <div class="paper" style="margin-top:20px"><ExtrasSection cfg={cfg} onChange={patch} /></div>
        <div class="paper" style="margin-top:20px">
          <section class="section" style="margin-top:0">
            <div class="eyebrow">Your data</div>
            <h2>Export, import, back up</h2>
            <p class="page-sub">Exports contain your seasons and gifts, never your tokens, keys or agent logs. Imports back up the current state first.</p>
            <div class="button-row">
              <button class="secondary-button" onClick={async () => { const r = await fetch('/api/export', { method: 'POST', credentials: 'same-origin' }); if (!r.ok) { toast('Export failed.'); return; } saveBlob(await r.blob(), `advent-agent-${cal.season.year}.zip`); }}>Export a zip</button>
              <label class="secondary-button" style="cursor:pointer">Import a zip<input type="file" accept=".zip" style="display:none" onChange={async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return; const form = new FormData(); form.append('file', f); try { const r = await api.importZip(form); toast(`Imported ${r.files} files.`); } catch (err) { toast((err as Error).message); } }} /></label>
              <button class="ghost-button" onClick={async () => toast(`Backup written to ${(await api.backup()).folder}`)}>Back up now</button>
            </div>
            <label class="check" style="margin-top:14px"><input type="checkbox" checked={cfg.debugKeepWorkspace} onChange={(e) => patch({ debugKeepWorkspace: (e.target as HTMLInputElement).checked })} /><span class="check-text">Keep agent workspaces after sealing (debug)<small>Normally the private workspace is deleted once the gift is sealed. Logs stay in ~/.advent-agent either way and never reach this page.</small></span></label>
            <div class="field" style="margin-top:14px"><label for="timeout">Preparation timeout (minutes)</label><input id="timeout" type="number" min={1} max={240} value={cfg.timeoutMinutes} onChange={(e) => patch({ timeoutMinutes: Number((e.target as HTMLInputElement).value) || 20 })} /></div>
          </section>
        </div>
        </details>
        <div class="wizard-nav" style="position:sticky;bottom:12px;background:var(--cream);padding:12px 0">
          <span style="font-size:12px;color:var(--muted-strong);align-self:center">{dirty ? 'Unsaved changes' : 'All saved'}</span>
          <button class="primary-button" disabled={!dirty} onClick={save}>Save settings</button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
