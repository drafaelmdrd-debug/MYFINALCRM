/**
 * Everything in the CRM that needs "today", "now" or a clock time uses Dallas,
 * Texas time (America/Chicago — CST/CDT, DST handled automatically), no matter
 * where the person using the app is sitting or what their computer's timezone is.
 *
 * Dates are plain 'YYYY-MM-DD' strings ("date keys"). Instants (timestamps) are
 * still stored as UTC ISO strings — that is correct and unambiguous — and are
 * only *displayed* in Dallas time.
 */

export const DALLAS_TZ = 'America/Chicago';

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: DALLAS_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

export interface DallasParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
}

/** The wall-clock reading in Dallas at the given instant. */
export function dallasParts(d: Date = new Date()): DallasParts {
  const p: Record<string, string> = {};
  for (const part of partsFormatter.formatToParts(d)) {
    if (part.type !== 'literal') p[part.type] = part.value;
  }
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' for the Dallas calendar day containing the instant (default: now). */
export function dallasDateKey(d: Date = new Date()): string {
  const p = dallasParts(d);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** 'MM/DD/YY' for the Dallas calendar day containing the instant. */
export function dallasDateMMDDYY(d: Date = new Date()): string {
  const p = dallasParts(d);
  return `${pad2(p.month)}/${pad2(p.day)}/${String(p.year).slice(-2)}`;
}

/** Pure calendar math on a 'YYYY-MM-DD' key (no timezone involved). */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' that is `days` Dallas-calendar-days from today (negative = past). */
export function dallasDateKeyOffset(days: number, from: Date = new Date()): string {
  return addDaysToDateKey(dallasDateKey(from), days);
}

/** Milliseconds Dallas is offset from UTC at an instant (negative: Dallas is behind UTC). */
function dallasOffsetMs(ts: number): number {
  const p = dallasParts(new Date(ts));
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - Math.floor(ts / 1000) * 1000;
}

/**
 * The real instant at which the clocks in Dallas read `dateKey hh:mm:ss`.
 * Used when someone types a time into a timesheet: they mean Dallas time.
 */
export function dallasWallTimeToDate(dateKey: string, hour = 0, minute = 0, second = 0): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hour, minute, second);
  let ts = wallAsUtc - dallasOffsetMs(wallAsUtc);
  ts = wallAsUtc - dallasOffsetMs(ts); // second pass settles DST edges
  return new Date(ts);
}

/** 23:59:59 Dallas time on that calendar day. */
export function dallasEndOfDay(dateKey: string): Date {
  return dallasWallTimeToDate(dateKey, 23, 59, 59);
}

/** 'HH:mm' (24h) in Dallas — for <input type="time"> values. */
export function dallasHHMM(d: Date | string | number): string {
  const p = dallasParts(new Date(d));
  return `${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** Like toLocaleTimeString(), but always Dallas time. */
export function formatDallasTime(
  d: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Date(d).toLocaleTimeString('en-US', { timeZone: DALLAS_TZ, ...options });
}

/** Like toLocaleDateString(), but always Dallas time. */
export function formatDallasDate(
  d: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Date(d).toLocaleDateString('en-US', { timeZone: DALLAS_TZ, ...options });
}

/** 'CST' or 'CDT' depending on the date. */
export function dallasZoneAbbr(d: Date = new Date()): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: DALLAS_TZ, timeZoneName: 'short' })
    .formatToParts(d)
    .find((x) => x.type === 'timeZoneName');
  return part ? part.value : 'CT';
}
