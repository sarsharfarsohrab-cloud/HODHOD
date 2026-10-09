import { FSRS_SCHEDULER_VERSION } from '../../core/fsrsScheduler.ts'
import { SETTINGS_LIMITS, type Settings } from '../../core/types.ts'
import { toAppError } from '../../data/errors.ts'
import type { Ctx, Screen } from '../context.ts'
import { h, icon, replace } from '../dom.ts'
import { fa, faDateTime, faPercent } from '../format.ts'
import { APP_NAME, describeError, t } from '../strings.ts'
import { openSheet, segmented } from '../widgets.ts'

declare const __APP_VERSION__: string

export function settingsScreen(ctx: Ctx): Screen {
  const el = h('main', { class: 'screen' })
  const s = t.settings
  let advancedOpen = false
  let saveTimer: ReturnType<typeof setTimeout> | undefined

  const update = (patch: Partial<Settings>, rerender = true) => {
    void ctx.data.updateSettings(patch)
    if (rerender) render()
  }
  /** Sliders fire continuously: show the value at once, store it when the finger rests. */
  const updateSoon = (patch: Partial<Settings>) => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => update(patch, false), 400)
  }

  // The sync card changes from outside (uploads finish, the connection drops), so it
  // refreshes on its own without rebuilding the form the learner may be typing in.
  const syncCard = h('section', { class: 'card stack' })
  const renderSync = () => {
    const sync = ctx.data.sync
    replace(
      syncCard,
      h('h2', null, s.data),
      h(
        'p',
        { class: 'small muted', 'aria-live': 'polite' },
        sync.syncing ? s.syncing : sync.lastSyncedAt ? s.synced(faDateTime(sync.lastSyncedAt)) : s.neverSynced,
        sync.pending > 0 ? `، ${s.pending(sync.pending)}` : '',
      ),
      !sync.online ? h('p', { class: 'notice warn' }, icon('offline', { size: 18 }), t.sync.offlineBanner) : null,
      h('button', { class: 'btn block', type: 'button', disabled: sync.syncing || !sync.online, onclick: () => void ctx.data.syncNow() }, icon('refresh', { size: 18 }), s.syncNow),
      h('button', { class: 'btn block', type: 'button', onclick: (e: Event) => void exportData(e.currentTarget as HTMLButtonElement) }, icon('download', { size: 18 }), s.export),
      h('p', { class: 'help' }, s.exportHelp),
    )
  }

  const setting = (title: string, control: Node, help?: string | null, extra?: Node | null) =>
    h('div', { class: 'setting' }, h('div', { class: 'row spread wrap' }, h('span', { class: 'label', style: { color: 'var(--ink)' } }, title), control), help ? h('p', { class: 'help' }, help) : null, extra ?? null)

  const stepper = (value: number, min: number, max: number, onChange: (v: number) => void, label: string) =>
    h(
      'div',
      { class: 'stepper', role: 'group', 'aria-label': label },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': `${label}: −`, disabled: value <= min, onclick: () => onChange(Math.max(min, value - 1)) }, '−'),
      h('output', { 'aria-live': 'polite' }, fa(value)),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': `${label}: +`, disabled: value >= max, onclick: () => onChange(Math.min(max, value + 1)) }, '+'),
    )

  function render() {
    const { data } = ctx
    const settings = data.settings
    const session = ctx.client.session
    renderSync()

    const name = h('input', { class: 'input', type: 'text', value: data.profile.displayName ?? '', maxLength: 60, autocomplete: 'given-name', 'aria-label': s.displayName })
    name.onchange = async () => {
      try {
        await data.updateDisplayName(name.value)
        ctx.toast(s.saved)
      } catch (err) {
        ctx.toast(describeError(toAppError(err)), 'error')
      }
    }

    const retentionLabel = h('output', null, faPercent(settings.desiredRetention))
    const rateLabel = h('output', null, `${fa(Math.round(settings.speechRate * 100))}٪`)

    replace(
      el,
      h('header', { class: 'topbar' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': t.common.back, onclick: () => ctx.go('/home') }, icon('back')), h('h1', null, s.title)),

      h(
        'section',
        { class: 'card' },
        h('h2', null, s.learning),
        setting(
          s.newPerDay,
          stepper(settings.newPerDay, SETTINGS_LIMITS.newPerDay.min, SETTINGS_LIMITS.newPerDay.max, (v) => update({ newPerDay: v }), s.newPerDay),
          s.newPerDayHelp,
          settings.newPerDay > SETTINGS_LIMITS.newPerDay.warnAbove
            ? h('p', { class: 'notice warn' }, icon('info', { size: 18 }), s.newPerDayWarn)
            : settings.newPerDay === 0
              ? h('p', { class: 'notice' }, icon('info', { size: 18 }), s.newPerDayZero)
              : null,
        ),
        h(
          'div',
          { class: 'setting' },
          h('span', { class: 'label', style: { color: 'var(--ink)' } }, s.dailyGoal),
          h(
            'div',
            { class: 'chips', role: 'group', 'aria-label': s.dailyGoal },
            SETTINGS_LIMITS.dailyGoalMinutes.choices.map((minutes) =>
              h('button', { class: 'chip', type: 'button', 'aria-pressed': String(settings.dailyGoalMinutes === minutes), onclick: () => update({ dailyGoalMinutes: minutes }) }, s.minutes(minutes)),
            ),
          ),
          h('p', { class: 'help' }, s.dailyGoalHelp),
        ),
        h(
          'div',
          { class: 'setting' },
          h('label', { class: 'switch' }, h('span', { style: { fontWeight: '700' } }, s.reverseCards), h('input', { type: 'checkbox', checked: settings.reverseCards, onchange: (e: Event) => void data.setReverseCards((e.target as HTMLInputElement).checked) })),
          h('p', { class: 'help' }, s.reverseCardsHelp),
        ),
        h(
          'details',
          { class: 'fold', open: advancedOpen, ontoggle: (e: Event) => (advancedOpen = (e.target as HTMLDetailsElement).open) },
          h('summary', null, s.advanced, icon('chevron', { size: 20 })),
          h(
            'div',
            { class: 'setting' },
            h('span', { class: 'label', style: { color: 'var(--ink)' } }, s.reviewLimit),
            segmented(
              [{ value: 'auto', label: s.reviewLimitAuto }, { value: 'custom', label: s.reviewLimitCustom }],
              settings.maxReviewsPerDay === null ? 'auto' : 'custom',
              (v) => update({ maxReviewsPerDay: v === 'auto' ? null : 100 }),
              s.reviewLimit,
            ),
            settings.maxReviewsPerDay !== null
              ? h('input', {
                  class: 'input', type: 'number', inputMode: 'numeric', dir: 'ltr', 'aria-label': s.reviewLimitCustom,
                  min: SETTINGS_LIMITS.maxReviewsPerDay.min, max: SETTINGS_LIMITS.maxReviewsPerDay.max, value: String(settings.maxReviewsPerDay),
                  onchange: (e: Event) => {
                    const raw = Math.round(Number((e.target as HTMLInputElement).value))
                    const { min, max } = SETTINGS_LIMITS.maxReviewsPerDay
                    update({ maxReviewsPerDay: Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : 100 })
                  },
                })
              : null,
            h('p', { class: 'help' }, s.reviewLimitHelp),
          ),
          h(
            'div',
            { class: 'setting' },
            h('div', { class: 'row spread' }, h('span', { class: 'label', style: { color: 'var(--ink)' } }, s.retention), retentionLabel),
            h('input', {
              type: 'range', 'aria-label': s.retention, dir: 'ltr',
              min: SETTINGS_LIMITS.desiredRetention.min, max: SETTINGS_LIMITS.desiredRetention.max, step: 0.01, value: String(settings.desiredRetention),
              oninput: (e: Event) => {
                const value = Number((e.target as HTMLInputElement).value)
                retentionLabel.textContent = faPercent(value)
                updateSoon({ desiredRetention: value })
              },
            }),
            h('p', { class: 'help' }, s.retentionHelp),
          ),
          h('p', { class: 'help', style: { paddingBottom: 'var(--s3)' } }, s.learningSteps),
        ),
      ),

      h(
        'section',
        { class: 'card' },
        h('h2', null, s.audio),
        ctx.audio.canSpeak(data.profile.activeTargetLanguage)
          ? [
              h(
                'div',
                { class: 'setting' },
                h('div', { class: 'row spread' }, h('span', { class: 'label', style: { color: 'var(--ink)' } }, s.speechRate), rateLabel),
                h('input', {
                  type: 'range', 'aria-label': s.speechRate, dir: 'ltr',
                  min: SETTINGS_LIMITS.speechRate.min, max: SETTINGS_LIMITS.speechRate.max, step: 0.05, value: String(settings.speechRate),
                  oninput: (e: Event) => {
                    const value = Number((e.target as HTMLInputElement).value)
                    rateLabel.textContent = `${fa(Math.round(value * 100))}٪`
                    updateSoon({ speechRate: value })
                  },
                }),
                h('button', { class: 'btn small', type: 'button', onclick: () => void ctx.audio.speak('Guten Tag! Wie geht es Ihnen?', data.profile.activeTargetLanguage, ctx.data.settings.speechRate) }, icon('speaker', { size: 18 }), s.audioTest),
              ),
              h('div', { class: 'setting' }, h('label', { class: 'switch' }, h('span', null, s.autoplay), h('input', { type: 'checkbox', checked: settings.autoplayAudio, onchange: (e: Event) => update({ autoplayAudio: (e.target as HTMLInputElement).checked }, false) }))),
            ]
          : h('p', { class: 'muted' }, s.audioUnavailable),
      ),

      h(
        'section',
        { class: 'card stack' },
        h('h2', null, s.appearance),
        segmented(
          (['system', 'light', 'dark'] as const).map((value) => ({ value, label: s.themes[value] })),
          settings.theme,
          (theme) => update({ theme }, false),
          s.appearance,
        ),
      ),

      h(
        'section',
        { class: 'card stack' },
        h('h2', null, s.account),
        h('label', { class: 'field' }, h('span', null, s.displayName), name),
        h('div', { class: 'field' }, h('span', null, s.email), h('bdi', { dir: 'ltr', style: { textAlign: 'right' } }, session?.email ?? '—')),
        h('button', { class: 'btn block', type: 'button', onclick: () => void signOut() }, s.signOut),
      ),

      syncCard,

      h(
        'section',
        { class: 'card stack' },
        h('h2', null, s.privacy),
        h('p', { class: 'small' }, s.privacyBody),
        h('button', { class: 'btn danger block', type: 'button', onclick: deleteAccount }, s.deleteAccount),
      ),

      h(
        'section',
        { class: 'card stack' },
        h('h2', null, s.about),
        h(
          'dl',
          { class: 'facts' },
          h('dt', null, s.version), h('dd', null, h('bdi', { dir: 'ltr' }, `${APP_NAME} ${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'}`)),
          h('dt', null, s.scheduler), h('dd', null, h('bdi', { dir: 'ltr', class: 'de' }, FSRS_SCHEDULER_VERSION)),
        ),
        h('p', { class: 'small muted' }, s.aboutBody),
      ),
    )
  }

  async function signOut() {
    if (ctx.data.sync.pending > 0 && !ctx.data.sync.online) return ctx.toast(s.signOutPending(ctx.data.sync.pending), 'error')
    if (await ctx.confirm({ title: s.signOut, body: s.signOutConfirm, confirmLabel: s.signOut })) await ctx.data.signOut()
  }

  async function exportData(button: HTMLButtonElement) {
    button.disabled = true
    try {
      const dump = await ctx.data.exportData()
      const file = new File([JSON.stringify(dump, null, 2)], `hodhod-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' })
      // An installed iPhone app cannot "download"; the share sheet lets the learner save the file.
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] }).catch(() => undefined)
      } else {
        const url = URL.createObjectURL(file)
        const link = h('a', { href: url, download: file.name })
        document.body.appendChild(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
    } catch {
      ctx.toast(s.exportFailed, 'error')
    } finally {
      button.disabled = false
    }
  }

  function deleteAccount() {
    const email = ctx.client.session?.email ?? ''
    openSheet(
      (close) => {
        const input = h('input', { class: 'input', type: 'email', dir: 'ltr', autocomplete: 'off', autocapitalize: 'off', spellcheck: false, 'aria-label': s.deleteConfirmLabel, 'data-autofocus': '' })
        const confirm = h('button', { class: 'btn danger block', type: 'button', disabled: true }, s.deleteConfirmButton)
        input.oninput = () => (confirm.disabled = email === '' || input.value.trim().toLowerCase() !== email.toLowerCase())
        confirm.onclick = async () => {
          confirm.disabled = true
          try {
            await ctx.data.deleteAccount()
            close()
            ctx.toast(s.deleted)
          } catch (err) {
            ctx.toast(describeError(toAppError(err)), 'error')
            confirm.disabled = false
          }
        }
        return [
          h('h2', { style: { fontSize: 'var(--text-lg)' } }, s.deleteAccount),
          h('p', { class: 'notice error' }, s.deleteHelp),
          h('label', { class: 'field' }, h('span', null, s.deleteConfirmLabel), input),
          confirm,
          h('button', { class: 'btn block', type: 'button', onclick: close }, t.common.cancel),
        ]
      },
      { label: s.deleteAccount },
    )
  }

  render()
  return {
    el,
    onData: renderSync,
    destroy: () => clearTimeout(saveTimer),
  }
}
