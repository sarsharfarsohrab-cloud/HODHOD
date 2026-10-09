/**
 * The daily learning queue.
 *
 * The Word Bank can hold any number of saved words; only this module decides which
 * cards are offered today. Saving a word never puts it into today's workload by itself.
 */
import { dayEnd, dayStart } from './time.ts'
import type { Card, DayActivity, Settings } from './types.ts'

/** Learning cards that come due within this window are shown early instead of ending the session. */
export const LEARN_AHEAD_MS = 20 * 60_000

export interface QueueCounts {
  /** New cards that may still be introduced today (respects new-per-day). */
  newCards: number
  /** Review cards due today (respects the optional review limit). */
  reviews: number
  /** Cards in (re)learning steps that come up again today. */
  learning: number
  total: number
  /** New cards saved in the bank but waiting for a later day. */
  newWaiting: number
  /** Reviews hidden today by the learner's own limit. */
  reviewsOverLimit: number
  introducedToday: number
}

export interface QueueOptions {
  settings: Pick<Settings, 'newPerDay' | 'maxReviewsPerDay'>
  now: Date
}

interface Buckets {
  learning: Card[]
  reviews: Card[]
  newCards: Card[]
  counts: QueueCounts
}

const time = (iso: string) => new Date(iso).getTime()

function bucket(cards: readonly Card[], { settings, now }: QueueOptions): Buckets {
  const start = dayStart(now).getTime()
  const end = dayEnd(now).getTime()

  const learning: Card[] = []
  const reviewsDue: Card[] = []
  const fresh: Card[] = []
  let introducedToday = 0
  let reviewedToday = 0

  // The two cards of one word (German → Persian and the optional reverse) must not
  // prompt each other on the same day.
  const byWord = new Map<string, Card[]>()
  for (const card of cards) {
    const list = byWord.get(card.wordId)
    if (list) list.push(card)
    else byWord.set(card.wordId, [card])
  }
  const sibling = (card: Card) => byWord.get(card.wordId)?.find((other) => other.id !== card.id)
  const inSteps = (card: Card) => card.state === 'learning' || card.state === 'relearning'
  const answeredToday = (card: Card) => card.lastReview !== null && time(card.lastReview) >= start
  const buried = (card: Card) => {
    const other = sibling(card)
    return other !== undefined && (inSteps(other) || answeredToday(other))
  }

  for (const card of cards) {
    if (card.introducedAt && time(card.introducedAt) >= start) introducedToday++
    switch (card.state) {
      case 'new':
        if (card.cardType === 'production') {
          // the reverse card starts only once the word itself has been learned
          const other = sibling(card)
          if (!other || other.state !== 'review' || answeredToday(other)) break
        }
        fresh.push(card)
        break
      case 'learning':
      case 'relearning':
        if (time(card.due) < end) learning.push(card)
        break
      case 'review':
        if (time(card.due) < end) {
          if (!buried(card)) reviewsDue.push(card)
        }
        // an already-answered review of today counts against today's limit
        else if (card.lastReview && time(card.lastReview) >= start && !(card.introducedAt && time(card.introducedAt) >= start)) {
          reviewedToday++
        }
        break
    }
  }

  learning.sort((a, b) => time(a.due) - time(b.due))
  reviewsDue.sort((a, b) => time(a.due) - time(b.due))
  // oldest saved first: words wait their turn in the order they were added
  fresh.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt) || a.id.localeCompare(b.id))

  const newAllowance = Math.max(0, settings.newPerDay - introducedToday)
  const newCards = fresh.slice(0, newAllowance)

  let reviews = reviewsDue
  if (settings.maxReviewsPerDay !== null) {
    reviews = reviewsDue.slice(0, Math.max(0, settings.maxReviewsPerDay - reviewedToday))
  }

  return {
    learning,
    reviews,
    newCards,
    counts: {
      newCards: newCards.length,
      reviews: reviews.length,
      learning: learning.length,
      total: newCards.length + reviews.length + learning.length,
      newWaiting: fresh.length - newCards.length,
      reviewsOverLimit: reviewsDue.length - reviews.length,
      introducedToday,
    },
  }
}

