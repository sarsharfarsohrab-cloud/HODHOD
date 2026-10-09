import type { SchedulingState } from './scheduler.ts'
import type { Card } from './types.ts'

export function toSchedulingState(card: Card): SchedulingState {
  return {
    state: card.state,
    due: new Date(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduledDays,
    learningSteps: card.learningSteps,
    reps: card.reps,
    lapses: card.lapses,
    lastReview: card.lastReview ? new Date(card.lastReview) : null,
  }
}

export function applySchedulingState(card: Card, next: SchedulingState, reviewedAt: Date, schedulerVersion: string): Card {
  return {
    ...card,
    state: next.state,
    due: next.due.toISOString(),
    stability: next.stability,
    difficulty: next.difficulty,
    scheduledDays: next.scheduledDays,
    learningSteps: next.learningSteps,
    reps: next.reps,
    lapses: next.lapses,
    lastReview: reviewedAt.toISOString(),
    introducedAt: card.introducedAt ?? reviewedAt.toISOString(),
    schedulerVersion,
  }
}

/**
 * What the Word Bank shows as a word's learning status.
 * "mastered" is a display label only: a review card whose memory is stable for three weeks or more.
 */
export type WordStatus = 'new' | 'learning' | 'review' | 'mastered'
export const MASTERED_STABILITY_DAYS = 21
export const DIFFICULT_LAPSES = 3
export const DIFFICULT_DIFFICULTY = 8

export function wordStatus(card: Card | undefined): WordStatus {
  if (!card || card.state === 'new') return 'new'
  if (card.state === 'learning' || card.state === 'relearning') return 'learning'
  return card.stability >= MASTERED_STABILITY_DAYS ? 'mastered' : 'review'
}

export function isDifficult(card: Card | undefined): boolean {
  if (!card || card.state === 'new') return false
  return card.lapses >= DIFFICULT_LAPSES || card.difficulty >= DIFFICULT_DIFFICULTY
}
