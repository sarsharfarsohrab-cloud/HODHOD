/**
 * Versioned prompt + output schema for word analysis, for every language pair.
 *
 * Bump PROMPT_VERSION whenever the instructions or the schema change:
 * the shared cache is keyed by it, so old drafts are never served for a new prompt.
 */

import {
  ARTICLE_VALUES,
  ARTICLES,
  CEFR_VALUES,
  EXAMPLE_LEVELS,
  GENDER_VALUES,
  POS_VALUES,
  REGISTER_VALUES,
  type ValidationIssue,
} from './wordSchema.ts'

export const PROMPT_VERSION = 'word_analysis_v4'
/**
 * Earlier versions whose cached analyses are still valid. They exist for German–Persian only
 * (the only pair before v4), and v4 asks the same of that pair.
 */
export const COMPATIBLE_PROMPT_VERSIONS = ['word_analysis_v3', 'word_analysis_v2'] as const

export interface LanguagePair {
  target: string
  native: string
}

/** Languages whose words can be learned. */
export const TARGETS = ['de', 'en', 'fr', 'it', 'es', 'nl'] as const
/** Languages the meanings can be written in (the learner's own language). */
export const NATIVES = ['fa', 'de', 'en', 'fr', 'tr', 'uk', 'ru', 'ar', 'es', 'nl', 'it'] as const

export function isSupportedPair(pair: LanguagePair): boolean {
  return (
    (TARGETS as readonly string[]).includes(pair.target) &&
    (NATIVES as readonly string[]).includes(pair.native) &&
    pair.target !== pair.native
  )
}

export const AI_STATUS = ['ok', 'not_a_word', 'wrong_language', 'misspelled'] as const
export type AiStatus = (typeof AI_STATUS)[number]

// --- the learner's language --------------------------------------------------------------

interface NativeInfo {
  /** English name used in the prompt */
  name: string
  /** how text in this language must be written */
  rules: string
  /** example of a word-for-word rendering of "die Nase voll haben", to show the format */
  literal: string
}

const NATIVE: Record<string, NativeInfo> = {
  fa: {
    name: 'Persian (Farsi)',
    rules: 'modern standard written Persian, in Persian script, with correct half-spaces (نیم‌فاصله). No transliteration, no English. It must also be clear to Dari speakers: prefer words shared by Iranian Persian and Dari.',
    literal: '«دماغ را پُر داشتن»',
  },
  ar: {
    name: 'Arabic',
    rules: 'Modern Standard Arabic in Arabic script, understandable across Arabic-speaking countries. No transliteration, no English. Add short vowels (tashkīl) only where a word would otherwise be ambiguous.',
    literal: '«أن يكون الأنف ممتلئًا»',
  },
  tr: {
    name: 'Turkish',
    rules: 'standard Turkish (Türkiye Türkçesi) with correct Turkish letters (ç, ğ, ı, İ, ö, ş, ü).',
    literal: '«burnu dolu olmak»',
  },
  uk: {
    name: 'Ukrainian',
    rules: 'standard modern Ukrainian in Cyrillic script. Never Russian words or Russian spelling.',
    literal: '«мати повний ніс»',
  },
  ru: {
    name: 'Russian',
    rules: 'standard modern Russian in Cyrillic script.',
    literal: '«иметь полный нос»',
  },
  de: {
    name: 'German',
    rules: 'current standard German orthography (ß, umlauts, capitalised nouns), as used in Germany.',
    literal: '«die Nase voll haben»',
  },
  en: {
    name: 'English',
    rules: 'clear, natural standard English (British spelling).',
    literal: '"to have the nose full"',
  },
  fr: {
    name: 'French',
    rules: 'standard French with correct accents and typography.',
    literal: '« avoir le nez plein »',
  },
  es: {
    name: 'Spanish',
    rules: 'standard Spanish (neutral, understood in Spain and Latin America) with correct accents and ¿ ¡.',
    literal: '«tener la nariz llena»',
  },
  nl: {
    name: 'Dutch',
    rules: 'standard Dutch (as in the Netherlands and Flanders), current official spelling.',
    literal: '"de neus vol hebben"',
  },
  it: {
    name: 'Italian',
    rules: 'standard Italian with correct accents (è, é, à, ò, ù) and apostrophes.',
    literal: '«avere il naso pieno»',
  },
}

