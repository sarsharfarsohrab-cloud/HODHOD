/**
 * Scheduling boundary. The UI and the data layer only know this interface; the
 * algorithm behind it can be replaced or upgraded without touching them.
 * Every review event records `Scheduler.version`.
 */
import type { CardStateName, Rating } from './types.ts'

/** The part of a card that scheduling reads and writes. */
export interface SchedulingState {
  state: CardStateName
  due: Date
  stability: number
  difficulty: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  lastReview: Date | null
}

export interface SchedulingResult {
  rating: Rating
  next: SchedulingState
  /** Time from the review until the card is due again. */
  intervalMs: number
  /** Days since the previous review, as the algorithm saw them. */
  elapsedDays: number
}

export interface SchedulerConfig {
  /** Target probability of recalling a card when it comes due (0–1). */
  desiredRetention: number
}

export interface Scheduler {
  readonly version: string
  /** What each of the four answers would do to this card right now. */
  preview(card: SchedulingState, now: Date): Record<Rating, SchedulingResult>
  /** Estimated probability of recalling the card at `now`; null for cards never reviewed. */
  retrievability(card: SchedulingState, now: Date): number | null
}
