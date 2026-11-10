/**
 * Admin panel, part two: accounting (what each AI feature really costs, a pricing calculator)
 * and growth (sign-ups, active learners, who comes back, languages in use).
 */
import { admin, type AdminCosts, type AdminGrowth, type AiBudgetConfig, type AiPrices } from '../../data/platform.ts'
import type { Ctx } from '../context.ts'
import { h, icon, replace } from '../dom.ts'
import { fmtDate, fmtPercent, num } from '../format.ts'
import { languageLabel } from '../i18n/names.ts'
import { TARGET_LANGUAGE_INFO } from '../i18n/languages.ts'
import { t } from '../strings.ts'
import { segmented } from '../widgets.ts'
import { failure, settingsCard, stat, usd, usdText } from './admin.ts'

const a = t.admin

/** One colour per AI feature, the same in the table, the legend and the chart. */
const KIND_COLORS: Record<string, string> = { analyze_word: 'var(--chart-bar)', story: '#e8892b', tts: '#1fa892' }
const kindColor = (kind: string) => KIND_COLORS[kind] ?? 'var(--ink-3)'
const kindName = (kind: string) => a.kinds[kind] ?? kind

/** Typical costs measured in November 2026, used until the logs have numbers of their own. */
const DEFAULT_AVG: Record<string, number> = { analyze_word: 0.0007, story: 0.0008, tts: 0.0004 }

const PERIODS = ['7', '30', '90'] as const
type Period = (typeof PERIODS)[number]

function periodPicker(current: Period, onChange: (p: Period) => void): HTMLElement {
  return h(
    'div',
    { class: 'row spread wrap' },
    h('span', { class: 'muted small' }, a.period),
    segmented(PERIODS.map((p) => ({ value: p, label: a.periodDays(Number(p)) })), current, onChange, a.period),
  )
}

const remember = (key: string, fallback: string): string => {
  try {
    return localStorage.getItem(`hodhod.admin.${key}`) ?? fallback
  } catch {
    return fallback
  }
}
const keep = (key: string, value: string) => {
  try {
    localStorage.setItem(`hodhod.admin.${key}`, value)
  } catch {
    // private mode: the choice is simply not remembered
  }
}

// --- accounting ----------------------------------------------------------------------------------

export function money(ctx: Ctx, body: HTMLElement): void {
  let period = remember('period', '30') as Period
  if (!PERIODS.includes(period)) period = '30'
  const content = h('div', { class: 'stack' })
  const load = async () => {
    replace(content, h('p', { class: 'muted' }, t.common.loading))
    try {
      const [costs, prices, budget] = await Promise.all([
        admin.costs(ctx.client, Number(period)),
        admin.config<AiPrices>(ctx.client, 'ai_prices'),
        admin.config<AiBudgetConfig>(ctx.client, 'ai_budget'),
      ])
      const models = [...new Set(costs.models.filter((m) => m.kind !== 'tts' && m.model).map((m) => m.model!))]
      replace(content, ...costCards(costs), calculator(costs), settingsCard(ctx, prices, budget, models))
    } catch (err) {
      replace(content, failure(err))
    }
  }
  replace(body, periodPicker(period, (p) => { period = p; keep('period', p); void load() }), content)
  void load()
}

