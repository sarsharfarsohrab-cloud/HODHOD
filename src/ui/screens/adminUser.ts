/**
 * Admin panel: one learner on one page — languages and words, activity, AI costs, Plus and
 * limits, and whether their reminders are set up and arriving.
 */
import { toAppError } from '../../data/errors.ts'
import { admin, isAdmin, type AdminReminders, type AdminUserDetail } from '../../data/platform.ts'
import type { Ctx, Screen } from '../context.ts'
import { h, icon, replace } from '../dom.ts'
import { fmtDate, fmtDateTime, fmtRelative, num } from '../format.ts'
import { TARGET_LANGUAGE_INFO } from '../i18n/languages.ts'
import { languageLabel } from '../i18n/names.ts'
import { mascot } from '../mascot.ts'
import { t } from '../strings.ts'
import { emptyState } from '../widgets.ts'
import { failure, stat, usd, userActions } from './admin.ts'

const a = t.admin

export function adminUserScreen(ctx: Ctx, params: Record<string, string>): Screen {
  const el = h('main', { class: 'screen wide admin' })
  const header = (title: string = a.userPage) =>
    h(
      'header',
      { class: 'topbar' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.common.back, title: t.common.back, onclick: () => ctx.go('/admin/users') }, icon('back')),
      h('h1', null, title),
    )
  replace(el, header(), h('p', { class: 'muted center' }, t.common.loading))

  const load = async () => {
    if (!(await isAdmin(ctx.client))) {
      replace(el, header(), emptyState({ art: mascot('confused', { size: 120 }), title: a.notAllowed }))
      return
    }
    try {
      const [u, r] = await Promise.all([admin.user(ctx.client, params.id ?? ''), admin.reminders(ctx.client, params.id ?? '').catch(() => null)])
      replace(el, header(u.display_name || u.email), ...page(ctx, u, r, load))
    } catch (err) {
      const e = toAppError(err)
      replace(el, header(), e.kind === 'not_found' ? emptyState({ art: mascot('confused', { size: 120 }), title: a.userNotFound }) : failure(err))
    }
  }
  void load()
  return { el }
}

function page(ctx: Ctx, u: AdminUserDetail, r: AdminReminders | null, reload: () => void): (HTMLElement | null)[] {
  const now = ctx.now()
  const blocked = u.blocked || u.banned
  const plus = u.plus_until && Date.parse(u.plus_until) > now.getTime()
  const totalCost = u.costs_30d.reduce((n, c) => n + c.cost, 0)
  return [
    h(
      'section',
      { class: 'card stack' },
      h(
        'div',
        { class: 'row wrap', style: { gap: 'var(--s2)' } },
        h('bdi', { dir: 'ltr', class: 'grow user-email' }, u.email),
        u.is_admin ? h('span', { class: 'chip status-review' }, a.adminBadge) : null,
        plus ? h('span', { class: 'chip plus' }, a.plusUntil(fmtDate(u.plus_until!))) : h('span', { class: 'chip' }, a.noPlus),
        blocked ? h('span', { class: 'chip danger' }, a.blockedBadge) : null,
        u.ai_per_day !== null ? h('span', { class: 'chip' }, a.limitBadge(u.ai_per_day)) : null,
      ),
      h(
        'p',
        { class: 'small muted' },
        [a.joined(fmtDate(u.created_at)), u.last_sign_in_at ? a.lastSignIn(fmtRelative(u.last_sign_in_at, now)) : null, u.last_active_at ? a.lastActive(fmtRelative(u.last_active_at, now)) : a.neverActive].filter(Boolean).join('، '),
      ),
      u.is_admin ? null : userActions(ctx, u, (change) => (change === 'deleted' ? ctx.go('/admin/users') : reload())),
    ),
    h(
      'section',
      { class: 'admin-stats' },
      stat(num(u.words), a.wordsTotal),
      stat(num(u.reviews_30d), a.activity, a.userReviews7(u.reviews_7d)),
      stat(num(u.streak), a.streakDays(u.streak)),
      stat(usd(totalCost, 3), a.userCosts),
    ),
    h(
      'div',
      { class: 'admin-two' },
      h(
        'section',
        { class: 'card stack' },
        h('h2', null, a.decksTitle),
        h(
          'p',
          { class: 'small muted' },
          `${a.ownLanguage}: ${u.native_language ? languageLabel(u.native_language) : '—'}، ${a.learningNow}: ${u.active_language ? languageLabel(u.active_language) : '—'}`,
        ),
        h(
          'ul',
          { class: 'admin-list compact' },
          u.languages.map((l) =>
            h(
              'li',
              null,
              h('span', { class: 'kind-dot', 'aria-hidden': 'true', style: { background: (TARGET_LANGUAGE_INFO as Record<string, { color: string }>)[l.language]?.color ?? 'var(--ink-3)' } }),
              h('span', { class: 'grow' }, languageLabel(l.language)),
              h('small', { class: 'muted' }, a.words(l.words)),
            ),
          ),
        ),
        h('p', { class: 'small muted' }, a.extras(u.packs, u.friends, u.stories)),
      ),
      h(
        'section',
        { class: 'card stack' },
        h('h2', null, a.cardStates),
        h(
          'ul',
          { class: 'admin-list compact' },
          (['new', 'learning', 'review', 'relearning'] as const)
            .filter((s) => u.cards[s] !== undefined)
            .map((s) => h('li', null, h('span', { class: 'grow' }, a.cardStateNames[s] ?? s), h('b', null, num(u.cards[s] ?? 0)))),
        ),
        u.costs_30d.length > 0
          ? h(
              'ul',
              { class: 'admin-list compact' },
              u.costs_30d.map((c) => h('li', null, h('span', { class: 'grow' }, a.kinds[c.kind] ?? c.kind), h('small', { class: 'muted' }, num(c.calls)), usd(c.cost, 4))),
            )
          : null,
      ),
    ),
    reminders(r, now),
  ]
}

