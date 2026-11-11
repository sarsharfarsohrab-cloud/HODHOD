/**
 * The Learn corner: podcasts read sentence by sentence, short lessons and verb families.
 * Content lives in src/content/learn.ts; every word can be turned into a card with one tap.
 */
import { explained, learnContent, type Explained } from '../../content/learn.ts'
import type { Ctx, Screen } from '../context.ts'
import { h, icon, replace } from '../dom.ts'
import { mascot } from '../mascot.ts'
import { t } from '../strings.ts'
import { emptyState, speakButton } from '../widgets.ts'
import { learning, ownLanguage } from '../learning.ts'

const back = (ctx: Ctx, to: string) =>
  h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.common.back, title: t.common.back, onclick: () => ctx.go(to) }, icon('back'))

/** Text in the learner's language (English when it is not written yet). */
const say = (text: Explained) => explained(text, ownLanguage())

/** A note shown once on a screen when some explanations fall back to English. */
const englishNote = (used: boolean) => (used ? h('p', { class: 'help learn-note' }, icon('info', { size: 16 }), t.learn.inEnglish) : null)

/** A word of the learned language as a chip that opens "new word" with the word filled in. */
const wordChip = (word: string) =>
  h('a', { class: 'chip learn-word', href: `#/create?word=${encodeURIComponent(word)}`, lang: learning(), dir: 'ltr', title: t.learn.addWord }, icon('plus', { size: 14 }), word)

