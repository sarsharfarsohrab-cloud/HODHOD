/**
 * The lexical content of a word and its validation.
 *
 * One definition is shared by the AI function (validates model output before it
 * leaves the server) and the client (validates again before saving, and after
 * every user edit). Nothing that fails `validateWordContent` is ever stored.
 */

/**
 * 3: any language pair. The two text slots of an example, a collocation and a reply keep
 * their historical names: `de` holds the text in the language being learned and `fa` the
 * text in the learner's own language, whatever the pair is.
 */
export const CONTENT_VERSION = 3

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
  'sentence',
  'other',
] as const
export type PartOfSpeech = (typeof POS_VALUES)[number]

export const CEFR_VALUES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type Cefr = (typeof CEFR_VALUES)[number]

export const EXAMPLE_LEVELS = ['easy', 'medium', 'hard'] as const
export type ExampleLevel = (typeof EXAMPLE_LEVELS)[number]

export const ARTICLE_VALUES = ['der', 'die', 'das'] as const
/** A definite article in the singular ("der", "la", "het", "l'"). */
export type Article = string

/** Grammatical gender: masculine, feminine, neuter, or common (Dutch de-words). */
export const GENDER_VALUES = ['m', 'f', 'n', 'c'] as const
export type Gender = (typeof GENDER_VALUES)[number]

/** Singular definite articles per learned language, with the gender each one marks (null: it does not tell). */
export const ARTICLES: Record<string, Record<string, Gender | null>> = {
  de: { der: 'm', die: 'f', das: 'n' },
  fr: { le: 'm', la: 'f', "l'": null },
  it: { il: 'm', lo: 'm', la: 'f', "l'": null },
  es: { el: 'm', la: 'f' },
  nl: { de: 'c', het: 'n' },
  en: {},
}

/** Does this learned language mark nouns with a gendered article? */
export const hasArticles = (target: string): boolean => Object.keys(ARTICLES[target] ?? {}).length > 0

export interface Example {
  level: ExampleLevel
  /** sentence in the learned language */
  de: string
  /** its translation into the learner's language */
  fa: string
}

export interface Meaning {
  translation: string
  note: string | null
  examples: Example[]
}

export interface NounInfo {
  /** null for plural-only nouns and in languages without gendered articles (English). */
  article: Article | null
  /** Since content version 3; for German it follows from the article. */
  gender?: Gender | null
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

/** One tense of a verb in a language other than German, as the AI wrote it. */
export interface Tense {
  /** name of the tense in the learned language ("présent", "Past simple") */
  name: string
  forms: { person: string; form: string }[]
}

/** Verb details for every learned language except German (which keeps the richer VerbInfo). */
export interface Conjugation {
  /** auxiliary of the perfect tense (avoir/être, essere/avere, hebben/zijn, haber, have) */
  auxiliary: string | null
  irregular: boolean
  /** Dutch separable verbs (opbellen → ik bel op) */
  separable: boolean
  reflexive: boolean
  /** past participle */
  participle: string
  /** fixed preposition worth knowing ("penser à", "depend on") */
  government: string | null
  tenses: Tense[]
}

export interface AdjectiveInfo {
  comparative: string | null
  superlative: string | null
}

/** How a word or expression sounds: who says it, where. */
export const REGISTER_VALUES = ['neutral', 'informal', 'formal', 'slang', 'vulgar'] as const
export type Register = (typeof REGISTER_VALUES)[number]

export interface Reply {
  de: string
  fa: string
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
  /** German verbs */
  verb: VerbInfo | null
  /** verbs of every other learned language (content version 3) */
  conjugation?: Conjugation | null
  adjective: AdjectiveInfo | null
  synonyms: string[]
  antonyms: string[]
  collocations: Collocation[]
  notes: string | null
  // --- since content version 2 (absent in older saved words) -------------------
  /** Word-for-word Persian rendering of an idiom ("die Nase voll haben" → «دماغ را پُر داشتن»). */
  literal?: string | null
  register?: Register | null
  /** 3 very common in everyday speech, 2 common, 1 rare. */
  frequency?: 1 | 2 | 3 | null
  /** Other ways to say the same thing (German). */
  alternatives?: string[]
  /** A typical answer when the entry is a question or a greeting. */
  reply?: Reply | null
}

export const LIMITS = {
  lemma: 60,
  /** fixed expressions and sentences may be longer */
  lemmaPhrase: 120,
  lemmaSentence: 200,
  translationSentence: 300,
  alternatives: 5,
  meanings: 3,
  examplesPerMeaning: 6,
  listItems: 8,
  collocations: 8,
  shortText: 120,
  sentence: 300,
  note: 600,
  tenses: 5,
  persons: 8,
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
  /** language being learned (default German) */
  target?: string
  /** the learner's own language, in which meanings are written (default Persian) */
  native?: string
}

const PERSIAN = /[؀-ۿ]/
const LATIN = /\p{Script=Latin}/u
const CYRILLIC = /\p{Script=Cyrillic}/u

/** The script a native language is written in, when it differs from the Latin script of every learned language. */
export function nativeScript(native: string): RegExp | null {
  if (native === 'fa' || native === 'ar') return PERSIAN
  if (native === 'uk' || native === 'ru') return CYRILLIC
  return null
}

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
  const target = options.target ?? 'de'
  const script = nativeScript(options.native ?? 'fa')
  /** text in the learner's language: in its own script when that script is not Latin */
  const nativeOk = (v: string) => !script || script.test(v)
  /** text in the learned language: Latin script, none of the native script */
  const targetOk = (v: string) => LATIN.test(v) && !(script && script.test(v))

