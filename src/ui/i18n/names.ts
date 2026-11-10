/**
 * Language names inside interface texts: "کلمهٔ آلمانی" becomes "کلمهٔ انگلیسی" when English is learned.
 * Names come from the browser (Intl.DisplayNames) in the interface language.
 */
import { learning, ownLanguage } from '../learning.ts'
import { formatLocale } from '../format.ts'

const cache = new Map<string, string>()

export function languageName(code: string, locale = formatLocale()): string {
  const key = `${locale}|${code}`
  let name = cache.get(key)
  if (!name) {
    try {
      name = new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code
      // these languages write language names in lower case inside a sentence
      if (/^(ru|uk|es|fr|it)\b/.test(locale)) name = name.toLocaleLowerCase(locale)
    } catch {
      name = code
    }
    cache.set(key, name)
  }
  return name
}

/** Name of the language being learned, in the interface language ("آلمانی", "German"). */
export const L = (): string => languageName(learning())
/** Name of the learner's own language ("فارسی"). */
export const O = (): string => languageName(ownLanguage())

/** A language name as a label on its own: "Немецкий", not "немецкий". */
export function languageLabel(code: string, locale = formatLocale()): string {
  const name = languageName(code, locale)
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
}