/** The words of a sentence, without punctuation and repeats. */
const wordsOf = (text: string) => [...new Set(text.match(/[\p{L}][\p{L}'-]*/gu) ?? [])]

const notFound = (ctx: Ctx, el: HTMLElement) =>
  replace(el, h('header', { class: 'topbar' }, back(ctx, '/learn')), emptyState({ art: mascot('confused', { size: 120 }), title: t.learn.notFound }))

export function learnScreen(ctx: Ctx): Screen {
  const l = t.learn
  const content = learnContent(learning())
  const el = h('main', { class: 'screen learn' })
  const item = (href: string, title: string, sub: string, level?: string, foreign = false) =>
    h('a', { class: 'learn-item', href }, h('span', { class: 'learn-item-text' }, h('b', foreign ? { lang: learning(), dir: 'ltr' } : null, title), h('small', { class: 'muted' }, h('bdi', null, sub))), level ? h('span', { class: 'chip learn-level' }, level) : null, h('span', { class: 'learn-arrow', 'aria-hidden': 'true' }, icon('back', { size: 18 })))
  const section = (name: Parameters<typeof icon>[0], title: string, hint: string, items: HTMLElement[]) =>
    h('section', { class: 'card stack learn-section' }, h('div', { class: 'learn-section-head' }, h('span', { class: 'feature-icon' }, icon(name, { size: 22 })), h('div', null, h('h2', null, title), h('p', { class: 'small muted' }, hint))), items.length ? h('div', { class: 'learn-list' }, items) : h('p', { class: 'small muted' }, l.empty))

  let fallback = false
  const podcastItems = content.podcasts.map((p) => {
    const about = say(p.about)
    fallback ||= about.fallback
    return item(`#/learn/podcast/${p.id}`, p.title, about.text, p.level, true)
  })
  const lessonItems = content.lessons.map((x) => {
    const title = say(x.title)
    fallback ||= title.fallback
    return item(`#/learn/lesson/${x.id}`, title.text, x.words.slice(0, 3).join(' · '), x.level)
  })
  const verbItems = content.verbs.map((v) => {
    const title = say(v.title)
    fallback ||= title.fallback
    return item(`#/learn/verbs/${v.id}`, title.text, v.members.map((m) => m.verb).slice(0, 4).join(' · '))
  })

  replace(
    el,
    h('header', { class: 'topbar' }, back(ctx, '/home'), h('h1', null, l.title)),
    h('div', { class: 'learn-intro' }, mascot('happy', { size: 72 }), h('p', null, l.intro)),
    englishNote(fallback),
    section('ear', l.podcasts, l.podcastsHint, podcastItems),
    section('book', l.lessons, l.lessonsHint, lessonItems),
    section('list', l.verbs, l.verbsHint, verbItems),
    h('p', { class: 'help center' }, l.soon),
  )
  return { el }
}

export function podcastScreen(ctx: Ctx, params: Record<string, string>): Screen {
  const l = t.learn
  const el = h('main', { class: 'screen story learn' })
  const episode = learnContent(learning()).podcasts.find((p) => p.id === params.id)
  let shown = new Set<number>()
  let showAll = false
  let playing = false

  async function playAll(button: HTMLButtonElement) {
    if (!episode) return
    if (playing) {
      playing = false
      ctx.audio.stop()
      return
    }
    playing = true
    button.classList.add('speaking')
    for (const [i, line] of episode.lines.entries()) {
      if (!playing || !el.isConnected) break
      el.querySelectorAll('.story-sentence').forEach((n, j) => n.classList.toggle('current', j === i))
      await ctx.audio.speak(line.text, learning(), ctx.data.settings.speechRate)
    }
    playing = false
    button.classList.remove('speaking')
    el.querySelectorAll('.story-sentence.current').forEach((n) => n.classList.remove('current'))
  }

  function render() {
    if (!episode) return notFound(ctx, el)
    const about = say(episode.about)
    let fallback = about.fallback
    const playButton = h('button', { class: 'btn', type: 'button' }, icon('speaker', { size: 18 }), l.playAll)
    playButton.onclick = () => void playAll(playButton)
    const lines = episode.lines.map((line, i) => {
      const open = showAll || shown.has(i)
      const tr = say(line.tr)
      fallback ||= tr.fallback
      return h(
        'li',
        { class: `story-sentence ${open ? 'open' : ''}` },
        line.who ? h('span', { class: `learn-who who-${line.who}`, 'aria-hidden': 'true' }, line.who) : null,
        h(
          'button',
          {
            class: 'story-de',
            type: 'button',
            lang: learning(),
            dir: 'ltr',
            'aria-expanded': String(open),
            onclick: () => {
              if (shown.has(i)) shown.delete(i)
              else shown.add(i)
              render()
            },
          },
          line.text,
        ),
        speakButton(ctx, line.text, { compact: true }),
        open ? h('p', { class: 'story-fa' }, tr.text) : null,
        open ? h('div', { class: 'chips learn-words', dir: 'ltr' }, wordsOf(line.text).map(wordChip)) : null,
      )
    })
    replace(
      el,
      h('header', { class: 'topbar' }, back(ctx, '/learn')),
      h('section', { class: 'story-head' }, h('h1', { class: 'de', lang: learning(), dir: 'ltr' }, episode.title), h('p', { class: 'muted' }, h('span', { class: 'chip learn-level' }, episode.level), ' ', about.text)),
      englishNote(fallback),
      h(
        'div',
        { class: 'row wrap story-tools' },
        playButton,
        h('button', { class: 'btn ghost', type: 'button', 'aria-pressed': String(showAll), onclick: () => { showAll = !showAll; render() } }, showAll ? l.hideAll : l.showAll),
      ),
      h('p', { class: 'help' }, l.tapHelp),
      h('ol', { class: 'story-text' }, lines),
    )
  }

  render()
  return {
    el,
    destroy: () => {
      playing = false
      shown = new Set()
    },
  }
}

export function lessonScreen(ctx: Ctx, params: Record<string, string>): Screen {
  const l = t.learn
  const el = h('main', { class: 'screen learn' })
  const lesson = learnContent(learning()).lessons.find((x) => x.id === params.id)
  if (!lesson) {
    notFound(ctx, el)
    return { el }
  }
  const title = say(lesson.title)
  let fallback = title.fallback
  const parts = lesson.parts.map((part) => {
    const heading = say(part.heading)
    const body = say(part.body)
    fallback ||= heading.fallback || body.fallback
    return h(
      'section',
      { class: 'card stack learn-part' },
      h('h2', null, heading.text),
      h('p', null, body.text),
      h(
        'ul',
        { class: 'learn-examples' },
        part.examples.map((ex) => {
          const tr = say(ex.tr)
          return h('li', null, h('span', { class: 'de', lang: learning(), dir: 'ltr' }, ex.text), speakButton(ctx, ex.text, { compact: true }), h('small', { class: 'muted' }, tr.text))
        }),
      ),
    )
  })
  replace(
    el,
    h('header', { class: 'topbar' }, back(ctx, '/learn'), h('h1', null, title.text)),
    h('p', null, h('span', { class: 'chip learn-level' }, lesson.level)),
    englishNote(fallback),
    parts,
    lesson.words.length ? h('section', { class: 'card stack' }, h('h2', null, l.wordsTitle), h('div', { class: 'chips learn-words', dir: 'ltr' }, lesson.words.map(wordChip))) : null,
  )
  return { el }
}

export function verbFamilyScreen(ctx: Ctx, params: Record<string, string>): Screen {
  const l = t.learn
  const el = h('main', { class: 'screen learn' })
  const family = learnContent(learning()).verbs.find((v) => v.id === params.id)
  if (!family) {
    notFound(ctx, el)
    return { el }
  }
  const title = say(family.title)
  const intro = say(family.intro)
  let fallback = title.fallback || intro.fallback
  const members = family.members.map((m) => {
    const meaning = say(m.meaning)
    const tr = say(m.exampleTr)
    fallback ||= meaning.fallback
    return h(
      'li',
      { class: 'card stack learn-verb' },
      h('div', { class: 'row' }, h('b', { class: 'de', lang: learning(), dir: 'ltr' }, m.verb), speakButton(ctx, m.verb, { compact: true }), h('span', { class: 'muted' }, meaning.text)),
      h('p', { class: 'learn-example' }, h('span', { lang: learning(), dir: 'ltr' }, m.example), speakButton(ctx, m.example, { compact: true })),
      h('small', { class: 'muted' }, tr.text),
      h('div', { class: 'chips' }, wordChip(m.verb)),
    )
  })
  replace(
    el,
    h('header', { class: 'topbar' }, back(ctx, '/learn'), h('h1', null, title.text)),
    englishNote(fallback),
    h('p', { class: 'learn-intro-text' }, intro.text),
    h('ol', { class: 'learn-verbs' }, members),
    family.confusables?.length
      ? h(
          'section',
          { class: 'card stack learn-confusables' },
          h('h2', null, l.confusables),
          family.confusables.map((c) => h('div', { class: 'learn-pair' }, h('p', { lang: learning(), dir: 'ltr' }, h('b', null, c.a), ' ≠ ', h('b', null, c.b)), h('p', { class: 'small' }, say(c.tip).text))),
        )
      : null,
  )
  return { el }
}
