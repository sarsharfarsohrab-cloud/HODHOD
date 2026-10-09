/** Stage 2: reverse cards in the queue, quiz building and grading, statistics. */
import { describe, expect, test } from 'bun:test'
import { nextCard, queueCounts } from '../../src/core/queue.ts'
import { buildQuestion, buildQuiz, gradeTyped, pickWeighted, quizAvailability, quizWeight, summarize, type QuizAnswer, type QuizCandidate } from '../../src/core/quiz.ts'
import { computeStats } from '../../src/core/stats.ts'
import { dayKey, shiftDayKey } from '../../src/core/time.ts'
import type { Card, DayActivity, Word } from '../../src/core/types.ts'
import type { WordContent } from '../../supabase/functions/_shared/wordSchema.ts'
import { AUFGEBEN, SCHNELL, TISCH } from '../fixtures/words.ts'

const NOW = new Date(2026, 9, 9, 11, 0)
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString()
const DAY = 24 * 60

/** Deterministic pseudo-random numbers (mulberry32). */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let n = 0
const card = (wordId: string, partial: Partial<Card> = {}): Card => ({
  id: `card-${++n}`, wordId, cardType: 'recognition', state: 'new', due: at(-1), stability: 0, difficulty: 0, scheduledDays: 0, learningSteps: 0,
  reps: 0, lapses: 0, lastReview: null, introducedAt: null, schedulerVersion: null, updatedAt: at(-10_000 + n), ...partial,
})
const reviewState = (dueMinutes: number, lastReviewMinutes = -5 * DAY): Partial<Card> => ({
  state: 'review', due: at(dueMinutes), stability: 6, lastReview: at(lastReviewMinutes), introducedAt: at(-30 * DAY), reps: 4,
})
const settings = { newPerDay: 10, maxReviewsPerDay: null }

const noun = (lemma: string, article: 'der' | 'die' | 'das', meaning: string): WordContent => ({
  ...TISCH, lemma, noun: { article, plural: null, genitive: null, pluralOnly: false }, meanings: [{ ...TISCH.meanings[0]!, translation: meaning }],
})
const word = (id: string, content: WordContent, extra: Partial<Word> = {}): Word => ({
  id, targetLanguage: 'de', nativeLanguage: 'fa', lemma: content.lemma, normalizedLemma: content.lemma, pos: content.pos, cefr: content.cefr,
  primaryMeaning: content.meanings[0]!.translation, content, isFavorite: false, tags: [], source: 'ai', createdAt: at(0), updatedAt: at(0), deletedAt: null, ...extra,
})

describe('reverse cards in the daily queue', () => {
  test('the reverse card of a word waits until the word itself has been learned', () => {
    const cards = [card('w1'), card('w1', { cardType: 'production' })]
    const counts = queueCounts(cards, { settings, now: NOW })
    expect(counts.newCards).toBe(1)
    expect(counts.newWaiting).toBe(0) // the reverse card is not shown as a "saved word waiting"
    const next = nextCard(cards, { settings, now: NOW })
    expect(next.kind === 'card' && next.card.cardType).toBe('recognition')
  })
  test('once the word is in review, its reverse card becomes a new card', () => {
    const cards = [card('w1', reviewState(3 * DAY)), card('w1', { cardType: 'production' })]
    const next = nextCard(cards, { settings, now: NOW })
    expect(next.kind === 'card' && next.card.cardType).toBe('production')
  })
  test('…but not on the day the word was answered', () => {
    const cards = [card('w1', reviewState(3 * DAY, -30)), card('w1', { cardType: 'production' })]
    expect(nextCard(cards, { settings, now: NOW }).kind).toBe('done')
  })
  test('both directions due on the same day: after one is answered the other moves to tomorrow', () => {
    const recognition = card('w1', reviewState(-60))
    const production = card('w1', { cardType: 'production', ...reviewState(-30) })
    expect(queueCounts([recognition, production], { settings, now: NOW }).reviews).toBe(2)
    const answered = { ...recognition, due: at(6 * DAY), lastReview: at(-1) }
    expect(queueCounts([answered, production], { settings, now: NOW }).reviews).toBe(0)
    // the next study day it is offered again
    const tomorrow = new Date(NOW.getTime() + DAY * 60_000)
    expect(queueCounts([answered, production], { settings, now: tomorrow }).reviews).toBe(1)
  })
  test('a card in its learning steps hides its sibling, never itself', () => {
    const learning = card('w1', { state: 'relearning', due: at(-1), lastReview: at(-10), introducedAt: at(-9 * DAY), reps: 5 })
    const production = card('w1', { cardType: 'production', ...reviewState(-30) })
    const counts = queueCounts([learning, production], { settings, now: NOW })
    expect(counts.learning).toBe(1)
    expect(counts.reviews).toBe(0)
  })
  test('reverse cards count towards new-per-day like any new card', () => {
    const cards = Array.from({ length: 6 }, (_, i) => [card(`w${i}`, reviewState(3 * DAY)), card(`w${i}`, { cardType: 'production' })]).flat()
    expect(queueCounts(cards, { settings: { newPerDay: 4, maxReviewsPerDay: null }, now: NOW }).newCards).toBe(4)
  })
})

