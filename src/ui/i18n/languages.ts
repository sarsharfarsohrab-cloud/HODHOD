/**
 * Languages of Hodhod.
 *   Interface (native) languages: the language the app speaks and the one meanings are written in.
 *   Target languages: the languages whose words are learned.
 */

export const UI_LANGUAGES = ['fa', 'de', 'en', 'fr', 'tr', 'uk', 'ru', 'ar', 'es', 'nl'] as const
export type UiLanguage = (typeof UI_LANGUAGES)[number]

export const TARGET_LANGUAGES = ['en', 'de', 'fr', 'it', 'es', 'nl'] as const
export type TargetLanguage = (typeof TARGET_LANGUAGES)[number]

export interface UiLanguageInfo {
  code: UiLanguage
  /** The language's own name, shown in the language picker. */
  name: string
  dir: 'rtl' | 'ltr'
  /** Locale for numbers and dates. */
  intl: string
  /** Is the app's name written in this language's script (هدهد) or in Latin (Hodhod)? */
  appName: string
}

export const UI_LANGUAGE_INFO: Record<UiLanguage, UiLanguageInfo> = {
  fa: { code: 'fa', name: 'فارسی', dir: 'rtl', intl: 'fa-IR', appName: 'هدهد' },
  de: { code: 'de', name: 'Deutsch', dir: 'ltr', intl: 'de-DE', appName: 'Hodhod' },
  en: { code: 'en', name: 'English', dir: 'ltr', intl: 'en-GB', appName: 'Hodhod' },
  fr: { code: 'fr', name: 'Français', dir: 'ltr', intl: 'fr-FR', appName: 'Hodhod' },
  tr: { code: 'tr', name: 'Türkçe', dir: 'ltr', intl: 'tr-TR', appName: 'Hodhod' },
  uk: { code: 'uk', name: 'Українська', dir: 'ltr', intl: 'uk-UA', appName: 'Hodhod' },
  ru: { code: 'ru', name: 'Русский', dir: 'ltr', intl: 'ru-RU', appName: 'Hodhod' },
  ar: { code: 'ar', name: 'العربية', dir: 'rtl', intl: 'ar', appName: 'هدهد' },
  es: { code: 'es', name: 'Español', dir: 'ltr', intl: 'es-ES', appName: 'Hodhod' },
  nl: { code: 'nl', name: 'Nederlands', dir: 'ltr', intl: 'nl-NL', appName: 'Hodhod' },
}

export interface TargetLanguageInfo {
  code: TargetLanguage
  /** Own name ("Deutsch"), used next to the flag-free language picker. */
  name: string
  /** BCP-47 tag for speech (synthesis and recognition). */
  speech: string
  /** Definite articles that mark grammatical gender, in display order; empty when the language has none. */
  articles: readonly string[]
  /** A friendly sentence to try the voice with. */
  sample: string
  /** A word to show as an example in the "new word" field. */
  example: string
}

export const TARGET_LANGUAGE_INFO: Record<TargetLanguage, TargetLanguageInfo> = {
  en: { code: 'en', name: 'English', speech: 'en-GB', articles: [], sample: 'Hello! How are you today?', example: 'give up' },
  de: { code: 'de', name: 'Deutsch', speech: 'de-DE', articles: ['der', 'die', 'das'], sample: 'Guten Tag! Wie geht es Ihnen?', example: 'aufgeben' },
  fr: { code: 'fr', name: 'Français', speech: 'fr-FR', articles: ['le', 'la'], sample: 'Bonjour ! Comment allez-vous ?', example: 'se débrouiller' },
  it: { code: 'it', name: 'Italiano', speech: 'it-IT', articles: ['il', 'lo', 'la'], sample: 'Buongiorno! Come sta?', example: 'in bocca al lupo' },
  es: { code: 'es', name: 'Español', speech: 'es-ES', articles: ['el', 'la'], sample: '¡Hola! ¿Qué tal estás?', example: 'echar de menos' },
  nl: { code: 'nl', name: 'Nederlands', speech: 'nl-NL', articles: ['de', 'het'], sample: 'Goedendag! Hoe gaat het met u?', example: 'opgeven' },
}

export const isUiLanguage = (code: string | null | undefined): code is UiLanguage => !!code && (UI_LANGUAGES as readonly string[]).includes(code)
export const isTargetLanguage = (code: string | null | undefined): code is TargetLanguage =>
  !!code && (TARGET_LANGUAGES as readonly string[]).includes(code)

/** A learner cannot learn their own language; every other pair is offered. */
export const targetsFor = (native: string): TargetLanguage[] => TARGET_LANGUAGES.filter((code) => code !== native)
