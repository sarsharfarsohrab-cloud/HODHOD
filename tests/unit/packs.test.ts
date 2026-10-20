import { describe, expect, test } from 'bun:test'
import { assignLessons, packProgress, type PackEntry } from '../../src/core/packs.ts'
import type { Card, Word } from '../../src/core/types.ts'
import { parseItemList, parsePackFile } from '../../src/data/platform.ts'

const entry = (id: string, lesson: number): PackEntry => ({ id, lesson, lemma: id, pos: 'noun' })
const card = (wordId: string, state: Card['state']): Card => ({
  id: `c-${wordId}`, wordId, cardType: 'recognition', state, due: '2026-01-01T00:00:00Z', stability: 0, difficulty: 0, scheduledDays: 0,
  learningSteps: 0, reps: 0, lapses: 0, lastReview: null, introducedAt: null, schedulerVersion: null, updatedAt: '2026-01-01T00:00:00Z',
})

function progress(entries: PackEntry[], states: Record<string, Card['state']>) {
  return packProgress(
    entries,
    (e) => (states[e.id] ? ({ id: e.id } as Word) : undefined),
    (wordId) => (states[wordId] ? [card(wordId, states[wordId]!)] : []),
  )
}

describe('pack progress', () => {
  const entries = [entry('a', 1), entry('b', 1), entry('c', 2), entry('d', 2), entry('e', 3)]

  test('only the first lesson is open at the start', () => {
    const p = progress(entries, {})
    expect(p.lessons.map((l) => l.state)).toEqual(['open', 'locked', 'locked'])
    expect(p.current).toBe(1)
    expect(p.total).toBe(5)
    expect(p.green).toBe(0)
  })

  test('a lesson being learned stays active until every card has graduated', () => {
    const p = progress(entries, { a: 'review', b: 'learning' })
    expect(p.lessons.map((l) => l.state)).toEqual(['active', 'locked', 'locked'])
    expect(p.lessons[0]!.green).toBe(1)
    expect(p.current).toBe(1)
  })

  test('a green lesson opens the next one', () => {
    const p = progress(entries, { a: 'review', b: 'review' })
    expect(p.lessons.map((l) => l.state)).toEqual(['done', 'open', 'locked'])
    expect(p.current).toBe(2)
    expect(p.green).toBe(2)
  })

  test('a word the learner already had counts for a later lesson', () => {
    const p = progress(entries, { e: 'new' })
    expect(p.lessons[2]!.state).toBe('active')
    expect(p.lessons[2]!.inBank).toBe(1)
  })

  test('lessons are cut by position', () => {
    const items = [{ position: 3 }, { position: 0 }, { position: 1 }, { position: 2 }, { position: 7 }]
    expect(assignLessons(items, 2).map((i) => [i.position, i.lesson])).toEqual([[0, 1], [1, 1], [2, 2], [3, 2], [7, 3]])
  })
})

describe('pasted pack lists', () => {
  test('one entry per line, hints after a bar or tab, bullets and duplicates dropped', () => {
    expect(parseItemList('die Bank | نیمکت\n- der Termin\n\n2. Wie spät ist es?\nder termin\nder Hahn\tخروس')).toEqual([
      { input: 'die Bank', hint: 'نیمکت' },
      { input: 'der Termin', hint: null },
      { input: 'Wie spät ist es?', hint: null },
      { input: 'der Hahn', hint: 'خروس' },
    ])
  })

  test('pack files are checked before anything is created', () => {
    expect(() => parsePackFile('{"packs": [{"slug": "x"}]}')).toThrow()
    expect(() => parsePackFile('[]')).toThrow()
    expect(parsePackFile('{"packs": [{"slug": "kitchen", "topic": "home", "title_fa": "آشپزخانه", "items": ["der Topf"]}]}').packs).toHaveLength(1)
  })
})