  const pos = input.pos as PartOfSpeech
  if (!POS_VALUES.includes(pos)) add('pos', 'invalid_value')
  const isSentence = pos === 'sentence'

  const lemma = text(input.lemma)
  const lemmaMax = isSentence ? LIMITS.lemmaSentence : pos === 'phrase' ? LIMITS.lemmaPhrase : LIMITS.lemma
  if (!lemma) add('lemma', 'required')
  else if (lemma.length > lemmaMax) add('lemma', 'too_long')
  else if (!targetOk(lemma)) add('lemma', 'wrong_script')

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
    else if (translation.length > (isSentence ? LIMITS.translationSentence : LIMITS.shortText)) add(`${p}.translation`, 'too_long')
    else if (!nativeOk(translation)) add(`${p}.translation`, 'wrong_script')

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
      else if (!targetOk(de)) add(`${q}.de`, 'wrong_script')
      if (!fa) add(`${q}.fa`, 'required')
      else if (fa.length > LIMITS.sentence) add(`${q}.fa`, 'too_long')
      else if (!nativeOk(fa)) add(`${q}.fa`, 'wrong_script')
      examples.push({ level, de, fa })
    })
    // a sentence is its own example: further examples are optional
    if (options.mode === 'ai' && !isSentence) {
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
      const allowed = ARTICLES[target] ?? {}
      const withArticles = Object.keys(allowed).length > 0
      let article: Article | null = null
      const rawArticle = text(raw.article).toLowerCase().replace(/’/g, "'")
      if (withArticles && rawArticle in allowed) article = rawArticle
      else if (withArticles && !pluralOnly) add('noun.article', rawArticle ? 'invalid_value' : 'required')
      // the stated gender wins: Spanish "el agua" is feminine although "el" usually marks masculine
      let gender: Gender | null = GENDER_VALUES.includes(raw.gender as Gender) ? (raw.gender as Gender) : null
      if (!gender && article) gender = allowed[article] ?? null
      if (target === 'de' && article) gender = allowed[article] ?? gender
      if (withArticles && article && !gender) add('noun.gender', 'required')
      const plural = optionalText(raw.plural)
      const genitive = target === 'de' ? optionalText(raw.genitive) : null
      if (plural && plural.length > LIMITS.shortText) add('noun.plural', 'too_long')
      if (genitive && genitive.length > LIMITS.shortText) add('noun.genitive', 'too_long')
      if (target === 'de' && pluralOnly && !article) article = 'die'
      noun = { article, gender, plural, genitive, pluralOnly }
    }
  }

  let verb: VerbInfo | null = null
  let conjugation: Conjugation | null = null
  if (pos === 'verb' && target !== 'de') {
    if (!isRec(input.conjugation)) add('conjugation', 'required')
    else {
      const raw = input.conjugation
      const participle = text(raw.participle)
      if (!participle && options.mode === 'ai') add('conjugation.participle', 'required')
      else if (participle.length > LIMITS.shortText) add('conjugation.participle', 'too_long')
      const auxiliary = optionalText(raw.auxiliary)
      const government = optionalText(raw.government)
      if ((auxiliary?.length ?? 0) > LIMITS.shortText) add('conjugation.auxiliary', 'too_long')
      if ((government?.length ?? 0) > LIMITS.shortText) add('conjugation.government', 'too_long')
      const tenses: Tense[] = []
      const rawTenses = Array.isArray(raw.tenses) ? raw.tenses : []
      if (rawTenses.length === 0 && options.mode === 'ai') add('conjugation.tenses', 'required')
      if (rawTenses.length > LIMITS.tenses) add('conjugation.tenses', 'too_many')
      rawTenses.slice(0, LIMITS.tenses).forEach((rt, i) => {
        if (!isRec(rt)) return add(`conjugation.tenses.${i}`, 'invalid_value')
        const name = text(rt.name)
        const rawForms = Array.isArray(rt.forms) ? rt.forms : []
        const forms = rawForms
          .slice(0, LIMITS.persons)
          .map((f) => (isRec(f) ? { person: text(f.person), form: text(f.form) } : { person: '', form: '' }))
        if (!name || forms.length === 0 || forms.some((f) => !f.form)) add(`conjugation.tenses.${i}`, 'invalid_value')
        else if (forms.some((f) => f.form.length > LIMITS.shortText || f.person.length > LIMITS.shortText || !targetOk(f.form)))
          add(`conjugation.tenses.${i}`, 'invalid_value')
        tenses.push({ name, forms })
      })
      conjugation = {
        auxiliary,
        irregular: raw.irregular === true,
        separable: raw.separable === true,
        reflexive: raw.reflexive === true,
        participle,
        government,
        tenses,
      }
    }
  }
  if (pos === 'verb' && target === 'de') {
    if (!isRec(input.verb)) add('verb', 'required')
    else {
      const raw = input.verb
      const six = (key: 'praesens' | 'praeteritum' | 'konjunktiv1' | 'konjunktiv2'): SixForms => {
        const list = Array.isArray(raw[key]) ? (raw[key] as unknown[]).map(text) : []
        if (list.length !== 6 || list.some((f) => !f)) add(`verb.${key}`, list.length ? 'invalid_value' : 'required')
        else if (list.some((f) => f.length > LIMITS.shortText || !targetOk(f))) add(`verb.${key}`, 'invalid_value')
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

  // --- expression details (content version 2) ----------------------------------
  const literal = optionalText(input.literal)
  if (literal && literal.length > LIMITS.translationSentence) add('literal', 'too_long')
  else if (literal && !nativeOk(literal)) add('literal', 'wrong_script')

  let register: Register | null = null
  if (input.register !== null && input.register !== undefined && input.register !== '') {
    if (REGISTER_VALUES.includes(input.register as Register)) register = input.register as Register
    else add('register', 'invalid_value')
  }

  let frequency: 1 | 2 | 3 | null = null
  if (input.frequency !== null && input.frequency !== undefined) {
    if (input.frequency === 1 || input.frequency === 2 || input.frequency === 3) frequency = input.frequency
    else add('frequency', 'invalid_value')
  }

  // extra alternatives are dropped rather than refused
  const alternatives = uniqueList(input.alternatives).filter((a) => a !== lemma)
  if (alternatives.some((a) => a.length > LIMITS.lemmaSentence || !targetOk(a))) add('alternatives', 'invalid_value')

  let reply: Reply | null = null
  if (isRec(input.reply)) {
    const de = text(input.reply.de)
    const fa = text(input.reply.fa)
    if (de || fa) {
      if (!de) add('reply.de', 'required')
      else if (de.length > LIMITS.sentence || !targetOk(de)) add('reply.de', 'invalid_value')
      if (!fa) add('reply.fa', 'required')
      else if (fa.length > LIMITS.sentence || !nativeOk(fa)) add('reply.fa', 'invalid_value')
      reply = { de, fa }
    }
  }

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
      conjugation,
      adjective,
      synonyms,
      antonyms,
      collocations,
      notes,
      literal,
      register,
      frequency,
      alternatives: alternatives.slice(0, LIMITS.alternatives),
      reply,
    },
  }
}

/** The word as it is shown and spoken: nouns carry their article. */
export function displayWord(content: Pick<WordContent, 'lemma' | 'noun'>): string {
  const article = content.noun?.article
  if (!article) return content.lemma
  // elided articles join the noun: l'arbre, l'amica
  return article.endsWith("'") ? `${article}${content.lemma}` : `${article} ${content.lemma}`
}
