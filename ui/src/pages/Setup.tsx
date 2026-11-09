/**
 * First-run setup (D6, D11): connect an agent, then hang the calendar. Delivery and budget are asked by the onboarding
 * modal on the calendar (handoff §0); the profile and the reminder live in Settings only.
 */
import { useEffect, useState } from 'preact/hooks';
import type { Config } from '../../../src/shared/config.js';
import { api } from '../api.js';
import { Footer, Header } from '../components/Header.js';
import { toast } from '../lib/ui.js';
import { navigate } from '../router.js';
import { ConnectionSection, type Detect } from './SettingsSections.js';

export function SetupPage() {
  const [step, setStep] = useState(0);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [detect, setDetect] = useState<Detect | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([api.settings(), api.detect()]).then(([c, d]) => {
      setCfg(c.setupComplete ? c : { ...c, timeZone: d.deviceTimeZone, language: (navigator.language || 'en').split('-')[0]! });
      setDetect(d);
    }).catch((e) => toast((e as Error).message));
  }, []);
  if (!cfg || !detect) return <div class="shell"><Header current="setup" /></div>;

  const patch = (p: Partial<Config>) => setCfg({ ...cfg, ...p });
  const finish = async () => {
    setBusy(true);
    try {
      await api.completeSetup(cfg);
      navigate('/');
    } catch (e) { toast((e as Error).message); } finally { setBusy(false); }
  };
  const installed = detect.adapters.filter((a) => a.detection.installed);

  return (
    <div class="shell">
      <Header current="setup" />
      <main style="padding-top:40px;max-width:860px;margin:0 auto">
        <div class="paper">
          {step === 0 ? (
            <>
              <p class="home-eyebrow" style="justify-content:flex-start">Welcome</p>
              <h1 class="page-title">Your AI agent is your <em style="color:var(--burgundy)">Secret Santa.</em></h1>
              <p class="page-sub">Twenty-four doors, December 1 to 24. Behind each one, something your own agent made just for you. Everything stays on this computer: no account, no API keys, no tracking.</p>
              <p class="page-sub"><strong>Your agent never buys or books anything.</strong> When a gift is a real object or experience, it prepares a proposal and you decide.</p>
              {installed.length === 0 && <div class="notice">No terminal agent was found on this computer. That is fine: you can connect a desktop app through MCP, or paste a request into any chat assistant and drop the result in.</div>}
            </>
          ) : <ConnectionSection cfg={cfg} onChange={patch} detect={detect} />}
          <div class="wizard-nav">
            <button class="ghost-button" disabled={step === 0} onClick={() => setStep(0)}>Back</button>
            {step === 0
              ? <button class="primary-button" onClick={() => { setStep(1); window.scrollTo({ top: 0 }); }}>Continue</button>
              : <button class="primary-button" disabled={busy} onClick={finish}>Hang the calendar</button>}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
