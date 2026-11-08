/** Calendar home (DESIGN_SPEC §4, §5, §7, §9). */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { CalendarResponse } from '../../../src/shared/api.js';
import type { PublicDoor } from '../../../src/shared/door.js';
import { api, ApiError, subscribe } from '../api.js';
import { Board } from '../components/Board.js';
import { Gary } from '../components/Gary.js';
import { Header } from '../components/Header.js';
import { announce, formatTodayInZone, prefersReducedMotion, sleep, toast } from '../lib/ui.js';
import { Link, navigate } from '../router.js';

export function CalendarPage() {
  const [cal, setCal] = useState<CalendarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openingDay, setOpeningDay] = useState<number | undefined>();
  const [bumpDay, setBumpDay] = useState<number | undefined>();
  const busy = useRef(false);

  const load = async () => {
    try {
      const c = await api.calendar();
      setCal(c);
      setError(null);
      if (!c.setupComplete) navigate('/setup', { replace: true });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    void load();
    const unsub = subscribe((ev) => {
      if (ev.type === 'door') setCal((c) => (c ? { ...c, doors: c.doors.map((d) => (d.day === ev.door.day ? ev.door : d)), opened: c.doors.filter((d) => (d.day === ev.door.day ? ev.door.revealed : d.revealed)).length } : c));
      if (ev.type === 'rollover' || ev.type === 'calendar') void load();
    });
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const interval = window.setInterval(() => void load(), 60_000);
    // Restore focus to the envelope we came back from.
    const back = sessionStorage.getItem('advent-agent.focusDay');
    if (back) {
      sessionStorage.removeItem('advent-agent.focusDay');
      setTimeout(() => (document.querySelector(`.envelope[data-day="${back}"]`) as HTMLButtonElement | null)?.focus(), 80);
    }
    return () => { unsub(); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); window.clearInterval(interval); };
  }, []);

  const select = async (day: number, el: HTMLButtonElement) => {
    if (!cal || busy.current) return;
    const door = cal.doors.find((d) => d.day === day)!;
    if (!door.eligible) {
      setBumpDay(day);
      setTimeout(() => setBumpDay(undefined), 600);
      const msg = cal.eligibleThrough === 0 ? `The calendar is still sealed. Door 1 opens on December 1.` : `Not yet! Door ${day} opens on December ${day}.`;
      toast(msg);
      setTimeout(() => el.focus(), 0);
      return;
    }
    sessionStorage.setItem('advent-agent.focusDay', String(day));
    if (door.revealed) { navigate(`/gift/${cal.season.year}/${day}`); return; }
    busy.current = true;
    setOpeningDay(day);
    announce(door.envelope === 'ready_unopened' ? `Opening door ${day}.` : `Opening door ${day}. Your Secret Santa gets to work.`);
    const reduced = prefersReducedMotion();
    try {
      const [opened] = await Promise.all([
        door.envelope === 'ready_unopened' || door.envelope === 'failed' || door.envelope === 'generating' || door.envelope === 'waiting' ? Promise.resolve(door) : api.open(day),
        sleep(reduced ? 60 : 950),
      ]);
      if (opened.jobState === 'ready') {
        await api.reveal(day);
        navigate(`/gift/${cal.season.year}/${day}`);
      } else {
        navigate(`/door/${day}`);
      }
    } catch (e) {
      const err = e as ApiError;
      toast(err.message);
      setOpeningDay(undefined);
      busy.current = false;
      el.focus();
      void load();
    }
  };

  if (error) {
    return (
      <div class="shell">
        <Header />
        <div class="paper" style="margin-top:40px">
          <h1 class="page-title">The calendar is out of reach</h1>
          <p class="page-sub">{error}</p>
          <p class="page-sub">In a terminal, run <code class="inline">npx advent-agent</code> to start it and get a fresh link.</p>
        </div>
      </div>
    );
  }
  if (!cal) return <div class="shell"><Header /><p class="empty">Setting the table…</p></div>;

  const demo = cal.season.kind !== 'live';
  const { eligibleThrough, opened } = cal;
  const generating = cal.doors.filter((d) => d.envelope === 'generating' || d.envelope === 'waiting');
  const headline = eligibleThrough === 0 ? `${cal.countdownDays ?? 0} day${cal.countdownDays === 1 ? '' : 's'} until the first door` : eligibleThrough >= 24 ? 'All 24 doors are ready' : `December ${eligibleThrough} is here`;
  const description = eligibleThrough === 0
    ? 'Your first surprise is waiting for December 1.'
    : eligibleThrough >= 24
      ? 'Every door is open to you. Revisit any gift from the shelf.'
      : `Door ${eligibleThrough} is ready. You can also revisit any earlier gift.`;
  const nextUnlock = cal.nextUnlockAt && eligibleThrough > 0 && eligibleThrough < 24 ? `Your next little wonder opens ${cal.season.unlockHour === 0 ? 'at midnight' : `at ${String(cal.season.unlockHour).padStart(2, '0')}:00`}.` : undefined;

  return (
    <div class="shell">
      <Header season={cal.season.year} current="calendar" demo={demo} />
      <main class="experience">
        <section class="intro">
          <div class="eyebrow">The season of surprises</div>
          <h1 class="hero-title">A little <em>wonder,</em><br />every day.</h1>
          <p class="intro-copy">Twenty-four paper doors. Twenty-four unexpected gifts, made for you by your own AI agent. No spoilers, no peeking: each day reveals something new.</p>
          <section class="date-card" aria-label="Calendar status">
            <div class="date-card-top">
              <span><span class="live-dot" aria-hidden="true" />{demo ? 'Simulated December' : cal.season.timeZone}</span>
              <span>{demo ? (cal.demo?.simulatedDay === 0 ? 'Nov' : `Dec ${cal.demo?.simulatedDay ?? eligibleThrough}`) : formatTodayInZone(cal.now, cal.season.timeZone)}</span>
            </div>
            <div class="date-headline">{demo ? (cal.demo?.simulatedDay === 0 ? 'Before December: sealed' : `Previewing December ${cal.demo?.simulatedDay ?? eligibleThrough}`) : headline}</div>
            <p class="date-description">{demo ? 'This is a safe preview. Nothing is generated or purchased.' : description} {nextUnlock}</p>
            <div class="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={24} aria-valuenow={opened} aria-label="Gifts opened"><div class="progress-fill" style={`width:${(opened / 24) * 100}%`} /></div>
            <div class="progress-labels"><span>{opened} of 24 gifts opened</span><span>{eligibleThrough} available</span></div>
            {generating.length > 0 && (
              <div class="status-line"><span class="status-dot" aria-hidden="true" /> {generating.length === 1 ? `Your Secret Santa is preparing door ${generating[0]!.day}.` : `Your Secret Santa is preparing ${generating.length} doors.`}</div>
            )}
          </section>
          {demo && <DemoControls day={cal.demo?.simulatedDay ?? eligibleThrough} onChange={async (d) => setCal(await api.demoDay(d))} />}
          <div class="small-divider"><span aria-hidden="true">✳</span></div>
          <div class="how-it-works">
            <div class="how-row"><span class="how-number" aria-hidden="true">01</span><div class="how-copy"><strong>Wait for the date.</strong><br />The next envelope unlocks {cal.season.unlockHour === 0 ? 'at local midnight' : `at ${String(cal.season.unlockHour).padStart(2, '0')}:00`}.</div></div>
            <div class="how-row"><span class="how-number" aria-hidden="true">02</span><div class="how-copy"><strong>Open the surprise.</strong><br />{cal.season.mode === 'launched' ? 'Your agent makes the day’s gift when you open the door.' : cal.season.mode === 'connected' ? 'Open the door, then ask your agent to fill it.' : 'Open the door, then drop in what your agent made.'}</div></div>
            <div class="how-row"><span class="how-number" aria-hidden="true">03</span><div class="how-copy"><strong>Keep what you love.</strong><br />Play, explore, or download your gift. <Link href="/gifts">Your gifts</Link> keeps them all.</div></div>
          </div>
        </section>
        <Board
          doors={cal.doors}
          openingDay={openingDay}
          bumpDay={bumpDay}
          inert={openingDay !== undefined}
          onSelect={select}
          footer="Each door opens on its day"
          footerRight={eligibleThrough > 0 ? `✦ ${eligibleThrough} unlocked` : 'Sealed until December'}
        />
      </main>
      <Gary show={cal.gary.show} />
    </div>
  );
}

function DemoControls(props: { day: number; onChange: (day: number) => void }) {
  return (
    <section class="control-group">
      <div class="control-label">Experience the calendar</div>
      <div class="demo-controls">
        <div class="demo-title-row">
          <div class="demo-title">{props.day === 0 ? 'Before December' : `December ${props.day}`}</div>
          <div class="demo-caption">Preview time machine</div>
        </div>
        <input class="demo-range" aria-label="Simulated December day" type="range" min={0} max={24} step={1} value={props.day} onChange={(e) => props.onChange(Number((e.target as HTMLInputElement).value))} />
        <div class="demo-ticks" aria-hidden="true"><span>Nov</span><span>Dec 8</span><span>Dec 16</span><span>Dec 24</span></div>
        <p class="demo-note">Move the date to test locks and gift reveals. On December 8, door 9 stays closed. Demo gifts are fixtures, not generated.</p>
      </div>
    </section>
  );
}

export type { PublicDoor };
