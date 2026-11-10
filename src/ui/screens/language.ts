/**
 * The very first screen on a new device: before anything else, the visitor picks the language
 * Hodhod talks to them in. It opens in English; every choice is written in its own language.
 */
import { h } from '../dom.ts'
import { mascot } from '../mascot.ts'
import { t } from '../strings.ts'
import { UI_LANGUAGE_INFO, UI_LANGUAGES } from '../i18n/languages.ts'

export function languageScreen(onPick: (code: string) => void): HTMLElement {
  return h(
    'main',
    { class: 'screen no-nav welcome first-language' },
    h('div', { class: 'welcome-bird' }, mascot('happy', { size: 140, enter: 'fly' })),
    h('h1', { class: 'welcome-title' }, t.auth.chooseTitle),
    h('p', { class: 'welcome-body' }, t.auth.chooseBody),
    h(
      'div',
      { class: 'language-grid' },
      UI_LANGUAGES.map((code) =>
        h(
          'button',
          { class: 'option-card', type: 'button', lang: code, dir: UI_LANGUAGE_INFO[code].dir, 'data-language': code, onclick: () => onPick(code) },
          h('b', null, UI_LANGUAGE_INFO[code].name),
        ),
      ),
    ),
  )
}