// --- the language being learned -------------------------------------------------------------

interface TargetInfo {
  name: string
  /** standard dictionaries to follow when in doubt */
  reference: string
  /** examples of entries a learner types */
  entries: string
  /** rules for the dictionary form, specific to the language */
  lemma: string
  /** rules for the "noun" block */
  noun: string
  /** rules for the verb block ("verb" for German, "conjugation" otherwise) */
  verb: string
  ipa: string
  orthography: string
}

const PERSONS_RULE = (persons: string) =>
  `Each tense lists every person in this order: ${persons}. "person" is that label exactly; "form" is the verb form WITHOUT the subject pronoun (reflexive verbs keep their reflexive pronoun).`

const CONJUGATION_COMMON = `
  - "conjugation": only for verbs, else null.
    - "auxiliary": the auxiliary of the perfect tense, as an infinitive; null if the language has only one and it says nothing.
    - "irregular": true for irregular verbs.
    - "separable": true only for verbs with a separable particle.
    - "reflexive": true for reflexive verbs.
    - "participle": the past participle.
    - "government": a fixed preposition (and case) worth learning; else null.
    - "tenses": exactly the tenses listed below, in this order, with their usual name in the language being learned as "name".`

const TARGET: Record<string, TargetInfo> = {
  de: {
    name: 'German',
    reference: 'Duden',
    entries:
      'a single German word, a fixed expression (idiom, set phrase, common collocation, verb with a fixed preposition or noun such as "Bescheid sagen", "auf jeden Fall", "sich Sorgen machen", "jdm. auf die Nerven gehen"), or a short everyday sentence ("Kannst du mir kurz helfen?", "Das ist mir egal.")',
    lemma:
      'Nouns: nominative singular WITHOUT article, capitalised ("Tisch"). Verbs: infinitive ("aufgeben"); truly reflexive verbs as "sich freuen". Adjectives: base form. Fixed expressions: the citation form with the verb in the infinitive at the end ("Bescheid sagen", "sich Sorgen machen", "auf jeden Fall"), correct capitalisation, no final punctuation. Capitalisation alone is NEVER a misspelling: "erfolg", "TISCH" or "Aufgeben" are "ok" and are analysed (the lemma gets the correct capitalisation). "ss" written for "ß" is not a misspelling either.',
    noun: '"noun": only for nouns, else null. "article" is der/die/das. "plural" is the nominative plural WITHOUT article ("Tische"), null if the noun has no plural. "genitive" is the genitive singular without article ("Tisches"). For plural-only nouns (Eltern, Leute): plural_only = true, article = "die", plural = null.',
    verb: `- "verb": only for verbs, else null. ("conjugation" is always null for German.)
  - "separable": true for trennbare Verben.
  - "auxiliary": "haben" or "sein" (the usual one for the Perfekt).
  - "reflexive": "accusative" (sich freuen → ich freue mich), "dative" (sich etwas vorstellen → ich stelle mir vor) or "none".
  - "irregular": true for strong and mixed verbs.
  - "partizip2": e.g. "aufgegeben".
  - "government": fixed preposition and case if the verb has one worth learning, e.g. "auf + Akkusativ"; else null.
  - "praesens", "praeteritum", "konjunktiv1", "konjunktiv2": EXACTLY six forms each, in this order: ich, du, er/sie/es, wir, ihr, sie/Sie. Give the verb form WITHOUT the subject pronoun. Separable verbs in main-clause order ("gebe auf"). Reflexive verbs with their pronoun ("freue mich"). konjunktiv1 = Konjunktiv I Präsens ("gebe auf", "gebest auf", "gebe auf", ...). konjunktiv2 = Konjunktiv II Präteritum (the synthetic form: "gäbe auf", "ginge", "machte"), not the würde-form.
  - "imperativ": full forms with exclamation mark: du "Gib auf!", ihr "Gebt auf!", Sie "Geben Sie auf!". For verbs without an imperative (modal verbs) use three empty strings.
  Do NOT produce compound tenses (Perfekt, Futur …); the app builds them itself.`,
    ipa: 'IPA transcription of the lemma in standard German',
    orthography: 'All German text follows current standard orthography (ß, umlauts, noun capitalisation).',
  },
  en: {
    name: 'English',
    reference: 'the Oxford and Cambridge learner’s dictionaries',
    entries:
      'a single English word, a phrasal verb ("give up", "look forward to"), a fixed expression or idiom ("by the way", "break the ice"), or a short everyday sentence ("Could you help me for a second?")',
    lemma:
      'Nouns: singular WITHOUT article, lower case unless a proper noun. Verbs: bare infinitive without "to" ("give up"). Adjectives: base form. Fixed expressions: their citation form, no final punctuation. A phrasal verb is a "verb", not a "phrase". Capitalisation alone is NEVER a misspelling. British and American spellings are both correct; use British spelling for the lemma.',
    noun: '"noun": only for nouns, else null. "article" and "gender" are null (English has no grammatical gender). "plural": the plural ("children"), null for uncountable nouns. For plural-only nouns (trousers, scissors): plural_only = true, plural = null.',
    verb: `${CONJUGATION_COMMON}
      Tenses: "Present simple", "Past simple", "Present perfect", "Future (will)". ${PERSONS_RULE('I, you, he/she/it, we, you (pl.), they')} Present perfect forms include "have/has" ("have given up"); future forms include "will".
    - "auxiliary": "have". "participle": the past participle ("given up").`,
    ipa: 'IPA transcription of the lemma in standard British pronunciation',
    orthography: 'All English text is natural, correct standard English.',
  },
  fr: {
    name: 'French',
    reference: 'Le Robert and Larousse',
    entries:
      'a single French word, a fixed expression or idiom ("avoir besoin de", "tout à fait", "poser un lapin"), or a short everyday sentence ("Tu peux m’aider une seconde ?")',
    lemma:
      'Nouns: singular WITHOUT article. Verbs: infinitive; pronominal verbs as "se lever" / "s’habiller". Adjectives: masculine singular. Fixed expressions: their citation form, no final punctuation. Missing accents ("eleve" for "élève") ARE a misspelling; capitalisation alone is not.',
    noun: '"noun": only for nouns, else null. "article": the singular definite article "le" or "la"; use "l\'" for nouns starting with a vowel or mute h. "gender": "m" or "f" (always give it, also with l\'). "plural": the plural ("chevaux"). For plural-only nouns (les gens, les vacances): plural_only = true, plural = null, article null.',
    verb: `${CONJUGATION_COMMON}
      Tenses: "présent", "passé composé", "imparfait", "futur simple". ${PERSONS_RULE('je, tu, il/elle/on, nous, vous, ils/elles')} Write elision where needed in the form itself only when it belongs to the verb (e.g. pronominal "me lève"); the passé composé forms include the auxiliary ("ai mangé", "suis allé(e)").
    - "auxiliary": "avoir" or "être".`,
    ipa: 'IPA transcription of the lemma in standard French',
    orthography: 'All French text follows standard French orthography and typography.',
  },
  it: {
    name: 'Italian',
    reference: 'Treccani and Zingarelli',
    entries:
      'a single Italian word, a fixed expression or idiom ("avere bisogno di", "in bocca al lupo"), or a short everyday sentence ("Mi puoi aiutare un attimo?")',
    lemma:
      'Nouns: singular WITHOUT article. Verbs: infinitive; reflexive verbs as "alzarsi". Adjectives: masculine singular. Fixed expressions: their citation form, no final punctuation. Missing accents ("perche" for "perché", "citta" for "città") ARE a misspelling; capitalisation alone is not.',
    noun: '"noun": only for nouns, else null. "article": the singular definite article "il", "lo" or "la"; use "l\'" before a vowel. "gender": "m" or "f" (always give it). "plural": the plural ("libri", "uova"). For plural-only nouns: plural_only = true, plural = null, article null.',
    verb: `${CONJUGATION_COMMON}
      Tenses: "presente", "passato prossimo", "imperfetto", "futuro semplice". ${PERSONS_RULE('io, tu, lui/lei, noi, voi, loro')} Passato prossimo forms include the auxiliary ("ho mangiato", "sono andato/a").
    - "auxiliary": "avere" or "essere".`,
    ipa: 'IPA transcription of the lemma in standard Italian',
    orthography: 'All Italian text follows standard Italian orthography.',
  },
  es: {
    name: 'Spanish',
    reference: 'the Diccionario de la lengua española (RAE)',
    entries:
      'a single Spanish word, a fixed expression or idiom ("tener que", "echar de menos", "estar en las nubes"), or a short everyday sentence ("¿Me puedes ayudar un momento?")',
    lemma:
      'Nouns: singular WITHOUT article. Verbs: infinitive; reflexive verbs as "levantarse". Adjectives: masculine singular. Fixed expressions: their citation form, no final punctuation. Missing accents ("cancion" for "canción") ARE a misspelling; capitalisation alone is not.',
    noun: '"noun": only for nouns, else null. "article": the singular definite article "el" or "la" as actually used ("el agua" takes "el" but is feminine). "gender": "m" or "f" (always give it). "plural": the plural ("canciones"). For plural-only nouns (las gafas): plural_only = true, plural = null, article null.',
    verb: `${CONJUGATION_COMMON}
      Tenses: "presente", "pretérito indefinido", "pretérito imperfecto", "futuro simple". ${PERSONS_RULE('yo, tú, él/ella/usted, nosotros/as, vosotros/as, ellos/ellas/ustedes')}
    - "auxiliary": "haber".`,
    ipa: 'IPA transcription of the lemma in standard Castilian Spanish',
    orthography: 'All Spanish text follows RAE orthography, including ¿ ¡ and accents.',
  },
  nl: {
    name: 'Dutch',
    reference: 'Van Dale',
    entries:
      'a single Dutch word, a fixed expression or idiom ("in de war zijn", "op de hoogte houden"), or a short everyday sentence ("Kun je me even helpen?")',
    lemma:
      'Nouns: singular WITHOUT article. Verbs: infinitive; reflexive verbs as "zich vergissen". Adjectives: base form. Fixed expressions: their citation form, no final punctuation. Capitalisation alone is never a misspelling.',
    noun: '"noun": only for nouns, else null. "article": "de" or "het". "gender": "c" for de-words, "n" for het-words. "plural": the plural ("huizen"). For plural-only nouns: plural_only = true, plural = null, article "de".',
    verb: `${CONJUGATION_COMMON}
      Tenses: "tegenwoordige tijd", "verleden tijd", "voltooide tijd", "toekomende tijd". ${PERSONS_RULE('ik, jij/je, hij/zij/het, wij, jullie, zij')} Separable verbs in main-clause order ("bel op"). Voltooide tijd forms include the auxiliary ("heb opgebeld", "ben gegaan"); toekomende tijd with "zal/zult/zullen".
    - "auxiliary": "hebben" or "zijn".`,
    ipa: 'IPA transcription of the lemma in standard Dutch',
    orthography: 'All Dutch text follows the current official spelling (Groene Boekje).',
  },
}

