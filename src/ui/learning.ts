/**
 * The language pair on screen: the language whose words are being learned (the active deck)
 * and the learner's own language. Set when the account's data loads and whenever the learner
 * switches decks; everything that shows or speaks a word asks here.
 */
import { TARGET_LANGUAGE_INFO, UI_LANGUAGE_INFO, isTargetLanguage, isUiLanguage } from './i18n/languages.ts'

let target = 'de'
let native = 'fa'

export function setLearningPair(pair: { target: string; native: string }): void {
  target = isTargetLanguage(pair.target) ? pair.target : 'de'
  native = isUiLanguage(pair.native) ? pair.native : 'fa'
  // each deck has its own colour (see app.css)
  if (typeof document !== 'undefined') document.documentElement.dataset.deck = target
}

/** Code of the language being learned ("de"). */
export const learning = (): string => target
/** Code of the learner's own language ("fa"). */
export const ownLanguage = (): string => native
/** Writing direction of the learner's own language. */
export const ownDir = (): 'rtl' | 'ltr' => (isUiLanguage(native) ? UI_LANGUAGE_INFO[native].dir : 'rtl')
/** BCP-47 tag for speaking and hearing the learned language ("de-DE"). */
export const learningSpeech = (): string => (isTargetLanguage(target) ? TARGET_LANGUAGE_INFO[target].speech : 'de-DE')

/** Facts about the language being learned (articles, a sample sentence, an example word). */
export const learningInfo = () => TARGET_LANGUAGE_INFO[isTargetLanguage(target) ? target : 'de']
