/** Database rows (snake_case) ↔ app models (camelCase). The only place that knows column names. */
import { normalizeLemma } from '../../supabase/functions/_shared/inputRules.ts'
import { CONTENT_VERSION, type WordContent } from '../../supabase/functions/_shared/wordSchema.ts'
import { DEFAULT_SETTINGS, type Card, type DayActivity, type Profile, type ReviewEvent, type Settings, type Word } from '../core/types.ts'

export interface WordRow {
  id: string
  target_language: string
  native_language: string
  lemma: string
  normalized_lemma: string
  pos: Word['pos']
  cefr: Word['cefr']
  primary_meaning: string
  content: WordContent
  is_favorite: boolean
  /** Missing on databases that have not run migration 0002 yet. */
  tags?: string[] | null
  source: Word['source']
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface CardRow {
  id: string
  word_id: string
  card_type: Card['cardType']
  state: Card['state']
  due: string
  stability: number
  difficulty: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  last_review: string | null
  introduced_at: string | null
  scheduler_version: string | null
  created_at?: string
  updated_at: string
}

export interface SettingsRow {
  new_per_day: number
  daily_goal_minutes: number
  max_reviews_per_day: number | null
  desired_retention: number | string
  theme: Settings['theme']
  speech_rate: number | string
  autoplay_audio: boolean
  reverse_cards?: boolean
}

export interface ProfileRow {
  display_name: string | null
  native_language: string
  active_target_language: string
}

export interface ActivityRow {
  day: string
  reviews: number
  again: number
  new_cards: number
  duration_ms: number | string
  mature_reviews?: number
  mature_again?: number
}

export const wordFromRow = (r: WordRow): Word => ({
  id: r.id,
  targetLanguage: r.target_language,
  nativeLanguage: r.native_language,
  lemma: r.lemma,
  normalizedLemma: r.normalized_lemma,
  pos: r.pos,
  cefr: r.cefr,
  primaryMeaning: r.primary_meaning,
  content: r.content,
  isFavorite: r.is_favorite,
  tags: r.tags ?? [],
  source: r.source,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
})

export const cardFromRow = (r: CardRow): Card => ({
  id: r.id,
  wordId: r.word_id,
  cardType: r.card_type,
  state: r.state,
  due: r.due,
  stability: Number(r.stability),
  difficulty: Number(r.difficulty),
  scheduledDays: r.scheduled_days,
  learningSteps: r.learning_steps,
  reps: r.reps,
  lapses: r.lapses,
  lastReview: r.last_review,
  introducedAt: r.introduced_at,
  schedulerVersion: r.scheduler_version,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export const settingsFromRow = (r: SettingsRow): Settings => ({
  newPerDay: r.new_per_day,
  dailyGoalMinutes: r.daily_goal_minutes,
  maxReviewsPerDay: r.max_reviews_per_day,
  desiredRetention: Number(r.desired_retention) || DEFAULT_SETTINGS.desiredRetention,
  theme: r.theme,
  speechRate: Number(r.speech_rate) || DEFAULT_SETTINGS.speechRate,
  autoplayAudio: r.autoplay_audio,
  reverseCards: r.reverse_cards === true,
})

export function settingsToRow(patch: Partial<Settings>): Record<string, unknown> {
  const row: Record<string, unknown> = {}
  if (patch.newPerDay !== undefined) row.new_per_day = patch.newPerDay
  if (patch.dailyGoalMinutes !== undefined) row.daily_goal_minutes = patch.dailyGoalMinutes
  if (patch.maxReviewsPerDay !== undefined) row.max_reviews_per_day = patch.maxReviewsPerDay
  if (patch.desiredRetention !== undefined) row.desired_retention = patch.desiredRetention
  if (patch.theme !== undefined) row.theme = patch.theme
  if (patch.speechRate !== undefined) row.speech_rate = patch.speechRate
  if (patch.autoplayAudio !== undefined) row.autoplay_audio = patch.autoplayAudio
  if (patch.reverseCards !== undefined) row.reverse_cards = patch.reverseCards
  return row
}

export const profileFromRow = (r: ProfileRow): Profile => ({
  displayName: r.display_name,
  nativeLanguage: r.native_language,
  activeTargetLanguage: r.active_target_language,
})

export const activityFromRow = (r: ActivityRow): [string, DayActivity] => [
  r.day,
  {
    reviews: r.reviews,
    again: r.again,
    newCards: r.new_cards,
    durationMs: Number(r.duration_ms) || 0,
    matureReviews: r.mature_reviews ?? 0,
    matureAgain: r.mature_again ?? 0,
  },
]

/** The columns derived from a word's content; kept in step with it on every save. */
export function wordColumns(content: WordContent): Record<string, unknown> {
  return {
    lemma: content.lemma,
    normalized_lemma: normalizeLemma(content.lemma),
    pos: content.pos,
    cefr: content.cefr,
    primary_meaning: content.meanings[0]!.translation,
    content,
    content_version: CONTENT_VERSION,
  }
}

export const reviewEventToJson = (e: ReviewEvent): Record<string, unknown> => ({
  id: e.id,
  card_id: e.cardId,
  word_id: e.wordId,
  rating: e.rating,
  reviewed_at: e.reviewedAt,
  duration_ms: e.durationMs,
  state_before: e.stateBefore,
  state_after: e.stateAfter,
  stability_before: e.stabilityBefore,
  stability_after: e.stabilityAfter,
  difficulty_before: e.difficultyBefore,
  difficulty_after: e.difficultyAfter,
  elapsed_days: e.elapsedDays,
  scheduled_days: e.scheduledDays,
  due_before: e.dueBefore,
  due_after: e.dueAfter,
  scheduler_version: e.schedulerVersion,
  session_id: e.sessionId,
})

/** The complete scheduling state of a card, as `undo_review` needs it to put a card back. */
export const cardToUndoJson = (c: Card): Record<string, unknown> => ({
  ...cardToReviewJson(c),
  last_review: c.lastReview,
  introduced_at: c.introducedAt,
  scheduler_version: c.schedulerVersion,
})

export interface QuizSessionRecord {
  id: string
  kind: string
  startedAt: string
  finishedAt: string
  total: number
  correct: number
}

export interface QuizAnswerRecord {
  id: string
  wordId: string
  questionType: string
  prompt: string
  expected: string
  answer: string
  isCorrect: boolean
  durationMs: number
  answeredAt: string
}

export const quizSessionToJson = (s: QuizSessionRecord): Record<string, unknown> => ({
  id: s.id, kind: s.kind, started_at: s.startedAt, finished_at: s.finishedAt, total: s.total, correct: s.correct,
})

export const quizAnswerToJson = (a: QuizAnswerRecord): Record<string, unknown> => ({
  id: a.id, word_id: a.wordId, question_type: a.questionType, prompt: a.prompt, expected: a.expected, answer: a.answer,
  is_correct: a.isCorrect, duration_ms: a.durationMs, answered_at: a.answeredAt,
})

export const cardToReviewJson = (c: Card): Record<string, unknown> => ({
  state: c.state,
  due: c.due,
  stability: c.stability,
  difficulty: c.difficulty,
  scheduled_days: c.scheduledDays,
  learning_steps: c.learningSteps,
  reps: c.reps,
  lapses: c.lapses,
})
