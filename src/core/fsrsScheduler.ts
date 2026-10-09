/**
 * FSRS-6 scheduler, backed by the reference TypeScript implementation (ts-fsrs,
 * vendored unmodified in /vendor/ts-fsrs). Default parameters, no per-user optimisation.
 */
import { FSRS, generatorParameters, Rating as FsrsRating, State, type Card as FsrsCard, type Grade } from '../../vendor/ts-fsrs/index.ts'
import { version as fsrsPackageVersion } from '../../vendor/package.json'
import type { Scheduler, SchedulerConfig, SchedulingResult, SchedulingState } from './scheduler.ts'
import { RATINGS, type CardStateName, type Rating } from './types.ts'

export const FSRS_SCHEDULER_VERSION = `fsrs-6/ts-fsrs-${fsrsPackageVersion}`

const TO_FSRS: Record<CardStateName, State> = {
  new: State.New,
  learning: State.Learning,
  review: State.Review,
  relearning: State.Relearning,
}
const FROM_FSRS: Record<State, CardStateName> = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'relearning',
}
const GRADE: Record<Rating, Grade> = {
  1: FsrsRating.Again,
  2: FsrsRating.Hard,
  3: FsrsRating.Good,
  4: FsrsRating.Easy,
}

function toFsrs(card: SchedulingState): FsrsCard {
  return {
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: 0, // deprecated input; the library derives it from last_review
    scheduled_days: card.scheduledDays,
    learning_steps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    state: TO_FSRS[card.state],
    last_review: card.lastReview ?? undefined,
  }
}

function fromFsrs(card: FsrsCard): SchedulingState {
  return {
    state: FROM_FSRS[card.state],
    due: card.due,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    lastReview: card.last_review ?? null,
  }
}

export interface FsrsOptions extends SchedulerConfig {
  /** Spreads review intervals slightly so cards saved together do not come back together. */
  fuzz?: boolean
}

export function createFsrsScheduler(options: FsrsOptions): Scheduler {
  const retention = Math.min(0.97, Math.max(0.7, options.desiredRetention))
  const fsrs = new FSRS(
    generatorParameters({
      request_retention: retention,
      enable_fuzz: options.fuzz ?? true,
      enable_short_term: true,
      learning_steps: ['1m', '10m'],
      relearning_steps: ['10m'],
      maximum_interval: 36500,
    }),
  )

  return {
    version: FSRS_SCHEDULER_VERSION,
    preview(card, now) {
      const input = toFsrs(card)
      const out = {} as Record<Rating, SchedulingResult>
      for (const rating of RATINGS) {
        const item = fsrs.next(input, now, GRADE[rating])
        out[rating] = {
          rating,
          next: fromFsrs(item.card),
          intervalMs: Math.max(0, item.card.due.getTime() - now.getTime()),
          elapsedDays: item.log.elapsed_days,
        }
      }
      return out
    },
    retrievability(card, now) {
      if (card.state === 'new' || !card.lastReview || card.stability <= 0) return null
      return fsrs.get_retrievability(toFsrs(card), now, false)
    },
  }
}
