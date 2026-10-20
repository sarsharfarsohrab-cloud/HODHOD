import { computeStreak, minutesStudied } from '../../core/activity.ts'
import { averageSecondsPerAnswer, estimateMinutes, nextCard, queueCounts } from '../../core/queue.ts'
import { dayKey, shiftDayKey } from '../../core/time.ts'
import type { Ctx, Screen } from '../context.ts'
import { h, icon, replace, svg } from '../dom.ts'
import { fa, faRelative, faWeekday } from '../format.ts'
import { celebrateStreak, pendingMilestone } from '../celebrate.ts'
import { burst, mascot, reactMascot, type MascotMood } from '../mascot.ts'
import { announcements, type Announcement } from '../../data/platform.ts'
import { t } from '../strings.ts'
import { iconButton } from '../widgets.ts'

/** The bird flies in the first time the home screen is shown in a session, not on every visit. */
let arrived = false

const NEWS_KEY = 'hodhod.news.seen'
let newsRequest: Promise<Announcement[]> | null = null

function seenNews(): string[] {
  try {
    return JSON.parse(localStorage.getItem(NEWS_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function dismissNews(id: string): void {
  try {
    localStorage.setItem(NEWS_KEY, JSON.stringify([id, ...seenNews()].slice(0, 30)))
  } catch {
    // storage blocked: the card simply comes back next time
  }
}

/** Asked once per app start; nothing is shown when the server has no announcements table yet. */
async function latestNews(ctx: Ctx): Promise<Announcement | null> {
  newsRequest ??= announcements(ctx.client).catch(() => [])
  const seen = new Set(seenNews())
  return (await newsRequest).find((a) => !seen.has(a.id)) ?? null
}

/** A ring that fills up with today's minutes. */
function goalRing(ratio: number, done: boolean): SVGSVGElement {
  const r = 46
  const c = 2 * Math.PI * r
  const filled = Math.max(0, Math.min(1, ratio))
  return svg(
    `<circle cx="60" cy="60" r="${r}" class="ring-track"/>` +
      `<circle cx="60" cy="60" r="${r}" class="ring-fill ${done ? 'done' : ''}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - filled)}" transform="rotate(-90 60 60)"/>`,
    { viewBox: '0 0 120 120', class: 'ring', 'aria-hidden': 'true' },
  )
}

export function homeScreen(ctx: Ctx): Screen {
  const el = h('main', { class: 'screen wide home' })

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
    const hour = now.getHours()

    // What is most useful right now decides the main button and what Hodhod says.
    let mood: MascotMood = 'idle'
    let line = m.idle
    let action: HTMLElement
    let plan: HTMLElement | null = null
    const study = (label: string) => h('a', { class: 'btn primary big block', href: '#/study' }, icon('cards'), label)
    if (!hasWords) {
      mood = 'morning'
      line = m.first
      action = h('a', { class: 'btn primary big block', href: '#/create' }, icon('plus'), t.home.addFirst)
    } else if (next.kind === 'card') {
      const morning = hour >= 4 && hour < 11 && !today
      mood = goalDone ? 'proud' : morning ? 'morning' : today ? 'encouraging' : 'card'
      line = goalDone ? m.goalDone : morning ? m.morning : today ? m.back : m.due
      const label = counts.reviews + counts.learning > 0 ? (today ? t.home.startReview : t.home.startMixed) : t.home.startNew
      action = study(label)
      plan = h(
        'p',
        { class: 'perch-plan' },
        counts.newCards > 0 ? [h('b', { class: 'count-new' }, fa(counts.newCards)), ` ${t.home.newCards}، `] : null,
        counts.reviews + counts.learning > 0 ? [h('b', { class: 'count-review' }, fa(counts.reviews + counts.learning)), ` ${t.home.reviews}، `] : null,
        t.home.planMinutes(estimate),
      )
    } else if (next.kind === 'wait') {
      mood = 'waiting'
      line = t.home.waitingLater(faRelative(next.until.toISOString(), now))
      action = h('a', { class: 'btn big block on-dark', href: '#/study' }, icon('clock'), t.study.waitNow)
    } else {
      mood = today ? (goalDone ? 'trophy' : 'celebrating') : hour >= 21 || hour < 4 ? 'sleepy' : 'idle'
      line = today ? (goalDone ? m.goalDone : m.allDone) : m.idle
      action = h('a', { class: 'btn big block on-dark', href: '#/create' }, icon('plus'), t.home.addWord)
    }

    const art = mascot(mood, { size: 150, enter: arrived ? 'none' : 'fly' })
    arrived = true
    const bird = h(
      'button',
      {
        class: 'mascot-button',
        type: 'button',
        'aria-label': 'هدهد',
        onclick: () => {
          reactMascot(art, 'happy', mood, 1500)
          burst(art, 'hearts', 7)
        },
      },
      art,
    )

    const todayKey = dayKey(now)
    const week = Array.from({ length: 7 }, (_, i) => {
      const key = shiftDayKey(todayKey, i - 6)
      const [y, mo, d] = key.split('-').map(Number) as [number, number, number]
      return { key, reviews: data.activity.get(key)?.reviews ?? 0, date: new Date(y, mo - 1, d, 12) }
    })
    const activeDays = week.filter((d) => d.reviews > 0).length

    replace(
      el,
      newsCard(),
      // the perch: the bird sits on an ink-blue panel striped like its own wing
      h(
        'section',
        { class: 'perch' },
        h(
          'div',
          { class: 'perch-top' },
          h('h1', null, t.home.greeting(hour, data.profile.displayName)),
          iconButton('settings', t.nav.settings, () => ctx.go('/settings'), 'on-dark'),
        ),
        h('div', { class: 'perch-bird' }, bird, h('p', { class: 'bubble cream' }, line)),
        h(
          'div',
          { class: 'perch-action' },
          action,
          plan,
          hasWords && next.kind === 'done' ? h('p', { class: 'perch-plan' }, today ? t.home.allDoneBody : t.home.nothingDue) : null,
          counts.newWaiting > 0 ? h('p', { class: 'perch-plan soft' }, t.home.newWaiting(counts.newWaiting)) : null,
        ),
        h('span', { class: 'perch-stripes', 'aria-hidden': 'true' }),
      ),
      h(
        'div',
        { class: 'home-grid' },
        h(
          'section',
          { class: 'card goal-card', 'aria-label': t.home.goal },
          h('div', { class: 'ring-holder' }, goalRing(minutes / goal, goalDone), h('div', { class: 'ring-center' }, h('b', null, fa(minutes)), h('span', null, t.home.minutesLabel))),
          h('div', { class: 'stack', style: { gap: 'var(--s1)' } }, h('h2', null, t.home.goal), h('p', { class: 'small muted' }, goalDone ? t.home.goalDone : t.home.goalLeft(goal - minutes))),
        ),
        h(
          'section',
          { class: `card streak-card ${streak.current > 0 ? 'hot' : ''}`, 'aria-label': t.home.streakDays },
          h('span', { class: 'flame', 'aria-hidden': 'true' }, icon('flame', { size: 34, filled: streak.current > 0 })),
          h('div', { class: 'stack', style: { gap: '0' } }, h('b', { class: 'big-number' }, fa(streak.current)), h('span', { class: 'small' }, t.home.streakDays)),
          h('p', { class: 'small muted streak-note' }, streak.activeToday ? t.home.streakTodayDone : streak.current > 0 ? t.home.streakKeep : t.home.streakNone),
        ),
        h(
          'section',
          { class: 'card week-card' },
          h('div', { class: 'row spread' }, h('h2', null, t.home.weekTitle), h('span', { class: 'small muted' }, t.home.weekDone(activeDays))),
          h(
            'ol',
            { class: 'week-dots' },
            week.map((d) =>
              h(
                'li',
                { class: `${d.reviews > 0 ? 'on' : ''} ${d.key === todayKey ? 'today' : ''}`, title: t.home.weekReviews(d.reviews) },
                h('span', { class: 'wd' }, d.reviews > 0 ? icon('check', { size: 16 }) : null),
                h('span', { class: 'wd-label' }, faWeekday(d.date)),
              ),
            ),
          ),
        ),
        h(
          'nav',
          { class: 'home-tiles', 'aria-label': t.home.bank },
          h('a', { class: 'tile-link', href: '#/stats' }, h('span', { class: 'tile-icon' }, icon('chart')), h('span', null, h('b', null, t.nav.stats), h('small', null, t.home.statsHint))),
          h('a', { class: 'tile-link', href: '#/words' }, h('span', { class: 'tile-icon' }, icon('book')), h('span', null, h('b', null, t.home.bank), h('small', null, t.home.bankCount(data.words.size)))),
          h('a', { class: 'tile-link store-tile', href: '#/store' }, h('span', { class: 'tile-icon' }, icon('bag')), h('span', null, h('b', null, t.store.tile), h('small', null, t.store.tileHint))),
        ),
      ),
    )
  }

  // the newest announcement from the team, shown until it is dismissed
  let news: Announcement | null = null
  const newsCard = () =>
    news
      ? h(
          'section',
          { class: 'card news-card', role: 'status' },
          h('span', { class: 'tile-icon' }, icon('bell')),
          h('div', { class: 'grow stack', style: { gap: 'var(--s1)' } }, h('b', null, news.title), news.body ? h('p', { class: 'small' }, news.body) : null),
          h('button', { class: 'btn ghost small', type: 'button', onclick: () => { dismissNews(news!.id); news = null; render() } }, t.news.dismiss),
        )
      : null
  void latestNews(ctx).then((item) => {
    news = item
    if (news) render()
  })

  render()
  // a milestone reached on another device (or before the summary was seen) is celebrated here
  const milestone = pendingMilestone(ctx)
  if (milestone) void celebrateStreak(milestone)
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