/** English names of a pair's languages and the writing rules of the learner's own language (used by other prompts too). */
export function pairNames(pair: LanguagePair): { target: string; native: string; nativeRules: string } {
  return { target: TARGET[pair.target]?.name ?? 'German', native: NATIVE[pair.native]?.name ?? 'Persian (Farsi)', nativeRules: NATIVE[pair.native]?.rules ?? NATIVE.fa!.rules }
}

function systemPrompt(pair: LanguagePair): string {
  const T = TARGET[pair.target]!
  const N = NATIVE[pair.native]!
  const tl = T.name
  const nl = N.name
  return `You are a careful ${tl} lexicographer and teacher writing vocabulary cards for native ${nl} speakers who are learning ${tl}.

You receive ONE entry typed by a learner: ${T.entries}. Return a single JSON object that follows the provided schema exactly.

STEP 1 — decide "status":
- "ok": the input is a real ${tl} word (any inflected form counts), an established fixed expression that a dictionary or textbook would list as one unit, or a natural everyday ${tl} sentence (up to about 20 words) that is useful to learn as a whole. Small mistakes in a sentence (missing comma, wrong capitalisation, a wrong ending) are corrected silently in "lemma" and mentioned in "input_note".
- "misspelled": it is clearly a typo of a ${tl} word or expression (missing accent or umlaut, swapped letters). Put the corrected form in "suggestion". Do not analyse it.
- "wrong_language": it is from another language and not used in ${tl}.
- "not_a_word": random letters, a name with no dictionary meaning, several unrelated words, or text that is not natural ${tl} at all.
For every status except "ok": lemma = "", meanings = [], noun/verb/conjugation/adjective/reply = null, lists = [], other text fields null, pos = "other", cefr = "A1", register = null, frequency = null.

STEP 2 — when status is "ok":
- "lemma": the dictionary form. ${T.lemma}
- If the learner typed an inflected form, analyse the lemma and explain the relation in one short ${nl} sentence in "input_note". Otherwise "input_note" is null.
- "pos": the most common part of speech of this word. For every fixed expression of two or more words use "phrase" (exceptions: a single reflexive or phrasal verb is a "verb"). For a complete sentence or a set conversational formula that works as a whole utterance use "sentence". For "phrase" and "sentence": noun, verb, conjugation and adjective are null, "ipa" may be null, and "collocations" may be empty.
- For "sentence": "lemma" is the corrected sentence with its final punctuation; exactly ONE meaning whose "translation" is a natural, idiomatic ${nl} rendering of the whole sentence (what a ${nl} speaker would really say in that situation, not word for word); "note" says in ${nl} when and to whom it is said, if useful; "examples": 0 to 2 short related lines (e.g. a typical previous or next line in the same conversation) with levels "easy"/"medium", or an empty list; "synonyms"/"antonyms" are empty.
- "register": who says it — "neutral", "informal" (friends, family), "formal" (offices, strangers), "slang" (youth/very casual) or "vulgar" (rude, offensive). Give it for phrases and sentences, and for single words whose register is not neutral; otherwise "neutral".
- "frequency": how common this is in everyday spoken ${tl} today: 3 = very common, 2 = common, 1 = rare or old-fashioned.
- "literal": ONLY for idioms and expressions whose meaning is not the sum of their words: a word-for-word ${nl} rendering inside quotation marks (e.g. for German "die Nase voll haben" → ${N.literal}). null for everything else.
- "alternatives": 0 to 3 other common ${tl} ways to say the same thing (phrases and sentences only; for single words use synonyms instead), else empty.
- "reply": when the entry is a question, greeting, thanks or apology that typically gets an answer, one natural typical answer {"text" in ${tl}, "translation" in ${nl}}; else null.
- "cefr": the level at which a learner typically meets this word (your best estimate).
- "ipa": ${T.ipa}, without slashes or brackets.
- "meanings": the 1 to 3 most common, practically useful meanings, most important first. Add a second or third meaning ONLY when it is genuinely common in everyday ${tl}. This is not a dictionary dump.
  - "translation": natural ${nl} equivalent(s), short (a few words, comma-separated synonyms allowed).
  - "note": optional short ${nl} hint that tells this meaning apart (register, context). null if not needed.
  - "examples": for words and phrases EXACTLY three, one of each level (for sentences see above):
      "easy"   — A1/A2, short main clause, present tense.
      "medium" — B1, a longer sentence, e.g. a past tense or a subordinate clause.
      "hard"   — B2+, natural idiomatic usage.
    Each example uses the word in THIS meaning, is natural, correct ${tl} a native speaker would say ("text"), and has a faithful natural ${nl} translation ("translation", not word-for-word).
- ${T.noun}
${T.verb}
- "adjective": only for adjectives, else null. "comparative"/"superlative" in their usual ${tl} form; null for adjectives that cannot be compared.
- "synonyms" / "antonyms": 0 to 4 common ${tl} words each${pair.target === 'en' ? '' : ', nouns with their article'}. Empty list when there is none that a learner should know.
- "collocations": 2 to 4 very common word combinations ("text") with ${nl} translation ("translation").
- "learner_note": at most two short ${nl} sentences with the single most useful tip (a typical mistake of ${nl} speakers, a false friend, a confusable word). null if there is nothing worth saying.

LANGUAGE RULES:
- All ${nl} text (translations, notes, input_note, learner_note, literal) is ${N.rules}
- ${T.orthography}
- Never invent words, forms or meanings. If you are unsure whether a form exists, choose the standard form found in ${T.reference}.`
}

