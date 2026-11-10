/**
 * The very first screen on a new device: before anything else, the visitor picks the language
 * Hodhod talks to them in. It opens in English; every choice shows its flag and its English name,
 * so the list looks the same for everyone, with the language's own name underneath.
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
      UI_LANGUAGES.map((code) => {
        const info = UI_LANGUAGE_INFO[code]
        return h(
          'button',
          { class: 'option-card', type: 'button', dir: 'ltr', 'data-language': code, onclick: () => onPick(code) },
          h('img', { class: 'language-flag', src: `./flags/${code}.svg`, alt: '', width: 28, height: 21, decoding: 'async' }),
          h('span', { class: 'language-names' },
            h('b', null, info.english),
            info.name === info.english ? null : h('small', { lang: code, dir: info.dir }, info.name),
          ),
        )
      }),
    ),
  )
}
