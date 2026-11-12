/** The compact form in which hand-written packs are authored (see restaurant.ts). */
import type { Cefr, PartOfSpeech } from '../../../supabase/functions/_shared/wordSchema.ts'

/** What is needed to conjugate a German verb; everything not given follows the regular pattern. */
export interface VerbSpec {
  /** Partizip II */
  p2: string
  aux?: 'haben' | 'sein'
  /** present tense, 2nd and 3rd person singular, when the stem changes ("isst") */
  du?: string
  er?: string
  /** strong verbs: the past stem ("aß") and the stem of Konjunktiv II ("äß") */
  prat?: string
  k2?: string
  /** mixed verbs: changed stems that still take the weak endings ("brach" → brachte) */
  pratWeak?: string
  k2Weak?: string
  /** imperative singular when it is not the plain stem ("iss") */
  imp?: string
  /** separable prefix ("ein" in einladen) */
  sep?: string
  irregular?: boolean
  /** fixed preposition worth knowing ("auf + Akkusativ") */
  gov?: string
}

export interface CuratedWord {
  /** the word itself, nouns without their article */
  w: string
  /** nouns: gender, or 'pl' for plural-only nouns */
  g?: 'm' | 'f' | 'n' | 'pl'
  /** nouns: the plural without article; null when there is none in everyday use */
  pl?: string | null
  /** every other part of speech */
  p?: Exclude<PartOfSpeech, 'noun' | 'sentence'>
  /** adjectives: comparative and superlative */
  cmp?: [string, string]
  v?: VerbSpec
  lv: Cefr
  /** meaning in the learner's language */
  fa: string
  /** one short sentence to listen to, and its translation; never asked about */
  ex: [string, string]
  /** a note on a close word, a false friend or a custom */
  tip?: string
}

export interface CuratedLine {
  /** who says it, in the learner's language */
  who: string
  de: string
  fa: string
  /** when it is said */
  when: string
  lv: Cefr
  /** a typical answer and its translation */
  reply?: [string, string]
  /** word-for-word rendering */
  lit?: string
  /** other ways to say the same */
  alt?: string[]
  informal?: boolean
}

export interface CuratedGroup {
  title: string
  words?: CuratedWord[]
  lines?: CuratedLine[]
}

export interface CuratedPack {
  slug: string
  kind: 'words' | 'sentences'
  level: 'basic' | 'advanced'
  emoji: string
  title: string
  description: string
  groups: CuratedGroup[]
}
