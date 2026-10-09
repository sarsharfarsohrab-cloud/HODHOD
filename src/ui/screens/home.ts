import { computeStreak, minutesStudied } from '../../core/activity.ts'
import { averageSecondsPerAnswer, estimateMinutes, nextCard, queueCounts } from '../../core/queue.ts'
import { dayKey, shiftDayKey } from '../../core/time.ts'
import type { Ctx, Screen } from '../context.ts'
import { h, icon, replace } from '../dom.ts'
import { fa, faRelative, faWeekday } from '../format.ts'
import { mascot, type MascotMood } from '../mascot.ts'
import { t } from '../strings.ts'
import { iconButton, progressBar } from '../widgets.ts'

export function homeScreen(ctx: Ctx): Screen {
  const el = h('main', { class: 'screen wide' })

  const render = () => {
    const { data } = ctx
    const now = ctx.now()
    const cards = data.activeCards()
    const options = { settings: data.settings, now }
    const counts = queueCounts(cards, options)
    const next = nextCard(cards, options)
    const today = data.today()
    const streak = computeStreak(data.activity, now)
    const minutes = minutesStudied(today)
    const goal = data.settings.dailyGoalMinutes
    const goalDone = minutes >= goal
    const estimate = estimateMinutes(counts, averageSecondsPerAnswer(data.activity.values()))
    const hasWords = data.words.size > 0
    const m = t.home.mascot

    // What is most useful right now decides the main button and what Hodhod says.
    let mood: MascotMood = 'idle'
    let line = m.idle
    let action: HTMLElement
    const study = (label: string) => h('a', { class: 'btn primary big block', href: '#/study' }, icon('cards'), label)
    if (!hasWords) {
      mood = 'happy'
      line = m.first
      action = h('a', { class: 'btn primary big block', href: '#/create' }, icon('plus'), t.home.addFirst)
    } else if (next.kind === 'card') {
      mood = goalDone ? 'proud' : 'encouraging'
      line = goalDone ? m.goalDone : today ? m.back : m.due
      const label = counts.reviews + counts.learning > 0 ? (today ? t.home.startReview : t.home.startMixed) : t.home.startNew
      action = study(label)
    } else if (next.kind === 'wait') {
      mood = 'sleepy'
      line = t.home.waitingLater(faRelative(next.until.toISOString(), now))
      action = h('a', { class: 'btn big block', href: '#/study' }, icon('clock'), t.study.waitNow)
    } else {
      mood = today ? 'celebrating' : 'idle'
      line = today ? (goalDone ? m.goalDone : m.allDone) : m.idle
      action = h('a', { class: 'btn big block', href: '#/create' }, icon('plus'), t.home.addWord)
    }

    const todayKey = dayKey(now)
    const week = Array.from({ length: 7 }, (_, i) => {
      const key = shiftDayKey(todayKey, i - 6)
      const [y, mo, d] = key.split('-').map(Number) as [number, number, number]
      return { key, reviews: data.activity.get(key)?.reviews ?? 0, date: new Date(y, mo - 1, d, 12) }
    })
    const peak = Math.max(1, ...week.map((d) => d.reviews))

    replace(
      el,
      h(
        'header',
        { class: 'topbar' },
        h('h1', null, t.home.greeting(now.getHours(), data.profile.displayName)),
        iconButton('settings', t.nav.settings, () => ctx.go('/settings')),
      ),
      h('div', { class: 'hello' }, mascot(mood, { size: 92 }), h('p', { class: 'bubble' }, line)),
      h(
        'div',
        { class: 'cols' },
        h(
          'div',
          { class: 'col' },
          h(
            'section',
            { class: 'card' },
            h(
              'div',
              { class: 'row spread', style: { marginBottom: 'var(--s3)' } },
              h('h2', { style: { margin: '0' } }, t.home.today),
              h(
                'span',
                { class: `streak ${streak.current > 0 ? '' : 'cold'}`, title: streak.activeToday || streak.current === 0 ? '' : t.home.streakKeep },
                icon('flame', { size: 18, filled: streak.activeToday }),
                streak.current > 0 ? t.home.streak(streak.current) : t.home.streakNone,
              ),
            ),
            hasWords
              ? h(
                  'div',
                  { class: 'plan-numbers' },
                  h('div', { class: 'plan-number' }, h('b', { class: 'count-new' }, fa(counts.newCards)), h('span', null, t.home.newCards)),
                  h('div', { class: 'plan-number' }, h('b', { class: 'count-review' }, fa(counts.reviews + counts.learning)), h('span', null, t.home.reviews)),
                  h('div', { class: 'plan-number' }, h('b', null, counts.total > 0 ? `≈ ${fa(estimate)}` : '—'), h('span', null, t.home.minutesLabel)),
                )
              : h('p', { class: 'muted', style: { margin: '0 0 var(--s4)' } }, t.words.emptyBody),
            action,
            hasWords && next.kind === 'done' ? h('p', { class: 'small muted', style: { marginTop: 'var(--s3)' } }, today ? t.home.allDoneBody : t.home.nothingDue) : null,
            counts.newWaiting > 0 ? h('p', { class: 'small muted', style: { marginTop: 'var(--s3)' } }, t.home.newWaiting(counts.newWaiting)) : null,
          ),
          h(
            'section',
            { class: 'card stack' },
            h('div', { class: 'row spread' }, h('h2', null, t.home.goal), h('span', { class: 'small muted' }, goalDone ? t.home.goalDone : t.home.goalProgress(minutes, goal))),
            progressBar(minutes / goal, t.home.goal),
          ),
        ),
        h(
          'div',
          { class: 'col' },
          h(
            'section',
            { class: 'card stack' },
            h('div', { class: 'row spread' }, h('h2', null, t.home.week), h('span', { class: 'small muted' }, t.home.weekReviews(week.reduce((sum, d) => sum + d.reviews, 0)))),
            h(
              'div',
              { class: 'week' },
              week.map((d) =>
                h(
                  'div',
                  { class: `week-day ${d.reviews > 0 ? 'active' : ''} ${d.key === todayKey ? 'today' : ''}`, title: t.home.weekReviews(d.reviews) },
                  h('div', { class: 'week-bar', style: { height: `${d.reviews > 0 ? Math.max(14, (d.reviews / peak) * 100) : 0}%` } }),
                  faWeekday(d.date),
                ),
              ),
            ),
          ),
          h(
            'a',
            { class: 'card tile', href: '#/words' },
            h('div', { class: 'row' }, icon('book'), h('div', null, h('h2', null, t.home.bank), h('span', { class: 'small muted' }, t.home.bankCount(data.words.size)))),
            h('span', { style: { transform: 'scaleX(-1)', display: 'grid' } }, icon('back', { size: 20 })),
          ),
        ),
      ),
    )
  }

  render()
  // counts depend on the clock (cards come due, the day rolls over): refresh when the app is looked at again
  const onVisible = () => document.visibilityState === 'visible' && render()
  document.addEventListener('visibilitychange', onVisible)
  const timer = setInterval(render, 60_000)
  return {
    el,
    onData: render,
    destroy() {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    },
  }
}
