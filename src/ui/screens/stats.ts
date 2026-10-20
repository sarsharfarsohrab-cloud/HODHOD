/** Statistics: what has been learned, how steadily, and what is coming. */
import type { WordStatus } from '../../core/cards.ts'
import { computeStats, type PeriodStats, type Stats } from '../../core/stats.ts'
import type { Ctx, Screen } from '../context.ts'
import { de, h, icon, replace } from '../dom.ts'
import { fa, faPercent } from '../format.ts'
import { mascot, type MascotMood } from '../mascot.ts'
import { t } from '../strings.ts'
import { emptyState, segmented, wordTitle } from '../widgets.ts'

type Period = 'today' | 'week' | 'month'
const STATUSES: WordStatus[] = ['new', 'learning', 'review', 'mastered']
const dayLabel = new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { day: 'numeric', month: 'long' })
const shortDay = new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { day: 'numeric' })

const dateOfKey = (key: string) => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Date(y, m - 1, d, 12)
}

interface Column {
  /** Full description shown when the column is pointed at, focused or tapped. */
  label: string
  /** Short axis label; only some columns carry one. */
  tick?: string
  value: number
}

/**
 * A single-series column chart. Thin columns on one baseline; the value of a column
 * appears in the caption when it is hovered, focused or tapped, so the chart works
 * with a finger, a mouse and a keyboard alike. The peak is labelled directly.
 */
function columnChart(columns: Column[], options: { summary: string; idle: string }): HTMLElement {
  const peak = Math.max(1, ...columns.map((c) => c.value))
  const caption = h('p', { class: 'chart-caption', 'aria-live': 'polite' }, options.idle)
  const peakIndex = columns.findIndex((c) => c.value === peak)
  const plot = h(
    'div',
    { class: 'chart-columns', role: 'group', 'aria-label': options.summary, onpointerleave: () => (caption.textContent = options.idle) },
    columns.map((column, i) => {
      const show = () => (caption.textContent = column.label)
      return h(
        'button',
        { class: 'chart-col', type: 'button', 'aria-label': column.label, onpointerenter: show, onfocus: show, onclick: show, onblur: () => (caption.textContent = options.idle) },
        // the label hangs above its bar, so labelled and unlabelled bars share one scale
        h(
          'span',
          { class: 'chart-bar', style: { height: column.value > 0 ? `max(4px, ${(column.value / peak) * 100}%)` : '0' } },
          i === peakIndex && column.value > 0 ? h('span', { class: 'chart-peak' }, fa(column.value)) : null,
        ),
      )
    }),
  )
  const ticks = h('div', { class: 'chart-ticks', 'aria-hidden': 'true' }, columns.map((column) => h('span', null, column.tick ?? '')))
  return h('div', { class: 'chart' }, caption, plot, ticks)
}

