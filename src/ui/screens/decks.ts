/**
 * The learner's languages ("decks"): which one to review today, and adding another.
 * Each deck has its own words, reviews and colour. A second language needs Hodhod Plus;
 * the server enforces that, this screen only explains it.
 */
import { toAppError } from '../../data/errors.ts'
import type { Ctx, Screen } from '../context.ts'
import { h, icon, replace } from '../dom.ts'
import { TARGET_LANGUAGE_INFO, isTargetLanguage, targetsFor } from '../i18n/languages.ts'
import { languageName } from '../i18n/names.ts'
import { mascot } from '../mascot.ts'
import { describeError, t } from '../strings.ts'

/** True when the server refused because a second language needs Plus. */
export function isPlusRequired(err: unknown): boolean {
  const text = err instanceof Error ? `${err.message} ${(err as { code?: string }).code ?? ''}` : String(err)
  return /plus_required|P0004/.test(text)
}

const dot = (code: string) =>
  h('span', { class: 'deck-dot', 'aria-hidden': 'true', style: { background: isTargetLanguage(code) ? TARGET_LANGUAGE_INFO[code].color : 'var(--brand)' } })

export function decksScreen(ctx: Ctx): Screen {
  const el = h('main', { class: 'screen decks' })
  const d = t.decks
  let adding = false
  let busy = false
  let plusNeeded = false

  async function open(code: string) {
    if (busy) return
    if (code === ctx.data.profile.activeTargetLanguage) return ctx.go('/home')
    busy = true
    render()
    try {
      await ctx.data.setLanguages({ target: code })
      ctx.go('/home')
    } catch (err) {
      if (isPlusRequired(err)) plusNeeded = true
      else ctx.toast(toAppError(err).kind === 'offline' ? d.failed : describeError(toAppError(err)), 'error')
    } finally {
      busy = false
      render()
    }
  }

  function render() {
    const decks = ctx.data.decks()
    const have = new Set(decks.map((x) => x.language))
    const others = targetsFor(ctx.data.profile.nativeLanguage).filter((code) => !have.has(code))
    replace(
      el,
      h('header', { class: 'topbar' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.common.back, onclick: () => ctx.go('/home') }, icon('back')), h('h1', null, d.title)),
      h('p', { class: 'muted' }, d.choose),
      h(
        'ul',
        { class: 'deck-list' },
        decks.map((deck) => {
          const current = deck.language === ctx.data.profile.activeTargetLanguage
          return h(
            'li',
            null,
            h(
              'button',
              { class: `deck-row ${current ? 'current' : ''}`, type: 'button', disabled: busy, 'aria-current': current ? 'true' : undefined, onclick: () => void open(deck.language) },
              dot(deck.language),
              h('span', { class: 'grow' }, h('b', null, languageName(deck.language)), h('small', { class: 'muted' }, current ? `${d.words(deck.words)} · ${d.current}` : d.words(deck.words))),
              icon('back', { size: 18 }),
            ),
          )
        }),
      ),
      plusNeeded
        ? h('section', { class: 'card stack plus-note' }, mascot('pointing', { size: 72 }), h('b', null, d.plusTitle), h('p', { class: 'small' }, d.plusBody))
        : null,
      others.length
        ? adding
          ? h(
              'section',
              { class: 'card stack' },
              h('h2', null, d.addTitle),
              h(
                'div',
                { class: 'deck-choices' },
                others.map((code) => h('button', { class: 'option-card deck-choice', type: 'button', disabled: busy, onclick: () => void open(code) }, dot(code), h('b', null, languageName(code)), h('span', { lang: code, dir: 'ltr' }, TARGET_LANGUAGE_INFO[code].name))),
              ),
            )
          : h('button', { class: 'btn block', type: 'button', onclick: () => { adding = true; render() } }, icon('plus', { size: 18 }), d.add)
        : null,
    )
  }

  render()
  return { el, onData: render }
}
