/** A focused flashcard session: recall first, then the answer, then one of four honest ratings. */
import { minutesStudied } from '../../core/activity.ts'
import { isDifficult, toSchedulingState } from '../../core/cards.ts'
import { nextCard, type QueueCounts } from '../../core/queue.ts'
import type { SchedulingResult } from '../../core/scheduler.ts'
import { RATINGS, type Card, type Rating, type Word } from '../../core/types.ts'
import type { Ctx, Screen } from '../context.ts'
import { de, h, icon, replace } from '../dom.ts'
import { fa, faDuration, faPercent, faRelative } from '../format.ts'
import { mascot } from '../mascot.ts'
import { t } from '../strings.ts'
import { emptyState, iconButton, progressBar, speakButton, wordTitle } from '../widgets.ts'

/** Time on one card beyond this is treated as "walked away", not as study time. */
const MAX_CARD_MS = 120_000

interface Session {
  id: string
  answered: number
  /** Answers other than "again". */
  recalled: number
  newSeen: number
  durationMs: number
  sinceNew: number
  lastCardId: string | null
  /** The learner chose to see learning cards before they are due. */
  ahead: boolean
}

export function studyScreen(ctx: Ctx): Screen {
  const el = h('main', { class: 'screen no-nav study' })
  const session: Session = { id: crypto.randomUUID(), answered: 0, recalled: 0, newSeen: 0, durationMs: 0, sinceNew: 0, lastCardId: null, ahead: false }
  let current: { card: Card; word: Word; shownAt: number; revealed: boolean; preview: Record<Rating, SchedulingResult> | null } | null = null
  let coach: string | null = null
  let busy = false
  let waitTimer: ReturnType<typeof setTimeout> | undefined

  const exit = () => ctx.go('/home')

  function advance() {
    clearTimeout(waitTimer)
    const now = ctx.now()
    const cards = ctx.data.activeCards()
    let next = nextCard(cards, { settings: ctx.data.settings, now, lastCardId: session.lastCardId, sinceNew: session.sinceNew })
    if (next.kind === 'wait' && session.ahead) {
      const learning = cards.filter((c) => c.state === 'learning' || c.state === 'relearning').sort((a, b) => a.due.localeCompare(b.due))
      const pick = learning.find((c) => c.id !== session.lastCardId) ?? learning[0]
      if (pick) next = { kind: 'card', card: pick, counts: next.counts }
    }
    if (next.kind === 'card') {
      const word = ctx.data.wordOfCard(next.card)
      if (!word) return renderDone(next.counts) // cannot happen for active cards; fail safe rather than blank
      current = { card: next.card, word, shownAt: Date.now(), revealed: false, preview: null }
      renderCard(next.counts)
      if (ctx.data.settings.autoplayAudio) void ctx.audio.speak(spoken(word), ctx.data.profile.activeTargetLanguage, ctx.data.settings.speechRate)
      return
    }
    current = null
    if (next.kind === 'wait') {
      // come back by itself when the next learning card is ready
      waitTimer = setTimeout(advance, Math.max(1_000, next.until.getTime() - now.getTime()))
      return renderWait(next.counts, next.until)
    }
    renderDone(next.counts)
  }

  const spoken = (word: Word) => (word.content.noun?.article ? `${word.content.noun.article} ${word.lemma}` : word.lemma)

  function topBar(counts: QueueCounts): HTMLElement {
    const total = session.answered + counts.total
    return h(
      'header',
      { class: 'study-top' },
      iconButton('close', t.study.exit, exit),
      h('div', { class: 'grow' }, progressBar(total === 0 ? 1 : session.answered / total, t.study.remaining(counts.total))),
      h(
        'div',
        { class: 'study-counts', 'aria-label': t.study.remaining(counts.total) },
        h('span', { class: 'count-new', title: t.home.newCards }, fa(counts.newCards)),
        h('span', { class: 'count-learning', title: t.home.learning }, fa(counts.learning)),
        h('span', { class: 'count-review', title: t.home.reviews }, fa(counts.reviews)),
      ),
    )
  }

  function renderCard(counts: QueueCounts) {
    if (!current) return
    const { card, word } = current
    const content = word.content
    const isNew = card.state === 'new'

    const front = h(
      'div',
      { class: 'flashcard-front' },
      isNew ? h('span', { class: 'chip status-new' }, t.study.newBadge) : null,
      wordTitle(content, 'div'),
      h('div', { class: 'row' }, h('span', { class: 'chip' }, t.pos[content.pos]), speakButton(ctx, spoken(word))),
      current.revealed ? null : h('p', { class: 'small muted' }, t.study.recallPrompt),
    )

    let back: HTMLElement | null = null
    let actions: HTMLElement
    if (current.revealed && current.preview) {
      const preview = current.preview
      const many = content.meanings.length > 1
      back = h(
        'div',
        { class: 'flashcard-back' },
        content.meanings.map((meaning, i) => {
          const example = meaning.examples.find((e) => e.level === 'easy') ?? meaning.examples[0]
          return h(
            'div',
            { class: 'meaning' },
            h('div', { class: 'meaning-title' }, many ? h('span', { class: 'meaning-index', 'aria-hidden': 'true' }, fa(i + 1)) : null, meaning.translation),
            meaning.note ? h('p', { class: 'small muted' }, meaning.note) : null,
            example ? h('div', { class: 'example' }, h('div', null, de(example.de)), speakButton(ctx, example.de, { compact: true }), h('span', { class: 'fa' }, example.fa)) : null,
          )
        }),
        h('a', { class: 'btn ghost small', href: `#/words/${word.id}` }, t.study.fullDetail),
      )
      actions = h(
        'div',
        { class: 'stack' },
        h(
          'div',
          { class: 'ratings', role: 'group', 'aria-label': t.study.ratingGuide },
          RATINGS.map((rating) =>
            h(
              'button',
              { class: `rating rating-${rating}`, type: 'button', title: t.study.ratingHelp[rating], 'aria-label': `${t.study.ratings[rating]} — ${t.study.ratingHelp[rating]} — ${faDuration(preview[rating].intervalMs)}`, onclick: () => void rate(rating) },
              h('b', null, t.study.ratings[rating]),
              h('span', null, faDuration(preview[rating].intervalMs)),
            ),
          ),
        ),
        h(
          'details',
          { class: 'fold small' },
          h('summary', { class: 'muted' }, t.study.ratingGuide, icon('chevron', { size: 18 })),
          h('dl', { class: 'facts', style: { paddingBottom: 'var(--s3)' } }, RATINGS.flatMap((rating) => [h('dt', null, t.study.ratings[rating]), h('dd', { style: { fontWeight: '400' } }, t.study.ratingHelp[rating])])),
        ),
      )
    } else {
      actions = h('button', { class: 'btn accent big block', type: 'button', onclick: reveal }, t.study.showAnswer)
    }

    replace(
      el,
      topBar(counts),
      coach ? h('p', { class: 'notice', role: 'status' }, coach) : null,
      h('article', { class: `flashcard ${current.revealed ? 'revealed' : ''}` }, front, back),
      actions,
    )
    if (current.revealed) window.scrollTo({ top: 0 })
  }

  function reveal() {
    if (!current || current.revealed) return
    current.revealed = true
    // intervals are computed at the moment of answering, from the card's real state
    current.preview = ctx.scheduler().preview(toSchedulingState(current.card), ctx.now())
    coach = null
    renderCard(nextCountsNow())
  }

  const nextCountsNow = () => nextCard(ctx.data.activeCards(), { settings: ctx.data.settings, now: ctx.now() }).counts

  async function rate(rating: Rating) {
    if (!current || !current.preview || busy) return // a second tap while saving is ignored
    busy = true
    const { card, preview, shownAt } = current
    const elapsed = Math.min(MAX_CARD_MS, Date.now() - shownAt)
    try {
      await ctx.data.recordReview(card, preview[rating], ctx.scheduler().version, elapsed, session.id)
    } catch {
      busy = false
      return ctx.toast(t.errors.server, 'error')
    }
    session.answered++
    session.durationMs += elapsed
    if (rating > 1) session.recalled++
    if (card.state === 'new') {
      session.newSeen++
      session.sinceNew = 0
    } else {
      session.sinceNew++
    }
    session.lastCardId = card.id
    coach = rating === 1 ? t.study.encourage : rating >= 3 && isDifficult(card) ? t.study.proud : null
    busy = false
    advance()
  }

  function renderWait(counts: QueueCounts, until: Date) {
    replace(
      el,
      topBar(counts),
      emptyState({
        art: mascot('sleepy', { size: 132 }),
        title: t.study.waitTitle,
        body: t.study.waitBody(counts.learning, faRelative(until.toISOString(), ctx.now())),
        action: h(
          'div',
          { class: 'stack', style: { width: '100%', maxWidth: '320px' } },
          h('button', { class: 'btn primary big block', type: 'button', onclick: () => { session.ahead = true; advance() } }, t.study.waitNow),
          h('button', { class: 'btn block', type: 'button', onclick: exit }, t.study.doneHome),
        ),
      }),
    )
  }

  function renderDone(counts: QueueCounts) {
    if (session.answered === 0) {
      const hasWords = ctx.data.words.size > 0
      return replace(
        el,
        h('header', { class: 'study-top' }, iconButton('close', t.study.exit, exit), h('div', { class: 'grow' })),
        emptyState({
          art: mascot(hasWords ? 'happy' : 'idle', { size: 132 }),
          title: hasWords ? t.study.emptyTitle : t.study.emptyNoWords,
          body: counts.newWaiting > 0 ? t.home.newWaiting(counts.newWaiting) : t.study.emptyBody,
          action: h('a', { class: 'btn primary', href: '#/create' }, icon('plus'), t.home.addWord),
        }),
      )
    }
    const goalDone = minutesStudied(ctx.data.today()) >= ctx.data.settings.dailyGoalMinutes
    const stat = (value: string, label: string) => h('div', { class: 'plan-number' }, h('b', null, value), h('span', null, label))
    replace(
      el,
      emptyState({
        art: mascot('celebrating', { size: 148 }),
        title: t.study.doneTitle,
        body: goalDone ? t.study.doneGoal : undefined,
        action: h(
          'div',
          { class: 'stack', style: { width: '100%', alignItems: 'stretch' } },
          h(
            'div',
            { class: 'summary-grid' },
            stat(fa(session.answered), t.study.doneCards),
            stat(faPercent(session.recalled / session.answered), t.study.doneCorrect),
            stat(t.study.doneDuration(session.durationMs), t.study.doneTime),
            stat(fa(session.newSeen), t.study.doneNew),
          ),
          h('button', { class: 'btn primary big block', type: 'button', 'data-autofocus': '', onclick: exit }, t.study.doneHome),
        ),
      }),
    )
  }

  const onKey = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || !current) return
    if (document.querySelector('.sheet-backdrop')) return
    if (!current.revealed && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault()
      reveal()
    } else if (current.revealed && ['1', '2', '3', '4'].includes(event.key)) {
      event.preventDefault()
      void rate(Number(event.key) as Rating)
    }
  }
  document.addEventListener('keydown', onKey)

  advance()
  return {
    el,
    nav: false,
    destroy() {
      clearTimeout(waitTimer)
      document.removeEventListener('keydown', onKey)
      ctx.audio.stop()
    },
  }
}
