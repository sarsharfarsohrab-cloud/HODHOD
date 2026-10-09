import { describe, expect, test } from 'bun:test'
import { createFsrsScheduler, FSRS_SCHEDULER_VERSION } from '../../src/core/fsrsScheduler.ts'
import type { SchedulingState } from '../../src/core/scheduler.ts'
import type { Rating } from '../../src/core/types.ts'

const START = new Date(2022, 11, 29, 12, 30, 0, 0)
const MIN = 60_000
const DAY = 86_400_000

const fresh = (now = START): SchedulingState => ({
  state: 'new', due: now, stability: 0, difficulty: 0, scheduledDays: 0, learningSteps: 0, reps: 0, lapses: 0, lastReview: null,
})
const scheduler = createFsrsScheduler({ desiredRetention: 0.9, fuzz: false })

/** Answers each card exactly when it comes due, like the reference test-suite does. */
function run(ratings: Rating[], start = START) {
  let card = fresh(start)
  let now = start
  const history: SchedulingState[] = []
  for (const rating of ratings) {
    card = scheduler.preview(card, now)[rating].next
    history.push(card)
    now = card.due
  }
  return history
}

describe('FSRS scheduler', () => {
  test('reproduces the FSRS-6 reference interval history', () => {
    // vector from ts-fsrs __tests__/FSRS-6.test.ts ("ivl_history"), default parameters
    const history = run([3, 3, 3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 3])
    expect(history.map((c) => c.scheduledDays)).toEqual([0, 2, 11, 46, 163, 498, 0, 0, 2, 4, 7, 12, 21])
  })

  test('reproduces the FSRS-6 reference memory state', () => {
    // vector from fsrs-rs inference tests, as used by ts-fsrs ("memory state[short-term]")
    const ratings: Rating[] = [1, 3, 3, 3, 3, 3]
    const gaps = [0, 0, 1, 3, 8, 21]
    let card = fresh()
    let now = START
    ratings.forEach((rating, i) => {
      now = new Date(now.getTime() + gaps[i]! * DAY)
      card = scheduler.preview(card, now)[rating].next
    })
    expect(card.stability).toBeCloseTo(53.62691, 4)
    expect(card.difficulty).toBeCloseTo(6.3574867, 4)
  })

  test('a new card goes through the learning steps: 1 min, 6 min, 10 min, or straight to review', () => {
    const p = scheduler.preview(fresh(), START)
    expect(p[1].next.state).toBe('learning')
    expect(p[1].intervalMs).toBe(1 * MIN)
    expect(p[2].next.state).toBe('learning')
    expect(p[2].intervalMs).toBe(6 * MIN)
    expect(p[3].next.state).toBe('learning')
    expect(p[3].intervalMs).toBe(10 * MIN)
    expect(p[4].next.state).toBe('review')
    expect(p[4].intervalMs).toBeGreaterThanOrEqual(DAY)
  })

  test('Hard is a successful recall: no lapse, and never a shorter interval than Again', () => {
    const [, , , review] = run([3, 3, 3, 3]) as [SchedulingState, SchedulingState, SchedulingState, SchedulingState]
    expect(review.state).toBe('review')
    const p = scheduler.preview(review, review.due)
    expect(p[2].next.state).toBe('review')
    expect(p[2].next.lapses).toBe(review.lapses)
    expect(p[1].next.state).toBe('relearning')
    expect(p[1].next.lapses).toBe(review.lapses + 1)
    expect(p[1].intervalMs).toBeLessThan(p[2].intervalMs)
  })

  test('intervals grow Again < Hard < Good < Easy for a review card', () => {
    const review = run([3, 3, 3]).at(-1)!
    const p = scheduler.preview(review, review.due)
    expect(p[2].intervalMs).toBeLessThan(p[3].intervalMs)
    expect(p[3].intervalMs).toBeLessThan(p[4].intervalMs)
    expect(p[2].next.stability).toBeLessThan(p[3].next.stability)
    expect(p[3].next.stability).toBeLessThan(p[4].next.stability)
  })

  test('forgetting makes a card harder and less stable, an easy answer does the opposite', () => {
    const review = run([3, 3, 3]).at(-1)!
    const p = scheduler.preview(review, review.due)
    expect(p[1].next.difficulty).toBeGreaterThan(review.difficulty)
    expect(p[1].next.stability).toBeLessThan(review.stability)
    expect(p[4].next.difficulty).toBeLessThan(review.difficulty)
  })

  test('a higher retention target schedules reviews sooner', () => {
    const strict = createFsrsScheduler({ desiredRetention: 0.95, fuzz: false })
    const relaxed = createFsrsScheduler({ desiredRetention: 0.85, fuzz: false })
    const review = run([3, 3, 3]).at(-1)!
    expect(strict.preview(review, review.due)[3].intervalMs).toBeLessThan(scheduler.preview(review, review.due)[3].intervalMs)
    expect(relaxed.preview(review, review.due)[3].intervalMs).toBeGreaterThan(scheduler.preview(review, review.due)[3].intervalMs)
  })

  test('retrievability starts near 1, is the target at the due date and keeps falling', () => {
    const review = run([3, 3, 3]).at(-1)!
    expect(scheduler.retrievability(fresh(), START)).toBe(null)
    const justAfter = scheduler.retrievability(review, new Date(review.lastReview!.getTime() + MIN))!
    const atDue = scheduler.retrievability(review, review.due)!
    const late = scheduler.retrievability(review, new Date(review.due.getTime() + 30 * DAY))!
    expect(justAfter).toBeGreaterThan(0.99)
    expect(atDue).toBeGreaterThan(0.88)
    expect(atDue).toBeLessThan(0.92)
    expect(late).toBeLessThan(atDue)
  })

  test('preview never changes the card it is given', () => {
    const card = run([3, 3]).at(-1)!
    const before = JSON.stringify(card)
    scheduler.preview(card, card.due)
    expect(JSON.stringify(card)).toBe(before)
  })

  test('counts repetitions and records which scheduler produced the result', () => {
    expect(run([3, 2, 1, 3]).at(-1)!.reps).toBe(4)
    expect(FSRS_SCHEDULER_VERSION).toBe('fsrs-6/ts-fsrs-5.4.2')
    expect(scheduler.version).toBe(FSRS_SCHEDULER_VERSION)
  })

  test('fuzz changes review intervals a little but never the learning steps', () => {
    const fuzzy = createFsrsScheduler({ desiredRetention: 0.9, fuzz: true })
    expect(fuzzy.preview(fresh(), START)[3].intervalMs).toBe(10 * MIN)
    const review = run([3, 3, 3, 3]).at(-1)!
    const exact = scheduler.preview(review, review.due)[3].next.scheduledDays
    const spread = fuzzy.preview(review, review.due)[3].next.scheduledDays
    expect(Math.abs(spread - exact)).toBeLessThanOrEqual(Math.ceil(exact * 0.25) + 2)
  })
})
