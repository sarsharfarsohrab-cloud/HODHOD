/**
 * The admin panel (only for accounts in public.admins; the database refuses everyone else).
 * Tabs: overview with AI credit, users, inbox (reports, messages, errors), announcements,
 * and the pack builder.
 */
import { assignLessons } from '../../core/packs.ts'
import { toAppError } from '../../data/errors.ts'
import {
  admin,
  isAdmin,
  itemFromContent,
  parseItemList,
  packItems,
  parsePackFile,
  type AdminBudget,
  type AdminOverview,
  type AdminUser,
  type AiBudgetConfig,
  type AiPrices,
  type Announcement,
  type CreditEntry,
  type ErrorRow,
  type FeedbackRow,
  type PackItem,
  type PackKind,
  type PackLevel,
  type PackRow,
  type ReportRow,
  type StorePack,
} from '../../data/platform.ts'
import type { Ctx, Screen } from '../context.ts'
import { de, h, icon, replace, type IconName } from '../dom.ts'
import { createEditor } from '../editor.ts'
import { fa, faDate, faDateTime, faRelative } from '../format.ts'
import { mascot } from '../mascot.ts'
import { describeError, t } from '../strings.ts'
import { emptyState, progressBar } from '../widgets.ts'

const a = t.admin
type Tab = 'overview' | 'users' | 'inbox' | 'news' | 'packs'
const TABS: { id: Tab; icon: IconName }[] = [
  { id: 'overview', icon: 'chart' },
  { id: 'users', icon: 'users' },
  { id: 'inbox', icon: 'message' },
  { id: 'news', icon: 'bell' },
  { id: 'packs', icon: 'bag' },
]
/** Below this many dollars the overview warns that the credit is running out. */
const LOW_CREDIT_USD = 1

const usd = (n: number, digits = 2) => h('bdi', { dir: 'ltr', class: 'money' }, `$${n.toFixed(digits)}`)
/** Isolated left-to-right, so "$0.25" never turns into "0.25$" inside Persian text. */
const usdText = (n: number, digits = 2) => `\u2066$${n.toFixed(digits)}\u2069`

const back = (ctx: Ctx, to: string) =>
  h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.common.back, title: t.common.back, onclick: () => ctx.go(to) }, icon('back'))

/** Runs an admin action with a busy button and a toast for the result. */
async function act(ctx: Ctx, button: HTMLButtonElement | null, work: () => Promise<unknown>, done?: string): Promise<boolean> {
  if (button) button.disabled = true
  try {
    await work()
    if (done) ctx.toast(done)
    return true
  } catch (err) {
    ctx.toast(describeError(toAppError(err)), 'error')
    return false
  } finally {
    if (button) button.disabled = false
  }
}

/** Shows the screen only to the administrator; everyone else gets a polite stop. */
function guarded(ctx: Ctx, el: HTMLElement, header: () => HTMLElement, start: () => void): void {
  replace(el, header(), h('p', { class: 'muted center' }, t.common.loading))
  void isAdmin(ctx.client).then((yes) => {
    if (yes) return start()
    replace(el, header(), emptyState({ art: mascot('confused', { size: 120 }), title: a.notAllowed, action: h('a', { class: 'btn', href: '#/home' }, t.nav.home) }))
  })
}

function failure(err: unknown): HTMLElement {
  const error = toAppError(err)
  return h('p', { class: 'notice error' }, icon('info', { size: 18 }), h('span', null, error.kind === 'not_found' ? a.notReady : describeError(error)))
}

const stat = (value: string | Node, label: string, hint?: string) =>
  h('div', { class: 'admin-stat' }, h('b', null, value), h('span', null, label), hint ? h('small', { class: 'muted' }, hint) : null)

// --- the tabbed panel -------------------------------------------------------------------------

export function adminScreen(ctx: Ctx, params: Record<string, string>): Screen {
  const tab = (TABS.some((x) => x.id === params.tab) ? params.tab : 'overview') as Tab
  const el = h('main', { class: 'screen wide admin' })
  const body = h('div', { class: 'stack admin-body' })
  const header = () =>
    h(
      'div',
      { class: 'stack', style: { gap: 'var(--s3)' } },
      h('header', { class: 'topbar' }, back(ctx, '/settings'), h('h1', null, a.title)),
      h(
        'nav',
        { class: 'admin-tabs', 'aria-label': a.title },
        TABS.map((x) => h('a', { href: `#/admin/${x.id}`, 'aria-current': x.id === tab ? 'page' : undefined }, icon(x.icon, { size: 18 }), a.tabs[x.id])),
      ),
    )
  let destroy: (() => void) | undefined
  guarded(ctx, el, header, () => {
    replace(el, header(), body)
    const views: Record<Tab, (ctx: Ctx, body: HTMLElement) => void | (() => void)> = { overview, users, inbox, news, packs }
    destroy = views[tab](ctx, body) ?? undefined
  })
  return { el, destroy: () => destroy?.() }
}

// --- overview & money ------------------------------------------------------------------------

function overview(ctx: Ctx, body: HTMLElement): void {
  replace(body, h('p', { class: 'muted' }, t.common.loading))
  const load = async () => {
    try {
      const [o, b, credits, prices, budget] = await Promise.all([
        admin.overview(ctx.client),
        admin.budget(ctx.client),
        admin.credits(ctx.client),
        admin.config<AiPrices>(ctx.client, 'ai_prices'),
        admin.config<AiBudgetConfig>(ctx.client, 'ai_budget'),
      ])
      replace(body, numbers(o), creditCard(ctx, b, credits, load), costChart(b), settingsCard(ctx, prices, budget))
    } catch (err) {
      replace(body, failure(err))
    }
  }
  void load()
}

