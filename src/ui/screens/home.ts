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

const feature = (href: string, name: Parameters<typeof icon>[0], label: string, extra = '') =>
  h('a', { class: `feature ${extra}`, href }, h('span', { class: 'feature-icon' }, icon(name, { size: 24 })), h('span', null, label))

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
    // the goal also counts as reached once every card of the day is done
    const finishedToday = Boolean(today?.reviews) && next.kind === 'done'
    const goalDone = minutes >= goal || finishedToday
    const minutesShown = today?.reviews ? Math.max(1, minutes) : minutes
    const goalText = minutes >= goal ? t.home.goalDone : finishedToday ? t.home.dayDone : t.home.goalLeft(goal - minutes)
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

    const art = mascot(mood, { size: 124, enter: arrived ? 'none' : 'fly' })
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
      // the new things right under the bird, before anything needs scrolling
      h(
        'nav',
        { class: 'feature-row', 'aria-label': t.home.more },
        feature('#/store', 'bag', t.store.tile, 'store'),
        feature('#/stories', 'sparkle', t.stories.tile),
        feature('#/friends', 'users', t.friends.tile),
      ),
      // today in one card: goal, streak and the last seven days; tapping it opens the statistics
      h(
        'a',
        { class: 'card today-card', href: '#/stats', 'aria-label': t.home.todayCard },
        h(
          'div',
          { class: 'today-top' },
          h('div', { class: 'ring-holder' }, goalRing(goalDone ? 1 : minutes / goal, goalDone), h('div', { class: 'ring-center' }, goalDone ? icon('check', { size: 24 }) : h('b', null, fa(minutesShown)), goalDone ? null : h('span', null, t.home.minutesLabel))),
          h('div', { class: 'today-goal' }, h('b', null, t.home.goal), h('span', { class: 'small muted' }, goalText)),
          h(
            'div',
            { class: `streak-mini ${streak.current > 0 ? 'hot' : ''}`, title: t.home.streakDays },
            icon('flame', { size: 22, filled: streak.current > 0 }),
            h('b', { class: 'streak-number' }, streak.current > 0 ? fa(streak.current) : '–'),
            h('small', null, t.home.streakDays),
          ),
        ),
        h(
          'ol',
          { class: 'week-dots', 'aria-label': `${t.home.weekTitle}: ${t.home.weekDone(activeDays)}` },
          week.map((d) =>
            h(
              'li',
              { class: `${d.reviews > 0 ? 'on' : ''} ${d.key === todayKey ? 'today' : ''}`, title: t.home.weekReviews(d.reviews) },
              h('span', { class: 'wd' }, d.reviews > 0 ? icon('check', { size: 16 }) : null),
              h('span', { class: 'wd-label' }, faWeekday(d.date)),
            ),
          ),
        ),
        h('span', { class: 'today-more' }, streak.activeToday ? t.home.streakTodayDone : streak.current > 0 ? t.home.streakKeep : t.home.streakNone, h('span', { class: 'today-link' }, t.home.statsLink, icon('back', { size: 16 }))),
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
