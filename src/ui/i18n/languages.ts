/**
 * Languages of Hodhod.
 *   Interface (native) languages: the language the app speaks and the one meanings are written in.
 *   Target languages: the languages whose words are learned.
 */

export const UI_LANGUAGES = ['fa', 'de', 'en', 'fr', 'it', 'tr', 'uk', 'ru', 'ar', 'es', 'nl'] as const
export type UiLanguage = (typeof UI_LANGUAGES)[number]

export const TARGET_LANGUAGES = ['en', 'de', 'fr', 'it', 'es', 'nl'] as const
export type TargetLanguage = (typeof TARGET_LANGUAGES)[number]

export interface UiLanguageInfo {
  code: UiLanguage
  /** The language's own name, shown in the language picker. */
  name: string
  /** The name in English, the same for everyone on the very first screen. */
  english: string
  dir: 'rtl' | 'ltr'
  /** Locale for numbers and dates. */
  intl: string
  /** Is the app's name written in this language's script (هدهد) or in Latin (Hodhod)? */
  appName: string
}

export const UI_LANGUAGE_INFO: Record<UiLanguage, UiLanguageInfo> = {
  fa: { code: 'fa', name: 'فارسی', english: 'Persian', dir: 'rtl', intl: 'fa-IR', appName: 'هدهد' },
  de: { code: 'de', name: 'Deutsch', english: 'German', dir: 'ltr', intl: 'de-DE', appName: 'Hodhod' },
  en: { code: 'en', name: 'English', english: 'English', dir: 'ltr', intl: 'en-GB', appName: 'Hodhod' },
  fr: { code: 'fr', name: 'Français', english: 'French', dir: 'ltr', intl: 'fr-FR', appName: 'Hodhod' },
  tr: { code: 'tr', name: 'Türkçe', english: 'Turkish', dir: 'ltr', intl: 'tr-TR', appName: 'Hodhod' },
  uk: { code: 'uk', name: 'Українська', english: 'Ukrainian', dir: 'ltr', intl: 'uk-UA', appName: 'Hodhod' },
  ru: { code: 'ru', name: 'Русский', english: 'Russian', dir: 'ltr', intl: 'ru-RU', appName: 'Hodhod' },
  ar: { code: 'ar', name: 'العربية', english: 'Arabic', dir: 'rtl', intl: 'ar', appName: 'هدهد' },
  es: { code: 'es', name: 'Español', english: 'Spanish', dir: 'ltr', intl: 'es-ES', appName: 'Hodhod' },
  nl: { code: 'nl', name: 'Nederlands', english: 'Dutch', dir: 'ltr', intl: 'nl-NL', appName: 'Hodhod' },
  it: { code: 'it', name: 'Italiano', english: 'Italian', dir: 'ltr', intl: 'it-IT', appName: 'Hodhod' },
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
  /** Examples for the help under the "new word" field: a noun, an expression and a sentence. */
  examples: readonly [string, string, string]
  /** The deck's colour (the same as --brand in app.css), for the language picker. */
  color: string
}

export const TARGET_LANGUAGE_INFO: Record<TargetLanguage, TargetLanguageInfo> = {
  en: { code: 'en', name: 'English', speech: 'en-GB', articles: [], sample: 'Hello! How are you today?', example: 'give up', examples: ['a table', 'give up', 'How are you doing?'], color: '#5b9cf6' },
  de: { code: 'de', name: 'Deutsch', speech: 'de-DE', articles: ['der', 'die', 'das'], sample: 'Guten Tag! Wie geht es Ihnen?', example: 'aufgeben', examples: ['der Tisch', 'Bescheid sagen', "Wie geht's dir?"], color: '#f5922b' },
  fr: { code: 'fr', name: 'Français', speech: 'fr-FR', articles: ['le', 'la'], sample: 'Bonjour ! Comment allez-vous ?', example: 'se débrouiller', examples: ['la table', 'avoir besoin de', 'Ça va ?'], color: '#a78bfa' },
  it: { code: 'it', name: 'Italiano', speech: 'it-IT', articles: ['il', 'lo', 'la'], sample: 'Buongiorno! Come sta?', example: 'in bocca al lupo', examples: ['il tavolo', 'avere bisogno di', 'Come stai?'], color: '#34c38a' },
  es: { code: 'es', name: 'Español', speech: 'es-ES', articles: ['el', 'la'], sample: '¡Hola! ¿Qué tal estás?', example: 'echar de menos', examples: ['la mesa', 'echar de menos', '¿Qué tal?'], color: '#f87171' },
  nl: { code: 'nl', name: 'Nederlands', speech: 'nl-NL', articles: ['de', 'het'], sample: 'Goedendag! Hoe gaat het met u?', example: 'opgeven', examples: ['de tafel', 'in de war zijn', 'Hoe gaat het?'], color: '#2cc7b4' },
}

export const isUiLanguage = (code: string | null | undefined): code is UiLanguage => !!code && (UI_LANGUAGES as readonly string[]).includes(code)
export const isTargetLanguage = (code: string | null | undefined): code is TargetLanguage =>
  !!code && (TARGET_LANGUAGES as readonly string[]).includes(code)

/** A learner cannot learn their own language; every other pair is offered. */
export const targetsFor = (native: string): TargetLanguage[] => TARGET_LANGUAGES.filter((code) => code !== native)