function costCards(c: AdminCosts): HTMLElement[] {
  const unpriced = c.models.filter((m) => !m.priced)
  const cards = c.by_kind.find((k) => k.kind === 'analyze_word')
  const cardRequests = cards ? cards.ok + cards.cache_hits : 0
  const out: HTMLElement[] = []
  if (unpriced.length > 0) {
    out.push(h('p', { class: 'notice warn' }, icon('info', { size: 18 }), h('span', null, a.unpriced(unpriced.map((m) => (m.kind === 'tts' ? `${kindName('tts')} (${m.model ?? '?'})` : m.model ?? '?')).join('، ')))))
  }
  out.push(
    h(
      'section',
      { class: 'admin-stats' },
      stat(usd(c.total, 3), a.costTotal, a.periodDays(c.days)),
      stat(usd(c.active_users > 0 ? c.total / c.active_users : 0, 4), a.costPerActive, a.activeUsers(c.active_users)),
      stat(cardRequests > 0 ? fmtPercent(cards!.cache_hits / cardRequests) : '—', a.cacheRate, a.cacheRateHint(cards?.cache_hits ?? 0, cardRequests)),
    ),
  )
  if (c.by_kind.length === 0) {
    out.push(h('p', { class: 'muted' }, a.noCosts))
    return out
  }
  const kinds = [...c.by_kind].sort((x, y) => y.cost - x.cost)
  out.push(
    h(
      'section',
      { class: 'card stack' },
      h('h2', null, a.perKind),
      h(
        'div',
        { class: 'table-scroll' },
        h(
          'table',
          { class: 'admin-table' },
          h('thead', null, h('tr', null, h('th', null, a.colKind), h('th', null, a.colCalls), h('th', null, a.colCache), h('th', null, a.colCost), h('th', null, a.colAvg), h('th', null, a.colUsers))),
          h(
            'tbody',
            null,
            kinds.map((k) =>
              h(
                'tr',
                null,
                h('td', null, h('span', { class: 'kind-dot', style: { background: kindColor(k.kind) }, 'aria-hidden': 'true' }), kindName(k.kind)),
                h('td', null, num(k.calls)),
                h('td', null, num(k.cache_hits)),
                h('td', null, usd(k.cost, 3)),
                h('td', null, usd(k.avg_cost, 5)),
                h('td', null, num(k.users)),
              ),
            ),
          ),
        ),
      ),
    ),
  )
  const chart = dailyByKind(c, kinds.map((k) => k.kind))
  if (chart) out.push(chart)
  if (c.models.length > 0) {
    out.push(
      h(
        'details',
        { class: 'card stack fold' },
        h('summary', null, h('h2', null, a.modelsUsed), icon('chevron', { size: 18 })),
        h(
          'ul',
          { class: 'admin-list compact' },
          c.models.map((m) =>
            h('li', null, h('span', { class: 'grow' }, kindName(m.kind), ' · ', h('bdi', { dir: 'ltr' }, m.model ?? '—')), h('small', { class: 'muted' }, num(m.calls)), h('span', { class: `chip ${m.priced ? 'status-review' : 'warn'}` }, m.priced ? a.priced : a.notPriced)),
          ),
        ),
      ),
    )
  }
  if (c.top_users.length > 0) {
    out.push(
      h(
        'section',
        { class: 'card stack' },
        h('h2', null, a.topUsers),
        h(
          'ol',
          { class: 'admin-list compact ranked' },
          c.top_users.map((u) =>
            h(
              'li',
              null,
              h('a', { class: 'grow', href: `#/admin/users?q=${encodeURIComponent(u.email ?? '')}` }, u.display_name || u.email || '—', u.display_name && u.email ? h('small', { class: 'muted' }, ` ${u.email}`) : null),
              h('small', { class: 'muted' }, num(u.calls)),
              usd(u.cost, 3),
            ),
          ),
        ),
        h('p', { class: 'help' }, a.topUsersHelp),
      ),
    )
  }
  return out
}

