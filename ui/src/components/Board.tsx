/** The wooden board: frame, ribbon and our red bow, 24 envelopes in four wordless states (handoff §1.2). */
import type { PublicDoor } from '../../../src/shared/door.js';
import { Star } from './Icons.js';

/** Envelope styles from the mockup, cycled over the 24 doors. */
const STYLES = [
  'env-burgundy', 'env-cream', 'env-forest', 'env-stripe-red',
  'env-cream', 'env-gold', 'env-cream', 'env-burgundy',
  'env-forest', 'env-cream', 'env-burgundy', 'env-cream-b',
  'env-gold', 'env-forest', 'env-stripe-green', 'env-burgundy',
  'env-cream', 'env-burgundy', 'env-cream', 'env-gold',
  'env-burgundy', 'env-cream', 'env-forest', 'env-stripe-gold',
];

export function Bow(props: { class?: string }) {
  return (
    <svg class={props.class ?? 'bow'} viewBox="0 0 400 180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leftLoop" x1="0" x2="1" y1="0" y2=".7"><stop stop-color="#9b1b30" /><stop offset=".45" stop-color="#df4454" /><stop offset="1" stop-color="#8d142a" /></linearGradient>
        <linearGradient id="rightLoop" x1="0" x2="1" y1="0" y2=".7"><stop stop-color="#7f1126" /><stop offset=".55" stop-color="#cd3448" /><stop offset="1" stop-color="#e25764" /></linearGradient>
        <linearGradient id="tail" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#d74152" /><stop offset=".5" stop-color="#a61f36" /><stop offset="1" stop-color="#7b132a" /></linearGradient>
      </defs>
      <g class="bow-tails">
        <path fill="url(#tail)" d="M192 86 31 155 94 159 96 180 223 105Z" />
        <path fill="url(#tail)" d="M208 90 369 154 310 158 302 179 181 106Z" />
        <path fill="#751026" opacity=".53" d="M198 97 94 159 110 154 221 110Z M211 93 300 174 294 154 186 103Z" />
      </g>
      <g class="bow-left">
        <path fill="url(#leftLoop)" d="M198 78Q124 22 94 25Q62 27 99 79Q115 111 188 98Z" />
        <path fill="#e95260" opacity=".6" d="M186 85Q130 33 92 31Q133 39 169 91Z" />
        <path fill="url(#leftLoop)" d="M188 86Q116 80 99 116Q128 132 189 102Z" />
        <path fill="#8c152b" d="M185 91Q116 100 105 118Q143 104 190 102Z" opacity=".6" />
      </g>
      <g class="bow-right">
        <path fill="url(#rightLoop)" d="M200 79Q269 22 306 24Q343 28 301 81Q278 109 212 98Z" />
        <path fill="#f26368" d="M210 88Q277 33 303 30Q260 37 225 93Z" opacity=".55" />
        <path fill="url(#rightLoop)" d="M214 87Q279 82 304 118Q261 132 211 105Z" />
        <path fill="#7c1024" d="M215 94Q287 97 294 120Q258 103 213 104Z" opacity=".46" />
      </g>
      <g class="bow-knot">
        <rect x="182" y="71" width="36" height="42" rx="4" fill="#ae243b" />
        <path d="M184 73h9v38h-9z" fill="#ee5866" opacity=".35" />
      </g>
    </svg>
  );
}

export type Look = 'locked' | 'unlocked' | 'preparing' | 'opened';

/** The four visual states. A locked door that is being wrapped early (Day 1, the finale) shows the ribbon too. */
export function lookOf(d: PublicDoor): Look {
  if (d.revealed) return 'opened';
  if (d.wrapping) return 'preparing';
  if (!d.eligible) return 'locked';
  if (d.envelope === 'generating' || d.envelope === 'waiting') return 'preparing';
  return 'unlocked';
}

function label(d: PublicDoor, look: Look): string {
  const date = `December ${d.day}`;
  switch (look) {
    case 'opened': return d.title ? `${date}, opened: ${d.title}` : `${date}, opened`;
    case 'preparing': return d.eligible ? `${date}, your Secret Santa is wrapping it` : `${date}, locked, your Secret Santa is wrapping it`;
    case 'locked': return `${date}, locked`;
    default: return `${date}, gift ready to open`;
  }
}

export interface BoardProps {
  doors: PublicDoor[];
  todayDay: number;
  openingDay?: number;
  shakeDay?: number;
  unlocked: number;
  onSelect: (day: number, el: HTMLButtonElement) => void;
}

export function Board(props: BoardProps) {
  return (
    <section class="board-wrap" aria-label="December advent doors">
      <div class="board-frame">
        <div class="wood">
          <div class="board-top" aria-hidden="true">
            <div class="ribbon-h" />
            <div class="ribbon-v" />
            <Bow />
          </div>
          <ol class="board-grid" aria-label="Envelopes 1 to 24">
            {props.doors.map((d) => {
              const look = lookOf(d);
              const cls = ['env', STYLES[d.day - 1], look, props.openingDay === d.day ? 'opening' : '', props.shakeDay === d.day ? 'shake' : ''].filter(Boolean).join(' ');
              return (
                <li key={d.day}>
                  <button type="button" class={cls} data-day={d.day} data-state={look} aria-label={label(d, look)} onClick={(e) => props.onSelect(d.day, e.currentTarget)}>
                    {look === 'opened' && (
                      <>
                        <span class="inside" />
                        <span class="peek">{d.thumbnailUrl ? <img src={d.thumbnailUrl} alt="" loading="lazy" /> : <Star />}</span>
                        <span class="pocket" />
                      </>
                    )}
                    <span class="flap" />
                    <span class="num" aria-hidden="true">{d.day}</span>
                    {look === 'locked' && <span class="seal" />}
                    {look === 'unlocked' && <Star class="corner" />}
                    {look === 'unlocked' && d.day === props.todayDay && <span class="glint" />}
                    {look === 'preparing' && <><span class="tie" /><span class="knot" /></>}
                    {look === 'preparing' && !d.eligible && <span class="seal" />}
                  </button>
                </li>
              );
            })}
          </ol>
          <p class="board-foot" aria-hidden="true">A small surprise is a beautiful thing</p>
        </div>
      </div>
      <div class="board-footer">
        <span><Star /> Each door opens on its day</span>
        <span>✦ {props.unlocked} unlocked</span>
      </div>
    </section>
  );
}
