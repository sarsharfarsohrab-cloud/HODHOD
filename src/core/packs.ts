/**
 * Progress through a word pack. A pack is split into lessons; a lesson is "green" when
 * every one of its entries is in the learner's bank and its card has left the learning
 * steps (state "review"). The next lesson opens when the one before it is green.
 */
import type { Card, Word } from './types.ts'

export interface PackEntry {
  id: string
  lesson: number
  lemma: string | null
  pos: string | null
}

export type LessonState = 'done' | 'active' | 'open' | 'locked'

export interface LessonProgress {
  lesson: number
  entries: PackEntry[]
  /** Entries already in the bank. */
  inBank: number
  green: number
  state: LessonState
}

export interface PackProgress {
  lessons: LessonProgress[]
  total: number
  green: number
  /** The lesson to suggest next: the first one that is open or still being learned. */
  current: number | null
}

/** A word counts as learned once its recognition card has graduated from the learning steps. */
export function isGreen(cards: readonly Card[]): boolean {
  const main = cards.find((c) => c.cardType === 'recognition') ?? cards[0]
  return main !== undefined && main.state === 'review'
}

export function packProgress(
  entries: readonly PackEntry[],
  wordOf: (entry: PackEntry) => Word | undefined,
  cardsOf: (wordId: string) => readonly Card[],
): PackProgress {
  const byLesson = new Map<number, PackEntry[]>()
  for (const e of entries) {
    const list = byLesson.get(e.lesson) ?? []
    list.push(e)
    byLesson.set(e.lesson, list)
  }
  const lessons: LessonProgress[] = []
  let previousDone = true
  let total = 0
  let green = 0
  for (const lesson of [...byLesson.keys()].sort((a, b) => a - b)) {
    const list = byLesson.get(lesson)!
    let inBank = 0
    let lessonGreen = 0
    for (const entry of list) {
      const word = wordOf(entry)
      if (!word) continue
      inBank++
      if (isGreen(cardsOf(word.id))) lessonGreen++
    }
    const done = lessonGreen === list.length
    const state: LessonState = done ? 'done' : inBank > 0 ? 'active' : previousDone ? 'open' : 'locked'
    lessons.push({ lesson, entries: list, inBank, green: lessonGreen, state })
    previousDone = done
    total += list.length
    green += lessonGreen
  }
  const current = lessons.find((l) => l.state === 'active' || l.state === 'open')?.lesson ?? null
  return { lessons, total, green, current }
}

/** Splits entries into lessons of `size`, in order. */
export function assignLessons<T extends { position: number }>(items: readonly T[], size: number): (T & { lesson: number })[] {
  return [...items].sort((a, b) => a.position - b.position).map((item, i) => ({ ...item, lesson: Math.floor(i / Math.max(1, size)) + 1 }))
}
