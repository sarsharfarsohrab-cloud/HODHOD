/**
 * The lexical content of a word and its validation.
 *
 * One definition is shared by the AI function (validates model output before it
 * leaves the server) and the client (validates again before saving, and after
 * every user edit). Nothing that fails `validateWordContent` is ever stored.
 */

export const CONTENT_VERSION = 1

export const POS_VALUES = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'preposition',
  'conjunction',
  'pronoun',
  'article',
  'numeral',
  'interjection',
  'particle',
  'phrase',
  'other',
] as const
export type PartOfSpeech = (typeof POS_VALUES)[number]

export const CEFR_VALUES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type Cefr = (typeof CEFR_VALUES)[number]

export const EXAMPLE_LEVELS = ['easy', 'medium', 'hard'] as const
export type ExampleLevel = (typeof EXAMPLE_LEVELS)[number]

export const ARTICLE_VALUES = ['der', 'die', 'das'] as const
export type Article = (typeof ARTICLE_VALUES)[number]

export interface Example {
  level: ExampleLevel
  de: string
  fa: string
}

export interface Meaning {
  translation: string
  note: string | null
  examples: Example[]
}

export interface NounInfo {
  /** null only for nouns that exist in the plural alone (die Eltern → pluralOnly). */
  article: Article | null
  plural: string | null
  genitive: string | null
  pluralOnly: boolean
}

/** Order of the six persons everywhere in the app. */
export const PERSONS = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie'] as const
export type SixForms = [string, string, string, string, string, string]

export interface VerbInfo {
  separable: boolean
  auxiliary: 'haben' | 'sein'
  reflexive: 'none' | 'accusative' | 'dative'
  irregular: boolean
  partizip2: string
  /** e.g. "auf + Akkusativ"; null when the verb has no fixed preposition/case worth knowing. */
  government: string | null
  praesens: SixForms
  praeteritum: SixForms
  konjunktiv1: SixForms
  konjunktiv2: SixForms
  imperativ: { du: string; ihr: string; Sie: string }
}

export interface AdjectiveInfo {
  comparative: string | null
  superlative: string | null
}

export interface Collocation {
  de: string
  fa: string
}

export interface WordContent {
  version: number
  lemma: string
  pos: PartOfSpeech
  cefr: Cefr | null
  ipa: string | null
  meanings: Meaning[]
  noun: NounInfo | null
  verb: VerbInfo | null
  adjective: AdjectiveInfo | null
  synonyms: string[]
  antonyms: string[]
  collocations: Collocation[]
  notes: string | null
}

export const LIMITS = {
  lemma: 60,
  meanings: 3,
  examplesPerMeaning: 6,
  listItems: 8,
  collocations: 8,
  shortText: 120,
  sentence: 300,
  note: 600,
} as const

export interface ValidationIssue {
  path: string
  code:
    | 'required'
    | 'too_long'
    | 'too_many'
    | 'invalid_value'
    | 'wrong_script'
    | 'missing_levels'
}

export type ValidationResult =
  | { ok: true; value: WordContent }
  | { ok: false; issues: ValidationIssue[] }

export interface ValidateOptions {
  /**
   * 'ai': the draft must be complete — three examples (easy/medium/hard) per meaning.
   * 'user': the learner may trim a draft down, but the essentials must remain.
   */
  mode: 'ai' | 'user'
}

const PERSIAN = /[؀-ۿ]/
const LATIN = /\p{Script=Latin}/u

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

function text(v: unknown): string {
  return typeof v === 'string' ? v.normalize('NFC').replace(/\s+/g, ' ').trim() : ''
}

function optionalText(v: unknown): string | null {
  const t = text(v)
  return t.length > 0 ? t : null
}

function uniqueList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of v) {
    const t = text(item)
    const key = t.toLocaleLowerCase('de')
    if (t && !seen.has(key)) {
      seen.add(key)
      out.push(t)
    }
  }
  return out
}