const BANK = [
  word('1', AUFGEBEN), word('2', TISCH), word('3', SCHNELL), word('4', noun('Lampe', 'die', 'چراغ')), word('5', noun('Haus', 'das', 'خانه')),
  word('6', noun('Stuhl', 'der', 'صندلی')), word('7', { ...SCHNELL, lemma: 'langsam', meanings: [{ ...SCHNELL.meanings[0]!, translation: 'آهسته' }] }),
]
const candidates = (words = BANK): QuizCandidate[] => words.map((w) => ({ word: w, card: card(w.id, reviewState(DAY)), stat: undefined }))

describe('quiz questions', () => {
  test('article question: noun without its article, three choices', () => {
    const q = buildQuestion('article', BANK[1]!, BANK, seeded(1))!
    expect(q.prompt).toBe('Tisch')
    expect(q.options!.map((o) => o.label)).toEqual(['der', 'die', 'das'])
    expect(q.expected).toBe('der')
    expect(buildQuestion('article', BANK[0]!, BANK, seeded(1))).toBe(null) // a verb has no article
    const eltern = word('9', { ...TISCH, lemma: 'Eltern', noun: { article: 'die', plural: null, genitive: null, pluralOnly: true } })
    expect(buildQuestion('article', eltern, BANK, seeded(1))).toBe(null) // plural-only nouns are always "die": nothing to learn
  })
  test('German → Persian choice: four different meanings, exactly one correct', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const q = buildQuestion('choice_de_fa', BANK[1]!, BANK, seeded(seed))!
      const labels = q.options!.map((o) => o.label)
      expect(q.prompt).toBe('der Tisch')
      expect(labels.length).toBe(4)
      expect(new Set(labels).size).toBe(4)
      expect(labels.filter((l) => l === q.expected).length).toBe(1)
    }
  })
  test('distractors prefer the same part of speech', () => {
    const q = buildQuestion('choice_fa_de', BANK[1]!, BANK, seeded(3))!
    const wrong = q.options!.map((o) => o.label).filter((l) => l !== 'der Tisch')
    expect(wrong.sort()).toEqual(['das Haus', 'der Stuhl', 'die Lampe'])
  })
  test('two words with the same meaning never appear as competing options', () => {
    const twin = word('8', noun('Pult', 'das', 'میز'))
    for (let seed = 1; seed <= 20; seed++) {
      const q = buildQuestion('choice_de_fa', BANK[1]!, [...BANK, twin], seeded(seed))!
      expect(q.options!.filter((o) => o.label === 'میز').length).toBe(1)
    }
  })
  test('choice questions need four words with different meanings', () => {
    expect(buildQuestion('choice_de_fa', BANK[0]!, BANK.slice(0, 3), seeded(1))).toBe(null)
    expect(quizAvailability(BANK.slice(0, 3))).toEqual({ choice: false, article: true, typing: true, mixed: true })
    expect(quizAvailability([BANK[0]!, BANK[2]!]).article).toBe(false)
    expect(quizAvailability([])).toEqual({ choice: false, article: false, typing: false, mixed: false })
    expect(quizAvailability(BANK).choice).toBe(true)
  })
  test('a quiz asks about each word once and respects the requested length', () => {
    const quiz = buildQuiz('mixed', candidates(), 5, NOW, seeded(7))
    expect(quiz.length).toBe(5)
    expect(new Set(quiz.map((q) => q.wordId)).size).toBe(5)
    expect(buildQuiz('mixed', candidates(), 50, NOW, seeded(7)).length).toBe(BANK.length)
  })
  test('an article quiz contains only nouns', () => {
    const quiz = buildQuiz('article', candidates(), 10, NOW, seeded(2))
    expect(quiz.map((q) => q.prompt).sort()).toEqual(['Haus', 'Lampe', 'Stuhl', 'Tisch'])
    expect(quiz.every((q) => q.type === 'article')).toBe(true)
  })
  test('a typing quiz works with a single word', () => {
    const quiz = buildQuiz('typing', candidates([BANK[0]!]), 10, NOW, seeded(2))
    expect(quiz).toEqual([{ type: 'typing_fa_de', wordId: '1', prompt: 'تسلیم شدن، دست کشیدن', promptLanguage: 'fa', options: null, expected: 'aufgeben' }])
  })
})

