import { dayKey, shiftDayKey } from './time.ts'
import type { DayActivity } from './types.ts'

export type ActivityMap = ReadonlyMap<string, DayActivity>

export const EMPTY_DAY: DayActivity = { reviews: 0, again: 0, newCards: 0, durationMs: 0 }

/**
 * A day counts for the streak once at least this many cards were answered:
 * real practice, but small enough that a busy day does not break the chain.
 */
export const STREAK_MIN_REVIEWS = 1

export interface Streak {
  /** Consecutive study days up to today (or up to yesterday while today is still open). */
  current: number
  /** True when today already counts. */
  activeToday: boolean
  longest: number
}

const counts = (day: DayActivity | undefined) => (day?.reviews ?? 0) >= STREAK_MIN_REVIEWS

export function computeStreak(activity: ActivityMap, now: Date): Streak {
  const today = dayKey(now)
  const activeToday = counts(activity.get(today))

  let current = 0
  let cursor = activeToday ? today : shiftDayKey(today, -1)
  while (counts(activity.get(cursor))) {
    current++
    cursor = shiftDayKey(cursor, -1)
  }

  let longest = 0
  let run = 0
  let previous: string | null = null
  for (const key of [...activity.keys()].sort()) {
    if (!counts(activity.get(key))) continue
    run = previous !== null && shiftDayKey(previous, 1) === key ? run + 1 : 1
    longest = Math.max(longest, run)
    previous = key
  }

  return { current, activeToday, longest: Math.max(longest, current) }
}

export function addToDay(activity: Map<string, DayActivity>, key: string, delta: DayActivity): void {
  const base = activity.get(key) ?? EMPTY_DAY
  activity.set(key, {
    reviews: base.reviews + delta.reviews,
    again: base.again + delta.again,
    newCards: base.newCards + delta.newCards,
    durationMs: base.durationMs + delta.durationMs,
  })
}

export function minutesStudied(day: DayActivity | undefined): number {
  return Math.floor((day?.durationMs ?? 0) / 60_000)
}
