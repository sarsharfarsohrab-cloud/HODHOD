/**
 * Versioned prompt + output schema for word analysis.
 *
 * Bump PROMPT_VERSION whenever the instructions or the schema change:
 * the shared cache is keyed by it, so old drafts are never served for a new prompt.
 */

import {
  ARTICLE_VALUES,
  CEFR_VALUES,
  EXAMPLE_LEVELS,
  POS_VALUES,
  REGISTER_VALUES,
  type ValidationIssue,
} from './wordSchema.ts'

export const PROMPT_VERSION = 'word_analysis_v3'
/** Earlier versions whose cached word analyses are still valid (they never contained sentences). */
export const COMPATIBLE_PROMPT_VERSIONS = ['word_analysis_v2'] as const

export interface LanguagePair {
  target: string
  native: string
}

/** Language pairs the prompt below has actually been written for. */
export const SUPPORTED_PAIRS: readonly LanguagePair[] = [{ target: 'de', native: 'fa' }]

export function isSupportedPair(pair: LanguagePair): boolean {
  return SUPPORTED_PAIRS.some((p) => p.target === pair.target && p.native === pair.native)
}

export const AI_STATUS = ['ok', 'not_a_word', 'wrong_language', 'misspelled'] as const
export type AiStatus = (typeof AI_STATUS)[number]

