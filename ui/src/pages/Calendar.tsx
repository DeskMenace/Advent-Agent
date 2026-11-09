/** Calendar home (handoff §1.1–1.4): intro, the wooden board, onboarding on first launch, the reveal modal. */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { CalendarResponse } from '../../../src/shared/api.js';
import type { PublicDoor } from '../../../src/shared/door.js';
import { api, subscribe } from '../api.js';
import { Board, lookOf } from '../components/Board.js';
import { Gary } from '../components/Gary.js';
import { Footer, Header } from '../components/Header.js';
import { Lock } from '../components/Icons.js';
import { Onboarding } from '../components/Onboarding.js';
import { RevealModal } from '../components/RevealModal.js';
import { emitAdvent } from '../lib/site.js';
import { prefersReducedMotion, sleep } from '../lib/ui.js';
import { Link, navigate } from '../router.js';

function Steps(props: { unlockHour: number }) {
  const at = props.unlockHour === 0 ? 'at local midnight' : `at ${props.unlockHour}:00`;
  return (
    <ol class="steps">
      <li><span class="n">01</span><div><p class="t">Wait for your day.</p><p class="d">A new envelope unlocks {at}.</p></div></li>
      <li><span class="n">02</span><div><p class="t">Open the surprise.</p><p class="d">You never know what your agent will make next.</p></div></li>
      <li><span class="n">03</span><div><p class="t">Keep the magic.</p><p class="d">All your surprises live in <Link href="/gifts">Your Gifts</Link>.</p></div></li>
    </ol>
  );
}

function Footnote() {
  return <p class="footnote"><Lock /><span>Runs entirely on your computer. Nothing is sent to us.</span></p>;
}

export function CalendarPage(props: { door?: number }) {
  const [cal, setCal] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingDay, setOpeningDay] = useState<number | undefined>();
  const [shakeDay, setShakeDay] = useState<number | undefined>();
  const [modalDay, setModalDay] = useState<number | undefined>();
  const [onboarded, setOnboarded] = useState(false);
  const busy = useRef(false);

  const load = async () => {
    try {
      const c = await api.calendar();
      setCal(c);
      setError(null);
      if (!c.setupComplete) navigate('/setup', { replace: true });
      return c;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  };

  useEffect(() => {
    void load().then((c) => {
      // /door/:day deep links open that door's reveal modal.
      if (c && props.door && c.doors[props.door - 1] && lookOf(c.doors[props.door - 1]!) !== 'locked') setModalDay(props.door);
    });
    const unsub = subscribe((ev) => {
      if (ev.type === 'door') {
        setCal((c) => {
          if (!c) return c;
          const before = c.doors[ev.door.day - 1];
          if (before && lookOf(before) !== 'preparing' && lookOf(ev.door) === 'preparing') emitAdvent('gift:preparing', ev.door.day);
          if (before && before.jobState !== 'ready' && ev.door.jobState === 'ready') emitAdvent('gift:ready', ev.door.day);
          return { ...c, doors: c.doors.map((d) => (d.day === ev.door.day ? ev.door : d)), opened: c.doors.filter((d) => (d.day === ev.door.day ? ev.door.revealed : d.revealed)).length };
        });
      }
      if (ev.type === 'rollover' || ev.type === 'calendar') void load();
    });
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    const interval = window.setInterval(() => void load(), 60_000);
    return () => { unsub(); document.removeEventListener('visibilitychange', onVisible); window.clearInterval(interval); };
  }, []);

  const select = async (day: number, el: HTMLButtonElement) => {
    if (!cal || busy.current) return;
    const door = cal.doors.find((d) => d.day === day)!;
    const look = lookOf(door);
    if (look === 'opened') { navigate(`/gifts/${day}`); return; }
    if (look === 'locked') {
      setShakeDay(undefined);
      requestAnimationFrame(() => setShakeDay(day));
      setTimeout(() => setShakeDay((d) => (d === day ? undefined : d)), 450);
      emitAdvent('door:locked-click', day);
      return;
    }
    busy.current = true;
    if (door.eligible) {
      setOpeningDay(day);
      if (!prefersReducedMotion()) await sleep(650);
    }
    setModalDay(day);
    busy.current = false;
    void el;
  };

  const closeModal = () => {
    const day = modalDay;
    setModalDay(undefined);
    setOpeningDay(undefined);
    if (props.door) history.replaceState(null, '', '/');
    void load();
    if (day) setTimeout(() => (document.querySelector(`.env[data-day="${day}"]`) as HTMLButtonElement | null)?.focus(), 30);
  };

  if (error) {
    return (
      <div class="shell">
        <Header current="calendar" />
        <div class="paper" style="margin-top:40px">
          <h1 class="page-title">The calendar is out of reach</h1>
          <p class="page-sub">{error}</p>
          <p class="page-sub">In a terminal, run <code class="inline">npx advent-agent</code> to start it and get a fresh link.</p>
        </div>
      </div>
    );
  }
  if (!cal) return <div class="shell"><Header current="calendar" /></div>;

  const showOnboarding = cal.setupComplete && !cal.onboardingDone && !onboarded;
  const blurred = showOnboarding || modalDay !== undefined;
  return (
    <>
      <div class={`shell${blurred ? ' behind-modal' : ''}`} aria-hidden={blurred ? 'true' : undefined}>
        <Header current="calendar" />
        <main class="home">
          <section class="home-intro">
            <p class="home-eyebrow">The season of surprises</p>
            <h1 class="home-title">Your AI agent is your <em>Secret Santa.</em></h1>
            <p class="home-sub">Discover what it thinks you'd love, one gift at a time.</p>
            <div class="desk-only"><Steps unlockHour={cal.season.unlockHour} /></div>
            <div class="desk-only footnote-wrap"><Footnote /></div>
          </section>
          <section>
            <Board doors={cal.doors} todayDay={cal.todayDay} openingDay={openingDay} shakeDay={shakeDay} unlocked={cal.eligibleThrough} onSelect={select} />
          </section>
          <section class="mobile-only">
            <Steps unlockHour={cal.season.unlockHour} />
            <Footnote />
          </section>
        </main>
        <Footer />
      </div>
      <Gary show={cal.gary.show && !showOnboarding} />
      {showOnboarding && <Onboarding mode={cal.season.mode} unlockHour={cal.season.unlockHour} onDone={() => { setOnboarded(true); void load(); }} />}
      {modalDay !== undefined && <RevealModal day={modalDay} cal={cal} onClose={closeModal} />}
    </>
  );
}

export type { PublicDoor };
