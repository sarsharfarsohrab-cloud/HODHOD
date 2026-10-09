import { describe, expect, test } from 'bun:test'
import { computeStreak } from '../../src/core/activity.ts'
import { averageSecondsPerAnswer, estimateMinutes, nextCard, queueCounts, reviewForecast } from '../../src/core/queue.ts'
import { dayEnd, dayKey, dayStart, shiftDayKey } from '../../src/core/time.ts'
import type { Card, DayActivity } from '../../src/core/types.ts'

const NOW = new Date(2026, 9, 9, 11, 0, 0) // Friday 11:00 local
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString()
const DAY = 24 * 60

let seq = 0
function card(partial: Partial<Card>): Card {
  seq++
  return {
    id: `c${String(seq).padStart(4, '0')}`,
    wordId: `w${seq}`,
    cardType: 'recognition',
    state: 'new',
    due: at(-1),
    stability: 0,
    difficulty: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    lastReview: null,
    introducedAt: null,
    schedulerVersion: null,
    updatedAt: at(-10_000 + seq),
    ...partial,
  }
}
const newCards = (n: number) => Array.from({ length: n }, () => card({}))
const reviews = (n: number, dueMinutes = -60) =>
  Array.from({ length: n }, () => card({ state: 'review', due: at(dueMinutes), stability: 5, lastReview: at(-5 * DAY), introducedAt: at(-30 * DAY), reps: 3 }))
const settings = (newPerDay = 10, maxReviewsPerDay: number | null = null) => ({ newPerDay, maxReviewsPerDay })