/** Is this learner's reminder set up, does a device exist, and did reminders go out lately? */
function reminders(r: AdminReminders | null, now: Date): HTMLElement | null {
  if (!r) return null
  const on = r.settings && (r.settings.daily || r.settings.streak)
  const failing = r.devices.some((d) => d.failures >= 3)
  return h(
    'section',
    { class: 'card stack' },
    h('h2', null, icon('bell', { size: 20 }), ' ', a.remindersTitle),
    on && r.settings
      ? h('p', null, a.reminderSetup(r.settings.time, r.settings.time_zone ?? 'Europe/Berlin', r.settings.streak))
      : h('p', { class: 'muted' }, a.remindersOff),
    r.devices.length === 0
      ? on
        ? h('p', { class: 'notice warn' }, icon('info', { size: 18 }), h('span', null, a.noDevices))
        : null
      : h(
          'ul',
          { class: 'admin-list compact' },
          r.devices.map((d) =>
            h(
              'li',
              { class: 'stack', style: { gap: '2px' } },
              h('small', { class: 'muted', dir: 'ltr' }, d.agent ?? '—'),
              h(
                'small',
                { class: d.failures >= 3 ? 'bad' : '' },
                [a.device(fmtDate(d.created_at)), d.last_success_at ? a.deviceOk(fmtRelative(d.last_success_at, now)) : a.deviceNever, d.failures > 0 ? a.deviceFailures(d.failures) : null].filter(Boolean).join('، '),
              ),
            ),
          ),
        ),
    failing ? h('p', { class: 'notice warn' }, icon('info', { size: 18 }), h('span', null, a.deviceFailures(Math.max(...r.devices.map((d) => d.failures))))) : null,
    h('h3', null, a.sentTitle),
    r.sent.length === 0
      ? h('p', { class: 'muted small' }, a.sentNone)
      : h(
          'ul',
          { class: 'admin-list compact' },
          r.sent.map((s) => h('li', null, h('span', { class: 'chip' }, a.sentKinds[s.kind] ?? s.kind), h('small', { class: 'muted grow' }, fmtDateTime(s.sent_at)))),
        ),
  )
}
