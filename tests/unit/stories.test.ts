import { describe, expect, test } from 'bun:test'
import { highlightKnown, pickStoryWords, suggestLevel } from '../../src/core/stories.ts'
import type { Card, Word } from '../../src/core/types.ts'

const word = (id: string, lemma: string, extra: Partial<Word> = {}): Word =>
  ({ id, lemma, pos: 'noun', cefr: 'A2', deletedAt: null, content: { noun: null }, ...extra }) as unknown as Word
const card = (wordId: string, state: Card['state'], lastReview: string | null): Card =>
  ({ id: `c${wordId}`, wordId, cardType: 'recognition', state, lastReview }) as Card

describe('story words', () => {
  test('words being learned come first, new cards and sentences are left out', () => {
    const words = [word('1', 'Tisch'), word('2', 'Lampe'), word('3', 'Haus'), word('4', 'Wie geht es?', { pos: 'sentence' })]
    const cards = [card('1', 'review', '2026-10-01T00:00:00Z'), card('2', 'learning', '2026-09-01T00:00:00Z'), card('3', 'new', null), card('4', 'review', '2026-10-10T00:00:00Z')]
    expect(pickStoryWords(words, cards).map((w) => w.lemma)).toEqual(['Lampe', 'Tisch'])
  })

  test('level follows the words', () => {
    expect(suggestLevel([word('1', 'a', { cefr: 'B1' }), word('2', 'b', { cefr: 'B1' }), word('3', 'c', { cefr: 'A1' })])).toBe('B1')
    expect(suggestLevel([])).toBe('A2')
  })

  test('known words are marked, also when inflected', () => {
    const parts = highlightKnown('Die Tische stehen im Haus, und sie gibt auf.', ['der Tisch', 'stehen', 'aufgeben'])
    expect(parts.filter((p) => p.known).map((p) => p.text)).toEqual(['Tische', 'stehen'])
    expect(parts.map((p) => p.text).join('')).toBe('Die Tische stehen im Haus, und sie gibt auf.')
  })
})
