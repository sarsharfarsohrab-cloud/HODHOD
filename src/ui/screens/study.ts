/** A focused flashcard session: recall first, then the answer, then one of four honest ratings. */
import { minutesStudied } from '../../core/activity.ts'
import { isDifficult, toSchedulingState } from '../../core/cards.ts'
import { nextCard, type QueueCounts } from '../../core/queue.ts'
import type { SchedulingResult } from '../../core/scheduler.ts'
import { RATINGS, type Card, type Rating, type ReviewEvent, type Word } from '../../core/types.ts'
import type { Ctx, Screen } from '../context.ts'
import { de, h, icon, replace } from '../dom.ts'
import { fa, faDuration, faPercent, faRelative } from '../format.ts'
import { mascot, reactMascot, setMascotMood, type MascotMood } from '../mascot.ts'
import { t } from '../strings.ts'
import { emptyState, iconButton, progressBar, speakButton, wordTitle } from '../widgets.ts'

/** Time on one card beyond this is treated as "walked away", not as study time. */
const MAX_CARD_MS = 120_000
/** Recalled answers in a row that earn a small cheer. */
const STREAK_CHEER = 5

interface Session {
  id: string
  answered: number
  /** Answers other than "again". */
  recalled: number
  newSeen: number
  durationMs: number
  sinceNew: number
  /** Recalled answers in a row. */
  run: number
  lastCardId: string | null
  /** The learner chose to see learning cards before they are due. */
  ahead: boolean
}

/** Everything needed to take the last answer back. */
interface LastAnswer {
  before: Card
  event: ReviewEvent
  session: Session
}