export function buildMessages(pair: LanguagePair, word: string, hint?: string | null): { system: string; user: string } {
  if (!isSupportedPair(pair)) throw new Error(`unsupported language pair ${pair.target}/${pair.native}`)
  const tl = TARGET[pair.target]!.name
  let user = `${tl} entry: ${JSON.stringify(word)}`
  if (hint) user += `\nThe meaning the learner wants (in either language, use it to pick the right sense; do not copy it blindly): ${JSON.stringify(hint)}`
  return { system: systemPrompt(pair), user }
}

export function buildRepairMessage(issues: ValidationIssue[]): string {
  const list = issues
    .slice(0, 12)
    .map((i) => `- ${i.path || '(root)'}: ${i.code}`)
    .join('\n')
  return `Your previous JSON failed validation:\n${list}\nReturn the complete corrected JSON object for the same word. Follow every rule of the instructions.`
}

// --- output schema ------------------------------------------------------------------------

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
const pairText = obj({ text: str, translation: str })

const GERMAN_VERB = obj({
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
})

const CONJUGATION = obj({
  auxiliary: strOrNull,
  irregular: { type: 'boolean' },
  separable: { type: 'boolean' },
  reflexive: { type: 'boolean' },
  participle: str,
  government: strOrNull,
  tenses: { type: 'array', items: obj({ name: str, forms: { type: 'array', items: obj({ person: str, form: str }) } }) },
})