const SYSTEM_DE_FA = `You are a careful German lexicographer and teacher writing vocabulary cards for native Persian (Farsi) speakers who are learning German.

You receive ONE entry typed by a learner: a single German word, a fixed expression (idiom, set phrase, common collocation, verb with a fixed preposition or noun such as "Bescheid sagen", "auf jeden Fall", "sich Sorgen machen", "jdm. auf die Nerven gehen"), or a short everyday sentence ("Kannst du mir kurz helfen?", "Das ist mir egal."). Return a single JSON object that follows the provided schema exactly.

STEP 1 — decide "status":
- "ok": the input is a real German word (any inflected form counts), an established fixed expression that a dictionary or textbook would list as one unit, or a natural everyday German sentence (up to about 20 words) that is useful to learn as a whole. Small mistakes in a sentence (missing comma, wrong capitalisation, a wrong ending) are corrected silently in "lemma" and mentioned in "input_note".
- "misspelled": it is clearly a typo of a German word or expression (missing umlaut, swapped letters). Put the corrected form in "suggestion". Do not analyse it.
  Capitalisation alone is NEVER a misspelling: "erfolg", "TISCH" or "Aufgeben" are "ok" and are analysed (the lemma gets the correct capitalisation). "ss" written for "ß" is not a misspelling either.
- "wrong_language": it is from another language and not used in German.
- "not_a_word": random letters, a name with no dictionary meaning, several unrelated words, or text that is not natural German at all.
For every status except "ok": lemma = "", meanings = [], noun/verb/adjective/reply = null, lists = [], other text fields null, pos = "other", cefr = "A1", register = null, frequency = null.

STEP 2 — when status is "ok":
- "lemma": the dictionary form. Nouns: nominative singular WITHOUT article, capitalised ("Tisch"). Verbs: infinitive ("aufgeben"); truly reflexive verbs as "sich freuen". Adjectives: base form. Fixed expressions: the citation form with the verb in the infinitive at the end ("Bescheid sagen", "sich Sorgen machen", "auf jeden Fall"), correct capitalisation, no final punctuation.
- If the learner typed an inflected form ("ging", "Häuser", "besser"), analyse the lemma and explain the relation in one short Persian sentence in "input_note". Otherwise "input_note" is null.
- "pos": the most common part of speech of this word. For every fixed expression of two or more words use "phrase" (the only exception: a single reflexive verb such as "sich freuen" is a "verb"). For a complete sentence or a set conversational formula that works as a whole utterance ("Wie geht's?", "Das kannst du vergessen!", "Ich hätte gern einen Termin.") use "sentence". For "phrase" and "sentence": noun, verb and adjective are null, "ipa" may be null, and "collocations" may be empty.
- For "sentence": "lemma" is the corrected sentence with its final punctuation; exactly ONE meaning whose "translation" is a natural, idiomatic Persian rendering of the whole sentence (what a Persian speaker would really say in that situation, not word for word); "note" says in Persian when and to whom it is said, if useful; "examples": 0 to 2 short related lines (e.g. a typical previous or next line in the same conversation) with levels "easy"/"medium", or an empty list; "synonyms"/"antonyms" are empty.
- "register": who says it — "neutral", "informal" (friends, family), "formal" (offices, strangers, Sie), "slang" (youth/very casual) or "vulgar" (rude, offensive). Give it for phrases and sentences, and for single words whose register is not neutral; otherwise "neutral".
- "frequency": how common this is in everyday spoken German today: 3 = very common, 2 = common, 1 = rare or old-fashioned.
- "literal": ONLY for idioms and expressions whose meaning is not the sum of their words: a word-for-word Persian rendering in Persian script inside «» (e.g. "die Nase voll haben" → «دماغ را پُر داشتن»). null for everything else.
- "alternatives": 0 to 3 other common German ways to say the same thing (phrases and sentences only; for single words use synonyms instead), else empty.
- "reply": when the entry is a question, greeting, thanks or apology that typically gets an answer, one natural typical answer {"de", "fa"}; else null.
- "cefr": the level at which a learner typically meets this word (your best estimate).
- "ipa": IPA transcription of the lemma in standard German, without slashes or brackets.
- "meanings": the 1 to 3 most common, practically useful meanings, most important first. Add a second or third meaning ONLY when it is genuinely common in everyday German. This is not a dictionary dump.
  - "translation": natural Persian equivalent(s), short (a few words, comma-separated synonyms allowed).
  - "note": optional short Persian hint that tells this meaning apart (register, context). null if not needed.
  - "examples": for words and phrases EXACTLY three, one of each level (for sentences see above):
      "easy"   — A1/A2, short main clause, present tense.
      "medium" — B1, a longer sentence, e.g. perfect tense or a subordinate clause.
      "hard"   — B2+, natural idiomatic usage.
    Each example uses the word in THIS meaning, is natural, correct German a native speaker would say, and has a faithful natural Persian translation in "fa" (not word-for-word).
- "noun": only for nouns, else null. "article" is der/die/das. "plural" is the nominative plural WITHOUT article ("Tische"), null if the noun has no plural. "genitive" is the genitive singular without article ("Tisches"). For plural-only nouns (Eltern, Leute): plural_only = true, article = "die", plural = null.
- "verb": only for verbs, else null.
  - "separable": true for trennbare Verben.
  - "auxiliary": "haben" or "sein" (the usual one for the Perfekt).
  - "reflexive": "accusative" (sich freuen → ich freue mich), "dative" (sich etwas vorstellen → ich stelle mir vor) or "none".
  - "irregular": true for strong and mixed verbs.
  - "partizip2": e.g. "aufgegeben".
  - "government": fixed preposition and case if the verb has one worth learning, e.g. "auf + Akkusativ"; else null.
  - "praesens", "praeteritum", "konjunktiv1", "konjunktiv2": EXACTLY six forms each, in this order: ich, du, er/sie/es, wir, ihr, sie/Sie. Give the verb form WITHOUT the subject pronoun. Separable verbs in main-clause order ("gebe auf"). Reflexive verbs with their pronoun ("freue mich"). konjunktiv1 = Konjunktiv I Präsens ("gebe auf", "gebest auf", "gebe auf", ...). konjunktiv2 = Konjunktiv II Präteritum (the synthetic form: "gäbe auf", "ginge", "machte"), not the würde-form.
  - "imperativ": full forms with exclamation mark: du "Gib auf!", ihr "Gebt auf!", Sie "Geben Sie auf!". For verbs without an imperative (modal verbs) use three empty strings.
  Do NOT produce compound tenses (Perfekt, Futur …); the app builds them itself.
- "adjective": only for adjectives, else null. "comparative"/"superlative" ("schneller" / "am schnellsten"); null for adjectives that cannot be compared.
- "synonyms" / "antonyms": 0 to 4 common German words each, nouns with article. Empty list when there is none that a learner should know.
- "collocations": 2 to 4 very common word combinations with Persian translation.
- "learner_note": at most two short Persian sentences with the single most useful tip (a typical mistake of Persian speakers, a false friend, a confusable word). null if there is nothing worth saying.

LANGUAGE RULES:
- All Persian text is in modern standard written Persian, in Persian script, with correct half-spaces (نیم‌فاصله). No transliteration, no English.
- All German text follows current standard orthography (ß, umlauts, noun capitalisation).
- Never invent words, forms or meanings. If you are unsure whether a form exists, choose the standard form found in Duden.`