/** Stacked columns: one column per day, one coloured part per feature, with a legend. */
function dailyByKind(c: AdminCosts, kinds: string[]): HTMLElement | null {
  if (c.daily.length === 0) return null
  const days: string[] = []
  const start = new Date(Date.now() - (c.days - 1) * 86_400_000)
  for (let i = 0; i < c.days; i++) days.push(new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10))
  const byDay = new Map<string, Map<string, number>>()
  for (const d of c.daily) {
    const day = d.day.slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, new Map())
    byDay.get(day)!.set(d.kind, (byDay.get(day)!.get(d.kind) ?? 0) + d.cost)
  }
  const totals = days.map((d) => [...(byDay.get(d)?.values() ?? [])].reduce((x, y) => x + y, 0))
  const max = Math.max(...totals, 0.0001)
  return h(
    'section',
    { class: 'card stack' },
    h('h2', null, a.dailyByKind),
    h('ul', { class: 'chart-legend' }, kinds.map((k) => h('li', null, h('span', { class: 'kind-dot', style: { background: kindColor(k) }, 'aria-hidden': 'true' }), kindName(k)))),
    h(
      'ol',
      { class: 'cost-chart stacked', role: 'list' },
      days.map((day, i) => {
        const parts = byDay.get(day)
        const label = `${fmtDate(day)}: ${usdText(totals[i]!, 3)}${parts ? ' — ' + kinds.filter((k) => parts.has(k)).map((k) => `${kindName(k)} ${usdText(parts.get(k)!, 3)}`).join('، ') : ''}`
        return h(
          'li',
          { title: label, 'aria-label': label },
          h(
            'span',
            { class: 'stack-bar', style: { height: `${totals[i]! > 0 ? Math.max(2, (totals[i]! / max) * 100) : 0}%` } },
            kinds.filter((k) => parts?.has(k)).map((k) => h('span', { style: { flexGrow: String(parts!.get(k)!), background: kindColor(k) } })),
          ),
        )
      }),
    ),
    h('div', { class: 'row spread small muted' }, h('span', null, fmtDate(days[0]!)), h('span', null, `max ${usdText(max, 3)}`), h('span', null, fmtDate(days.at(-1)!))),
  )
}

// --- pricing calculator ---------------------------------------------------------------------------

interface CalcInputs {
  price: number
  fee: number
  plusUsers: number
  freeUsers: number
  plusCards: number
  freeCards: number
  stories: number
  voice: number
  fixed: number
  rate: number
}

const CALC_DEFAULTS: CalcInputs = { price: 4.99, fee: 15, plusUsers: 100, freeUsers: 400, plusCards: 15, freeCards: 5, stories: 1, voice: 20, fixed: 35, rate: 0.92 }

/** Monthly numbers for a price and an audience; `avg` is the dollar cost of one card, story and voice clip. */
export function pricing(input: CalcInputs, avg: { card: number; story: number; voice: number }) {
  const month = 30
  const plusAiUsd = (input.plusCards * avg.card + input.stories * avg.story + input.voice * avg.voice) * month
  const freeAiUsd = (input.freeCards * avg.card + input.voice * avg.voice) * month
  const perPlus = plusAiUsd * input.rate
  const perFree = freeAiUsd * input.rate
  const netPrice = input.price * (1 - input.fee / 100)
  const revenue = input.plusUsers * netPrice
  const ai = input.plusUsers * perPlus + input.freeUsers * perFree
  const profit = revenue - ai - input.fixed
  // how many paying learners cover the fixed costs and everyone's AI (free users grow with them in the same ratio)
  const ratio = input.plusUsers > 0 ? input.freeUsers / input.plusUsers : 0
  const marginPerPlus = netPrice - perPlus - ratio * perFree
  const breakEven = marginPerPlus > 0 ? Math.ceil(input.fixed / marginPerPlus) : null
  return { perPlus, perFree, revenue, ai, profit, breakEven }
}