function nounSchema(target: string) {
  if (target === 'de') {
    return obj({ article: { type: 'string', enum: [...ARTICLE_VALUES] }, plural: strOrNull, genitive: strOrNull, plural_only: { type: 'boolean' } })
  }
  const articles = Object.keys(ARTICLES[target] ?? {})
  return obj({
    article: articles.length ? nullable({ type: 'string', enum: articles }) : { type: 'null' },
    gender: articles.length ? nullable({ type: 'string', enum: [...GENDER_VALUES] }) : { type: 'null' },
    plural: strOrNull,
    plural_only: { type: 'boolean' },
  })
}

/** JSON Schema for the model's structured output (strict mode: every key required). */
export function outputSchema(target: string) {
  return obj({
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
        examples: { type: 'array', items: obj({ level: { type: 'string', enum: [...EXAMPLE_LEVELS] }, text: str, translation: str }) },
      }),
    },
    noun: nullable(nounSchema(target)),
    verb: target === 'de' ? nullable(GERMAN_VERB) : { type: 'null' },
    conjugation: target === 'de' ? { type: 'null' } : nullable(CONJUGATION),
    adjective: nullable(obj({ comparative: strOrNull, superlative: strOrNull })),
    synonyms: strList,
    antonyms: strList,
    collocations: { type: 'array', items: pairText },
    learner_note: strOrNull,
    register: nullable({ type: 'string', enum: [...REGISTER_VALUES] }),
    frequency: nullable({ type: 'integer', enum: [1, 2, 3] }),
    literal: strOrNull,
    alternatives: strList,
    reply: nullable(pairText),
  })
}