function numbers(o: AdminOverview): HTMLElement {
  return h(
    'section',
    { class: 'admin-stats' },
    stat(fa(o.users), a.usersTotal, a.usersNew(o.users_7d)),
    stat(fa(o.active_today), a.activeToday, a.active7(o.active_7d)),
    stat(fa(o.reviews_today), a.reviewsToday, a.reviews7(o.reviews_7d)),
    stat(fa(o.words), a.wordsTotal),
    stat(fa(o.ai_calls_today), a.aiToday),
    stat(usd(o.cost_today), a.costToday, `${a.cost7}: ${usdText(o.cost_7d)}، ${a.cost30}: ${usdText(o.cost_30d)}`),
    h(
      'a',
      { class: `admin-stat link ${o.feedback_new + o.reports_new > 0 ? 'attention' : ''}`, href: '#/admin/inbox' },
      h('b', null, fa(o.feedback_new + o.reports_new)),
      h('span', null, a.tabs.inbox),
      h('small', { class: 'muted' }, a.inboxNew(o.feedback_new, o.reports_new, o.errors_24h)),
    ),
  )
}

function creditCard(ctx: Ctx, b: AdminBudget, credits: CreditEntry[], reload: () => void): HTMLElement {
  const amount = h('input', { class: 'input', type: 'number', inputMode: 'decimal', step: '0.01', min: '0', max: '10000', placeholder: '5.00', 'aria-label': a.amount, dir: 'ltr' })
  const note = h('input', { class: 'input', type: 'text', maxLength: 300, placeholder: a.note, 'aria-label': a.note })
  const add = (kind: 'topup' | 'balance') => async (e: Event) => {
    const value = Number(amount.value)
    if (!Number.isFinite(value) || value < 0 || amount.value === '') return amount.focus()
    if (await act(ctx, e.currentTarget as HTMLButtonElement, () => admin.addCredit(ctx.client, kind, value, note.value.trim() || null), a.creditSaved)) reload()
  }
  const hasCredit = b.since !== null
  const low = hasCredit && b.remaining < LOW_CREDIT_USD
  const cardsLeft = b.avg_card_cost > 0 && b.remaining > 0 ? Math.floor(b.remaining / b.avg_card_cost) : null
  return h(
    'section',
    { class: `card stack credit-card ${low ? 'low' : ''}` },
    h('h2', null, a.credit),
    hasCredit
      ? h(
          'div',
          { class: 'credit-main' },
          h('b', { class: 'credit-number' }, usd(b.remaining)),
          h('span', null, a.remaining),
          progressBar(b.credit > 0 ? b.remaining / b.credit : 0, a.remaining),
          h('small', { class: 'muted' }, a.spent(usdText(b.spent), b.since ? faDate(b.since) : '—')),
          b.avg_card_cost > 0 ? h('small', { class: 'muted' }, a.perCard(usdText(b.avg_card_cost, 4))) : null,
          cardsLeft !== null ? h('small', { class: 'muted' }, a.cardsLeft(cardsLeft)) : null,
        )
      : h('p', { class: 'notice' }, icon('info', { size: 18 }), h('span', null, a.noCredit)),
    low ? h('p', { class: 'notice warn' }, icon('info', { size: 18 }), h('span', null, a.lowCredit)) : null,
    h('div', { class: 'row wrap' }, h('div', { class: 'grow' }, amount), h('div', { class: 'grow' }, note)),
    h(
      'div',
      { class: 'row wrap' },
      h('button', { class: 'btn primary grow', type: 'button', onclick: add('topup') }, icon('plus', { size: 18 }), a.addTopup),
      h('button', { class: 'btn grow', type: 'button', onclick: add('balance') }, icon('check', { size: 18 }), a.setBalance),
    ),
    h('p', { class: 'help' }, a.creditHelp),
    credits.length > 0
      ? h(
          'details',
          { class: 'fold small' },
          h('summary', { class: 'muted' }, a.history, icon('chevron', { size: 18 })),
          h(
            'ul',
            { class: 'admin-list compact' },
            credits.map((c) =>
              h('li', null, h('span', { class: 'chip' }, c.kind === 'topup' ? a.kindTopup : a.kindBalance), usd(Number(c.amount_usd)), h('span', { class: 'muted grow' }, c.note ?? ''), h('small', { class: 'muted' }, faDate(c.created_at))),
            ),
          ),
        )
      : null,
  )
}

/** Thirty days of spending as simple columns (one series, value on hover and in the label). */
function costChart(b: AdminBudget): HTMLElement | null {
  if (b.daily.length === 0) return null
  const max = Math.max(...b.daily.map((d) => d.cost), 0.0001)
  return h(
    'section',
    { class: 'card stack' },
    h('h2', null, a.costChart),
    h(
      'ol',
      { class: 'cost-chart', role: 'list' },
      b.daily.map((d) =>
        h(
          'li',
          { title: `${faDate(d.day)}: ${usdText(d.cost, 3)}، ${fa(d.calls)}`, 'aria-label': `${faDate(d.day)}: ${usdText(d.cost, 3)}` },
          h('span', { class: 'bar', style: { height: `${Math.max(2, (d.cost / max) * 100)}%` } }),
        ),
      ),
    ),
    h('div', { class: 'row spread small muted' }, h('span', null, faDate(b.daily[0]!.day)), h('span', null, `max ${usdText(max, 3)}`), h('span', null, faDate(b.daily.at(-1)!.day))),
  )
}