export function statsScreen(ctx: Ctx): Screen {
  const el = h('main', { class: 'screen wide' })
  let period: Period = 'week'

  const tile = (value: string, label: string) => h('div', { class: 'plan-number' }, h('b', null, value), h('span', null, label))

  const periodTiles = (p: PeriodStats) =>
    h(
      'div',
      { class: 'summary-grid four' },
      tile(fa(p.reviews), t.stats.reviews),
      tile(fa(p.minutes), t.stats.minutes),
      tile(fa(p.newCards), t.stats.newWords),
      tile(p.retention === null ? '—' : faPercent(p.retention), t.stats.retention),
    )

  function insight(stats: Stats): { mood: MascotMood; line: string } {
    if (stats.month.reviews === 0) return { mood: 'idle', line: t.stats.insightStart }
    if (stats.streak.current >= 3) return { mood: 'proud', line: t.stats.insightStreak(stats.streak.current) }
    if (stats.month.retention !== null && stats.month.retention >= 0.8) return { mood: 'happy', line: t.stats.insightRetention(faPercent(stats.month.retention)) }
    if (stats.byStatus.mastered > 0) return { mood: 'happy', line: t.stats.insightMastered(stats.byStatus.mastered) }
    return { mood: 'encouraging', line: t.stats.insightStart }
  }

  function render() {
    const { data } = ctx
    const back = h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.common.back, onclick: () => ctx.go('/home') }, icon('back'))
    if (data.words.size === 0) {
      return replace(
        el,
        h('header', { class: 'topbar' }, back, h('h1', null, t.stats.title)),
        emptyState({ art: mascot('idle', { size: 132 }), title: t.stats.empty, action: h('a', { class: 'btn primary', href: '#/create' }, icon('plus'), t.home.addWord) }),
      )
    }
    const stats = computeStats({ words: data.words.values(), cards: data.cards, activeCards: data.activeCards(), activity: data.activity, quizStats: data.quizStats, now: ctx.now() })
    const say = insight(stats)
    const total = Math.max(1, stats.totalWords)
    const tilesHost = h('div', null, periodTiles(stats[period]))

    const today = ctx.now()
    const forecastColumns: Column[] = stats.forecast.map((count, i) => {
      const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i, 12)
      return {
        label: t.stats.perDay(i === 0 ? t.stats.forecastToday : dayLabel.format(date), count),
        tick: i === 0 ? t.stats.forecastToday : i % 2 === 0 ? shortDay.format(date) : undefined,
        value: count,
      }
    })
    const levelPeak = Math.max(1, ...stats.byCefr.map((l) => l.count))
    const week = stats.week

    // the last five weeks as a calendar, today last; deeper saffron for busier days
    const heat = stats.daily.slice(-35)
    const heatLevel = (n: number) => (n === 0 ? 0 : n < 10 ? 1 : n < 30 ? 2 : n < 60 ? 3 : 4)

    replace(
      el,
      h('header', { class: 'topbar' }, back, h('h1', null, t.stats.title)),
      h('section', { class: 'perch slim' }, h('div', { class: 'perch-bird' }, mascot(say.mood, { size: 120 }), h('p', { class: 'bubble cream' }, say.line)), h('span', { class: 'perch-stripes', 'aria-hidden': 'true' })),
      h(
        'div',
        { class: 'cols' },
        h(
          'div',
          { class: 'col' },
          // this week, said in words
          h(
            'section',
            { class: 'card stack' },
            h('h2', null, t.stats.weekTitle),
            week.reviews === 0
              ? h('p', { class: 'muted' }, t.stats.weekNone)
              : h(
                  'ul',
                  { class: 'said' },
                  h('li', null, h('b', null, fa(week.reviews)), h('span', null, t.stats.saidReviews(week.minutes))),
                  h('li', null, h('b', null, fa(week.newCards)), h('span', null, t.stats.saidNew)),
                  week.retention !== null ? h('li', null, h('b', null, faPercent(week.retention)), h('span', null, t.stats.saidRetention)) : null,
                  h('li', null, h('b', null, fa(week.activeDays)), h('span', null, t.stats.saidDays)),
                ),
            segmented<Period>(
              [{ value: 'today', label: t.stats.today }, { value: 'week', label: t.stats.week }, { value: 'month', label: t.stats.month }],
              period,
              (value) => {
                period = value
                replace(tilesHost, periodTiles(stats[period]))
              },
              t.stats.periodTitle,
            ),
            tilesHost,
          ),
          // where the words are on their way into long-term memory
          h(
            'section',
            { class: 'card stack' },
            h('div', { class: 'row spread' }, h('h2', null, t.stats.journey), h('span', { class: 'small muted' }, t.stats.wordsTotal(stats.totalWords))),
            h(
              'ol',
              { class: 'journey', 'aria-label': STATUSES.map((st) => `${t.status[st]}: ${fa(stats.byStatus[st])}`).join('، ') },
              STATUSES.map((st) =>
                h(
                  'li',
                  { class: `station st-${st}` },
                  h('span', { class: 'station-dot', style: { '--size': `${28 + Math.round((stats.byStatus[st] / total) * 26)}px` } }, fa(stats.byStatus[st])),
                  h('span', { class: 'station-name' }, t.status[st]),
                ),
              ),
            ),
            h('p', { class: 'help' }, t.stats.journeyHelp),
          ),
          h(
            'section',
            { class: 'card stack' },
            h('h2', null, t.stats.difficult),
            stats.difficult.length
              ? h(
                  'ul',
                  { class: 'word-list flat' },
                  stats.difficult.map(({ word, lapses }) =>
                    h('li', { class: 'word-row' }, h('a', { href: `#/words/${word.id}` }, wordTitle(word.content, 'span', 'de'), h('span', { class: 'meaning-line' }, `${word.primaryMeaning}، ${t.stats.lapses(lapses)}`))),
                  ),
                )
              : h('p', { class: 'muted' }, t.stats.difficultNone),
          ),
        ),
        h(
          'div',
          { class: 'col' },
          h(
            'section',
            { class: 'card stack' },
            h('div', { class: 'row spread' }, h('h2', null, t.stats.calendar), h('span', { class: 'small muted' }, t.stats.streakLine(stats.streak.current, stats.streak.longest))),
            h(
              'ol',
              { class: 'heat', 'aria-label': t.stats.calendar },
              heat.map((day, i) =>
                h('li', {
                  class: `heat-${heatLevel(day.reviews)} ${i === heat.length - 1 ? 'today' : ''}`,
                  title: t.stats.perDay(dayLabel.format(dateOfKey(day.key)), day.reviews),
                }),
              ),
            ),
            h('div', { class: 'heat-legend small muted' }, h('span', null, t.stats.less), [0, 1, 2, 3, 4].map((n) => h('i', { class: `heat-${n}` })), h('span', null, t.stats.more)),
          ),
          h(
            'section',
            { class: 'card stack' },
            h('h2', null, t.stats.forecast),
            stats.forecast.some((n) => n > 0) ? columnChart(forecastColumns, { summary: t.stats.forecast, idle: t.stats.forecastHelp }) : h('p', { class: 'muted' }, t.stats.forecastNone),
          ),
          stats.byCefr.length
            ? h(
                'section',
                { class: 'card stack' },
                h('h2', null, t.stats.levels),
                h(
                  'ul',
                  { class: 'hbars' },
                  stats.byCefr.map((level) =>
                    h(
                      'li',
                      null,
                      level.level ? de(level.level, 'hbar-label') : h('span', { class: 'hbar-label' }, t.stats.noLevel),
                      h('span', { class: 'hbar-track' }, h('span', { class: 'hbar-fill', style: { width: `${(level.count / levelPeak) * 100}%` } })),
                      h('b', null, fa(level.count)),
                    ),
                  ),
                ),
              )
            : null,
          h(
            'section',
            { class: 'card stack' },
            h('h2', null, t.stats.quiz),
            stats.quiz.accuracy === null
              ? h('div', { class: 'row spread wrap' }, h('p', { class: 'muted' }, t.stats.quizNone), h('a', { class: 'btn small', href: '#/quiz' }, t.quiz.start))
              : h('div', { class: 'summary-grid' }, tile(faPercent(stats.quiz.accuracy), t.quiz.accuracyLabel), tile(fa(stats.quiz.attempts), t.stats.quizAnswersLabel)),
          ),
        ),
      ),
    )
  }

  render()
  return { el, onData: render }
}