export function studyScreen(ctx: Ctx): Screen {
  const el = h('main', { class: 'screen no-nav study' })
  let session: Session = { id: crypto.randomUUID(), answered: 0, recalled: 0, newSeen: 0, durationMs: 0, sinceNew: 0, run: 0, lastCardId: null, ahead: false }
  let current: { card: Card; word: Word; shownAt: number; revealed: boolean; preview: Record<Rating, SchedulingResult> | null } | null = null
  let last: LastAnswer | null = null
  let coach: string | null = null
  let busy = false
  let waitTimer: ReturnType<typeof setTimeout> | undefined
  // One bird for the whole session, so its reactions animate instead of popping in.
  const bird = mascot('idle', { size: 52 })

  const exit = () => ctx.go('/home')
  const spoken = (word: Word) => (word.content.noun?.article ? `${word.content.noun.article} ${word.lemma}` : word.lemma)
  const speak = (word: Word) => void ctx.audio.speak(spoken(word), ctx.data.profile.activeTargetLanguage, ctx.data.settings.speechRate)

  function show(card: Card, counts: QueueCounts) {
    const word = ctx.data.wordOfCard(card)
    if (!word) return renderDone(counts) // cannot happen for active cards; fail safe rather than blank
    current = { card, word, shownAt: Date.now(), revealed: false, preview: null }
    renderCard(counts)
    // the reverse card must not say its own answer out loud
    if (ctx.data.settings.autoplayAudio && card.cardType !== 'production') speak(word)
  }

  /** True while the "nothing to review" page is up and no card has been answered. */
  let nothingYet = false

  function advance() {
    clearTimeout(waitTimer)
    nothingYet = false
    const now = ctx.now()
    const cards = ctx.data.activeCards()
    let next = nextCard(cards, { settings: ctx.data.settings, now, lastCardId: session.lastCardId, sinceNew: session.sinceNew })
    if (next.kind === 'wait' && session.ahead) {
      const learning = cards.filter((c) => c.state === 'learning' || c.state === 'relearning').sort((a, b) => a.due.localeCompare(b.due))
      const pick = learning.find((c) => c.id !== session.lastCardId) ?? learning[0]
      if (pick) next = { kind: 'card', card: pick, counts: next.counts }
    }
    if (next.kind === 'card') return show(next.card, next.counts)
    current = null
    if (next.kind === 'wait') {
      // come back by itself when the next learning card is ready
      waitTimer = setTimeout(advance, Math.max(1_000, next.until.getTime() - now.getTime()))
      return renderWait(next.counts, next.until)
    }
    renderDone(next.counts)
  }

  const countsNow = () => nextCard(ctx.data.activeCards(), { settings: ctx.data.settings, now: ctx.now() }).counts

  function topBar(counts: QueueCounts): HTMLElement {
    const total = session.answered + counts.total
    const undo = iconButton('undo', t.study.undo, () => void undoLast())
    undo.disabled = last === null
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
      undo,
    )
  }

  /** The bird and, when there is something worth saying, one short line. Never covers the card. */
  const companion = () => h('div', { class: 'companion' }, bird, coach ? h('p', { class: 'bubble', role: 'status' }, coach) : null)

  function renderCard(counts: QueueCounts) {
    if (!current) return
    const { card, word } = current
    const content = word.content
    const reverse = card.cardType === 'production'
    const many = content.meanings.length > 1
    const meaningTitle = (text: string, i: number) =>
      h('div', { class: 'meaning-title' }, many ? h('span', { class: 'meaning-index', 'aria-hidden': 'true' }, fa(i + 1)) : null, text)

    const badge = reverse
      ? h('span', { class: 'chip status-review' }, icon('swap', { size: 14 }), t.study.reverseBadge)
      : card.state === 'new'
        ? h('span', { class: 'chip status-new' }, t.study.newBadge)
        : null

    // Front: the side shown before recalling. German → Persian shows the word; the reverse card shows the meanings.
    const front = reverse
      ? h(
          'div',
          { class: 'flashcard-front' },
          badge,
          h('div', { class: 'stack', style: { gap: 'var(--s1)' } }, content.meanings.map((m, i) => meaningTitle(m.translation, i))),
          h('span', { class: 'chip' }, t.pos[content.pos]),
          current.revealed ? null : h('p', { class: 'small muted' }, t.study.reversePrompt),
        )
      : h(
          'div',
          { class: 'flashcard-front' },
          badge,
          wordTitle(content, 'div'),
          h('div', { class: 'row' }, h('span', { class: 'chip' }, t.pos[content.pos]), speakButton(ctx, spoken(word))),
          current.revealed ? null : h('p', { class: 'small muted' }, t.study.recallPrompt),
        )

    let back: HTMLElement | null = null
    let actions: HTMLElement
    if (current.revealed && current.preview) {
      const preview = current.preview
      const example = (meaning: (typeof content.meanings)[number]) => {
        const e = meaning.examples.find((x) => x.level === 'easy') ?? meaning.examples[0]
        return e ? h('div', { class: 'example' }, h('div', null, de(e.de)), speakButton(ctx, e.de, { compact: true }), h('span', { class: 'fa' }, e.fa)) : null
      }
      back = reverse
        ? h(
            'div',
            { class: 'flashcard-back' },
            h('div', { class: 'row', style: { justifyContent: 'center' } }, wordTitle(content, 'div'), speakButton(ctx, spoken(word))),
            example(content.meanings[0]!),
            h('a', { class: 'btn ghost small', href: `#/words/${word.id}` }, t.study.fullDetail),
          )
        : h(
            'div',
            { class: 'flashcard-back' },
            content.meanings.map((meaning, i) =>
              h('div', { class: 'meaning' }, meaningTitle(meaning.translation, i), meaning.note ? h('p', { class: 'small muted' }, meaning.note) : null, example(meaning)),
            ),
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

    replace(el, topBar(counts), companion(), h('article', { class: `flashcard ${current.revealed ? 'revealed' : ''} ${reverse ? 'reverse' : ''}` }, front, back), actions)
    if (current.revealed) window.scrollTo({ top: 0 })
  }

  function reveal() {
    if (!current || current.revealed) return
    current.revealed = true
    // intervals are computed at the moment of answering, from the card's real state
    current.preview = ctx.scheduler().preview(toSchedulingState(current.card), ctx.now())
    coach = null
    setMascotMood(bird, 'idle')
    renderCard(countsNow())
    if (ctx.data.settings.autoplayAudio && current.card.cardType === 'production') speak(current.word)
  }

  async function rate(rating: Rating) {
    if (!current || !current.preview || busy) return // a second tap while saving is ignored
    busy = true
    const { card, preview, shownAt } = current
    const elapsed = Math.min(MAX_CARD_MS, Date.now() - shownAt)
    const before = { ...session }
    let stored: { card: Card; event: ReviewEvent }
    try {
      stored = await ctx.data.recordReview(card, preview[rating], ctx.scheduler().version, elapsed, session.id)
    } catch {
      busy = false
      return ctx.toast(t.errors.server, 'error')
    }
    last = { before: card, event: stored.event, session: before }
    session.answered++
    session.durationMs += elapsed
    if (rating > 1) session.recalled++
    session.run = rating > 1 ? session.run + 1 : 0
    if (card.state === 'new') {
      session.newSeen++
      session.sinceNew = 0
    } else {
      session.sinceNew++
    }
    session.lastCardId = card.id

    // One short reaction, matched to what just happened.
    let mood: MascotMood
    if (rating === 1) {
      mood = 'supportive'
      coach = t.study.encourage
    } else if (rating >= 3 && isDifficult(card)) {
      mood = 'proud'
      coach = t.study.proud
    } else if (session.run > 0 && session.run % STREAK_CHEER === 0) {
      mood = 'celebrating'
      coach = t.study.streak(session.run)
    } else {
      mood = rating === 4 ? 'excited' : rating === 3 ? 'happy' : 'encouraging'
      coach = null
    }
    busy = false
    advance()
    reactMascot(bird, mood, 'idle', coach ? 2600 : 1400)
  }

  async function undoLast() {
    if (!last || busy) return
    busy = true
    const { before, event, session: previous } = last
    last = null
    try {
      await ctx.data.undoReview(event, before)
    } catch {
      busy = false
      return ctx.toast(t.errors.server, 'error')
    }
    clearTimeout(waitTimer)
    session = { ...previous, ahead: session.ahead }
    coach = t.study.undone
    busy = false
    // straight back to the card that was answered, front side up
    show(ctx.data.activeCards().find((c) => c.id === before.id) ?? before, countsNow())
    reactMascot(bird, 'encouraging', 'idle', 1800)
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
      nothingYet = true
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
      // the last answer can still be taken back from the summary
      last ? h('header', { class: 'study-top' }, h('div', { class: 'grow' }), iconButton('undo', t.study.undo, () => void undoLast())) : null,
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
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (document.querySelector('.sheet-backdrop')) return
    if (event.key === 'u' || event.key === 'U') {
      event.preventDefault()
      return void undoLast()
    }
    if (!current) return
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
    // opened while the first sync was still running: show the cards once they arrive
    onData() {
      if (nothingYet) advance()
    },
    destroy() {
      clearTimeout(waitTimer)
      document.removeEventListener('keydown', onKey)
      ctx.audio.stop()
    },
  }
}