function settingsCard(ctx: Ctx, prices: AiPrices | null, budget: AiBudgetConfig | null): HTMLElement {
  const p: AiPrices = structuredClone(prices ?? { default: { input: 1.25, output: 10 }, tts: { input: 15, output: 0 } })
  const bud: AiBudgetConfig = { daily_usd: 1.5, new_user_days: 3, new_user_per_day: 30, tts_per_day: 300, stories_per_day: 3, ...(budget ?? {}) }
  const numberInput = (value: number, onChange: (v: number) => void, label: string, step = '0.01') =>
    h('label', { class: 'field' }, h('span', null, label), h('input', { class: 'input', type: 'number', step, min: '0', value: String(value), dir: 'ltr', oninput: (e: Event) => onChange(Number((e.target as HTMLInputElement).value)) }))
  const priceRow = (key: string, label: string) => {
    p[key] ??= { input: 0, output: 0 }
    return h(
      'div',
      { class: 'row wrap' },
      h('b', { class: 'price-label' }, label),
      h('div', { class: 'grow' }, numberInput(p[key]!.input, (v) => (p[key]!.input = v), a.priceInput)),
      h('div', { class: 'grow' }, numberInput(p[key]!.output, (v) => (p[key]!.output = v), a.priceOutput)),
    )
  }
  const save = h('button', { class: 'btn primary block', type: 'button' }, icon('check', { size: 18 }), a.saveSettings)
  save.onclick = () =>
    void act(ctx, save, async () => {
      await admin.setConfig(ctx.client, 'ai_prices', p)
      await admin.setConfig(ctx.client, 'ai_budget', bud)
    }, t.settings.saved)
  return h(
    'details',
    { class: 'card stack fold' },
    h('summary', null, h('h2', null, a.prices), icon('chevron', { size: 18 })),
    h('p', { class: 'help' }, a.pricesHelp),
    priceRow('default', a.priceDefault),
    priceRow('tts', a.priceTts),
    numberInput(bud.daily_usd, (v) => (bud.daily_usd = v), a.dailyUsd),
    h(
      'div',
      { class: 'row wrap' },
      h('div', { class: 'grow' }, numberInput(bud.new_user_days, (v) => (bud.new_user_days = v), a.newUserDays, '1')),
      h('div', { class: 'grow' }, numberInput(bud.new_user_per_day, (v) => (bud.new_user_per_day = v), a.newUserPerDay, '1')),
    ),
    h(
      'div',
      { class: 'row wrap' },
      h('div', { class: 'grow' }, numberInput(bud.tts_per_day, (v) => (bud.tts_per_day = v), a.ttsPerDay, '1')),
      h('div', { class: 'grow' }, numberInput(bud.stories_per_day, (v) => (bud.stories_per_day = v), a.storiesPerDay, '1')),
    ),
    save,
  )
}

// --- users ---------------------------------------------------------------------------------------

function users(ctx: Ctx, body: HTMLElement): () => void {
  let list: AdminUser[] = []
  let total = 0
  let query = ''
  let timer: ReturnType<typeof setTimeout> | undefined
  const search = h('input', {
    class: 'input',
    type: 'search',
    placeholder: a.search,
    'aria-label': a.search,
    dir: 'auto',
    oninput: () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        query = search.value
        void load(false)
      }, 350)
    },
  })
  const results = h('div', { class: 'stack' })
  replace(body, search, results)

  async function load(more: boolean) {
    try {
      const rows = await admin.users(ctx.client, query, more ? list.length : 0)
      list = more ? [...list, ...rows] : rows
      total = rows[0]?.total ?? (more ? total : 0)
      render()
    } catch (err) {
      replace(results, failure(err))
    }
  }

  const userCard = (u: AdminUser) => {
    const limitBtn = h('button', { class: 'btn small', type: 'button' }, icon('sparkle', { size: 16 }), a.setLimit)
    limitBtn.onclick = async () => {
      const raw = prompt(a.limitPrompt, u.ai_per_day === null ? '' : String(u.ai_per_day))
      if (raw === null) return
      const value = raw.trim() === '' ? null : Math.max(0, Math.min(5000, Math.round(Number(raw))))
      if (value !== null && !Number.isFinite(value)) return
      if (await act(ctx, limitBtn, () => admin.setLimit(ctx.client, u.user_id, value, u.blocked), a.limitSaved)) {
        u.ai_per_day = value
        render()
      }
    }
    const blocked = u.blocked || u.banned
    const blockBtn = h('button', { class: `btn small ${blocked ? '' : 'danger'}`, type: 'button' }, icon(blocked ? 'check' : 'lock', { size: 16 }), blocked ? a.unblock : a.block)
    blockBtn.onclick = async () => {
      if (!blocked && !(await ctx.confirm({ title: a.block, body: a.blockConfirm(u.email), confirmLabel: a.block, danger: true }))) return
      const ok = await act(ctx, blockBtn, async () => {
        await admin.ban(ctx.client, u.user_id, !blocked)
        await admin.setLimit(ctx.client, u.user_id, u.ai_per_day, !blocked)
      }, blocked ? a.unblocked : a.blocked)
      if (ok) {
        u.blocked = !blocked
        u.banned = !blocked
        render()
      }
    }
    const deleteBtn = h('button', { class: 'btn small danger', type: 'button' }, icon('trash', { size: 16 }), a.deleteUser)
    deleteBtn.onclick = async () => {
      if (!(await ctx.confirm({ title: a.deleteUser, body: a.deleteConfirm(u.email), confirmLabel: t.common.delete, danger: true }))) return
      if (await act(ctx, deleteBtn, () => admin.deleteUser(ctx.client, u.user_id), a.deletedUser)) {
        list = list.filter((x) => x.user_id !== u.user_id)
        total--
        render()
      }
    }
    const now = ctx.now()
    return h(
      'article',
      { class: `card stack user-card ${blocked ? 'blocked' : ''}` },
      h(
        'div',
        { class: 'row wrap', style: { gap: 'var(--s2)' } },
        h('b', { class: 'grow' }, u.display_name || '—'),
        u.is_admin ? h('span', { class: 'chip status-review' }, a.adminBadge) : null,
        blocked ? h('span', { class: 'chip danger' }, a.blockedBadge) : null,
        u.ai_per_day !== null ? h('span', { class: 'chip' }, a.limitBadge(u.ai_per_day)) : null,
      ),
      h('bdi', { dir: 'ltr', class: 'small user-email' }, u.email),
      h('p', { class: 'small muted' }, `${a.joined(faDate(u.created_at))}، ${u.last_active_at ? a.lastActive(faRelative(u.last_active_at, now)) : a.neverActive}`),
      h('p', { class: 'small' }, a.userStats(u.words, u.reviews_30d, u.ai_calls_30d, usdText(u.cost_30d, 3), u.packs)),
      u.is_admin ? null : h('div', { class: 'row wrap' }, limitBtn, blockBtn, deleteBtn),
    )
  }

  function render() {
    replace(
      results,
      list.length === 0 ? h('p', { class: 'muted' }, a.noUsers) : null,
      list.map(userCard),
      list.length < total ? h('button', { class: 'btn block', type: 'button', onclick: () => void load(true) }, a.more) : null,
    )
  }

  replace(results, h('p', { class: 'muted' }, t.common.loading))
  void load(false)
  return () => clearTimeout(timer)
}

