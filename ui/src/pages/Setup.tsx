/** First-run setup wizard (DESIGN_SPEC §10, AGENT_CONNECTIONS §1, D6, D7, D9). Calm, honest, no keys required. */
import { useEffect, useState } from 'preact/hooks';
import type { Config, Profile } from '../../../src/shared/config.js';
import { api } from '../api.js';
import { Header } from '../components/Header.js';
import { toast } from '../lib/ui.js';
import { navigate } from '../router.js';
import { DropArea, PortableRequest } from './Door.js';
import { ConnectionSection, ProfileSection, BudgetSection, TimeSection, DeliverySection, ExtrasSection, type Detect } from './SettingsSections.js';

const STEPS = ['Welcome', 'Your agent', 'Time', 'Delivery', 'Personal touch', 'Budgets', 'Extras', 'Ready'] as const;

/** D15: Day 1 is made during setup. Launched agents start on their own; connected and portable agents are asked now. */
function DayOne(props: { mode: string }) {
  const [door, setDoor] = useState<{ wrapping: boolean } | null>(null);
  useEffect(() => {
    let alive = true;
    const poll = () => api.calendar().then((c) => { if (alive) setDoor(c.doors[0] ?? null); }).catch(() => undefined);
    void poll();
    const t = window.setInterval(poll, 3000);
    return () => { alive = false; window.clearInterval(t); };
  }, []);
  if (props.mode === 'launched') {
    return <div class="notice"><strong>Your Secret Santa is already wrapping door 1.</strong> {door?.wrapping === false ? 'It is done and sealed. It will be waiting for you on December 1.' : 'It gets extra room for this first gift, so it may take a few minutes. You can close this page; it keeps going.'}</div>;
  }
  if (props.mode === 'connected') {
    return <div class="notice"><strong>Door 1 is made now, so it opens instantly on December 1.</strong> Tell your agent: <em>“Prepare door 1 of my Advent Agent calendar.”</em> It stays sealed until then.</div>;
  }
  if (props.mode === 'portable') {
    return (
      <div class="notice">
        <strong>Door 1 is made now, so it opens instantly on December 1.</strong> Paste this into your assistant, then drop what it sends you below. It stays sealed until December 1.
        <div style="margin-top:10px"><PortableRequest day={1} /></div>
        <div style="margin-top:10px"><DropArea day={1} onReport={() => undefined} onDone={() => toast('Door 1 is sealed. See you on December 1.')} /></div>
      </div>
    );
  }
  return null;
}

export function SetupPage() {
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [detect, setDetect] = useState<Detect | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([api.settings(), api.profile(), api.detect()]).then(([c, p, d]) => {
      setCfg(c.setupComplete ? c : { ...c, timeZone: d.deviceTimeZone });
      setProfile(p);
      setDetect(d);
    }).catch((e) => toast((e as Error).message));
  }, []);
  if (!cfg || !profile || !detect) return <div class="shell"><Header current="setup" /><p class="empty">Getting the wrapping paper out…</p></div>;

  const patch = (p: Partial<Config>) => setCfg({ ...cfg, ...p });
  const next = async () => {
    if (step === STEPS.length - 2) {
      setBusy(true);
      try {
        await api.saveProfile(profile);
        await api.completeSetup(cfg);
        setStep(step + 1);
      } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
      return;
    }
    setStep(Math.min(STEPS.length - 1, step + 1));
    window.scrollTo({ top: 0 });
  };
  const installed = detect.adapters.filter((a) => a.detection.installed);

  return (
    <div class="shell">
      <Header current="setup" />
      <main style="padding-top:40px;max-width:860px;margin:0 auto">
        <ol class="wizard-steps" aria-label="Setup steps">
          {STEPS.map((s, i) => <li key={s}><span class={i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>{i + 1}. {s}</span></li>)}
        </ol>
        <div class="paper">
          {step === 0 && (
            <>
              <div class="eyebrow">Welcome</div>
              <h1 class="page-title">Your AI agent is your Secret Santa.</h1>
              <p class="page-sub">Twenty-four doors, December 1 to 24. Behind each one, a gift your own agent makes: a game, a song, a card, a plan, a real thing it found for you. The calendar keeps the surprise; your agent does the rest.</p>
              <p class="page-sub">Everything stays on this computer. No account, no API keys, no tracking. Your agent works the way it normally does, with its own memory and its own provider.</p>
              <p class="page-sub"><strong>Your agent never buys or books anything.</strong> When a gift is a real object or experience, it prepares a proposal and you decide.</p>
              {installed.length === 0 && <div class="notice">No terminal agent was found on this computer. That is fine: you can connect a desktop app through MCP, or paste a request into any chat assistant and drop the result in. Or try the demo first: <code class="inline">npx advent-agent demo</code>.</div>}
            </>
          )}
          {step === 1 && <ConnectionSection cfg={cfg} onChange={patch} detect={detect} />}
          {step === 2 && <TimeSection cfg={cfg} onChange={patch} deviceTimeZone={detect.deviceTimeZone} />}
          {step === 3 && <DeliverySection cfg={cfg} onChange={patch} />}
          {step === 4 && <ProfileSection cfg={cfg} onChange={patch} profile={profile} onProfile={setProfile} />}
          {step === 5 && <BudgetSection cfg={cfg} onChange={patch} />}
          {step === 6 && <ExtrasSection cfg={cfg} onChange={patch} setup />}
          {step === 7 && (
            <>
              <div class="eyebrow">Ready</div>
              <h1 class="page-title">The calendar is on the wall.</h1>
              <p class="page-sub">Door 1 opens on December 1{cfg.unlockHour ? ` at ${String(cfg.unlockHour).padStart(2, '0')}:00` : ' at midnight'} in {cfg.timeZone}. Until then the envelopes stay sealed. You can change everything in Settings.</p>
              <DayOne mode={cfg.connection.mode} />
              <h2 class="minor">A reminder, if you like</h2>
              <p class="page-sub" style="margin-bottom:8px">One “Your door is open” event a day in your own calendar app. A local file: no account, no tracking.</p>
              <div class="button-row" style="margin-bottom:20px"><a class="secondary-button" href="/api/reminder.ics" download="advent-agent-doors.ics">Download the reminder (.ics)</a></div>
              <div class="button-row"><button class="primary-button" onClick={() => navigate('/')}>Show me the calendar</button></div>
            </>
          )}
          {step < STEPS.length - 1 && (
            <div class="wizard-nav">
              <button class="ghost-button" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
              <button class="primary-button" disabled={busy} onClick={next}>{step === STEPS.length - 2 ? 'Hang the calendar' : 'Continue'}</button>
            </div>
          )}
        </div>
      </main>
      <footer class="footer-credit"><a href="https://deskmenace.com/advent?ref=aa-app" target="_blank" rel="noopener noreferrer">Advent Agent · made by Desk Menace</a></footer>
    </div>
  );
}
