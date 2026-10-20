/** Short stories written around the learner's own words, read sentence by sentence. */
import { highlightKnown, pickStoryWords, storyForm, suggestLevel, type StoryLevel } from '../../core/stories.ts'
import { toAppError } from '../../data/errors.ts'
import { stories, type StoryRow } from '../../data/platform.ts'
import type { Ctx, Screen } from '../context.ts'
import { de, h, icon, replace } from '../dom.ts'
import { faDate } from '../format.ts'
import { mascot } from '../mascot.ts'
import { describeError, t } from '../strings.ts'
import { emptyState, segmented, speakButton } from '../widgets.ts'

const LEVELS: StoryLevel[] = ['A1', 'A2', 'B1', 'B2']
const MIN_WORDS = 3

const back = (ctx: Ctx, to: string) =>
  h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.common.back, title: t.common.back, onclick: () => ctx.go(to) }, icon('back'))

export function storiesScreen(ctx: Ctx): Screen {
  const s = t.stories
  const el = h('main', { class: 'screen stories' })
  let list: StoryRow[] | null = null
  let failed: string | null = null
  let writing = false
  const chosen = pickStoryWords(ctx.data.words.values(), ctx.data.activeCards())
  let level: StoryLevel = suggestLevel(chosen)

  async function write() {
    if (writing) return
    writing = true
    render()
    try {
      const story = await stories.create(ctx.client, chosen.map(storyForm), level)
      ctx.go(`/stories/${story.id}`)
    } catch (err) {
      const error = toAppError(err)
      ctx.toast(error.kind === 'rate_limit' ? s.limit : describeError(error), 'error')
      writing = false
      render()
    }
  }

  function render() {
    const header = h('header', { class: 'topbar' }, back(ctx, '/home'), h('h1', null, s.title))
    const enough = chosen.length >= MIN_WORDS
    const maker = h(
      'section',
      { class: 'story-maker' },
      mascot(writing ? 'writing' : 'reading', { size: 112, enter: 'hop' }),
      h('p', null, writing ? s.writing : enough ? s.intro : s.needWords(MIN_WORDS)),
      enough && !writing
        ? h(
            'div',
            { class: 'stack', style: { width: '100%' } },
            h('div', { class: 'chips story-words' }, chosen.map((w) => h('span', { class: 'chip' }, de(storyForm(w))))),
            segmented<StoryLevel>(LEVELS.map((l) => ({ value: l, label: l })), level, (v) => (level = v), s.level),
            h('button', { class: 'btn primary big block', type: 'button', onclick: () => void write() }, icon('sparkle'), s.write),
            h('p', { class: 'help on-dark' }, s.limitHelp),
          )
        : writing
          ? h('div', { class: 'progress indeterminate', role: 'progressbar', 'aria-label': s.writing }, h('span'))
          : h('a', { class: 'btn block', href: '#/study' }, icon('cards'), t.home.startReview),
    )
    const items =
      failed !== null
        ? h('p', { class: 'muted' }, failed)
        : list === null
          ? h('p', { class: 'muted' }, t.common.loading)
          : list.length === 0
            ? null
            : h(
                'section',
                { class: 'stack' },
                h('h2', null, s.mine),
                h(
                  'ul',
                  { class: 'story-list' },
                  list.map((story) =>
                    h(
                      'li',
                      null,
                      h(
                        'a',
                        { class: `story-item ${story.read_at ? 'read' : 'unread'}`, href: `#/stories/${story.id}` },
                        h('span', { class: 'story-item-text' }, h('b', { class: 'de', lang: 'de', dir: 'ltr' }, story.title_de), h('span', null, story.title_fa)),
                        h('span', { class: 'small muted' }, [story.level, faDate(story.created_at)].filter(Boolean).join('، ')),
                        story.read_at ? null : h('span', { class: 'chip status-new' }, s.unread),
                      ),
                    ),
                  ),
                ),
              )
    replace(el, header, maker, items)
  }

  render()
  stories
    .list(ctx.client)
    .then((rows) => (list = rows))
    .catch((err) => (failed = toAppError(err).kind === 'not_found' ? s.unavailable : describeError(toAppError(err))))
    .finally(() => !writing && render())
  return { el }
}

