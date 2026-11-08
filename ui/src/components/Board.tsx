/** The wooden board: ribbon, bow, 24 envelopes (DESIGN_SPEC §4.2–4.4, §7). */
import { useRef } from 'preact/hooks';
import type { PublicDoor } from '../../../src/shared/door.js';
import { envelopePattern } from '../lib/ui.js';

export function Bow() {
  return (
    <svg class="bow" viewBox="0 0 400 180" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="leftLoop" x1="0" x2="1" y1="0" y2=".7"><stop stop-color="#9b1b30" /><stop offset=".45" stop-color="#df4454" /><stop offset="1" stop-color="#8d142a" /></linearGradient>
        <linearGradient id="rightLoop" x1="0" x2="1" y1="0" y2=".7"><stop stop-color="#7f1126" /><stop offset=".55" stop-color="#cd3448" /><stop offset="1" stop-color="#e25764" /></linearGradient>
        <linearGradient id="tail" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#d74152" /><stop offset=".5" stop-color="#a61f36" /><stop offset="1" stop-color="#7b132a" /></linearGradient>
      </defs>
      <path fill="url(#tail)" d="M192 86 31 155 94 159 96 180 223 105Z" />
      <path fill="url(#tail)" d="M208 90 369 154 310 158 302 179 181 106Z" />
      <path fill="#751026" opacity=".53" d="M198 97 94 159 110 154 221 110Z M211 93 300 174 294 154 186 103Z" />
      <path fill="url(#leftLoop)" d="M198 78Q124 22 94 25Q62 27 99 79Q115 111 188 98Z" />
      <path fill="#e95260" opacity=".6" d="M186 85Q130 33 92 31Q133 39 169 91Z" />
      <path fill="url(#leftLoop)" d="M188 86Q116 80 99 116Q128 132 189 102Z" />
      <path fill="#8c152b" d="M185 91Q116 100 105 118Q143 104 190 102Z" opacity=".6" />
      <path fill="url(#rightLoop)" d="M200 79Q269 22 306 24Q343 28 301 81Q278 109 212 98Z" />
      <path fill="#f26368" d="M210 88Q277 33 303 30Q260 37 225 93Z" opacity=".55" />
      <path fill="url(#rightLoop)" d="M214 87Q279 82 304 118Q261 132 211 105Z" />
      <path fill="#7c1024" d="M215 94Q287 97 294 120Q258 103 213 104Z" opacity=".46" />
      <rect x="182" y="71" width="36" height="42" rx="4" fill="#ae243b" />
      <path d="M184 73h9v38h-9z" fill="#ee5866" opacity=".35" />
    </svg>
  );
}

function label(d: PublicDoor): string {
  switch (d.envelope) {
    case 'locked': return `December ${d.day}, locked until December ${d.day}`;
    case 'opened': return `December ${d.day}, opened gift, view again`;
    case 'generating': return `December ${d.day}, your Secret Santa is preparing your gift`;
    case 'waiting': return `December ${d.day}, waiting for your agent`;
    case 'ready_unopened': return `December ${d.day}, your gift is ready, open it`;
    case 'failed': return `December ${d.day}, the preparation failed, open to try again`;
    case 'today': return `December ${d.day}, today, open your gift`;
    default: return `December ${d.day}, open your gift`;
  }
}

function icon(d: PublicDoor): string {
  switch (d.envelope) {
    case 'opened': return '✦';
    case 'locked': return '⌁';
    case 'generating': return '✳';
    case 'waiting': return '◌';
    case 'ready_unopened': return '✧';
    case 'failed': return '↻';
    default: return '';
  }
}

export interface BoardProps {
  doors: PublicDoor[];
  openingDay?: number;
  bumpDay?: number;
  inert?: boolean;
  onSelect: (day: number, el: HTMLButtonElement) => void;
  footer: string;
  footerRight: string;
}

export function Board(props: BoardProps) {
  const refs = useRef<Record<number, HTMLButtonElement | null>>({});
  return (
    <section class="board-wrap" aria-label="December advent doors">
      <div class="board-shadow" />
      <div class="wood-board">
        <div class="board-top">
          <div class="ribbon-v" />
          <div class="ribbon-h" />
          <Bow />
        </div>
        <ol class={`board-grid${props.inert ? ' inert' : ''}`} aria-label="Envelopes 1 to 24">
          {props.doors.map((d) => (
            <li key={d.day}>
              <button
                type="button"
                ref={(el) => { refs.current[d.day] = el; }}
                class={`envelope ${envelopePattern(d.day)} ${d.envelope}${props.openingDay === d.day ? ' opening' : ''}${props.bumpDay === d.day ? ' bump' : ''}`}
                data-day={d.day}
                data-state={d.envelope}
                aria-label={label(d)}
                title={d.envelope === 'locked' ? `Opens December ${d.day}` : d.envelope === 'opened' ? 'Revisit your gift' : 'Open your gift'}
                onClick={(e) => props.onSelect(d.day, e.currentTarget)}
              >
                <span class="paper" />
                <span class="letter" />
                <span class="number" aria-hidden="true">{d.day}</span>
                <span class="flap" />
                <span class="date-icon" aria-hidden="true">{icon(d)}</span>
              </button>
            </li>
          ))}
        </ol>
        <div class="board-foot" aria-hidden="true">A small surprise is a beautiful thing</div>
      </div>
      <div class="board-footer">
        <span><span class="key-icon" aria-hidden="true">✧</span>&nbsp; {props.footer}</span>
        <span>{props.footerRight}</span>
      </div>
      <div class="board-credit">
        <a href="https://deskmenace.com/advent?ref=aa-app" target="_blank" rel="noopener noreferrer">Advent Agent · made by Desk Menace</a>
      </div>
    </section>
  );
}
