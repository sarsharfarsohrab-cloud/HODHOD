/**
 * Builds the full conjugation table of a German verb.
 *
 * The simple tenses come from the word's data; the compound tenses (Perfekt,
 * Plusquamperfekt, Futur I/II) are formed here by rule from the auxiliary, the
 * Partizip II and the infinitive, so they cannot contain a model's slip.
 */
import { PERSONS, type SixForms, type VerbInfo } from '../../supabase/functions/_shared/wordSchema.ts'

export type TenseKey =
  | 'praesens'
  | 'praeteritum'
  | 'perfekt'
  | 'plusquamperfekt'
  | 'futur1'
  | 'futur2'
  | 'konjunktiv1'
  | 'konjunktiv2'
  | 'imperativ'

export interface TenseTable {
  key: TenseKey
  /** German name of the tense. */
  title: string
  /** Pronoun (or "" for the imperative) and the form that goes with it. */
  rows: { person: string; form: string }[]
}

const SIX = [0, 1, 2, 3, 4, 5] as const

const AUX = {
  haben: {
    present: ['habe', 'hast', 'hat', 'haben', 'habt', 'haben'],
    past: ['hatte', 'hattest', 'hatte', 'hatten', 'hattet', 'hatten'],
  },
  sein: {
    present: ['bin', 'bist', 'ist', 'sind', 'seid', 'sind'],
    past: ['war', 'warst', 'war', 'waren', 'wart', 'waren'],
  },
} as const
const WERDEN = ['werde', 'wirst', 'wird', 'werden', 'werdet', 'werden'] as const
const REFLEXIVE = {
  none: ['', '', '', '', '', ''],
  accusative: ['mich', 'dich', 'sich', 'uns', 'euch', 'sich'],
  dative: ['mir', 'dir', 'sich', 'uns', 'euch', 'sich'],
} as const

const join = (...parts: string[]) => parts.filter(Boolean).join(' ')

/** "sich freuen" → "freuen" */
export function bareInfinitive(lemma: string): string {
  return lemma.replace(/^sich\s+/i, '').trim()
}

export function buildConjugation(lemma: string, verb: VerbInfo): TenseTable[] {
  const infinitive = bareInfinitive(lemma)
  const aux = AUX[verb.auxiliary]
  const refl = REFLEXIVE[verb.reflexive]
  const fromForms = (forms: SixForms) => SIX.map((i) => ({ person: PERSONS[i], form: forms[i] }))
  const build = (make: (i: number) => string) => SIX.map((i) => ({ person: PERSONS[i], form: make(i) }))

  const tables: TenseTable[] = [
    { key: 'praesens', title: 'Präsens', rows: fromForms(verb.praesens) },
    { key: 'praeteritum', title: 'Präteritum', rows: fromForms(verb.praeteritum) },
    { key: 'perfekt', title: 'Perfekt', rows: build((i) => join(aux.present[i]!, refl[i]!, verb.partizip2)) },
    { key: 'plusquamperfekt', title: 'Plusquamperfekt', rows: build((i) => join(aux.past[i]!, refl[i]!, verb.partizip2)) },
    { key: 'futur1', title: 'Futur I', rows: build((i) => join(WERDEN[i]!, refl[i]!, infinitive)) },
    { key: 'futur2', title: 'Futur II', rows: build((i) => join(WERDEN[i]!, refl[i]!, verb.partizip2, verb.auxiliary)) },
    { key: 'konjunktiv1', title: 'Konjunktiv I', rows: fromForms(verb.konjunktiv1) },
    { key: 'konjunktiv2', title: 'Konjunktiv II', rows: fromForms(verb.konjunktiv2) },
  ]
  const { du, ihr, Sie } = verb.imperativ
  if (du && ihr && Sie) {
    tables.push({
      key: 'imperativ',
      title: 'Imperativ',
      rows: [
        { person: '', form: du },
        { person: '', form: ihr },
        { person: '', form: Sie },
      ],
    })
  }
  return tables
}

/** What the audio button says for a row: with the pronoun, the way it is actually used. */
export function spokenForm(row: { person: string; form: string }): string {
  if (!row.person) return row.form
  const pronoun = row.person === 'er/sie/es' ? 'er' : row.person === 'sie/Sie' ? 'sie' : row.person
  return `${pronoun} ${row.form}`
}
