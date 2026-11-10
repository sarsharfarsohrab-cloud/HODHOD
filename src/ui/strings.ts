/**
 * The interface text in the current language. `t` always holds the full dictionary of the
 * language chosen with setLanguage(); every dictionary in i18n/ has the shape of i18n/fa.ts.
 * `t` is updated in place, so objects taken from it (const s = t.store) stay current.
 */
import type { InputErrorCode } from '../../supabase/functions/_shared/inputRules.ts'
import type { Cefr, ExampleLevel, PartOfSpeech, Register, ValidationIssue } from '../../supabase/functions/_shared/wordSchema.ts'
import type { WordStatus } from '../core/cards.ts'
import type { GradeNote, QuestionType, QuizKind } from '../core/quiz.ts'
import type { Rating } from '../core/types.ts'
import type { AppError } from '../data/errors.ts'
import { num, setFormatLocale } from './format.ts'
import { fa as faStrings } from './i18n/fa.ts'
import { en as enStrings } from './i18n/en.ts'
import { de as deStrings } from './i18n/de.ts'
import { ar as arStrings } from './i18n/ar.ts'
import { tr as trStrings } from './i18n/tr.ts'
import { uk as ukStrings } from './i18n/uk.ts'
import { isUiLanguage, UI_LANGUAGE_INFO, type UiLanguage } from './i18n/languages.ts'

export type Strings = typeof faStrings

/** A dictionary of another language; the admin panel is only in Persian. */
export type Dictionary = Omit<Strings, 'admin'>

/** Dictionaries that ship with the app; a language without one falls back to English for now. */
const DICTIONARIES: Partial<Record<UiLanguage, Dictionary>> = { fa: faStrings, en: enStrings, de: deStrings, ar: arStrings, tr: trStrings, uk: ukStrings }

/** The language a first-time visitor sees: English, the international one. */
export const DEFAULT_LANGUAGE: UiLanguage = 'en'

type Plain = Record<string, unknown>
const isPlain = (v: unknown): v is Plain => typeof v === 'object' && v !== null && !Array.isArray(v)

function deepCopy<T>(value: T): T {
  if (Array.isArray(value)) return value.map(deepCopy) as T
  if (!isPlain(value)) return value
  const out: Plain = {}
  deepAssign(out, value)
  return out as T
}

/**
 * Copies a dictionary into `t` in place. Getters stay getters, so texts that name a language
 * ("کلمهٔ آلمانی") follow the deck that is open at the moment they are read.
 */
function deepAssign(target: Plain, source: Plain): void {
  for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(source))) {
    if (d.get) {
      Object.defineProperty(target, k, { get: d.get, enumerable: true, configurable: true })
      continue
    }
    const v = d.value as unknown
    const current = Object.getOwnPropertyDescriptor(target, k)
    if (isPlain(v) && current && !current.get && isPlain(current.value)) deepAssign(current.value as Plain, v)
    else Object.defineProperty(target, k, { value: deepCopy(v), writable: true, enumerable: true, configurable: true })
  }
}

export const t: Strings = deepCopy(faStrings)

let current: UiLanguage = 'fa'

export const currentLanguage = (): UiLanguage => current
export const hasDictionary = (code: UiLanguage): boolean => !!DICTIONARIES[code]

/** The app's name as written in the interface language (هدهد / Hodhod). */
export const appName = (): string => UI_LANGUAGE_INFO[current].appName

/** Switches the whole interface: texts, number and date formats, and the page direction. */
export function setLanguage(code: string | null | undefined): UiLanguage {
  const next: UiLanguage = isUiLanguage(code) ? code : DEFAULT_LANGUAGE
  current = next
  deepAssign(t as unknown as Plain, (DICTIONARIES[next] ?? enStrings) as unknown as Plain)
  const info = UI_LANGUAGE_INFO[next]
  setFormatLocale(info.intl)
  if (typeof document !== 'undefined') {
    document.documentElement.lang = next
    document.documentElement.dir = info.dir
  }
  return next
}


/** A sentence a person can act on, for any error from the data layer. */
export function describeError(error: AppError): string {
  if (error.kind === 'rate_limit') {
    return error.detail.scope === 'day' || error.detail.scope === 'global' ? t.errors.rate_limit_day : t.errors.rate_limit
  }
  if (error.code === 'ai_quota_exhausted') return t.errors.ai_quota
  if (error.code === 'ai_invalid_output') return t.errors.ai_invalid
  if (error.kind === 'validation' && error.code in t.create.inputErrors) {
    return t.create.inputErrors[error.code as InputErrorCode]
  }
  return t.errors[error.kind] ?? t.errors.server
}

export function describePath(path: string): string {
  const f = t.draft.fields
  const parts = path.split('.')
  const n = (i: number) => Number(parts[i]) + 1
  if (parts[0] === 'lemma') return f.word
  if (parts[0] === 'pos') return f.pos
  if (parts[0] === 'cefr') return f.cefr
  if (parts[0] === 'ipa') return f.ipa
  if (parts[0] === 'meanings') {
    if (parts.length === 1) return f.meaningsAll
    if (parts[2] === 'translation') return f.ofMeaning(f.translation, n(1))
    if (parts[2] === 'note') return f.ofMeaning(f.meaningNote, n(1))
    if (parts[2] === 'examples') {
      if (parts.length === 3) return f.examplesOf(n(1))
      const which = parts[4] === 'de' ? f.exampleDe : parts[4] === 'fa' ? f.exampleFa : f.example
      return f.exampleOf(which, n(1), n(3))
    }
    return f.meaningN(n(1))
  }
  if (parts[0] === 'noun') return parts[1] === 'article' ? f.article : parts[1] === 'plural' ? f.plural : f.nounInfo
  if (parts[0] === 'verb') {
    const tenses: Record<string, string> = {
      praesens: 'Präsens', praeteritum: 'Präteritum', konjunktiv1: 'Konjunktiv I', konjunktiv2: 'Konjunktiv II',
      imperativ: 'Imperativ', partizip2: 'Partizip II', auxiliary: f.auxiliary, reflexive: f.reflexive, government: f.government,
    }
    return parts[1] && tenses[parts[1]] ? f.tenseOf(tenses[parts[1]]!) : f.verbInfo
  }
  if (parts[0] === 'adjective') return f.adjectiveForms
  if (parts[0] === 'synonyms') return f.synonyms
  if (parts[0] === 'antonyms') return f.antonyms
  if (parts[0] === 'collocations') return parts.length > 1 ? f.collocationN(n(1)) : f.collocations
  if (parts[0] === 'literal') return f.literal
  if (parts[0] === 'register') return f.register
  if (parts[0] === 'frequency') return f.frequency
  if (parts[0] === 'alternatives') return f.alternatives
  if (parts[0] === 'reply') return f.reply
  if (parts[0] === 'notes') return f.notes
  return f.somePart
}
