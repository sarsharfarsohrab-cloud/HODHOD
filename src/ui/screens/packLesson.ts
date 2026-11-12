/**
 * One named group of a pack: meet the words (or read the conversation), a short practice of
 * words and meanings, then the cards join the daily review.
 *
 * The example sentence of a word is only there to be heard; no question is ever asked about it.
 */
import { buildPractice, type PracticeEntry, type PracticeQuestion } from '../../core/packPractice.ts'
import { toAppError } from '../../data/errors.ts'
import { packItems, packLessonTitles, startPackLesson, storePacks, type PackItem, type StorePack } from '../../data/platform.ts'
import { displayWord } from '../../../supabase/functions/_shared/wordSchema.ts'
import type { Word } from '../../core/types.ts'
import type { Ctx, Screen } from '../context.ts'
import { de, h, icon, replace } from '../dom.ts'
import { num } from '../format.ts'
import { learning } from '../learning.ts'
import { mascot } from '../mascot.ts'
import { describeError, t } from '../strings.ts'
import { emptyState, speakButton, wordTitle } from '../widgets.ts'

type Step = 'meet' | 'practice' | 'result'

export function packLessonScreen(ctx: Ctx, params: Record<string, string>): Screen {
  const id = params.id ?? ''
  const lesson = Number(params.lesson) || 1
  const s = t.store
  const el = h('main', { class: 'screen pack-lesson' })
  let pack: StorePack | null = null
  let items: PackItem[] = []
  let title = ''
  let failed: string | null = null
  let loading = true
  let busy = false
  let step: Step = 'meet'
  let questions: PracticeQuestion[] = []
  let at = 0
  let right = 0
  let chosen: string | null = null
  let playing = false

  const back = () => h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.common.back, title: t.common.back, onclick: () => ctx.go(`/store/${id}`) }, icon('back'))
  const talk = () => pack?.kind === 'sentences'
  const canHear = () => ctx.audio.canSpeak(learning())
  const say = (text: string) => ctx.audio.speak(text, learning(), ctx.data.settings.speechRate)

  /** How many of this group's entries the learner already has (from this pack, or the same word from elsewhere). */
  const inBank = () => {
    const mine = new Set<string>()
    for (const w of ctx.data.words.values()) if (!w.deletedAt && w.packItemId) mine.add(w.packItemId)
    return items.filter((i) => mine.has(i.id) || (i.lemma !== null && ctx.data.findDuplicate(i.lemma, (i.pos ?? undefined) as Word['pos'] | undefined) !== undefined)).length
  }

  async function add() {
    if (!pack || busy) return
    busy = true
    render()
    try {
      const added = await startPackLesson(ctx.client, pack.id, lesson)
      await ctx.data.syncNow()
      ctx.toast(added > 0 ? s.started(added) : s.startedNone)
      ctx.go(added > 0 ? `/study?pack=${pack.id}` : `/store/${pack.id}`)
    } catch (err) {
      ctx.toast(describeError(toAppError(err)), 'error')
      busy = false
      render()
    }
  }

  function startPractice() {
    const entries: PracticeEntry[] = items
      .filter((i) => i.content && i.content.pos !== 'sentence' && i.primary_meaning)
      .map((i) => ({ id: i.id, word: displayWord(i.content!), meaning: i.primary_meaning! }))
    questions = buildPractice(entries)
    // without a voice there is nothing to hear: ask for the word from its meaning instead
    if (!canHear()) questions = questions.map((q) => (q.kind === 'listen' ? { ...q, kind: 'word' } : q))
    at = 0
    right = 0
    chosen = null
    step = questions.length > 0 ? 'practice' : 'result'
    render()
    if (questions[0]?.kind === 'listen') void say(questions[0].entry.word)
  }

  async function playDialogue(button: HTMLButtonElement) {
    if (playing) {
      playing = false
      ctx.audio.stop()
      return
    }
    playing = true
    button.classList.add('speaking')
    for (const [i, item] of items.entries()) {
      if (!playing || !el.isConnected) break
      el.querySelectorAll('.pl-line').forEach((n, j) => n.classList.toggle('current', j === i))
      await say(item.content?.lemma ?? item.input)
    }
    playing = false
    button.classList.remove('speaking')
    el.querySelectorAll('.pl-line.current').forEach((n) => n.classList.remove('current'))
  }

  const steps = () =>
    talk()
      ? null
      : h(
          'ol',
          { class: 'pl-steps', 'aria-hidden': 'true' },
          [s.stepMeet, s.stepPractice, s.stepAdd].map((label, i) => h('li', { class: i <= ['meet', 'practice', 'result'].indexOf(step) ? 'on' : '' }, h('b', null, num(i + 1)), label)),
        )

  const addButton = (primary: boolean) =>
    h('button', { class: `btn ${primary ? 'primary' : ''} block`, type: 'button', disabled: busy, onclick: () => void add() }, icon('cards', { size: 18 }), busy ? s.starting : s.addToReview(items.length - inBank()))

  /** The foot of the first and the last step: add the cards, or say that they are there already. */
  const addBlock = (primary: boolean) =>
    inBank() >= items.length
      ? [h('p', { class: 'help' }, s.groupInBank), h('a', { class: 'btn block', href: `#/study?pack=${id}` }, icon('cards', { size: 18 }), s.studyPack)]
      : [addButton(primary), h('p', { class: 'help' }, s.addHint)]

  function wordRow(item: PackItem) {
    const c = item.content!
    const example = c.meanings[0]?.examples[0]
    return h(
      'li',
      { class: 'pl-word' },
      h('div', { class: 'pl-head' }, wordTitle(c, 'div', 'pl-title'), speakButton(ctx, displayWord(c), { compact: true })),
      h('p', { class: 'pl-meaning' }, c.meanings[0]?.translation ?? ''),
      c.noun?.plural ? h('p', { class: 'small muted', lang: learning(), dir: 'ltr' }, `die ${c.noun.plural}`) : null,
      example
        ? h(
            'div',
            { class: 'pl-listen' },
            h('small', null, s.listenLabel),
            h('div', { class: 'pl-sentence' }, h('span', { lang: learning(), dir: 'ltr' }, example.de), speakButton(ctx, example.de, { compact: true })),
            h('span', { class: 'muted' }, example.fa),
          )
        : null,
      c.notes ? h('p', { class: 'pl-tip' }, h('b', null, `${s.tip}: `), c.notes) : null,
    )
  }

  function lineRow(item: PackItem) {
    const c = item.content!
    return h(
      'li',
      { class: 'pl-line' },
      item.hint ? h('span', { class: 'chip pl-who' }, item.hint) : null,
      h('div', { class: 'pl-sentence' }, de(c.lemma, 'pl-de'), speakButton(ctx, c.lemma, { compact: true })),
      h('p', { class: 'pl-meaning' }, c.meanings[0]?.translation ?? ''),
      h(
        'dl',
        { class: 'pl-facts' },
        c.notes ? h('div', null, h('dt', null, s.whenLabel), h('dd', null, c.notes)) : null,
        c.reply ? h('div', null, h('dt', null, s.replyLabel), h('dd', { class: 'pl-reply' }, de(c.reply.de), h('span', { class: 'muted' }, c.reply.fa))) : null,
      ),
    )
  }

  function meet() {
    if (talk()) {
      const play = canHear() ? h('button', { class: 'btn', type: 'button' }, icon('speaker', { size: 18 }), s.playDialogue) : null
      if (play) play.onclick = () => void playDialogue(play)
      return [h('p', { class: 'help' }, s.meetHintTalk), play, h('ol', { class: 'pl-list' }, items.map(lineRow)), ...addBlock(true)]
    }
    const canPractise = items.filter((i) => i.content?.pos !== 'sentence').length >= 2
    return [
      h('p', { class: 'help' }, s.meetHint),
      h('ul', { class: 'pl-list' }, items.map(wordRow)),
      canPractise ? h('button', { class: 'btn primary block', type: 'button', onclick: startPractice }, icon('play', { size: 18 }), s.toPractice) : null,
      ...(inBank() >= items.length
        ? addBlock(false)
        : canPractise
          ? [h('button', { class: 'btn ghost block', type: 'button', disabled: busy, onclick: () => void add() }, s.skipPractice)]
          : addBlock(true)),
    ]
  }

  function practice() {
    const q = questions[at]!
    const answered = chosen !== null
    const prompt =
      q.kind === 'meaning'
        ? [h('div', { class: 'pl-ask' }, de(q.entry.word, 'pl-ask-word'), speakButton(ctx, q.entry.word, { compact: true })), h('p', { class: 'pl-question' }, s.qMeaning)]
        : q.kind === 'word'
          ? [h('div', { class: 'pl-ask' }, h('span', { class: 'pl-ask-word' }, q.entry.meaning)), h('p', { class: 'pl-question' }, s.qWord)]
          : [
              h('div', { class: 'pl-ask' }, h('button', { class: 'btn', type: 'button', onclick: () => void say(q.entry.word) }, icon('speaker', { size: 20 }), s.playAgain)),
              h('p', { class: 'pl-question' }, s.qListen),
            ]
    const options = q.options.map((o) => {
      const correct = o.id === q.entry.id
      const cls = !answered ? '' : correct ? 'right' : o.id === chosen ? 'wrong' : ''
      return h(
        'button',
        {
          class: `pl-option ${cls}`,
          type: 'button',
          disabled: answered,
          onclick: () => {
            chosen = o.id
            if (correct) right++
            render()
          },
        },
        q.kind === 'meaning' ? o.meaning : de(o.word),
      )
    })
    const last = at === questions.length - 1
    return [
      h('p', { class: 'help' }, s.practiceHint),
      h('p', { class: 'small muted center' }, `${num(at + 1)} / ${num(questions.length)}`),
      ...prompt,
      h('div', { class: 'pl-options' }, options),
      answered
        ? h(
            'div',
            { class: 'stack', role: 'status' },
            chosen === q.entry.id
              ? h('p', { class: 'pl-verdict good' }, s.right)
              : h('p', { class: 'pl-verdict bad' }, `${s.wrongAnswer} `, q.kind === 'meaning' ? q.entry.meaning : de(q.entry.word)),
            h(
              'button',
              {
                class: 'btn primary block',
                type: 'button',
                onclick: () => {
                  chosen = null
                  if (last) step = 'result'
                  else at++
                  render()
                  const next = questions[at]
                  if (step === 'practice' && next?.kind === 'listen') void say(next.entry.word)
                },
              },
              s.next,
            ),
          )
        : null,
    ]
  }

  function result() {
    return [
      h('div', { class: 'pl-result' }, mascot('happy', { size: 96 }), questions.length > 0 ? h('p', { class: 'pl-score' }, s.practiceDone(right, questions.length)) : null),
      ...addBlock(true),
      h('button', { class: 'btn ghost block', type: 'button', onclick: () => { step = 'meet'; render() } }, s.stepMeet),
    ]
  }

  function render() {
    const header = h('header', { class: 'topbar' }, back(), title ? h('h1', null, title) : null)
    if (loading) return replace(el, header, h('p', { class: 'muted center' }, t.common.loading))
    if (failed || !pack || items.length === 0) {
      return replace(el, header, emptyState({ art: mascot('confused', { size: 120 }), title: failed ?? s.notFound, action: h('a', { class: 'btn', href: `#/store/${id}` }, s.title) }))
    }
    replace(el, header, h('p', { class: 'small muted' }, `${pack.emoji ?? ''} ${pack.title}`), steps(), step === 'meet' ? meet() : step === 'practice' ? practice() : result())
  }

  async function load() {
    try {
      const [all, list, names] = await Promise.all([storePacks(ctx.client), packItems(ctx.client, id, { full: true }), packLessonTitles(ctx.client, id)])
      pack = all.find((x) => x.id === id) ?? null
      items = list.filter((i) => i.lesson === lesson && i.content)
      title = names?.[lesson - 1] ?? s.lesson(lesson)
    } catch (err) {
      failed = describeError(toAppError(err))
    }
    loading = false
    render()
  }

  render()
  void load()
  return {
    el,
    destroy: () => {
      playing = false
    },
  }
}
