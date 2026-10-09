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

    const activityColumns: Column[] = stats.daily.map((day, i) => ({
      label: t.stats.perDay(dayLabel.format(dateOfKey(day.key)), day.reviews),
      tick: i === stats.daily.length - 1 ? t.stats.today : i % 7 === (stats.daily.length - 1) % 7 ? shortDay.format(dateOfKey(day.key)) : undefined,
      value: day.reviews,
    }))
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

    replace(
      el,
      h('header', { class: 'topbar' }, back, h('h1', null, t.stats.title)),
      h('div', { class: 'hello' }, mascot(say.mood, { size: 84 }), h('p', { class: 'bubble' }, say.line)),
      h(
        'div',
        { class: 'cols' },
        h(
          'div',
          { class: 'col' },
          h(
            'section',
            { class: 'card stack' },
            h('div', { class: 'row spread' }, h('h2', null, t.stats.words), h('span', { class: 'small muted' }, t.stats.wordsTotal(stats.totalWords))),
            // one bar, four parts: the parts are separated by a gap in the surface colour, never by outlines
            h(
              'div',
              { class: 'stack-bar', role: 'img', 'aria-label': STATUSES.map((s) => `${t.status[s]}: ${fa(stats.byStatus[s])}`).join('، ') },
              STATUSES.filter((s) => stats.byStatus[s] > 0).map((s) => h('span', { class: `seg seg-${s}`, style: { flexGrow: String(stats.byStatus[s] / total) } })),
            ),
            h(
              'ul',
              { class: 'legend' },
              STATUSES.map((s) => h('li', null, h('span', { class: `swatch seg-${s}`, 'aria-hidden': 'true' }), h('span', { class: 'grow' }, t.status[s]), h('b', null, fa(stats.byStatus[s])))),
            ),
          ),
          h(
            'section',
            { class: 'card stack' },
            h('h2', null, t.stats.periodTitle),
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
            h('p', { class: 'help' }, t.stats.retentionHelp),
            h('div', { class: 'summary-grid' }, tile(fa(stats.streak.current), t.stats.streakNow), tile(fa(stats.streak.longest), t.stats.streakBest)),
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
            h('h2', null, t.stats.activity),
            stats.month.reviews > 0
              ? columnChart(activityColumns, { summary: t.stats.activity, idle: `${fa(stats.month.reviews)} ${t.stats.reviews}، ${fa(stats.month.activeDays)} ${t.stats.activeDays}` })
              : h('p', { class: 'muted' }, t.stats.activityNone),
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