export function storyScreen(ctx: Ctx, params: Record<string, string>): Screen {
  const s = t.stories
  const id = params.id ?? ''
  const el = h('main', { class: 'screen story' })
  let story: StoryRow | null = null
  let shown = new Set<number>()
  let showAll = false
  let playing = false

  const forms = () => [...(story?.words ?? []), ...[...ctx.data.words.values()].filter((w) => !w.deletedAt && w.pos !== 'sentence').map(storyForm)]

  async function playAll(button: HTMLButtonElement) {
    if (!story) return
    if (playing) {
      playing = false
      ctx.audio.stop()
      return
    }
    playing = true
    button.classList.add('speaking')
    for (const [i, sentence] of story.sentences.entries()) {
      if (!playing || !el.isConnected) break
      el.querySelectorAll('.story-sentence').forEach((n, j) => n.classList.toggle('current', j === i))
      await ctx.audio.speak(sentence.de, ctx.data.profile.activeTargetLanguage, ctx.data.settings.speechRate)
    }
    playing = false
    button.classList.remove('speaking')
    el.querySelectorAll('.story-sentence.current').forEach((n) => n.classList.remove('current'))
  }

  function render() {
    const header = h('header', { class: 'topbar' }, back(ctx, '/stories'))
    if (!story) return replace(el, header, h('p', { class: 'muted center' }, t.common.loading))
    const known = forms()
    const playButton = h('button', { class: 'btn', type: 'button' }, icon('speaker', { size: 18 }), s.playAll)
    playButton.onclick = () => void playAll(playButton)
    replace(
      el,
      header,
      h('section', { class: 'story-head' }, h('h1', { class: 'de', lang: 'de', dir: 'ltr' }, story.title_de), h('p', { class: 'muted' }, story.title_fa)),
      h(
        'div',
        { class: 'row wrap story-tools' },
        playButton,
        h('button', { class: 'btn ghost', type: 'button', 'aria-pressed': String(showAll), onclick: () => { showAll = !showAll; render() } }, showAll ? s.hideAll : s.showAll),
      ),
      h('p', { class: 'help' }, s.tapHelp),
      h(
        'ol',
        { class: 'story-text' },
        story.sentences.map((sentence, i) => {
          const open = showAll || shown.has(i)
          return h(
            'li',
            { class: `story-sentence ${open ? 'open' : ''}` },
            h(
              'button',
              {
                class: 'story-de',
                type: 'button',
                lang: 'de',
                dir: 'ltr',
                'aria-expanded': String(open),
                onclick: () => {
                  if (shown.has(i)) shown.delete(i)
                  else shown.add(i)
                  render()
                },
              },
              highlightKnown(sentence.de, known).map((part) => (part.known ? h('mark', null, part.text) : part.text)),
            ),
            speakButton(ctx, sentence.de, { compact: true }),
            open ? h('p', { class: 'story-fa' }, sentence.fa) : null,
          )
        }),
      ),
      story.words.length > 0 ? h('section', { class: 'card stack' }, h('h2', null, s.yourWords(story.words.length)), h('div', { class: 'chips' }, story.words.map((w) => h('span', { class: 'chip' }, de(w))))) : null,
      h('a', { class: 'btn block', href: '#/stories' }, icon('sparkle', { size: 18 }), s.another),
    )
  }

  render()
  stories
    .get(ctx.client, id)
    .then((row) => {
      if (!row) return replace(el, h('header', { class: 'topbar' }, back(ctx, '/stories')), emptyState({ art: mascot('confused', { size: 120 }), title: s.notFound }))
      story = row
      render()
      if (!row.read_at) void stories.markRead(ctx.client, id)
    })
    .catch((err) => ctx.toast(describeError(toAppError(err)), 'error'))
  return {
    el,
    destroy: () => {
      playing = false
      shown = new Set()
    },
  }
}