// --- inbox ------------------------------------------------------------------------------------

function inbox(ctx: Ctx, body: HTMLElement): void {
  replace(body, h('p', { class: 'muted' }, t.common.loading))
  const load = async () => {
    try {
      const [reports, feedback, errors] = await Promise.all([admin.reports(ctx.client), admin.feedback(ctx.client), admin.errors(ctx.client)])
      replace(body, reportList(ctx, reports, load), feedbackList(ctx, feedback, load), errorList(errors))
    } catch (err) {
      replace(body, failure(err))
    }
  }
  void load()
}

const statusChip = (status: string) => {
  const label: Record<string, string> = { new: a.statusNew, seen: a.statusSeen, done: a.statusDone, fixed: a.statusFixed, rejected: a.statusRejected }
  return h('span', { class: `chip inbox-${status}` }, label[status] ?? status)
}

function reportList(ctx: Ctx, rows: ReportRow[], reload: () => void): HTMLElement {
  const open = rows.filter((r) => r.status === 'new')
  const closed = rows.filter((r) => r.status !== 'new').slice(0, 10)
  const row = (r: ReportRow) => {
    const reject = h('button', { class: 'btn small ghost', type: 'button' }, a.reject)
    reject.onclick = async () => {
      if (await act(ctx, reject, () => admin.setReportStatus(ctx.client, r.id, 'rejected'))) reload()
    }
    return h(
      'li',
      { class: 'inbox-item' },
      h('div', { class: 'row wrap' }, statusChip(r.status), h('span', { class: 'chip' }, t.report.reasons[r.reason]), h('b', { class: 'de grow', lang: 'de', dir: 'ltr' }, r.lemma), h('small', { class: 'muted' }, faDateTime(r.created_at))),
      r.message ? h('p', { class: 'small' }, r.message) : null,
      r.status === 'new'
        ? h('div', { class: 'row wrap' }, r.content ? h('a', { class: 'btn small primary', href: `#/admin/reports/${r.id}` }, icon('edit', { size: 16 }), a.fix) : null, reject)
        : null,
    )
  }
  return h(
    'section',
    { class: 'card stack' },
    h('h2', null, `${a.reportsTitle} (${fa(open.length)})`),
    open.length + closed.length === 0 ? h('p', { class: 'muted small' }, a.nothing) : h('ul', { class: 'admin-list' }, [...open, ...closed].map(row)),
  )
}

