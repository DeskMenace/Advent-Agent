/**
 * D19: an optional .ics file with a daily "Your door is open" event at unlockHour in the season's timezone,
 * December 1–24. Times are written in UTC (computed from the frozen IANA zone), so every calendar app agrees
 * without needing VTIMEZONE data. Local file: no account, no subscription URL, no tracking.
 */
import { unlockInstant } from './time.js';

export interface ReminderInput {
  year: number;
  timeZone: string;
  unlockHour: number;
  /** Link back to the calendar (localhost). Optional. */
  url?: string;
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

function fold(line: string): string {
  // RFC 5545: lines longer than 75 octets are folded with CRLF + space.
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, 'utf8') > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut), 'utf8') > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function buildReminderIcs(input: ReminderInput, now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Advent Agent//Door reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc('Advent Agent')}`,
  ];
  for (let day = 1; day <= 24; day++) {
    const start = unlockInstant(input, day);
    const end = new Date(start.getTime() + 15 * 60_000);
    lines.push(
      'BEGIN:VEVENT',
      `UID:advent-agent-${input.year}-door-${String(day).padStart(2, '0')}@localhost`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(`Your door is open: December ${day}`)}`,
      `DESCRIPTION:${esc(`Door ${day} of your Advent Agent calendar is open.${input.url ? ` ${input.url}` : ''}`)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`Door ${day} is open`)}`,
      'TRIGGER:PT0M',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
