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
  type ValidationIssue,
} from './wordSchema.ts'

export const PROMPT_VERSION = 'word_analysis_v1'

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

You receive ONE German word typed by a learner. Return a single JSON object that follows the provided schema exactly.

STEP 1 — decide "status":
- "ok": the input is a real German word (any inflected form counts).
- "misspelled": it is clearly a typo of a German word (missing umlaut, swapped letters). Put the corrected word in "suggestion". Do not analyse it.
- "wrong_language": it is a word of another language and not used in German.
- "not_a_word": random letters, a name with no dictionary meaning, or more than one independent word.
For every status except "ok": lemma = "", meanings = [], noun/verb/adjective = null, lists = [], other text fields null, pos = "other", cefr = "A1".

STEP 2 — when status is "ok":
- "lemma": the dictionary form. Nouns: nominative singular WITHOUT article, capitalised ("Tisch"). Verbs: infinitive ("aufgeben"); truly reflexive verbs as "sich freuen". Adjectives: base form.
- If the learner typed an inflected form ("ging", "Häuser", "besser"), analyse the lemma and explain the relation in one short Persian sentence in "input_note". Otherwise "input_note" is null.
- "pos": the most common part of speech of this word.
- "cefr": the level at which a learner typically meets this word (your best estimate).
- "ipa": IPA transcription of the lemma in standard German, without slashes or brackets.
- "meanings": the 1 to 3 most common, practically useful meanings, most important first. Add a second or third meaning ONLY when it is genuinely common in everyday German. This is not a dictionary dump.
  - "translation": natural Persian equivalent(s), short (a few words, comma-separated synonyms allowed).
  - "note": optional short Persian hint that tells this meaning apart (register, context). null if not needed.
  - "examples": EXACTLY three, one of each level:
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

export function buildMessages(pair: LanguagePair, word: string): { system: string; user: string } {
  if (!isSupportedPair(pair)) throw new Error(`unsupported language pair ${pair.target}/${pair.native}`)
  return { system: SYSTEM_DE_FA, user: `German word: ${JSON.stringify(word)}` }
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
  }
}
