/**
 * The study day starts at 04:00 local time (like most spaced-repetition tools), so a
 * session after midnight still counts for the day it began on. The database function
 * `activity_by_day` uses the same rule.
 */
export const DAY_START_HOUR = 4
const HOUR = 3_600_000
export const DAY_MS = 24 * HOUR

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date (YYYY-MM-DD) of the study day that `date` belongs to. */
export function dayKey(date: Date): string {
  const shifted = new Date(date.getTime() - DAY_START_HOUR * HOUR)
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`
}

/** The moment the current study day began. */
export function dayStart(now: Date): Date {
  const shifted = new Date(now.getTime() - DAY_START_HOUR * HOUR)
  return new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate(), DAY_START_HOUR)
}

/** The moment the current study day ends (start of the next one). Safe across DST changes. */
export function dayEnd(now: Date): Date {
  const start = dayStart(now)
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, DAY_START_HOUR)
}

/** Shifts a YYYY-MM-DD key by whole days. */
export function shiftDayKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  const date = new Date(y, m - 1, d + days, 12)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}