export function buildMessages(pair: LanguagePair, word: string, hint?: string | null): { system: string; user: string } {
  if (!isSupportedPair(pair)) throw new Error(`unsupported language pair ${pair.target}/${pair.native}`)
  let user = `German entry: ${JSON.stringify(word)}`
  if (hint) user += `\nThe meaning the learner wants (Persian or German, use it to pick the right sense; do not copy it blindly): ${JSON.stringify(hint)}`
  return { system: SYSTEM_DE_FA, user }
}

export function buildRepairMessage(issues: ValidationIssue[]): string {
  const list = issues
    .slice(0, 12)
    .map((i) => `- ${i.path || '(root)'}: ${i.code}`)
    .join('\n')
  return `Your previous JSON failed validation:\n${list}\nReturn the complete corrected JSON object for the same word. Follow every rule of the instructions.`
}

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: 'null' }] })
const str = { type: 'string' }
const strOrNull = { type: ['string', 'null'] }
const strList = { type: 'array', items: str }
const obj = (properties: Record<string, unknown>) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})

/** JSON Schema for the model's structured output (strict mode: every key required). */
export const AI_OUTPUT_SCHEMA = obj({
  status: { type: 'string', enum: [...AI_STATUS] },
  suggestion: strOrNull,
  input_note: strOrNull,
  lemma: str,
  pos: { type: 'string', enum: [...POS_VALUES] },
  cefr: { type: 'string', enum: [...CEFR_VALUES] },
  ipa: strOrNull,
  meanings: {
    type: 'array',
    items: obj({
      translation: str,
      note: strOrNull,
      examples: {
        type: 'array',
        items: obj({ level: { type: 'string', enum: [...EXAMPLE_LEVELS] }, de: str, fa: str }),
      },
    }),
  },
  noun: nullable(
    obj({
      article: { type: 'string', enum: [...ARTICLE_VALUES] },
      plural: strOrNull,
      genitive: strOrNull,
      plural_only: { type: 'boolean' },
    }),
  ),
  verb: nullable(
    obj({
      separable: { type: 'boolean' },
      auxiliary: { type: 'string', enum: ['haben', 'sein'] },
      reflexive: { type: 'string', enum: ['none', 'accusative', 'dative'] },
      irregular: { type: 'boolean' },
      partizip2: str,
      government: strOrNull,
      praesens: strList,
      praeteritum: strList,
      konjunktiv1: strList,
      konjunktiv2: strList,
      imperativ: obj({ du: str, ihr: str, Sie: str }),
    }),
  ),
  adjective: nullable(obj({ comparative: strOrNull, superlative: strOrNull })),
  synonyms: strList,
  antonyms: strList,
  collocations: { type: 'array', items: obj({ de: str, fa: str }) },
  learner_note: strOrNull,
  register: nullable({ type: 'string', enum: [...REGISTER_VALUES] }),
  frequency: nullable({ type: 'integer', enum: [1, 2, 3] }),
  literal: strOrNull,
  alternatives: strList,
  reply: nullable(obj({ de: str, fa: str })),
})

/** Maps the model's snake_case answer onto the shape `validateWordContent` expects. */
export function aiOutputToContentInput(raw: Record<string, unknown>): Record<string, unknown> {
  const noun = raw.noun as Record<string, unknown> | null
  return {
    lemma: raw.lemma,
    pos: raw.pos,
    cefr: raw.cefr,
    ipa: raw.ipa,
    meanings: raw.meanings,
    noun: noun ? { article: noun.article, plural: noun.plural, genitive: noun.genitive, pluralOnly: noun.plural_only } : null,
    verb: raw.verb,
    adjective: raw.adjective,
    synonyms: raw.synonyms,
    antonyms: raw.antonyms,
    collocations: raw.collocations,
    notes: raw.learner_note,
    register: raw.register ?? null,
    frequency: raw.frequency ?? null,
    literal: raw.literal ?? null,
    alternatives: raw.alternatives ?? [],
    reply: raw.reply ?? null,
  }
}
