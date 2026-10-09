/** Figures for the statistics page, computed from data the app already holds. */
import { CEFR_VALUES, type Cefr } from '../../supabase/functions/_shared/wordSchema.ts'
import { computeStreak, type ActivityMap, type Streak } from './activity.ts'
import { wordStatus, type WordStatus } from './cards.ts'
import { reviewForecast } from './queue.ts'
import type { WordQuizStat } from './quiz.ts'
import { dayKey, shiftDayKey } from './time.ts'
import type { Card, Word } from './types.ts'

export interface PeriodStats {
  reviews: number
  minutes: number
  newCards: number
  activeDays: number
  /** Share of answers that were not "again"; null without any answer. */
  accuracy: number | null
  /** Share of cards already in review that were still remembered; null without such answers. */
  retention: number | null
}

export interface Stats {
  totalWords: number
  byStatus: Record<WordStatus, number>
  byCefr: { level: Cefr | null; count: number }[]
  streak: Streak
  today: PeriodStats
  week: PeriodStats
  month: PeriodStats
  /** One entry per study day, oldest first, today last. */
  daily: { key: string; reviews: number; minutes: number }[]
  /** Reviews coming due per day, today first. */
  forecast: number[]
  /** Words that keep being forgotten, hardest first. */
  difficult: { word: Word; lapses: number; difficulty: number }[]
  quiz: { attempts: number; accuracy: number | null }
}

export const STATS_DAYS = 30
export const FORECAST_DAYS = 14
const DIFFICULT_LIMIT = 8

function period(activity: ActivityMap, todayKey: string, days: number): PeriodStats {
  let reviews = 0, again = 0, ms = 0, newCards = 0, activeDays = 0, mature = 0, matureAgain = 0
  for (let i = 0; i < days; i++) {
    const day = activity.get(shiftDayKey(todayKey, -i))
    if (!day) continue
    reviews += day.reviews
    again += day.again
    ms += day.durationMs
    newCards += day.newCards
    mature += day.matureReviews
    matureAgain += day.matureAgain
    if (day.reviews > 0) activeDays++
  }
  return {
    reviews,
    minutes: Math.round(ms / 60_000),
    newCards,
    activeDays,
    accuracy: reviews > 0 ? 1 - again / reviews : null,
    retention: mature > 0 ? 1 - matureAgain / mature : null,
  }
}

export function computeStats(input: {
  words: Iterable<Word>
  /** The German → Persian card of each word, by word id. */
  cards: ReadonlyMap<string, Card>
  /** Every card in today's rotation (both directions when reverse cards are on). */
  activeCards: readonly Card[]
  activity: ActivityMap
  quizStats: ReadonlyMap<string, WordQuizStat>
  now: Date
}): Stats {
  const { cards, activity, now } = input
  const words = [...input.words]
  const todayKey = dayKey(now)

  const byStatus: Record<WordStatus, number> = { new: 0, learning: 0, review: 0, mastered: 0 }
  const cefr = new Map<Cefr | null, number>()
  const difficult: Stats['difficult'] = []
  for (const word of words) {
    const card = cards.get(word.id)
    byStatus[wordStatus(card)]++
    cefr.set(word.cefr, (cefr.get(word.cefr) ?? 0) + 1)
    if (card && card.state !== 'new' && (card.lapses >= 2 || card.difficulty >= 8)) {
      difficult.push({ word, lapses: card.lapses, difficulty: card.difficulty })
    }
  }
  difficult.sort((a, b) => b.lapses - a.lapses || b.difficulty - a.difficulty)

  let attempts = 0, wrong = 0
  for (const stat of input.quizStats.values()) {
    attempts += stat.attempts
    wrong += stat.wrong
  }

  return {
    totalWords: words.length,
    byStatus,
    byCefr: [...CEFR_VALUES, null].map((level) => ({ level, count: cefr.get(level) ?? 0 })).filter((entry) => entry.count > 0),
    streak: computeStreak(activity, now),
    today: period(activity, todayKey, 1),
    week: period(activity, todayKey, 7),
    month: period(activity, todayKey, 30),
    daily: Array.from({ length: STATS_DAYS }, (_, i) => {
      const key = shiftDayKey(todayKey, i - (STATS_DAYS - 1))
      const day = activity.get(key)
      return { key, reviews: day?.reviews ?? 0, minutes: Math.round((day?.durationMs ?? 0) / 60_000) }
    }),
    forecast: reviewForecast(input.activeCards, now, FORECAST_DAYS),
    difficult: difficult.slice(0, DIFFICULT_LIMIT),
    quiz: { attempts, accuracy: attempts > 0 ? 1 - wrong / attempts : null },
  }
}
