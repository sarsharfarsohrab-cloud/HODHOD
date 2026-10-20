import { describe, expect, test } from 'bun:test'
import { buildQuiz, gradeDictation, gradeSpoken, wordOverlap } from '../../src/core/quiz.ts'
import type { Word } from '../../src/core/types.ts'

const word = (lemma: string, pos: string, article: string | null = null): Word =>
  ({ id: lemma, lemma, pos, primaryMeaning: 'x', content: { noun: article ? { article, pluralOnly: false } : null } }) as unknown as Word

describe('listening (dictation)', () => {
  const sentence = word('Wie geht es dir?', 'sentence')
  test('a sentence must have every word', () => {
    expect(gradeDictation('Wie geht es dir?', sentence)).toEqual({ correct: true, note: null })
    expect(gradeDictation('wie geht es dir', sentence)).toEqual({ correct: true, note: 'case' })
    expect(gradeDictation('Wie geht es dier', sentence).correct).toBe(false)
    expect(gradeDictation('', sentence).correct).toBe(false)
  })
  test('a noun is graded like typing, with its article', () => {
    expect(gradeDictation('der Tisch', word('Tisch', 'noun', 'der')).correct).toBe(true)
    expect(gradeDictation('die Tisch', word('Tisch', 'noun', 'der'))).toEqual({ correct: false, note: 'wrong_article' })
  })
})

describe('speaking', () => {
  test('what was heard is compared word by word, forgiving case, punctuation and a missing article', () => {
    expect(wordOverlap('wie geht es dir', 'Wie geht es dir?')).toBe(1)
    expect(gradeSpoken(['Tisch'], word('Tisch', 'noun', 'der')).correct).toBe(true)
    expect(gradeSpoken(['wie gehts dir', 'wie geht es dir'], word('Wie geht es dir?', 'sentence')).correct).toBe(true)
    expect(gradeSpoken(['Fisch'], word('Tisch', 'noun', 'der')).correct).toBe(false)
  })
  test('listening and speaking quizzes use every kind of entry', () => {
    const candidates = [word('Tisch', 'noun', 'der'), word('Wie geht es dir?', 'sentence')].map((w) => ({ word: w, card: undefined, stat: undefined }))
    expect(buildQuiz('listening', candidates, 5, new Date(), () => 0.5).map((q) => q.type)).toEqual(['dictation', 'dictation'])
    expect(buildQuiz('speaking', candidates, 5, new Date(), () => 0.5).every((q) => q.type === 'speaking')).toBe(true)
  })
})