function calculator(c: AdminCosts): HTMLElement {
  const avgOf = (kind: string) => c.by_kind.find((k) => k.kind === kind && k.ok > 0)?.avg_cost || DEFAULT_AVG[kind]!
  const measured = c.by_kind.some((k) => k.kind === 'analyze_word' && k.ok > 0)
  const avg = { card: avgOf('analyze_word'), story: avgOf('story'), voice: avgOf('tts') }
  let input: CalcInputs = CALC_DEFAULTS
  try {
    input = { ...CALC_DEFAULTS, ...(JSON.parse(remember('calc', '{}')) as Partial<CalcInputs>) }
  } catch {
    // a broken saved value: start from the defaults
  }
  const result = h('div', { class: 'stack calc-result', 'aria-live': 'polite' })
  const eur = (n: number, digits = 2) => h('bdi', { dir: 'ltr', class: 'money' }, `€${n.toFixed(digits)}`)
  const eurText = (n: number, digits = 2) => `⁦€${n.toFixed(digits)}⁩`
  const update = () => {
    keep('calc', JSON.stringify(input))
    const r = pricing(input, avg)
    replace(
      result,
      h(
        'dl',
        { class: 'calc-lines' },
        h('dt', null, a.calcRevenue), h('dd', null, eur(r.revenue)),
        h('dt', null, a.calcAi), h('dd', null, '− ', eur(r.ai)),
        h('dt', null, a.calcFixedCost), h('dd', null, '− ', eur(input.fixed)),
        h('dt', { class: 'total' }, r.profit >= 0 ? a.calcProfit : a.calcLoss), h('dd', { class: `total ${r.profit >= 0 ? 'good' : 'bad'}` }, eur(Math.abs(r.profit))),
      ),
      h('p', { class: 'small muted' }, a.calcPerPlus(eurText(r.perPlus, 3))),
      h('p', { class: 'small muted' }, a.calcPerFree(eurText(r.perFree, 3))),
      h('p', { class: `notice ${r.breakEven === null ? 'warn' : ''}` }, icon('info', { size: 18 }), h('span', null, r.breakEven === null ? a.calcNeverEven : a.calcBreakEven(r.breakEven))),
    )
  }
  const field = (key: keyof CalcInputs, label: string, step = '1', help?: string) =>
    h(
      'label',
      { class: 'field' },
      h('span', null, label),
      h('input', {
        class: 'input', type: 'number', inputMode: 'decimal', min: '0', step, value: String(input[key]), dir: 'ltr',
        oninput: (e: Event) => {
          const v = Number((e.target as HTMLInputElement).value)
          if (Number.isFinite(v) && v >= 0) {
            input = { ...input, [key]: v }
            update()
          }
        },
      }),
      help ? h('small', { class: 'help' }, help) : null,
    )
  update()
  return h(
    'section',
    { class: 'card stack calculator' },
    h('h2', null, icon('wallet', { size: 20 }), ' ', a.calc),
    h('p', { class: 'help' }, a.calcHelp),
    measured ? null : h('p', { class: 'small muted' }, a.calcDefaults),
    h('p', { class: 'small muted' }, `${kindName('analyze_word')} ${usdText(avg.card, 5)} · ${kindName('story')} ${usdText(avg.story, 5)} · ${kindName('tts')} ${usdText(avg.voice, 5)}`),
    h(
      'div',
      { class: 'calc-grid' },
      field('price', a.calcPrice, '0.01'),
      field('fee', a.calcFee),
      field('plusUsers', a.calcPlusUsers),
      field('freeUsers', a.calcFreeUsers),
      field('plusCards', a.calcPlusCards),
      field('freeCards', a.calcFreeCards),
      field('stories', a.calcStories),
      field('voice', a.calcVoice),
      field('fixed', a.calcFixed, '1', a.calcFixedHelp),
      field('rate', a.calcRate, '0.01'),
    ),
    result,
  )
}

// --- growth ---------------------------------------------------------------------------------------

export function growth(ctx: Ctx, body: HTMLElement): void {
  let period = remember('growthPeriod', '30') as Period
  if (!PERIODS.includes(period)) period = '30'
  const content = h('div', { class: 'stack' })
  const load = async () => {
    replace(content, h('p', { class: 'muted' }, t.common.loading))
    try {
      replace(content, ...growthCards(await admin.growth(ctx.client, Number(period))))
    } catch (err) {
      replace(content, failure(err))
    }
  }
  replace(body, periodPicker(period, (p) => { period = p; keep('growthPeriod', p); void load() }), content)
  void load()
}