describe('which words a quiz prefers', () => {
  const base = { word: BANK[1]!, card: card('2', reviewState(DAY)), stat: { attempts: 4, wrong: 0, lastAnswered: at(-60) } }
  test('weak, forgotten and long-unseen words weigh more; unstudied words weigh little', () => {
    const steady = quizWeight(base, NOW)
    expect(quizWeight({ ...base, stat: { attempts: 4, wrong: 3, lastAnswered: at(-60) } }, NOW)).toBeGreaterThan(steady)
    expect(quizWeight({ ...base, card: card('2', { ...reviewState(DAY), lapses: 4 }) }, NOW)).toBeGreaterThan(steady)
    expect(quizWeight({ ...base, card: card('2', { state: 'learning', lastReview: at(-5), introducedAt: at(-5), reps: 1 }) }, NOW)).toBeGreaterThan(steady)
    expect(quizWeight({ ...base, stat: { attempts: 4, wrong: 0, lastAnswered: at(-20 * DAY) } }, NOW)).toBeGreaterThan(steady)
    expect(quizWeight({ ...base, card: card('2'), stat: undefined }, NOW)).toBeLessThan(quizWeight({ ...base, stat: undefined }, NOW))
  })
  test('over many quizzes a weak word is drawn far more often than a steady one', () => {
    const pool: QuizCandidate[] = [
      { word: BANK[1]!, card: card('2', reviewState(DAY)), stat: { attempts: 5, wrong: 5, lastAnswered: at(-60) } },
      ...BANK.slice(2).map((w) => ({ word: w, card: card(w.id, reviewState(DAY)), stat: { attempts: 5, wrong: 0, lastAnswered: at(-60) } })),
    ]
    const rng = seeded(11)
    let weakFirst = 0
    for (let i = 0; i < 400; i++) if (pickWeighted(pool, 1, NOW, rng)[0]!.word.id === '2') weakFirst++
    expect(weakFirst).toBeGreaterThan(400 / pool.length * 2)
  })
  test('picking never repeats a word and never returns more than there are', () => {
    const picked = pickWeighted(candidates(), 99, NOW, seeded(5))
    expect(picked.length).toBe(BANK.length)
    expect(new Set(picked.map((c) => c.word.id)).size).toBe(BANK.length)
  })
})

describe('grading typed answers', () => {
  const tisch = BANK[1]!
  const strasse = word('s', noun('Straße', 'die', 'خیابان'))
  const apfel = word('a', noun('Äpfel', 'die', 'سیب‌ها'))
  test('exact answers, with or without the article', () => {
    expect(gradeTyped('Tisch', tisch)).toEqual({ correct: true, note: null })
    expect(gradeTyped('  der   Tisch ', tisch)).toEqual({ correct: true, note: null })
    expect(gradeTyped('aufgeben', BANK[0]!)).toEqual({ correct: true, note: null })
  })
  test('a wrong article is a mistake, and says so', () => {
    expect(gradeTyped('die Tisch', tisch)).toEqual({ correct: false, note: 'wrong_article' })
  })
  test('capitalisation and keyboard spellings are accepted and pointed out', () => {
    expect(gradeTyped('tisch', tisch)).toEqual({ correct: true, note: 'case' })
    expect(gradeTyped('Strasse', strasse)).toEqual({ correct: true, note: 'spelling' })
    expect(gradeTyped('die strasse', strasse)).toEqual({ correct: true, note: 'spelling' })
    expect(gradeTyped('Aepfel', apfel)).toEqual({ correct: true, note: 'spelling' })
    expect(gradeTyped('Apfel', apfel)).toEqual({ correct: true, note: 'spelling' })
  })
  test('other words, empty input and near misses are wrong', () => {
    for (const answer of ['', '   ', 'Stuhl', 'Tische', 'Tisc', 'der', 'میز']) expect(gradeTyped(answer, tisch).correct).toBe(false)
  })
  test('a verb that happens to start with "die…" is not mistaken for article + noun', () => {
    const dienen = word('d', { ...AUFGEBEN, lemma: 'dienen' })
    expect(gradeTyped('dienen', dienen)).toEqual({ correct: true, note: null })
  })
  test('expressions are compared as a whole', () => {
    const phrase = word('p', { ...SCHNELL, lemma: 'auf jeden Fall', pos: 'phrase', adjective: null })
    expect(gradeTyped('auf jeden Fall', phrase).correct).toBe(true)
    expect(gradeTyped('auf jeden fall', phrase)).toEqual({ correct: true, note: 'case' })
    expect(gradeTyped('auf Fall', phrase).correct).toBe(false)
  })
  test('summary lists each missed word once', () => {
    const q = (wordId: string) => ({ type: 'article' as const, wordId, prompt: '', promptLanguage: 'de' as const, options: null, expected: '' })
    const a = (wordId: string, correct: boolean): QuizAnswer => ({ question: q(wordId), answer: '', correct, note: null, durationMs: 1000, answeredAt: at(0) })
    expect(summarize([a('1', true), a('2', false), a('3', false), a('2', false)])).toEqual({ total: 4, correct: 1, accuracy: 0.25, missedWordIds: ['2', '3'] })
    expect(summarize([]).accuracy).toBe(0)
  })
})

