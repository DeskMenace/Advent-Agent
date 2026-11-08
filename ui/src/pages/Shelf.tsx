/** "Your gifts" shelf (D4) and the past-season archive (DESIGN_SPEC §3). Only revealed gifts, ever. */
import { useEffect, useState } from 'preact/hooks';
import type { CalendarResponse, ShelfItem } from '../../../src/shared/api.js';
import { api } from '../api.js';
import { Header } from '../components/Header.js';
import { formatDate } from '../lib/ui.js';
import { Link } from '../router.js';
import { DropArea } from './Door.js';

const KIND_GLYPH: Record<string, string> = { 'interactive-html': '✦', image: '❀', audio: '♫', video: '▶', document: '✎', card: '✉', song: '♪', 'real-world': '⌂', link: '↗', download: '⬇' };

export function ShelfPage() {
  const [data, setData] = useState<{ season: number | null; items: ShelfItem[] } | null>(null);
  const [cal, setCal] = useState<CalendarResponse | null>(null);
  const [addFor, setAddFor] = useState<number | null>(null);
  const load = () => Promise.all([api.shelf(), api.calendar()]).then(([s, c]) => { setData(s); setCal(c); });
  useEffect(() => { void load(); }, []);
  if (!data || !cal) return <div class="shell"><Header current="shelf" /><p class="empty">Dusting the shelf…</p></div>;
  const waiting = cal.doors.filter((d) => d.eligible && !d.revealed && (d.jobState === 'waiting_for_drop' || d.jobState === 'not_requested' || d.jobState === 'failed' || d.jobState === 'cancelled'));
  return (
    <div class="shell">
      <Header current="shelf" season={cal.season.year} demo={cal.season.kind !== 'live'} />
      <main style="padding-top:40px">
        <div class="eyebrow">Your gifts</div>
        <h1 class="page-title">Everything you have unwrapped.</h1>
        <p class="page-sub">Only opened gifts live here. Unopened doors keep their secrets. Past seasons are in the <Link href="/archive">archive</Link>.</p>
        <GiftGrid items={data.items} season={data.season ?? cal.season.year} />
        {cal.season.mode !== 'launched' && waiting.length > 0 && (
          <section class="section">
            <h2>Add a gift for a door</h2>
            <p class="page-sub">Got a file from your assistant? Pick the door it belongs to and drop it in.</p>
            <div class="chips" style="margin-bottom:16px">
              {waiting.map((d) => <button key={d.day} type="button" class="chip" aria-pressed={addFor === d.day} onClick={() => setAddFor(d.day)}>Door {d.day}</button>)}
            </div>
            {addFor && <DropArea day={addFor} onReport={() => undefined} onDone={() => { setAddFor(null); void load(); }} />}
          </section>
        )}
      </main>
      <footer class="footer-credit"><a href="https://deskmenace.com/advent?ref=aa-app" target="_blank" rel="noopener noreferrer">Advent Agent · made by Desk Menace</a></footer>
    </div>
  );
}

export function GiftGrid(props: { items: ShelfItem[]; season: number }) {
  if (props.items.length === 0) return <p class="empty">Nothing unwrapped yet. The shelf fills as you open doors.</p>;
  // D15: completed collections are shown together; unfinished sets stay in their place among the other gifts.
  const sets = new Map<string, ShelfItem[]>();
  for (const it of props.items) if (it.collection) sets.set(it.collection.set, [...(sets.get(it.collection.set) ?? []), it]);
  const complete = [...sets.entries()].filter(([, items]) => items.length >= (items[0]!.collection!.size ?? 3));
  const grouped = new Set(complete.flatMap(([, items]) => items.map((i) => i.day)));
  const card = (it: ShelfItem) => (
    <li key={it.day}>
      <Link href={`/gift/${props.season}/${it.day}`} class="shelf-item">
        <div class="shelf-thumb" aria-hidden="true">{it.thumbnailUrl ? <img src={it.thumbnailUrl} alt="" /> : <span>{KIND_GLYPH[it.kind] ?? '✦'}</span>}</div>
        <div class="shelf-body">
          <span class="eyebrow-sm">December {it.day}{it.category ? ` · ${it.category}` : ''}{it.collection ? ` · ${it.collection.index} of ${it.collection.size}` : ''}</span>
          <h2>{it.title}</h2>
          <span class="date">Opened {formatDate(it.revealedAt)}</span>
        </div>
      </Link>
    </li>
  );
  return (
    <ul class="shelf-grid">
      {complete.map(([set, items]) => (
        <li key={`set-${set}`} class="collection-group">
          <h2>Set complete: {set.replace(/-/g, ' ')}</h2>
          <ul class="shelf-grid">{items.sort((a, b) => a.collection!.index - b.collection!.index).map(card)}</ul>
        </li>
      ))}
      {props.items.filter((i) => !grouped.has(i.day)).map(card)}
    </ul>
  );
}

export function ArchivePage(props: { season?: number }) {
  const [seasons, setSeasons] = useState<Array<{ year: number; opened: number; timeZone: string; current: boolean }> | null>(null);
  const [items, setItems] = useState<ShelfItem[] | null>(null);
  useEffect(() => {
    api.archive().then((a) => setSeasons(a.seasons));
    if (props.season) api.archiveSeason(props.season).then((s) => setItems(s.items));
  }, [props.season]);
  return (
    <div class="shell">
      <Header current="archive" />
      <main style="padding-top:40px">
        <div class="eyebrow">Archive</div>
        <h1 class="page-title">{props.season ? `Advent ${props.season}` : 'Past seasons.'}</h1>
        <p class="page-sub">Every calendar you have had, with its gifts and their original dates. Nothing here is regenerated.</p>
        {!props.season && (seasons ? (
          seasons.length ? (
            <ul class="shelf-grid">
              {seasons.map((s) => (
                <li key={s.year}>
                  <Link href={`/archive/${s.year}`} class="shelf-item">
                    <div class="shelf-thumb" aria-hidden="true"><span>{s.year}</span></div>
                    <div class="shelf-body"><span class="eyebrow-sm">{s.current ? 'This season' : 'Past season'}</span><h2>Advent {s.year}</h2><span class="date">{s.opened} of 24 opened · {s.timeZone}</span></div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p class="empty">No seasons yet.</p>
        ) : <p class="empty">Looking…</p>)}
        {props.season && (items ? <GiftGrid items={items} season={props.season} /> : <p class="empty">Looking…</p>)}
      </main>
    </div>
  );
}
