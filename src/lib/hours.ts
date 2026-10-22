import type { Airport } from '../../schema/schema';

const TZ = 'America/Chicago';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
type Day = (typeof DAYS)[number];

/** Local wall-clock parts in ZME's time zone. */
export function localParts(date: Date, timeZone = TZ): { day: number; minutes: number; hhmm: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  return {
    day: DAYS.indexOf(get('weekday') as Day),
    minutes: hour * 60 + minute,
    hhmm: `${String(hour).padStart(2, '0')}${String(minute).padStart(2, '0')}`,
  };
}

function dayMatches(spec: string, day: number): boolean {
  if (spec === 'daily') return true;
  const [from, to] = spec.split('-') as [Day, Day | undefined];
  const a = DAYS.indexOf(from);
  if (!to) return a === day;
  const b = DAYS.indexOf(to);
  return a <= b ? day >= a && day <= b : day >= a || day <= b;
}

const mins = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(2));

export type TowerStatus = 'open' | 'closed' | 'h24' | 'uncontrolled' | 'unknown';

/** Is the tower open at `date`? A window whose close is ≤ open runs past midnight. */
export function towerStatus(airport: Pick<Airport, 'hours' | 'uncontrolled' | 'h24'>, date: Date): TowerStatus {
  if (airport.uncontrolled) return 'uncontrolled';
  if (airport.h24) return 'h24';
  if (!airport.hours?.length) return 'unknown';
  const { day, minutes } = localParts(date);
  const yesterday = (day + 6) % 7;
  for (const h of airport.hours) {
    const open = mins(h.open);
    const close = mins(h.close);
    if (close > open) {
      if (dayMatches(h.days, day) && minutes >= open && minutes < close) return 'open';
    } else {
      if (dayMatches(h.days, day) && minutes >= open) return 'open';
      if (dayMatches(h.days, yesterday) && minutes < close) return 'open';
    }
  }
  return 'closed';
}

/** MEM's 0200–0600 local window for the night-only RNAV SIDs (MEM ATCT SOP 2-1-3b). */
export const inNightWindow = (date: Date) => {
  const { minutes } = localParts(date);
  return minutes >= 120 && minutes < 360;
};