/** The German schema, kept as a constant for callers that only deal with German. */
export const AI_OUTPUT_SCHEMA = outputSchema('de')

type Rec = Record<string, unknown>
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v)

/** {text, translation} from the model → the stored {de, fa} slots (learned language, own language). */
const slots = (v: unknown) => (isRec(v) ? { de: v.text ?? v.de, fa: v.translation ?? v.fa } : v)

/** Maps the model's snake_case answer onto the shape `validateWordContent` expects. */
export function aiOutputToContentInput(raw: Rec): Rec {
  const noun = isRec(raw.noun) ? raw.noun : null
  const meanings = Array.isArray(raw.meanings)
    ? raw.meanings.map((m) =>
        isRec(m)
          ? {
              ...m,
              examples: Array.isArray(m.examples) ? m.examples.map((e) => (isRec(e) ? { level: e.level, ...(slots(e) as Rec) } : e)) : m.examples,
            }
          : m,
      )
    : raw.meanings
  return {
    lemma: raw.lemma,
    pos: raw.pos,
    cefr: raw.cefr,
    ipa: raw.ipa,
    meanings,
    noun: noun ? { article: noun.article, gender: noun.gender ?? null, plural: noun.plural, genitive: noun.genitive ?? null, pluralOnly: noun.plural_only } : null,
    verb: raw.verb ?? null,
    conjugation: raw.conjugation ?? null,
    adjective: raw.adjective,
    synonyms: raw.synonyms,
    antonyms: raw.antonyms,
    collocations: Array.isArray(raw.collocations) ? raw.collocations.map(slots) : raw.collocations,
    notes: raw.learner_note,
    register: raw.register ?? null,
    frequency: raw.frequency ?? null,
    literal: raw.literal ?? null,
    alternatives: raw.alternatives ?? [],
    reply: raw.reply ? slots(raw.reply) : null,
  }
}