function growthCards(g: AdminGrowth): HTMLElement[] {
  const retention = (label: string, r: { base: number; back: number }) =>
    h(
      'li',
      null,
      h('div', { class: 'row spread' }, h('span', null, label), h('b', null, r.base > 0 ? fmtPercent(r.back / r.base) : '—')),
      h('div', { class: 'hbar', 'aria-hidden': 'true' }, h('span', { style: { width: `${r.base > 0 ? Math.round((r.back / r.base) * 100) : 0}%` } })),
      h('small', { class: 'muted' }, r.base > 0 ? a.retBase(r.back, r.base) : a.retNoBase),
    )
  return [
    h(
      'section',
      { class: 'admin-stats' },
      stat(num(g.users), a.usersTotal),
      stat(num(g.dau), a.dau),
      stat(num(g.wau), a.wau),
      stat(num(g.mau), a.mau, g.mau > 0 ? a.stickiness(fmtPercent(g.dau / g.mau)) : undefined),
      stat(num(g.plus), a.plusUsers),
      stat(num(g.push), a.pushUsers),
    ),
    columns(a.signupsChart, g.daily.map((d) => ({ day: d.day, value: d.signups })), '#1fa892'),
    columns(a.activeChart, g.daily.map((d) => ({ day: d.day, value: d.active })), 'var(--chart-bar)'),
    h(
      'section',
      { class: 'card stack' },
      h('h2', null, a.retention),
      h('p', { class: 'help' }, a.retentionHelp),
      h('ul', { class: 'retention-list' }, retention(a.retD1, g.retention.d1), retention(a.retD7, g.retention.d7), retention(a.retD30, g.retention.d30)),
    ),
    h('div', { class: 'admin-two' }, languageBars(a.nativeLangs, g.native), languageBars(a.learningLangs, g.learning, true)),
  ]
}

/** A single series as columns, with the largest value written out. */
function columns(title: string, rows: { day: string; value: number }[], color: string): HTMLElement {
  const max = Math.max(...rows.map((r) => r.value), 1)
  const total = rows.reduce((n, r) => n + r.value, 0)
  return h(
    'section',
    { class: 'card stack' },
    h('div', { class: 'row spread' }, h('h2', null, title), h('b', null, num(total))),
    h(
      'ol',
      { class: 'cost-chart', role: 'list' },
      rows.map((r) =>
        h('li', { title: `${fmtDate(r.day)}: ${num(r.value)}`, 'aria-label': `${fmtDate(r.day)}: ${num(r.value)}` }, h('span', { class: 'bar', style: { height: `${r.value > 0 ? Math.max(3, (r.value / max) * 100) : 0}%`, background: color } })),
      ),
    ),
    rows.length > 0 ? h('div', { class: 'row spread small muted' }, h('span', null, fmtDate(rows[0]!.day)), h('span', null, `max ${num(max)}`), h('span', null, fmtDate(rows.at(-1)!.day))) : null,
  )
}

function languageBars(title: string, counts: Record<string, number>, colored = false): HTMLElement {
  const rows = Object.entries(counts).sort((x, y) => y[1] - x[1])
  const max = Math.max(...rows.map((r) => r[1]), 1)
  return h(
    'section',
    { class: 'card stack' },
    h('h2', null, title),
    rows.length === 0
      ? h('p', { class: 'muted' }, '—')
      : h(
          'ul',
          { class: 'retention-list' },
          rows.map(([code, n]) =>
            h(
              'li',
              null,
              h('div', { class: 'row spread' }, h('span', null, languageLabel(code)), h('small', { class: 'muted' }, a.people(n))),
              h('div', { class: 'hbar', 'aria-hidden': 'true' }, h('span', { style: { width: `${Math.round((n / max) * 100)}%`, background: colored ? (TARGET_LANGUAGE_INFO as Record<string, { color: string }>)[code]?.color ?? 'var(--chart-bar)' : 'var(--chart-bar)' } })),
            ),
          ),
        ),
  )
}