function feedbackList(ctx: Ctx, rows: FeedbackRow[], reload: () => void): HTMLElement {
  const row = (f: FeedbackRow) => {
    const mark = (status: FeedbackRow['status'], label: string) => {
      const b = h('button', { class: 'btn small ghost', type: 'button' }, label)
      b.onclick = async () => {
        if (await act(ctx, b, () => admin.setFeedbackStatus(ctx.client, f.id, status))) reload()
      }
      return b
    }
    return h(
      'li',
      { class: `inbox-item ${f.status}` },
      h('div', { class: 'row wrap' }, statusChip(f.status), h('span', { class: 'chip' }, t.feedback.kinds[f.kind]), h('span', { class: 'grow' }), h('small', { class: 'muted' }, faDateTime(f.created_at))),
      h('p', { class: 'inbox-message' }, f.message),
      f.context && Object.keys(f.context).length > 0 ? h('small', { class: 'muted', dir: 'ltr' }, Object.entries(f.context).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')) : null,
      h('div', { class: 'row wrap' }, f.status === 'new' ? mark('seen', a.markSeen) : null, f.status !== 'done' ? mark('done', a.markDone) : null),
    )
  }
  const open = rows.filter((f) => f.status !== 'done')
  const done = rows.filter((f) => f.status === 'done').slice(0, 10)
  return h(
    'section',
    { class: 'card stack' },
    h('h2', null, `${a.feedbackTitle} (${fa(rows.filter((f) => f.status === 'new').length)})`),
    rows.length === 0 ? h('p', { class: 'muted small' }, a.nothing) : h('ul', { class: 'admin-list' }, [...open, ...done].map(row)),
  )
}

function errorList(rows: ErrorRow[]): HTMLElement {
  return h(
    'section',
    { class: 'card stack' },
    h('h2', null, `${a.errorsTitle} (${fa(rows.length)})`),
    rows.length === 0
      ? h('p', { class: 'muted small' }, a.nothing)
      : h(
          'ul',
          { class: 'admin-list' },
          rows.slice(0, 50).map((e) =>
            h(
              'li',
              { class: 'inbox-item' },
              h('details', null, h('summary', { dir: 'ltr', class: 'error-line' }, h('small', { class: 'muted' }, faDateTime(e.created_at)), ' ', e.message), h('pre', { class: 'error-stack', dir: 'ltr' }, [e.url, e.app_version, e.user_agent, e.stack].filter(Boolean).join('\n'))),
            ),
          ),
        ),
  )
}

// --- announcements ----------------------------------------------------------------------------

function news(ctx: Ctx, body: HTMLElement): void {
  const title = h('input', { class: 'input', type: 'text', maxLength: 120, placeholder: a.newsTitle, 'aria-label': a.newsTitle })
  const text = h('textarea', { class: 'textarea', rows: 3, maxLength: 1000, placeholder: a.newsBody, 'aria-label': a.newsBody })
  const add = h('button', { class: 'btn primary block', type: 'submit' }, icon('bell', { size: 18 }), a.newsAdd)
  const list = h('div', { class: 'stack' })
  const form = h(
    'form',
    {
      class: 'card stack',
      onsubmit: async (e: Event) => {
        e.preventDefault()
        if (!title.value.trim()) return title.focus()
        if (await act(ctx, add, () => admin.addAnnouncement(ctx.client, title.value, text.value), a.newsAdded)) {
          title.value = ''
          text.value = ''
          void load()
        }
      },
    },
    h('h2', null, a.newsAdd),
    h('p', { class: 'help' }, a.newsHelp),
    title,
    text,
    add,
  )
  replace(body, form, list)

  const item = (n: Announcement) => {
    const push = h('button', { class: 'btn small', type: 'button', disabled: n.push_sent_at !== null || !n.published }, icon('bell', { size: 16 }), n.push_sent_at ? a.newsSent : a.newsPush)
    push.onclick = async () => {
      if (!(await ctx.confirm({ title: a.newsPush, body: a.newsPushConfirm, confirmLabel: a.newsPush }))) return
      let sent = 0
      if (await act(ctx, push, async () => (sent = await admin.sendAnnouncement(ctx.client, n.id)))) {
        ctx.toast(a.newsPushed(sent))
        void load()
      }
    }
    const toggle = h('button', { class: 'btn small ghost', type: 'button' }, n.published ? a.newsHide : a.newsShow)
    toggle.onclick = async () => {
      if (await act(ctx, toggle, () => admin.setAnnouncementPublished(ctx.client, n.id, !n.published))) void load()
    }
    return h(
      'article',
      { class: `card stack ${n.published ? '' : 'faded'}` },
      h('div', { class: 'row wrap' }, h('b', { class: 'grow' }, n.title), n.published ? null : h('span', { class: 'chip' }, a.newsHidden), h('small', { class: 'muted' }, faDateTime(n.created_at))),
      n.body ? h('p', { class: 'small' }, n.body) : null,
      h('div', { class: 'row wrap' }, push, toggle),
    )
  }

  async function load() {
    try {
      replace(list, (await admin.announcements(ctx.client)).map(item))
    } catch (err) {
      replace(list, failure(err))
    }
  }
  void load()
}

// --- packs -----------------------------------------------------------------------------------

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

function packs(ctx: Ctx, body: HTMLElement): void {
  const list = h('div', { class: 'pack-grid' })
  const title = h('input', { class: 'input', type: 'text', maxLength: 120, placeholder: a.packTitle, 'aria-label': a.packTitle })
  const slug = h('input', { class: 'input', type: 'text', maxLength: 80, placeholder: 'kitchen-basic', 'aria-label': a.packSlug, dir: 'ltr', pattern: '[a-z0-9][a-z0-9\\-]{1,80}' })
  const create = h('button', { class: 'btn primary', type: 'submit' }, icon('plus', { size: 18 }), a.newPack)
  const file = h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden', id: 'pack-file' })
  let known: StorePack[] = []

  file.onchange = async () => {
    const chosen = file.files?.[0]
    file.value = ''
    if (!chosen) return
    try {
      const data = parsePackFile(await chosen.text())
      const existing = new Set(known.map((p) => p.slug))
      let made = 0
      let items = 0
      for (const [i, p] of data.packs.entries()) {
        if (existing.has(p.slug)) continue
        const pack = await admin.createPack(ctx.client, {
          slug: p.slug,
          topic: p.topic.slice(0, 60),
          kind: p.kind ?? 'words',
          level: p.level ?? null,
          title: p.title_fa.slice(0, 120),
          description: p.description_fa?.slice(0, 500) ?? null,
          emoji: p.emoji ?? null,
          sort_order: (known.length + i) * 10,
          lesson_size: 12,
        })
        const rows = assignLessons(
          p.items.map((entry, position) => {
            const text = typeof entry === 'string' ? entry : entry.text
            const hint = typeof entry === 'string' ? null : (entry.hint ?? null)
            return { pack_id: pack.id, position, input: text.slice(0, 200), hint }
          }),
          pack.lesson_size,
        )
        for (let k = 0; k < rows.length; k += 200) await admin.addItems(ctx.client, rows.slice(k, k + 200))
        made++
        items += rows.length
        ctx.toast(a.imported(made, items))
      }
      ctx.toast(a.imported(made, items))
      void load()
    } catch (err) {
      const error = toAppError(err)
      ctx.toast(error.code === 'bad_pack_file' || err instanceof SyntaxError ? a.badFile : describeError(error), 'error')
      void load()
    }
  }

  title.oninput = () => {
    if (!slug.dataset.touched) slug.value = slugify(title.value)
  }
  slug.oninput = () => (slug.dataset.touched = '1')

  const form = h(
    'form',
    {
      class: 'card stack',
      onsubmit: async (e: Event) => {
        e.preventDefault()
        const s = slugify(slug.value)
        if (!title.value.trim()) return title.focus()
        if (s.length < 2) return slug.focus()
        let id = ''
        if (await act(ctx, create, async () => (id = (await admin.createPack(ctx.client, { slug: s, title: title.value.trim(), sort_order: known.length * 10 })).id))) {
          ctx.go(`/admin/packs/${id}`)
        }
      },
    },
    h('h2', null, a.newPack),
    h('label', { class: 'field' }, h('span', null, a.packTitle), title),
    h('label', { class: 'field' }, h('span', null, a.packSlug), slug),
    create,
    h('hr'),
    h('label', { class: 'btn block', for: 'pack-file' }, icon('download', { size: 18 }), a.importFile),
    file,
    h('p', { class: 'help' }, a.importHelp),
  )
  replace(body, form, list)

  async function load() {
    try {
      known = await admin.packs(ctx.client)
      replace(
        list,
        known.map((p) =>
          h(
            'a',
            { class: `pack-card ${p.published ? '' : 'draft'}`, href: `#/admin/packs/${p.id}` },
            h('span', { class: 'pack-emoji', 'aria-hidden': 'true' }, p.emoji || '📦'),
            h(
              'span',
              { class: 'pack-text' },
              h('b', null, p.title),
              h(
                'span',
                { class: 'pack-meta' },
                h('span', { class: `chip ${p.published ? 'status-review' : 'warn'}` }, p.published ? a.published : a.unpublished),
                h('span', { class: 'chip' }, t.store.kinds[p.kind]),
                h('span', { class: 'small muted' }, t.store.size(p.items, p.lessons)),
              ),
              h('span', { class: 'small muted', dir: 'ltr' }, p.slug),
            ),
          ),
        ),
      )
    } catch (err) {
      replace(list, failure(err))
    }
  }
  void load()
}

// --- one pack: the builder -----------------------------------------------------------------------

export function adminPackScreen(ctx: Ctx, params: Record<string, string>): Screen {
  const id = params.id ?? ''
  const el = h('main', { class: 'screen wide admin' })
  const header = () => h('header', { class: 'topbar' }, back(ctx, '/admin/packs'), h('h1', null, a.tabs.packs))
  let pack: PackRow | null = null
  let items: PackItem[] = []
  let avgCost = 0
  let running: { done: number; total: number; stop: boolean } | null = null
  let destroyed = false

  const itemsBox = h('div', { class: 'stack' })
  const formBox = h('div')

  async function load() {
    try {
      const [p, list, budget] = await Promise.all([admin.pack(ctx.client, id), packItems(ctx.client, id, { all: true }), admin.budget(ctx.client).catch(() => null)])
      pack = p
      items = list
      avgCost = budget?.avg_card_cost ?? 0
      if (!pack) return replace(el, header(), emptyState({ art: mascot('confused', { size: 120 }), title: t.store.notFound }))
      replace(el, header(), formBox, itemsBox)
      renderForm()
      renderItems()
    } catch (err) {
      replace(el, header(), failure(err))
    }
  }

  function renderForm() {
    if (!pack) return
    const p: PackRow = { ...pack }
    const text = (key: 'title' | 'description' | 'emoji' | 'topic' | 'slug', label: string, options: { max: number; multiline?: boolean; ltr?: boolean }) => {
      const props = {
        class: options.multiline ? 'textarea' : 'input',
        maxLength: options.max,
        value: (p[key] as string | null) ?? '',
        dir: options.ltr ? 'ltr' : 'auto',
        oninput: (e: Event) => ((p as unknown as Record<string, string | null>)[key] = (e.target as HTMLInputElement).value.trim() || null),
      }
      return h('label', { class: 'field' }, h('span', null, label), options.multiline ? h('textarea', { ...props, rows: 2 }) : h('input', { ...props, type: 'text' }))
    }
    const kinds: PackKind[] = ['words', 'sentences', 'expressions', 'mixed']
    const select = <T extends string>(label: string, value: T | null, options: { value: T | ''; label: string }[], onChange: (v: T | null) => void) =>
      h(
        'label',
        { class: 'field' },
        h('span', null, label),
        h('select', { class: 'select', onchange: (e: Event) => onChange(((e.target as HTMLSelectElement).value || null) as T | null) }, options.map((o) => h('option', { value: o.value, selected: o.value === (value ?? '') }, o.label))),
      )
    const save = h('button', { class: 'btn primary grow', type: 'button' }, icon('check', { size: 18 }), a.savePack)
    save.onclick = async () => {
      const patch = { title: p.title || pack!.title, description: p.description, emoji: p.emoji, topic: p.topic || 'general', slug: slugify(p.slug) || pack!.slug, kind: p.kind, level: p.level, lesson_size: p.lesson_size, sort_order: p.sort_order }
      if (await act(ctx, save, () => admin.updatePack(ctx.client, id, patch), a.packSaved)) {
        pack = { ...pack!, ...patch }
        renderForm()
      }
    }
    const ready = items.filter((i) => i.status === 'ready').length
    const publish = h('button', { class: `btn grow ${pack.published ? '' : 'primary'}`, type: 'button' }, icon(pack.published ? 'lock' : 'bag', { size: 18 }), pack.published ? a.unpublish : a.publish)
    publish.onclick = async () => {
      if (!pack!.published && ready === 0) return ctx.toast(a.publishNeedsReady, 'error')
      const next = !pack!.published
      if (await act(ctx, publish, () => admin.updatePack(ctx.client, id, { published: next }), a.packSaved)) {
        pack!.published = next
        renderForm()
      }
    }
    const remove = h('button', { class: 'btn danger', type: 'button' }, icon('trash', { size: 18 }), a.deletePack)
    remove.onclick = async () => {
      if (!(await ctx.confirm({ title: a.deletePack, body: a.deletePackConfirm, confirmLabel: t.common.delete, danger: true }))) return
      if (await act(ctx, remove, () => admin.deletePack(ctx.client, id))) ctx.go('/admin/packs', { replace: true })
    }
    replace(
      formBox,
      h(
        'section',
        { class: 'card stack' },
        h('div', { class: 'row wrap' }, h('span', { class: 'pack-emoji big' }, pack.emoji || '📦'), h('h2', { class: 'grow' }, pack.title), h('span', { class: `chip ${pack.published ? 'status-review' : 'warn'}` }, pack.published ? a.published : a.unpublished)),
        h(
          'details',
          { class: 'fold' },
          h('summary', null, h('b', null, t.common.edit), icon('chevron', { size: 18 })),
          h(
            'div',
            { class: 'stack' },
            text('title', a.packTitle, { max: 120 }),
            text('description', a.packDescription, { max: 500, multiline: true }),
            h('div', { class: 'row wrap' }, h('div', { class: 'grow' }, text('emoji', a.packEmoji, { max: 16 })), h('div', { class: 'grow' }, text('topic', a.packTopic, { max: 60, ltr: true }))),
            text('slug', a.packSlug, { max: 80, ltr: true }),
            h(
              'div',
              { class: 'row wrap' },
              h('div', { class: 'grow' }, select<PackKind>(a.packKind, p.kind, kinds.map((k) => ({ value: k, label: t.store.kinds[k] })), (v) => (p.kind = v ?? 'words'))),
              h('div', { class: 'grow' }, select<PackLevel>(a.packLevel, p.level, [{ value: '', label: a.levelNone }, { value: 'basic', label: t.store.levels.basic }, { value: 'advanced', label: t.store.levels.advanced }], (v) => (p.level = v))),
            ),
            h(
              'div',
              { class: 'row wrap' },
              h('label', { class: 'field grow' }, h('span', null, a.lessonSize), h('input', { class: 'input', type: 'number', min: '5', max: '40', value: String(p.lesson_size), dir: 'ltr', oninput: (e: Event) => (p.lesson_size = Math.max(5, Math.min(40, Number((e.target as HTMLInputElement).value) || 12))) })),
              h('label', { class: 'field grow' }, h('span', null, a.sortOrder), h('input', { class: 'input', type: 'number', value: String(p.sort_order), dir: 'ltr', oninput: (e: Event) => (p.sort_order = Math.round(Number((e.target as HTMLInputElement).value) || 0)) })),
            ),
            save,
          ),
        ),
        h('p', { class: 'small muted' }, a.draftCount(ready, items.length)),
        h('div', { class: 'row wrap' }, publish, remove),
      ),
    )
  }

  const nextPosition = () => items.reduce((m, i) => Math.max(m, i.position + 1), 0)

  async function addPasted(text: string, button: HTMLButtonElement) {
    const existing = new Set(items.map((i) => i.input.toLocaleLowerCase('de')))
    const parsed = parseItemList(text).filter((x) => !existing.has(x.input.toLocaleLowerCase('de')))
    if (parsed.length === 0 || !pack) return
    const start = nextPosition()
    const size = pack.lesson_size
    const base = items.length
    const rows = parsed.map((x, i) => ({ pack_id: id, position: start + i, lesson: Math.floor((base + i) / size) + 1, input: x.input, hint: x.hint }))
    await act(ctx, button, async () => {
      for (let k = 0; k < rows.length; k += 200) items.push(...(await admin.addItems(ctx.client, rows.slice(k, k + 200))))
    }, a.added(rows.length))
    renderForm()
    renderItems()
  }

  async function generate(list: PackItem[]) {
    if (running || list.length === 0 || !pack) return
    running = { done: 0, total: list.length, stop: false }
    renderItems()
    let ok = 0
    let failed = 0
    const queue = [...list]
    const worker = async () => {
      while (queue.length > 0 && running && !running.stop && !destroyed) {
        const item = queue.shift()!
        try {
          const next = await admin.generateItem(ctx.client, item, { target: ctx.data.profile.activeTargetLanguage, native: ctx.data.profile.nativeLanguage })
          items = items.map((i) => (i.id === next.id ? next : i))
          if (next.status === 'ready') ok++
          else failed++
        } catch (err) {
          running.stop = true
          ctx.toast(describeError(toAppError(err)), 'error')
        }
        running.done++
        if (!destroyed) renderItems()
      }
    }
    await Promise.all([worker(), worker(), worker()])
    running = null
    if (destroyed) return
    ctx.toast(a.generated(ok, failed))
    renderForm()
    renderItems()
  }

  async function relesson(button: HTMLButtonElement) {
    if (!pack) return
    const next = assignLessons(items, pack.lesson_size)
    const changed = next.filter((n) => items.find((i) => i.id === n.id)?.lesson !== n.lesson)
    await act(ctx, button, async () => {
      for (const item of changed) await admin.updateItem(ctx.client, item.id, { lesson: item.lesson })
    }, a.relessoned)
    items = next
    renderItems()
  }

  function renderItems() {
    const pending = items.filter((i) => i.status !== 'ready')
    const paste = h('textarea', { class: 'textarea de', rows: 5, dir: 'ltr', lang: 'de', placeholder: 'die Bank | نیمکت\nder Termin\nWie spät ist es?', 'aria-label': a.paste })
    const addBtn = h('button', { class: 'btn', type: 'button' }, icon('plus', { size: 18 }), a.pasteAdd)
    addBtn.onclick = () => void addPasted(paste.value, addBtn)
    const relessonBtn = h('button', { class: 'btn small ghost', type: 'button' }, a.relesson)
    relessonBtn.onclick = () => void relesson(relessonBtn)

    const byLesson = new Map<number, PackItem[]>()
    for (const item of [...items].sort((x, y) => x.position - y.position)) {
      const list = byLesson.get(item.lesson) ?? []
      list.push(item)
      byLesson.set(item.lesson, list)
    }

    const itemRow = (item: PackItem) => {
      const retry = h('button', { class: 'icon-btn compact', type: 'button', title: a.retry, 'aria-label': a.retry, disabled: running !== null }, icon('refresh', { size: 18 }))
      retry.onclick = () => void generate([item])
      const del = h('button', { class: 'icon-btn compact', type: 'button', title: a.removeItem, 'aria-label': a.removeItem, disabled: running !== null }, icon('trash', { size: 18 }))
      del.onclick = async () => {
        if (await act(ctx, del, () => admin.deleteItem(ctx.client, item.id))) {
          items = items.filter((i) => i.id !== item.id)
          renderForm()
          renderItems()
        }
      }
      return h(
        'li',
        { class: `pack-item ${item.status}` },
        h('span', { class: `chip item-${item.status}` }, a.itemStatus[item.status]),
        h(
          'span',
          { class: 'grow pack-item-text' },
          h('b', { class: 'de', lang: 'de', dir: 'ltr' }, de(item.lemma ?? item.input)),
          item.hint ? h('small', { class: 'muted' }, ` (${a.hint}: ${item.hint})`) : null,
          item.primary_meaning ? h('span', { class: 'small muted' }, item.primary_meaning) : null,
        ),
        item.status === 'ready' ? h('a', { class: 'icon-btn compact', href: `#/admin/packs/${id}/items/${item.id}`, title: a.editItem, 'aria-label': a.editItem }, icon('edit', { size: 18 })) : retry,
        del,
      )
    }

    replace(
      itemsBox,
      h(
        'section',
        { class: 'card stack' },
        h('h2', null, a.paste),
        h('p', { class: 'help' }, a.pasteHelp),
        paste,
        addBtn,
      ),
      pending.length > 0 || running
        ? h(
            'section',
            { class: 'card stack generate-card' },
            running
              ? [
                  h('b', null, a.generating(running.done, running.total)),
                  progressBar(running.done / running.total, a.generating(running.done, running.total)),
                  h('button', { class: 'btn', type: 'button', onclick: () => running && (running.stop = true) }, a.stop),
                ]
              : [
                  h('button', { class: 'btn primary big block', type: 'button', onclick: () => void generate(pending) }, icon('sparkle', { size: 20 }), a.generate(pending.length)),
                  avgCost > 0 ? h('small', { class: 'muted center' }, a.estimate(usdText(avgCost * pending.length))) : null,
                ],
          )
        : null,
      h(
        'section',
        { class: 'card stack' },
        h('div', { class: 'row spread' }, h('h2', null, `${a.items} (${fa(items.length)})`), items.length > 0 ? relessonBtn : null),
        [...byLesson.entries()].map(([lesson, list]) => h('div', { class: 'stack', style: { gap: 'var(--s1)' } }, h('h3', { class: 'small muted' }, t.store.lesson(lesson)), h('ul', { class: 'admin-list' }, list.map(itemRow)))),
      ),
    )
  }

  guarded(ctx, el, header, () => void load())
  return {
    el,
    destroy: () => {
      destroyed = true
      if (running) running.stop = true
    },
    canLeave: () => !running || ctx.confirm({ title: a.stop, body: a.generating(running.done, running.total), confirmLabel: a.stop, danger: true }),
  }
}

// --- editing one pack item -----------------------------------------------------------------------

export function adminItemScreen(ctx: Ctx, params: Record<string, string>): Screen {
  const packId = params.id ?? ''
  const itemId = params.item ?? ''
  const el = h('main', { class: 'screen admin' })
  const header = () => h('header', { class: 'topbar' }, back(ctx, `/admin/packs/${packId}`), h('h1', null, a.editItem))
  let dirty = () => false
  let saved = false
  guarded(ctx, el, header, async () => {
    try {
      const item = await admin.item(ctx.client, itemId)
      if (!item?.content) return replace(el, header(), emptyState({ title: t.detail.notFound }))
      const editor = createEditor(item.content)
      dirty = editor.dirty
      const save = h('button', { class: 'btn primary big grow', type: 'button' }, icon('check'), t.common.save)
      save.onclick = async () => {
        const result = editor.read()
        if (!result.ok) return
        if (await act(ctx, save, () => admin.updateItem(ctx.client, itemId, itemFromContent(result.value)), a.itemSaved)) {
          saved = true
          ctx.go(`/admin/packs/${packId}`, { replace: true })
        }
      }
      replace(el, header(), h('p', { class: 'small muted', dir: 'ltr' }, item.input, item.hint ? ` | ${item.hint}` : ''), editor.el, h('div', { class: 'sticky-actions' }, h('a', { class: 'btn big', href: `#/admin/packs/${packId}` }, t.common.cancel), save))
    } catch (err) {
      replace(el, header(), failure(err))
    }
  })
  return { el, canLeave: () => saved || !dirty() || ctx.confirm({ title: t.draft.discardConfirm, confirmLabel: t.draft.discard, danger: true }) }
}

// --- fixing a reported card ---------------------------------------------------------------------

export function adminReportScreen(ctx: Ctx, params: Record<string, string>): Screen {
  const id = params.id ?? ''
  const el = h('main', { class: 'screen admin' })
  const header = () => h('header', { class: 'topbar' }, back(ctx, '/admin/inbox'), h('h1', null, a.fixTitle))
  let dirty = () => false
  let saved = false
  guarded(ctx, el, header, async () => {
    try {
      const report = await admin.report(ctx.client, id)
      if (!report?.content) return replace(el, header(), emptyState({ title: t.detail.notFound }))
      const editor = createEditor(report.content)
      dirty = editor.dirty
      const save = h('button', { class: 'btn primary big grow', type: 'button' }, icon('check'), a.fixSave)
      save.onclick = async () => {
        const result = editor.read()
        if (!result.ok) return
        const content = result.value
        const article = content.noun?.article
        let changed = 0
        const ok = await act(ctx, save, async () => {
          changed = await admin.fixCache(ctx.client, [report.lemma, content.lemma, ...(article ? [`${article} ${content.lemma}`] : [])], content)
          await admin.setReportStatus(ctx.client, id, 'fixed')
        })
        if (ok) {
          saved = true
          ctx.toast(a.fixed(changed))
          ctx.go('/admin/inbox', { replace: true })
        }
      }
      replace(
        el,
        header(),
        h(
          'section',
          { class: 'card stack' },
          h('div', { class: 'row wrap' }, h('span', { class: 'chip' }, t.report.reasons[report.reason]), h('small', { class: 'muted' }, faDateTime(report.created_at))),
          report.message ? h('p', null, report.message) : null,
          h('p', { class: 'help' }, a.fixHelp),
        ),
        editor.el,
        h('div', { class: 'sticky-actions' }, h('a', { class: 'btn big', href: '#/admin/inbox' }, t.common.cancel), save),
      )
    } catch (err) {
      replace(el, header(), failure(err))
    }
  })
  return { el, canLeave: () => saved || !dirty() || ctx.confirm({ title: t.draft.discardConfirm, confirmLabel: t.draft.discard, danger: true }) }
}

