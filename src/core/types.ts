import type { Cefr, PartOfSpeech, WordContent } from '../../supabase/functions/_shared/wordSchema.ts'

export type CardStateName = 'new' | 'learning' | 'review' | 'relearning'
export type CardType = 'recognition' | 'production' | 'sentence' | 'listening' | 'cloze'

/** 1 again (forgot) · 2 hard (recalled with effort) · 3 good · 4 easy */
export type Rating = 1 | 2 | 3 | 4
export const RATINGS: readonly Rating[] = [1, 2, 3, 4]

export interface Word {
  id: string
  targetLanguage: string
  nativeLanguage: string
  lemma: string
  normalizedLemma: string
  pos: PartOfSpeech
  cefr: Cefr | null
  primaryMeaning: string
  content: WordContent
  isFavorite: boolean
  /** Free-form groups the learner put the word in ("Lektion 3", "سفر"). */
  tags: string[]
  source: 'ai' | 'manual'
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/** A card as stored; timestamps are ISO strings so it round-trips through JSON unchanged. */
export interface Card {
  id: string
  wordId: string
  cardType: CardType
  state: CardStateName
  due: string
  stability: number
  difficulty: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  lastReview: string | null
  introducedAt: string | null
  schedulerVersion: string | null
  updatedAt: string
}

export interface Settings {
  newPerDay: number
  dailyGoalMinutes: number
  /** null = automatic: every due review is offered */
  maxReviewsPerDay: number | null
  desiredRetention: number
  theme: 'system' | 'light' | 'dark'
  speechRate: number
  autoplayAudio: boolean
  /** Also practise Persian → German (a second card per word). */
  reverseCards: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  newPerDay: 10,
  dailyGoalMinutes: 20,
  maxReviewsPerDay: null,
  desiredRetention: 0.9,
  theme: 'system',
  speechRate: 1,
  autoplayAudio: false,
  reverseCards: false,
}

export const SETTINGS_LIMITS = {
  newPerDay: { min: 0, max: 200, warnAbove: 20 },
  dailyGoalMinutes: { choices: [5, 10, 20, 30, 45, 60, 90] },
  maxReviewsPerDay: { min: 10, max: 2000 },
  desiredRetention: { min: 0.8, max: 0.95 },
  speechRate: { min: 0.6, max: 1.2 },
} as const

export interface Profile {
  displayName: string | null
  nativeLanguage: string
  activeTargetLanguage: string
}

export interface DayActivity {
  reviews: number
  again: number
  newCards: number
  durationMs: number
  /** Answers on cards that were already in review (the basis of the retention figure). */
  matureReviews: number
  /** …and how many of those were forgotten. */
  matureAgain: number
}

export const MAX_TAGS = 20
export const MAX_TAG_LENGTH = 30

export interface ReviewEvent {
  id: string
  cardId: string
  wordId: string
  rating: Rating
  reviewedAt: string
  durationMs: number | null
  stateBefore: CardStateName
  stateAfter: CardStateName
  stabilityBefore: number
  stabilityAfter: number
  difficultyBefore: number
  difficultyAfter: number
  elapsedDays: number
  scheduledDays: number
  dueBefore: string
  dueAfter: string
  schedulerVersion: string
  sessionId: string | null
}