describe('study day', () => {
  test('starts at 04:00 local time', () => {
    expect(dayKey(new Date(2026, 9, 9, 3, 59))).toBe('2026-10-08')
    expect(dayKey(new Date(2026, 9, 9, 4, 0))).toBe('2026-10-09')
    expect(dayStart(new Date(2026, 9, 9, 1, 30))).toEqual(new Date(2026, 9, 8, 4, 0))
    expect(dayEnd(NOW)).toEqual(new Date(2026, 9, 10, 4, 0))
  })
  test('day keys shift across month and year ends', () => {
    expect(shiftDayKey('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftDayKey('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('word bank vs. learning queue', () => {
  test('100 saved words, 10 new per day → only 10 enter today', () => {
    const counts = queueCounts(newCards(100), { settings: settings(10), now: NOW })
    expect(counts.newCards).toBe(10)
    expect(counts.newWaiting).toBe(90)
    expect(counts.total).toBe(10)
  })
  test('cards already introduced today use up the allowance', () => {
    const cards = [
      ...newCards(20),
      ...Array.from({ length: 7 }, () => card({ state: 'learning', due: at(5), introducedAt: at(-30), lastReview: at(-30), reps: 1 })),
    ]
    const counts = queueCounts(cards, { settings: settings(10), now: NOW })
    expect(counts.introducedToday).toBe(7)
    expect(counts.newCards).toBe(3)
    expect(counts.learning).toBe(7)
  })
  test('yesterday’s introductions do not count against today', () => {
    const cards = [...newCards(20), card({ state: 'review', due: at(3 * DAY), introducedAt: at(-DAY), lastReview: at(-DAY), stability: 3 })]
    expect(queueCounts(cards, { settings: settings(10), now: NOW }).newCards).toBe(10)
  })
  test('new per day = 0 pauses new cards but keeps reviews', () => {
    const counts = queueCounts([...newCards(5), ...reviews(4)], { settings: settings(0), now: NOW })
    expect(counts.newCards).toBe(0)
    expect(counts.reviews).toBe(4)
  })
  test('oldest saved words are introduced first', () => {
    const cards = newCards(5)
    const first = nextCard(cards, { settings: settings(2), now: NOW })
    expect(first.kind === 'card' && first.card.id).toBe(cards[0]!.id)
  })
})

describe('reviews', () => {
  test('due today counts, due tomorrow does not', () => {
    const cards = [...reviews(3, -60), ...reviews(2, 6 * 60), ...reviews(4, 2 * DAY)]
    expect(queueCounts(cards, { settings: settings(), now: NOW }).reviews).toBe(5)
  })
  test('without a limit every due review is offered', () => {
    expect(queueCounts(reviews(250), { settings: settings(10, null), now: NOW }).reviews).toBe(250)
  })
  test('a review limit hides the rest and says so', () => {
    const counts = queueCounts(reviews(50), { settings: settings(10, 20), now: NOW })
    expect(counts.reviews).toBe(20)
    expect(counts.reviewsOverLimit).toBe(30)
  })
  test('reviews answered today count against the limit', () => {
    const done = Array.from({ length: 15 }, () =>
      card({ state: 'review', due: at(4 * DAY), stability: 4, lastReview: at(-20), introducedAt: at(-30 * DAY), reps: 4 }))
    expect(queueCounts([...reviews(50), ...done], { settings: settings(10, 20), now: NOW }).reviews).toBe(5)
  })
})

describe('order within a session', () => {
  test('due learning steps come before everything else', () => {
    const learning = card({ state: 'learning', due: at(-1), introducedAt: at(-5), lastReview: at(-5), reps: 1 })
    const next = nextCard([...reviews(3), ...newCards(3), learning], { settings: settings(), now: NOW })
    expect(next.kind === 'card' && next.card.id).toBe(learning.id)
  })
  test('new cards are spread between reviews, not all at the start or end', () => {
    const cards = [...reviews(20), ...newCards(5)]
    const kinds: string[] = []
    const pool = [...cards]
    let sinceNew = 0
    while (pool.length > 0) {
      const next = nextCard(pool, { settings: settings(5), now: NOW, sinceNew })
      if (next.kind !== 'card') break
      const isNew = next.card.state === 'new'
      kinds.push(isNew ? 'N' : 'R')
      sinceNew = isNew ? 0 : sinceNew + 1
      pool.splice(pool.indexOf(next.card), 1)
    }
    expect(kinds.join('')).toBe('RRRNRRRNRRRNRRRNRRRNRRRRR')
  })
  test('with more new cards than reviews they alternate until the reviews run out', () => {
    const pool = [...reviews(2), ...newCards(4)]
    const kinds: string[] = []
    let sinceNew = 0
    while (pool.length > 0) {
      const next = nextCard(pool, { settings: settings(4), now: NOW, sinceNew })
      if (next.kind !== 'card') break
      const isNew = next.card.state === 'new'
      kinds.push(isNew ? 'N' : 'R')
      sinceNew = isNew ? 0 : sinceNew + 1
      pool.splice(pool.indexOf(next.card), 1)
    }
    expect(kinds.join('')).toBe('RNRNNN')
  })
  test('the card just answered is not shown again immediately while others wait', () => {
    const again = card({ state: 'learning', due: at(-1), introducedAt: at(-2), lastReview: at(-2), reps: 1 })
    const other = reviews(1)[0]!
    const next = nextCard([again, other], { settings: settings(), now: NOW, lastCardId: again.id })
    expect(next.kind === 'card' && next.card.id).toBe(other.id)
  })
  test('…but it is shown again when it is the only card left', () => {
    const again = card({ state: 'learning', due: at(-1), introducedAt: at(-2), lastReview: at(-2), reps: 1 })
    const next = nextCard([again], { settings: settings(), now: NOW, lastCardId: again.id })
    expect(next.kind === 'card' && next.card.id).toBe(again.id)
  })
  test('a learning card due in 10 minutes is brought forward rather than ending the session', () => {
    const soon = card({ state: 'learning', due: at(10), introducedAt: at(-1), lastReview: at(-1), reps: 1 })
    const next = nextCard([soon], { settings: settings(), now: NOW })
    expect(next.kind === 'card' && next.card.id).toBe(soon.id)
  })
  test('a learning card due in two hours means: come back later', () => {
    const later = card({ state: 'relearning', due: at(120), introducedAt: at(-9 * DAY), lastReview: at(-1), reps: 5 })
    const next = nextCard([later], { settings: settings(), now: NOW })
    expect(next.kind).toBe('wait')
    expect(next.kind === 'wait' && next.until.toISOString()).toBe(later.due)
  })
  test('nothing due and nothing new → done', () => {
    expect(nextCard(reviews(3, 3 * DAY), { settings: settings(), now: NOW }).kind).toBe('done')
    expect(nextCard([], { settings: settings(), now: NOW }).kind).toBe('done')
  })
  test('once today’s new cards are used up, the remaining new cards wait for tomorrow', () => {
    const introduced = Array.from({ length: 10 }, () =>
      card({ state: 'review', due: at(2 * DAY), stability: 2, introducedAt: at(-60), lastReview: at(-30), reps: 3 }))
    const next = nextCard([...introduced, ...newCards(15)], { settings: settings(10), now: NOW })
    expect(next.kind).toBe('done')
    expect(next.counts.newWaiting).toBe(15)
  })
})

describe('workload estimate', () => {
  const day = (reviews: number, durationMs: number): DayActivity => ({ reviews, again: 0, newCards: 0, durationMs, matureReviews: 0, matureAgain: 0 })
  test('uses product defaults until there is enough history', () => {
    expect(averageSecondsPerAnswer([day(10, 100_000)])).toBe(null)
    const counts = queueCounts([...reviews(28), ...newCards(10)], { settings: settings(10), now: NOW })
    expect(estimateMinutes(counts, null)).toBe(Math.round((28 * 10 + 10 * 35) / 60))
  })
  test('uses the learner’s own pace once known', () => {
    const pace = averageSecondsPerAnswer([day(30, 240_000), day(30, 240_000)])
    expect(pace).toBe(8)
    const counts = queueCounts(reviews(30), { settings: settings(0), now: NOW })
    expect(estimateMinutes(counts, pace)).toBe(4)
  })
  test('an empty queue is zero minutes, a tiny one at least one', () => {
    expect(estimateMinutes(queueCounts([], { settings: settings(), now: NOW }), null)).toBe(0)
    expect(estimateMinutes(queueCounts(reviews(1), { settings: settings(), now: NOW }), null)).toBe(1)
  })
  test('forecast groups upcoming reviews by study day and folds overdue into today', () => {
    const cards = [...reviews(2, -3 * DAY), ...reviews(3, 60), ...reviews(4, DAY + 60), ...reviews(1, 6 * DAY), ...newCards(5)]
    expect(reviewForecast(cards, NOW, 7)).toEqual([5, 4, 0, 0, 0, 0, 1])
  })
})

describe('streak', () => {
  const active: DayActivity = { reviews: 12, again: 1, newCards: 2, durationMs: 90_000, matureReviews: 0, matureAgain: 0 }
  const map = (...keys: string[]) => new Map(keys.map((k) => [k, active]))
  const today = dayKey(NOW)
  const back = (n: number) => shiftDayKey(today, -n)

  test('no activity → no streak', () => {
    expect(computeStreak(new Map(), NOW)).toEqual({ current: 0, activeToday: false, longest: 0 })
  })
  test('counts consecutive days including today', () => {
    expect(computeStreak(map(today, back(1), back(2)), NOW)).toEqual({ current: 3, activeToday: true, longest: 3 })
  })
  test('is still alive today before the first review of the day', () => {
    expect(computeStreak(map(back(1), back(2)), NOW)).toEqual({ current: 2, activeToday: false, longest: 2 })
  })
  test('a missed day resets the current streak but keeps the record', () => {
    const s = computeStreak(map(today, back(2), back(3), back(4), back(5)), NOW)
    expect(s.current).toBe(1)
    expect(s.longest).toBe(4)
  })
  test('a day with zero answered cards does not count', () => {
    const activity = new Map<string, DayActivity>([[today, active], [back(1), { ...active, reviews: 0 }], [back(2), active]])
    expect(computeStreak(activity, NOW).current).toBe(1)
  })
  test('a session after midnight keeps yesterday’s streak day', () => {
    const lateNight = new Date(2026, 9, 10, 1, 30)
    expect(computeStreak(map(dayKey(lateNight)), lateNight)).toEqual({ current: 1, activeToday: true, longest: 1 })
    expect(dayKey(lateNight)).toBe(today)
  })
})
