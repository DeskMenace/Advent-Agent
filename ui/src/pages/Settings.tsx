/** Settings (DESIGN_SPEC §10): everything from setup, plus skills, service, data, danger zone. */
import { useEffect, useState } from 'preact/hooks';
import type { CalendarResponse } from '../../../src/shared/api.js';
import type { Config, Profile } from '../../../src/shared/config.js';
import { api, saveBlob } from '../api.js';
import { Header } from '../components/Header.js';
import { toast } from '../lib/ui.js';
import { BudgetSection, ConnectionSection, DeliverySection, ExtrasSection, ProfileSection, TimeSection, type Detect } from './SettingsSections.js';

export function SettingsPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [detect, setDetect] = useState<Detect | null>(null);
  const [cal, setCal] = useState<CalendarResponse | null>(null);
  const [dirty, setDirty] = useState(false);
  const [skills, setSkills] = useState<Awaited<ReturnType<typeof api.skillTargets>>['targets'] | null>(null);
  useEffect(() => {
    Promise.all([api.settings(), api.profile(), api.detect(), api.calendar(), api.skillTargets()]).then(([c, p, d, k, s]) => { setCfg(c); setProfile(p); setDetect(d); setCal(k); setSkills(s.targets); }).catch((e) => toast((e as Error).message));
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
      <Header current="settings" season={cal.season.year} demo={cal.season.kind !== 'live'} />
      <main style="padding-top:40px;max-width:860px;margin:0 auto">
        <div class="eyebrow">Settings</div>
        <h1 class="page-title">Your calendar, your rules.</h1>
        <p class="page-sub">Everything is stored on this computer in <code class="inline">~/.advent-agent</code>. Season {cal.season.year} · {cal.season.timeZone} · {cal.season.mode} mode.</p>
        <div class="paper"><ConnectionSection cfg={cfg} onChange={patch} detect={detect} /></div>
        <div class="paper" style="margin-top:20px"><TimeSection cfg={cfg} onChange={patch} deviceTimeZone={detect.deviceTimeZone} frozen={frozen} /></div>
        <div class="paper" style="margin-top:20px"><DeliverySection cfg={cfg} onChange={patch} /></div>
        <div class="paper" style="margin-top:20px"><ProfileSection cfg={cfg} onChange={patch} profile={profile} onProfile={(p) => { setProfile(p); setDirty(true); }} /></div>
        <div class="paper" style="margin-top:20px"><BudgetSection cfg={cfg} onChange={patch} /></div>
        <div class="paper" style="margin-top:20px"><ExtrasSection cfg={cfg} onChange={patch} /></div>
        <div class="paper" style="margin-top:20px">
          <section class="section" style="margin-top:0">
            <div class="eyebrow">Skills for connected apps</div>
            <h2>Install the Advent Agent skills into an agent</h2>
            <p class="page-sub">Launched agents need nothing installed: they read the bundled workshop. For apps that support Agent Skills, you can copy the eight skills into their skills folder. One folder, removed cleanly. Never automatic.</p>
            {skills?.map((t) => (
              <div class="check" key={t.host}>
                <span class="check-text"><strong>{t.label}</strong><small>{t.folder} · {t.files.length} files{t.installed ? ' · installed' : ''}</small></span>
                <span style="margin-left:auto" class="button-row">
                  {!t.installed ? <button class="secondary-button" onClick={async () => { const r = await api.skillsInstall(t.host, false); if (confirm(`${r.message}\n\nFiles:\n${r.files.slice(0, 12).join('\n')}${r.files.length > 12 ? '\n…' : ''}`)) { const w = await api.skillsInstall(t.host, true); toast(w.message); setSkills((await api.skillTargets()).targets); } }}>Install…</button>
                    : <button class="ghost-button" onClick={async () => { const r = await api.skillsUninstall(t.host); toast(r.message); setSkills((await api.skillTargets()).targets); }}>Uninstall</button>}
                </span>
              </div>
            ))}
          </section>
        </div>
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
        <div class="wizard-nav" style="position:sticky;bottom:12px;background:var(--cream);padding:12px 0">
          <span style="font-size:12px;color:var(--muted-strong);align-self:center">{dirty ? 'Unsaved changes' : 'All saved'}</span>
          <button class="primary-button" disabled={!dirty} onClick={save}>Save settings</button>
        </div>
      </main>
      <footer class="footer-credit"><a href="https://deskmenace.com/advent?ref=aa-app" target="_blank" rel="noopener noreferrer">Advent Agent · made by Desk Menace</a></footer>
    </div>
  );
}