describe('statistics', () => {
  const today = dayKey(NOW)
  const day = (partial: Partial<DayActivity>): DayActivity => ({ reviews: 0, again: 0, newCards: 0, durationMs: 0, matureReviews: 0, matureAgain: 0, ...partial })
  const cards = new Map<string, Card>([
    ['1', card('1', { ...reviewState(DAY), stability: 40 })], // mastered
    ['2', card('2', { ...reviewState(-60), lapses: 3, difficulty: 8.5 })], // review, due today, difficult
    ['3', card('3', { state: 'learning', due: at(5), lastReview: at(-5), introducedAt: at(-5), reps: 1 })],
    ['4', card('4')],
    ['6', card('6', { ...reviewState(3 * DAY), lapses: 2 })],
  ])
  const activity = new Map<string, DayActivity>([
    [today, day({ reviews: 20, again: 2, newCards: 3, durationMs: 300_000, matureReviews: 10, matureAgain: 1 })],
    [shiftDayKey(today, -1), day({ reviews: 10, again: 5, durationMs: 120_000, matureReviews: 10, matureAgain: 4 })],
    [shiftDayKey(today, -10), day({ reviews: 30, again: 3, newCards: 10, durationMs: 600_000 })],
    [shiftDayKey(today, -45), day({ reviews: 99, again: 99, durationMs: 9_000_000 })], // outside every window
  ])
  const stats = computeStats({
    words: BANK, cards, activeCards: [...cards.values()], activity, now: NOW,
    quizStats: new Map([['1', { attempts: 6, wrong: 1, lastAnswered: at(-60) }], ['2', { attempts: 4, wrong: 3, lastAnswered: at(-60) }]]),
  })

  test('words by learning status (a word without a card counts as new)', () => {
    expect(stats.totalWords).toBe(7)
    expect(stats.byStatus).toEqual({ new: 3, learning: 1, review: 2, mastered: 1 })
  })
  test('levels present in the bank, in order', () => {
    expect(stats.byCefr).toEqual([{ level: 'A1', count: 6 }, { level: 'B1', count: 1 }])
  })
  test('today, last 7 and last 30 days', () => {
    expect(stats.today).toEqual({ reviews: 20, minutes: 5, newCards: 3, activeDays: 1, accuracy: 0.9, retention: 0.9 })
    expect(stats.week.reviews).toBe(30)
    expect(stats.week.activeDays).toBe(2)
    expect(stats.week.retention).toBe(0.75) // 15 of 20 mature reviews remembered
    expect(stats.month.reviews).toBe(60)
    expect(stats.month.minutes).toBe(17)
  })
  test('no answers means "unknown", not zero per cent', () => {
    const empty = computeStats({ words: [], cards: new Map(), activeCards: [], activity: new Map(), quizStats: new Map(), now: NOW })
    expect(empty.today.accuracy).toBe(null)
    expect(empty.month.retention).toBe(null)
    expect(empty.quiz).toEqual({ attempts: 0, accuracy: null })
    expect(empty.byCefr).toEqual([])
  })
  test('daily series ends today and covers 30 days', () => {
    expect(stats.daily.length).toBe(30)
    expect(stats.daily.at(-1)).toEqual({ key: today, reviews: 20, minutes: 5 })
    expect(stats.daily.at(-2)!.reviews).toBe(10)
    expect(stats.daily.reduce((sum, d) => sum + d.reviews, 0)).toBe(60)
  })
  test('forecast, difficult words and quiz accuracy', () => {
    expect(stats.forecast.length).toBe(14)
    expect(stats.forecast.slice(0, 4)).toEqual([2, 1, 0, 1]) // overdue + learning today, mastered tomorrow, one in three days
    expect(stats.difficult.map((d) => d.word.lemma)).toEqual(['Tisch', 'Stuhl'])
    expect(stats.quiz).toEqual({ attempts: 10, accuracy: 0.6 })
  })
})
