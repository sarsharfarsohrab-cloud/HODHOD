/** Choosing words for a short story and finding them again in its sentences. */
import type { Card, Word } from './types.ts'

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const
export type StoryLevel = (typeof LEVELS)[number]

/** How a word is sent to the story writer: nouns with their article. */
export const storyForm = (word: Word): string => (word.content.noun?.article ? `${word.content.noun.article} ${word.lemma}` : word.lemma)

/**
 * Words the learner has met (not brand-new cards), favouring the ones being learned right
 * now and the ones reviewed most recently. Sentences are left out: a story needs words.
 */
export function pickStoryWords(words: Iterable<Word>, cards: Iterable<Card>, max = 15): Word[] {
  const main = new Map<string, Card>()
  for (const c of cards) if (c.cardType === 'recognition') main.set(c.wordId, c)
  const scored: { word: Word; score: number }[] = []
  for (const word of words) {
    if (word.deletedAt || word.pos === 'sentence') continue
    const card = main.get(word.id)
    if (!card || card.state === 'new') continue
    const recent = card.lastReview ? Date.parse(card.lastReview) : 0
    const learning = card.state === 'learning' || card.state === 'relearning' ? 1e13 : 0
    scored.push({ word, score: learning + recent })
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, max).map((s) => s.word)
}

/** The level the chosen words suggest (their median CEFR level), A2 when unknown. */
export function suggestLevel(words: readonly Word[]): StoryLevel {
  const ranks = words.map((w) => LEVELS.indexOf((w.cefr ?? '') as StoryLevel)).filter((i) => i >= 0).sort((a, b) => a - b)
  if (ranks.length === 0) return 'A2'
  return LEVELS[Math.min(3, ranks[Math.floor(ranks.length / 2)]!)]!
}

export interface Segment {
  text: string
  known: boolean
}

function stems(forms: readonly string[]): string[] {
  const out = new Set<string>()
  for (const form of forms) {
    const parts = form.toLocaleLowerCase('de').replace(/^(der|die|das|sich)\s+/, '').split(/\s+/)
    for (const part of parts) {
      if (part.length < 3 || ['jdn.', 'jdm.', 'etw.', 'sein', 'haben'].includes(part)) continue
      out.add(part.length >= 5 ? part.replace(/(en|n|e)$/, '') : part)
    }
  }
  return [...out]
}

/** Splits a sentence so the learner's own words (in any form: "gab" is not caught, "Tische" is) can be marked. */
export function highlightKnown(sentence: string, forms: readonly string[]): Segment[] {
  const known = stems(forms)
  const segments: Segment[] = []
  for (const piece of sentence.split(/(\p{L}+(?:['’]\p{L}+)?)/u)) {
    if (!piece) continue
    const lower = piece.toLocaleLowerCase('de')
    const isKnown = /\p{L}/u.test(piece) && known.some((s) => lower === s || (s.length >= 4 && lower.startsWith(s) && lower.length - s.length <= 3))
    const last = segments.at(-1)
    if (last && last.known === isKnown && !isKnown) last.text += piece
    else segments.push({ text: piece, known: isKnown })
  }
  return segments
}