export function queueCounts(cards: readonly Card[], options: QueueOptions): QueueCounts {
  return bucket(cards, options).counts
}

export type NextCard =
  | { kind: 'card'; card: Card; counts: QueueCounts }
  /** Nothing to show right now, but learning cards return later today. */
  | { kind: 'wait'; until: Date; counts: QueueCounts }
  | { kind: 'done'; counts: QueueCounts }

export interface NextOptions extends QueueOptions {
  /** The card just answered: not repeated immediately while anything else is available. */
  lastCardId?: string | null
  /** Cards answered since the last new card was shown; spaces new cards between reviews. */
  sinceNew?: number
}

export function nextCard(cards: readonly Card[], options: NextOptions): NextCard {
  const { learning, reviews, newCards, counts } = bucket(cards, options)
  const now = options.now.getTime()
  const notLast = (card: Card) => card.id !== options.lastCardId

  // 1. learning steps that are due: short-term memory first
  const dueLearning = learning.filter((c) => time(c.due) <= now)
  const learningNow = dueLearning.find(notLast)
  if (learningNow) return { kind: 'card', card: learningNow, counts }

  // 2. reviews and new cards, new ones spread evenly between the reviews
  const review = reviews.find(notLast) ?? null
  const fresh = newCards.find(notLast) ?? null
  if (review && fresh) {
    // e.g. 20 reviews and 5 new → three reviews, one new, three reviews, …
    const gap = Math.max(1, Math.floor(reviews.length / (newCards.length + 1)))
    const takeNew = (options.sinceNew ?? 0) >= gap
    return { kind: 'card', card: takeNew ? fresh : review, counts }
  }
  if (review) return { kind: 'card', card: review, counts }
  if (fresh) return { kind: 'card', card: fresh, counts }

  // 3. nothing else left: bring forward learning cards that are almost due
  const ahead = learning.filter((c) => time(c.due) <= now + LEARN_AHEAD_MS)
  const early = ahead.find(notLast) ?? dueLearning[0] ?? ahead[0]
  if (early) return { kind: 'card', card: early, counts }

  if (learning.length > 0) return { kind: 'wait', until: new Date(learning[0]!.due), counts }
  return { kind: 'done', counts }
}

// ---------------------------------------------------------------------------
// workload estimate
// ---------------------------------------------------------------------------

/** Used until the learner has enough history of their own. */
export const DEFAULT_SECONDS = { review: 10, newCard: 35, learning: 10 } as const
const MIN_HISTORY_REVIEWS = 40

/** Average seconds per answered card over the given days, or null without enough history. */
export function averageSecondsPerAnswer(days: Iterable<DayActivity>): number | null {
  let reviews = 0
  let ms = 0
  for (const day of days) {
    reviews += day.reviews
    ms += day.durationMs
  }
  if (reviews < MIN_HISTORY_REVIEWS || ms <= 0) return null
  // guard against a phone left open on a card
  return Math.min(60, Math.max(3, ms / reviews / 1000))
}

/** A rough estimate in minutes — shown with "≈", never as a promise. */
export function estimateMinutes(counts: QueueCounts, secondsPerAnswer: number | null): number {
  const per = secondsPerAnswer
  const seconds = per
    ? // a new card is answered about three times on its first day (learning steps)
      counts.reviews * per + counts.learning * per + counts.newCards * per * 3
    : counts.reviews * DEFAULT_SECONDS.review +
      counts.learning * DEFAULT_SECONDS.learning +
      counts.newCards * DEFAULT_SECONDS.newCard
  if (seconds === 0) return 0
  return Math.max(1, Math.round(seconds / 60))
}

/** Reviews falling due on each of the next `days` study days (today first). */
export function reviewForecast(cards: readonly Card[], now: Date, days: number): number[] {
  const out = new Array<number>(days).fill(0)
  const start = dayStart(now).getTime()
  for (const card of cards) {
    if (card.state === 'new') continue
    const index = Math.max(0, Math.floor((time(card.due) - start) / 86_400_000))
    if (index < days) out[index]!++
  }
  return out
}