export function validateWordContent(input: unknown, options: ValidateOptions): ValidationResult {
  const issues: ValidationIssue[] = []
  const add = (path: string, code: ValidationIssue['code']) => issues.push({ path, code })
  if (!isRec(input)) return { ok: false, issues: [{ path: '', code: 'required' }] }

  const lemma = text(input.lemma)
  if (!lemma) add('lemma', 'required')
  else if (lemma.length > LIMITS.lemma) add('lemma', 'too_long')
  else if (!LATIN.test(lemma) || PERSIAN.test(lemma)) add('lemma', 'wrong_script')

  const pos = input.pos as PartOfSpeech
  if (!POS_VALUES.includes(pos)) add('pos', 'invalid_value')

  let cefr: Cefr | null = null
  if (input.cefr !== null && input.cefr !== undefined && input.cefr !== '') {
    if (CEFR_VALUES.includes(input.cefr as Cefr)) cefr = input.cefr as Cefr
    else add('cefr', 'invalid_value')
  } else if (options.mode === 'ai') {
    add('cefr', 'required')
  }

  const ipa = optionalText(input.ipa)
  if (ipa && ipa.length > LIMITS.shortText) add('ipa', 'too_long')

  // --- meanings -----------------------------------------------------------
  const meanings: Meaning[] = []
  const rawMeanings = Array.isArray(input.meanings) ? input.meanings : []
  if (rawMeanings.length === 0) add('meanings', 'required')
  if (rawMeanings.length > LIMITS.meanings) add('meanings', 'too_many')
  rawMeanings.slice(0, LIMITS.meanings).forEach((raw, i) => {
    const p = `meanings.${i}`
    if (!isRec(raw)) return add(p, 'invalid_value')
    const translation = text(raw.translation)
    if (!translation) add(`${p}.translation`, 'required')
    else if (translation.length > LIMITS.shortText) add(`${p}.translation`, 'too_long')
    else if (!PERSIAN.test(translation)) add(`${p}.translation`, 'wrong_script')

    const note = optionalText(raw.note)
    if (note && note.length > LIMITS.note) add(`${p}.note`, 'too_long')

    const examples: Example[] = []
    const rawExamples = Array.isArray(raw.examples) ? raw.examples : []
    if (rawExamples.length > LIMITS.examplesPerMeaning) add(`${p}.examples`, 'too_many')
    rawExamples.slice(0, LIMITS.examplesPerMeaning).forEach((ex, j) => {
      const q = `${p}.examples.${j}`
      if (!isRec(ex)) return add(q, 'invalid_value')
      const level = ex.level as ExampleLevel
      if (!EXAMPLE_LEVELS.includes(level)) add(`${q}.level`, 'invalid_value')
      const de = text(ex.de)
      const fa = text(ex.fa)
      if (!de) add(`${q}.de`, 'required')
      else if (de.length > LIMITS.sentence) add(`${q}.de`, 'too_long')
      else if (!LATIN.test(de) || PERSIAN.test(de)) add(`${q}.de`, 'wrong_script')
      if (!fa) add(`${q}.fa`, 'required')
      else if (fa.length > LIMITS.sentence) add(`${q}.fa`, 'too_long')
      else if (!PERSIAN.test(fa)) add(`${q}.fa`, 'wrong_script')
      examples.push({ level, de, fa })
    })
    if (options.mode === 'ai') {
      const levels = new Set(examples.map((e) => e.level))
      if (examples.length !== EXAMPLE_LEVELS.length || levels.size !== EXAMPLE_LEVELS.length) {
        add(`${p}.examples`, 'missing_levels')
      }
    }
    meanings.push({ translation, note, examples })
  })

  // --- part-of-speech specific blocks --------------------------------------
  let noun: NounInfo | null = null
  if (pos === 'noun') {
    if (!isRec(input.noun)) add('noun', 'required')
    else {
      const raw = input.noun
      const pluralOnly = raw.pluralOnly === true
      let article: Article | null = null
      if (ARTICLE_VALUES.includes(raw.article as Article)) article = raw.article as Article
      else if (!pluralOnly) add('noun.article', raw.article ? 'invalid_value' : 'required')
      const plural = optionalText(raw.plural)
      const genitive = optionalText(raw.genitive)
      if (plural && plural.length > LIMITS.shortText) add('noun.plural', 'too_long')
      if (genitive && genitive.length > LIMITS.shortText) add('noun.genitive', 'too_long')
      noun = { article: pluralOnly && !article ? 'die' : article, plural, genitive, pluralOnly }
    }
  }

  let verb: VerbInfo | null = null
  if (pos === 'verb') {
    if (!isRec(input.verb)) add('verb', 'required')
    else {
      const raw = input.verb
      const six = (key: 'praesens' | 'praeteritum' | 'konjunktiv1' | 'konjunktiv2'): SixForms => {
        const list = Array.isArray(raw[key]) ? (raw[key] as unknown[]).map(text) : []
        if (list.length !== 6 || list.some((f) => !f)) add(`verb.${key}`, list.length ? 'invalid_value' : 'required')
        else if (list.some((f) => f.length > LIMITS.shortText || PERSIAN.test(f))) add(`verb.${key}`, 'invalid_value')
        return [0, 1, 2, 3, 4, 5].map((i) => list[i] ?? '') as SixForms
      }
      const auxiliary = raw.auxiliary === 'sein' ? 'sein' : raw.auxiliary === 'haben' ? 'haben' : null
      if (!auxiliary) add('verb.auxiliary', 'invalid_value')
      const reflexive =
        raw.reflexive === 'accusative' || raw.reflexive === 'dative' || raw.reflexive === 'none'
          ? raw.reflexive
          : null
      if (!reflexive) add('verb.reflexive', 'invalid_value')
      const partizip2 = text(raw.partizip2)
      if (!partizip2) add('verb.partizip2', 'required')
      else if (partizip2.length > LIMITS.shortText) add('verb.partizip2', 'too_long')
      const imp = isRec(raw.imperativ) ? raw.imperativ : {}
      const imperativ = { du: text(imp.du), ihr: text(imp.ihr), Sie: text(imp.Sie) }
      // Modal verbs and a few others have no imperative; an all-empty block is fine,
      // a half-filled one is not.
      const filled = [imperativ.du, imperativ.ihr, imperativ.Sie].filter(Boolean).length
      if (filled !== 0 && filled !== 3) add('verb.imperativ', 'invalid_value')
      const government = optionalText(raw.government)
      if (government && government.length > LIMITS.shortText) add('verb.government', 'too_long')
      verb = {
        separable: raw.separable === true,
        auxiliary: auxiliary ?? 'haben',
        reflexive: reflexive ?? 'none',
        irregular: raw.irregular === true,
        partizip2,
        government,
        praesens: six('praesens'),
        praeteritum: six('praeteritum'),
        konjunktiv1: six('konjunktiv1'),
        konjunktiv2: six('konjunktiv2'),
        imperativ,
      }
    }
  }

  let adjective: AdjectiveInfo | null = null
  if (pos === 'adjective' && isRec(input.adjective)) {
    const comparative = optionalText(input.adjective.comparative)
    const superlative = optionalText(input.adjective.superlative)
    if (comparative && comparative.length > LIMITS.shortText) add('adjective.comparative', 'too_long')
    if (superlative && superlative.length > LIMITS.shortText) add('adjective.superlative', 'too_long')
    if (comparative || superlative) adjective = { comparative, superlative }
  }

  // --- lists ----------------------------------------------------------------
  const synonyms = uniqueList(input.synonyms)
  const antonyms = uniqueList(input.antonyms)
  if (synonyms.length > LIMITS.listItems) add('synonyms', 'too_many')
  if (antonyms.length > LIMITS.listItems) add('antonyms', 'too_many')
  if ([...synonyms, ...antonyms].some((s) => s.length > LIMITS.shortText)) add('synonyms', 'too_long')

  const collocations: Collocation[] = []
  const rawCollocations = Array.isArray(input.collocations) ? input.collocations : []
  if (rawCollocations.length > LIMITS.collocations) add('collocations', 'too_many')
  rawCollocations.slice(0, LIMITS.collocations).forEach((raw, i) => {
    if (!isRec(raw)) return add(`collocations.${i}`, 'invalid_value')
    const de = text(raw.de)
    const fa = text(raw.fa)
    if (!de && !fa) return // an empty row left behind in the editor
    if (!de) add(`collocations.${i}.de`, 'required')
    if (!fa) add(`collocations.${i}.fa`, 'required')
    if (de.length > LIMITS.sentence || fa.length > LIMITS.sentence) add(`collocations.${i}`, 'too_long')
    collocations.push({ de, fa })
  })

  const notes = optionalText(input.notes)
  if (notes && notes.length > LIMITS.note) add('notes', 'too_long')

  if (issues.length > 0) return { ok: false, issues }
  return {
    ok: true,
    value: {
      version: CONTENT_VERSION,
      lemma,
      pos,
      cefr,
      ipa,
      meanings,
      noun,
      verb,
      adjective,
      synonyms,
      antonyms,
      collocations,
      notes,
    },
  }
}

/** The word as it is shown and spoken: nouns carry their article. */
export function displayWord(content: Pick<WordContent, 'lemma' | 'noun'>): string {
  return content.noun?.article ? `${content.noun.article} ${content.lemma}` : content.lemma
}
