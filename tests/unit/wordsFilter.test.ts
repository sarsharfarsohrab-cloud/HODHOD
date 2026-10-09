import { describe, expect, test } from 'bun:test'
import type { Card, Word } from '../../src/core/types.ts'
import { foldGerman, foldPersian } from '../../src/ui/format.ts'
import { buildEntries, filterWords } from '../../src/ui/screens/words.ts'
import type { WordContent } from '../../supabase/functions/_shared/wordSchema.ts'
import { AUFGEBEN, SCHNELL, TISCH } from '../fixtures/words.ts'

const NOW = new Date(2026, 9, 9, 11, 0)
const iso = (days: number) => new Date(NOW.getTime() + days * 86_400_000).toISOString()

const word = (id: string, content: WordContent, extra: Partial<Word> = {}): Word => ({
  id, targetLanguage: 'de', nativeLanguage: 'fa', lemma: content.lemma, normalizedLemma: content.lemma, pos: content.pos, cefr: content.cefr,
  primaryMeaning: content.meanings[0]!.translation, content, isFavorite: false, tags: [], source: 'ai', createdAt: iso(-Number(id)), updatedAt: iso(-Number(id)), deletedAt: null, ...extra,
})
const card = (wordId: string, extra: Partial<Card> = {}): Card => ({
  id: `c${wordId}`, wordId, cardType: 'recognition', state: 'new', due: iso(0), stability: 0, difficulty: 0, scheduledDays: 0, learningSteps: 0,
  reps: 0, lapses: 0, lastReview: null, introducedAt: null, schedulerVersion: null, updatedAt: iso(0), ...extra,
})

const STRASSE: WordContent = { ...TISCH, lemma: 'Straße', cefr: 'A2', noun: { article: 'die', plural: 'Straßen', genitive: 'Straße', pluralOnly: false }, meanings: [{ ...TISCH.meanings[0]!, translation: 'خیابان' }] }
const APFEL: WordContent = { ...TISCH, lemma: 'Apfel', noun: { article: 'der', plural: 'Äpfel', genitive: 'Apfels', pluralOnly: false }, meanings: [{ ...TISCH.meanings[0]!, translation: 'سیب' }] }

const words = [word('1', AUFGEBEN, { tags: ['فعل‌ها'] }), word('2', TISCH, { isFavorite: true, tags: ['خانه', 'درس ۱'] }), word('3', SCHNELL), word('4', STRASSE, { tags: ['درس ۱'] }), word('5', APFEL)]
const cards = new Map<string, Card>([
  ['1', card('1', { state: 'review', stability: 40, due: iso(12), lastReview: iso(-3), reps: 9 })], // mastered
  ['2', card('2', { state: 'review', stability: 4, due: iso(-1), lastReview: iso(-5), reps: 4, lapses: 3 })], // review, due, difficult
  ['3', card('3', { state: 'learning', due: iso(0), lastReview: iso(0), reps: 1 })],
  ['4', card('4')], // new
  // word 5 has no card yet (just saved on another device): treated as new
])
const entries = buildEntries(words, cards)
const base = { query: '', quick: 'all' as const, pos: null, cefr: null, tag: null, sort: 'newest' as const }
const lemmas = (filters: Partial<Parameters<typeof filterWords>[1]>) => filterWords(entries, { ...base, ...filters }, NOW).map((e) => e.word.lemma)

describe('word bank search', () => {
  test('finds German by part of a word, ignoring case', () => {
    expect(lemmas({ query: 'GEB' })).toEqual(['aufgeben'])
    expect(lemmas({ query: 'sch' }).sort()).toEqual(['Tisch', 'schnell'])
  })
  test('umlauts and ß match their plain spellings both ways', () => {
    expect(lemmas({ query: 'strasse' })).toEqual(['Straße'])
    expect(lemmas({ query: 'Straße' })).toEqual(['Straße'])
    expect(lemmas({ query: 'apfel' })).toEqual(['Apfel'])
    expect(lemmas({ query: 'äpfel' })).toEqual(['Apfel']) // the plural is searchable too
  })
  test('finds a verb by its participle', () => {
    expect(lemmas({ query: 'aufgegeben' })).toEqual(['aufgeben'])
  })
  test('finds Persian meanings, including secondary ones', () => {
    expect(lemmas({ query: 'میز' })).toEqual(['Tisch'])
    expect(lemmas({ query: 'تحویل' })).toEqual(['aufgeben'])
  })
  test('Persian typed with Arabic letters or without half-space still matches', () => {
    expect(foldPersian('مي‌شود كتاب')).toBe(foldPersian('میشود کتاب'))
    expect(lemmas({ query: 'ميز' })).toEqual(['Tisch'])
    expect(lemmas({ query: 'خيابان' })).toEqual(['Straße'])
  })
  test('no match gives an empty list; blank query gives everything', () => {
    expect(lemmas({ query: 'xyz' })).toEqual([])
    expect(lemmas({ query: '   ' }).length).toBe(5)
  })
  test('foldGerman', () => {
    expect(foldGerman('  Größe ')).toBe('grosse')
    expect(foldGerman('Café')).toBe('cafe')
  })
})

describe('word bank filters and order', () => {
  test('by learning status', () => {
    expect(lemmas({ quick: 'new' }).sort()).toEqual(['Apfel', 'Straße'])
    expect(lemmas({ quick: 'learning' })).toEqual(['schnell'])
    expect(lemmas({ quick: 'review' })).toEqual(['Tisch'])
    expect(lemmas({ quick: 'mastered' })).toEqual(['aufgeben'])
  })
  test('favourites, difficult, due today', () => {
    expect(lemmas({ quick: 'favorites' })).toEqual(['Tisch'])
    expect(lemmas({ quick: 'difficult' })).toEqual(['Tisch'])
    expect(lemmas({ quick: 'due' }).sort()).toEqual(['Tisch', 'schnell']) // new words are not "due"
  })
  test('by part of speech and level, combined with search', () => {
    expect(lemmas({ pos: 'verb' })).toEqual(['aufgeben'])
    expect(lemmas({ cefr: 'A2' })).toEqual(['Straße'])
    expect(lemmas({ pos: 'noun', cefr: 'A1' }).sort()).toEqual(['Apfel', 'Tisch'])
    expect(lemmas({ pos: 'noun', query: 'sch' })).toEqual(['Tisch'])
  })
  test('by group, alone and combined', () => {
    expect(lemmas({ tag: 'درس ۱' }).sort()).toEqual(['Straße', 'Tisch'])
    expect(lemmas({ tag: 'درس ۱', quick: 'favorites' })).toEqual(['Tisch'])
    expect(lemmas({ tag: 'ناموجود' })).toEqual([])
  })
  test('sorting', () => {
    expect(lemmas({ sort: 'newest' })).toEqual(['aufgeben', 'Tisch', 'schnell', 'Straße', 'Apfel'])
    expect(lemmas({ sort: 'alpha' })).toEqual(['Apfel', 'aufgeben', 'schnell', 'Straße', 'Tisch'])
    expect(lemmas({ sort: 'due' }).slice(0, 3)).toEqual(['Tisch', 'schnell', 'aufgeben'])
    expect(lemmas({ sort: 'reviewed' }).slice(0, 3)).toEqual(['schnell', 'aufgeben', 'Tisch'])
  })
})
