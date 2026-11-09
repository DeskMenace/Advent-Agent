/**
 * First-launch onboarding (handoff §0): two steps over the blurred calendar, never about the user.
 * Closing at any point applies the defaults. Either way Day 1 starts being prepared (D15).
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ConnectionMode } from '../../../src/shared/door.js';
import { api } from '../api.js';
import { toast } from '../lib/ui.js';

export type Delivery = 'on_demand' | 'scheduled';
export type Generosity = 'light' | 'standard' | 'generous';

const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function DeliveryChoice(props: {
  mode: ConnectionMode;
  delivery: Delivery;
  scheduleTime: string;
  unlockHour: number;
  frozenUnlock?: boolean;
  onChange: (p: { delivery?: Delivery; scheduleTime?: string; unlockHour?: number }) => void;
}) {
  const canSchedule = props.mode === 'launched';
  return (
    <div class="choice-stack">
      <div class="choices two" role="radiogroup" aria-label="When does your Secret Santa work?">
        <button type="button" role="radio" class="choice" aria-checked={props.delivery === 'on_demand'} onClick={() => props.onChange({ delivery: 'on_demand' })}>
          <span class="choice-name">On demand</span>
          <span class="choice-copy">Your agent starts when you open the door. Watch it being wrapped.</span>
        </button>
        <button type="button" role="radio" class="choice" aria-checked={props.delivery === 'scheduled'} disabled={!canSchedule} onClick={() => props.onChange({ delivery: 'scheduled' })}>
          <span class="choice-name">Scheduled</span>
          <span class="choice-copy">Your agent works ahead, so each door is ready when it unlocks.</span>
        </button>
      </div>
      {!canSchedule && <p class="muted-line">Your agent works when you call it, so gifts are made on demand.</p>}
      {canSchedule && props.delivery === 'scheduled' && (
        <div class="time-row">
          <label>Wrap gifts at<input type="time" value={props.scheduleTime} onChange={(e) => props.onChange({ scheduleTime: (e.target as HTMLInputElement).value || '03:00' })} /></label>
          <label>Doors unlock at
            <select value={props.unlockHour} disabled={props.frozenUnlock} onChange={(e) => props.onChange({ unlockHour: Number((e.target as HTMLSelectElement).value) })}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hh(h)}</option>)}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}

export function BudgetChoice(props: { value: Generosity; onChange: (g: Generosity) => void }) {
  const tiers: Array<[Generosity, string, string]> = [
    ['light', 'Light', 'Smaller gifts. Easy on your tokens.'],
    ['standard', 'Standard', 'A balance of surprise and tokens.'],
    ['generous', 'Generous', 'Bigger gifts. Uses more tokens.'],
  ];
  return (
    <div class="choice-stack">
      <div class="choices three" role="radiogroup" aria-label="How generous is your Secret Santa?">
        {tiers.map(([v, name, copy]) => (
          <button key={v} type="button" role="radio" class="choice" aria-checked={props.value === v} onClick={() => props.onChange(v)}>
            <span class="choice-name">{name}</span>
            <span class="choice-copy">{copy}</span>
          </button>
        ))}
      </div>
      <p class="muted-line small">About 30k, 100k or 300k tokens per gift. Day 1 and December 24 get extra room.</p>
    </div>
  );
}

export function Onboarding(props: { mode: ConnectionMode; unlockHour: number; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [delivery, setDelivery] = useState<Delivery>('on_demand');
  const [scheduleTime, setScheduleTime] = useState('03:00');
  const [unlockHour, setUnlockHour] = useState(props.unlockHour);
  const [generosity, setGenerosity] = useState<Generosity>('standard');
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);

  const finish = async (useDefaults: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.completeOnboarding(useDefaults ? {} : { deliveryMode: delivery, scheduleTime, unlockHour, generosity });
    } catch (e) { toast((e as Error).message); }
    props.onDone();
  };

  useEffect(() => {
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') void finish(true); };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove('modal-open'); };
  }, []);

  return (
    <div class="onboard-backdrop" onClick={(e) => { if (e.target === e.currentTarget) void finish(true); }}>
      <div class="onboard" role="dialog" aria-modal="true" aria-labelledby="onboard-title" tabIndex={-1} ref={dialog}>
        <button type="button" class="icon-close" aria-label="Close" onClick={() => finish(true)}>×</button>
        <p class="sr-only">Step {step + 1} of 2</p>
        <div class="dots" aria-hidden="true"><span class={step === 0 ? 'on' : ''} /><span class={step === 1 ? 'on' : ''} /></div>
        {step === 0 ? (
          <>
            <h2 id="onboard-title" class="onboard-title">When does your Secret Santa work?</h2>
            <DeliveryChoice mode={props.mode} delivery={delivery} scheduleTime={scheduleTime} unlockHour={unlockHour}
              onChange={(p) => { if (p.delivery) setDelivery(p.delivery); if (p.scheduleTime) setScheduleTime(p.scheduleTime); if (p.unlockHour !== undefined) setUnlockHour(p.unlockHour); }} />
          </>
        ) : (
          <>
            <h2 id="onboard-title" class="onboard-title">How generous is your Secret Santa?</h2>
            <BudgetChoice value={generosity} onChange={setGenerosity} />
          </>
        )}
        <div class="onboard-nav">
          <button type="button" class="ghost-button" disabled={step === 0} onClick={() => setStep(0)}>Back</button>
          {step === 0
            ? <button type="button" class="primary-button" onClick={() => setStep(1)}>Next</button>
            : <button type="button" class="primary-button" disabled={busy} onClick={() => finish(false)}>Start wrapping</button>}
        </div>
      </div>
    </div>
  );
}
