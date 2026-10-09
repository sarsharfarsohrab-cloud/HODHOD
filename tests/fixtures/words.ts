/** Hand-written sample content used only by automated tests. */
import type { WordContent } from '../../supabase/functions/_shared/wordSchema.ts'

const three = (de: [string, string, string], fa: [string, string, string]) =>
  (['easy', 'medium', 'hard'] as const).map((level, i) => ({ level, de: de[i]!, fa: fa[i]! }))

export const AUFGEBEN: WordContent = {
  version: 1,
  lemma: 'aufgeben',
  pos: 'verb',
  cefr: 'B1',
  ipa: 'ˈaʊ̯fˌɡeːbn̩',
  meanings: [
    {
      translation: 'تسلیم شدن، دست کشیدن',
      note: null,
      examples: three(
        ['Ich gebe nicht auf.', 'Er hat das Rauchen aufgegeben.', 'Trotz aller Rückschläge gab sie die Hoffnung nie auf.'],
        ['من تسلیم نمی‌شوم.', 'او سیگار کشیدن را کنار گذاشته است.', 'با وجود همهٔ ناکامی‌ها، او هرگز امیدش را از دست نداد.'],
      ),
    },
    {
      translation: 'تحویل دادن (بسته، سفارش)',
      note: 'برای پست و سفارش',
      examples: three(
        ['Ich gebe das Paket auf.', 'Sie hat eine Bestellung aufgegeben.', 'Er gab bei der Zeitung eine Anzeige auf.'],
        ['من بسته را تحویل پست می‌دهم.', 'او یک سفارش ثبت کرده است.', 'او در روزنامه یک آگهی داد.'],
      ),
    },
  ],
  noun: null,
  verb: {
    separable: true,
    auxiliary: 'haben',
    reflexive: 'none',
    irregular: true,
    partizip2: 'aufgegeben',
    government: null,
    praesens: ['gebe auf', 'gibst auf', 'gibt auf', 'geben auf', 'gebt auf', 'geben auf'],
    praeteritum: ['gab auf', 'gabst auf', 'gab auf', 'gaben auf', 'gabt auf', 'gaben auf'],
    konjunktiv1: ['gebe auf', 'gebest auf', 'gebe auf', 'geben auf', 'gebet auf', 'geben auf'],
    konjunktiv2: ['gäbe auf', 'gäbest auf', 'gäbe auf', 'gäben auf', 'gäbet auf', 'gäben auf'],
    imperativ: { du: 'Gib auf!', ihr: 'Gebt auf!', Sie: 'Geben Sie auf!' },
  },
  adjective: null,
  synonyms: ['verzichten', 'aufhören'],
  antonyms: ['weitermachen'],
  collocations: [{ de: 'die Hoffnung aufgeben', fa: 'امید را از دست دادن' }],
  notes: 'فعل جداشدنی است: پیشوند auf در جملهٔ اصلی به آخر می‌رود.',
}

export const TISCH: WordContent = {
  version: 1,
  lemma: 'Tisch',
  pos: 'noun',
  cefr: 'A1',
  ipa: 'tɪʃ',
  meanings: [
    {
      translation: 'میز',
      note: null,
      examples: three(
        ['Der Tisch ist groß.', 'Ich habe den Tisch schon gedeckt.', 'Lass uns das Thema endlich auf den Tisch bringen.'],
        ['میز بزرگ است.', 'من میز را از قبل چیده‌ام.', 'بیا بالاخره این موضوع را مطرح کنیم.'],
      ),
    },
  ],
  noun: { article: 'der', plural: 'Tische', genitive: 'Tisches', pluralOnly: false },
  verb: null,
  adjective: null,
  synonyms: [],
  antonyms: [],
  collocations: [{ de: 'den Tisch decken', fa: 'میز را چیدن' }],
  notes: null,
}

export const SCHNELL: WordContent = {
  version: 1,
  lemma: 'schnell',
  pos: 'adjective',
  cefr: 'A1',
  ipa: 'ʃnɛl',
  meanings: [
    {
      translation: 'سریع، تند',
      note: null,
      examples: three(
        ['Das Auto ist schnell.', 'Komm bitte schnell, weil der Zug gleich fährt.', 'Er hat sich erstaunlich schnell eingelebt.'],
        ['ماشین سریع است.', 'لطفاً زود بیا، چون قطار الان حرکت می‌کند.', 'او به‌طرز شگفت‌آوری زود جا افتاد.'],
      ),
    },
  ],
  noun: null,
  verb: null,
  adjective: { comparative: 'schneller', superlative: 'am schnellsten' },
  synonyms: ['rasch'],
  antonyms: ['langsam'],
  collocations: [],
  notes: null,
}

/** The same word in the snake_case shape the model is asked to return. */
export function asAiOutput(source: WordContent, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const content = structuredClone(source) // tests may break the copy, never the fixture
  return {
    status: 'ok',
    suggestion: null,
    input_note: null,
    lemma: content.lemma,
    pos: content.pos,
    cefr: content.cefr ?? 'A1',
    ipa: content.ipa,
    meanings: content.meanings,
    noun: content.noun
      ? { article: content.noun.article, plural: content.noun.plural, genitive: content.noun.genitive, plural_only: content.noun.pluralOnly }
      : null,
    verb: content.verb,
    adjective: content.adjective,
    synonyms: content.synonyms,
    antonyms: content.antonyms,
    collocations: content.collocations,
    learner_note: content.notes,
    ...extra,
  }
}
