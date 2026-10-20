/**
 * The welcome tour after signing up: a few short questions, one per page, with the bird
 * as guide. The answers become the learner's settings (all changeable later).
 */
import { localTimeZone } from '../../core/time.ts'
import type { Ctx, Screen } from '../context.ts'
import { h, icon, replace } from '../dom.ts'
import { fa } from '../format.ts'
import { mascot, type MascotMood } from '../mascot.ts'
import { t } from '../strings.ts'
import { enablePush, pushState } from '../../data/push.ts'

type Level = 'beginner' | 'some' | 'intermediate'
const MINUTES = [5, 10, 20, 30] as const

/** A sensible number of new words for the time and level chosen. */
export function suggestNewPerDay(minutes: number, level: Level): number {
  const base = minutes <= 5 ? 3 : minutes <= 10 ? 5 : minutes <= 20 ? 10 : 15
  return level === 'beginner' ? Math.max(3, base - 2) : level === 'intermediate' ? base + 3 : base
}

export function welcomeScreen(ctx: Ctx): Screen {
  const el = h('main', { class: 'screen no-nav welcome' })
  const w = t.welcome
  let step = 0
  let minutes: number = ctx.data.settings.dailyGoalMinutes && MINUTES.includes(ctx.data.settings.dailyGoalMinutes as (typeof MINUTES)[number]) ? ctx.data.settings.dailyGoalMinutes : 10
  let level: Level = 'beginner'
  // someone who already uses the app sees this once after an update: their numbers stay the start
  const returning = ctx.data.words.size > 0
  let perDay = returning ? ctx.data.settings.newPerDay || suggestNewPerDay(minutes, level) : suggestNewPerDay(minutes, level)
  let perDayTouched = false

  const finish = async (go: string) => {
    await ctx.data.updateSettings({ dailyGoalMinutes: minutes, newPerDay: perDay, timeZone: localTimeZone(), onboarded: true })
    ctx.go(go, { replace: true })
  }

  const dots = () => h('ol', { class: 'welcome-dots', 'aria-label': w.progress(step + 1, 4) }, [0, 1, 2, 3].map((i) => h('li', { class: i === step ? 'on' : i < step ? 'done' : '' })))

  const page = (mood: MascotMood, title: string, body: string | null, content: Node | null, primary: HTMLElement, enter: 'fly' | 'hop' = 'hop') =>
    replace(
      el,
      h('div', { class: 'welcome-top' }, dots(), step < 3 ? h('button', { class: 'btn ghost small', type: 'button', onclick: () => void finish('/home') }, w.skip) : h('span')),
      h('div', { class: 'welcome-bird' }, mascot(mood, { size: 168, enter })),
      h('h1', { class: 'welcome-title' }, title),
      body ? h('p', { class: 'welcome-body' }, body) : null,
      content,
      h('div', { class: 'welcome-actions' }, primary, step > 0 && step < 3 ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { step--; render() } }, t.common.back) : null),
    )

  const next = (label: string = w.next) => h('button', { class: 'btn primary big block', type: 'button', 'data-autofocus': '', onclick: () => { step++; render() } }, label)

  const choice = <T,>(options: { value: T; title: string; hint: string }[], current: T, pick: (v: T) => void) =>
    h(
      'div',
      { class: 'welcome-choices', role: 'radiogroup' },
      options.map((o) =>
        h(
          'button',
          {
            class: 'option-card',
            type: 'button',
            role: 'radio',
            'aria-checked': String(o.value === current),
            onclick: () => {
              pick(o.value)
              render()
            },
          },
          h('b', null, o.title),
          h('span', null, o.hint),
        ),
      ),
    )

  function render() {
    const name = ctx.data.profile.displayName
    if (step === 0) {
      if (returning) {
        const news = h('ul', { class: 'whats-new' }, w.whatsNew.map(([emoji, text]) => h('li', null, h('span', { 'aria-hidden': 'true' }, emoji), text)))
        return page('excited', w.helloAgain(name), w.helloAgainBody, news, next(w.next), 'fly')
      }
      return page('morning', w.hello(name), w.helloBody, null, next(w.start), 'fly')
    }
    if (step === 1) {
      return page(
        'waiting',
        w.timeTitle,
        w.timeBody,
        choice(
          MINUTES.map((m) => ({ value: m as number, title: w.minutes(m), hint: w.timeHint[m] })),
          minutes,
          (v) => {
            minutes = v
            if (!perDayTouched) perDay = suggestNewPerDay(minutes, level)
          },
        ),
        next(),
      )
    }
    if (step === 2) {
      return page(
        'teacher',
        w.levelTitle,
        w.levelBody,
        h(
          'div',
          { class: 'stack' },
          choice<Level>(
            [
              { value: 'beginner', title: w.levels.beginner, hint: w.levelHints.beginner },
              { value: 'some', title: w.levels.some, hint: w.levelHints.some },
              { value: 'intermediate', title: w.levels.intermediate, hint: w.levelHints.intermediate },
            ],
            level,
            (v) => {
              level = v
              if (!perDayTouched) perDay = suggestNewPerDay(minutes, level)
            },
          ),
          h(
            'div',
            { class: 'welcome-perday' },
            h('span', null, w.perDay),
            h(
              'div',
              { class: 'row' },
              h('button', { class: 'btn square', type: 'button', 'aria-label': w.less, onclick: () => { perDay = Math.max(1, perDay - 1); perDayTouched = true; render() } }, '−'),
              h('b', { class: 'big-number', 'aria-live': 'polite' }, fa(perDay)),
              h('button', { class: 'btn square', type: 'button', 'aria-label': w.more, onclick: () => { perDay = Math.min(50, perDay + 1); perDayTouched = true; render() } }, '+'),
            ),
          ),
          h('p', { class: 'help' }, w.perDayHelp),
        ),
        next(),
      )
    }
    // reminders can only be switched on from a tap, so the offer sits here
    const reminder = h('div', { class: 'stack welcome-reminder', hidden: true })
    void pushState().then((state) => {
      if (state !== 'off') return
      const on = h('button', { class: 'btn block', type: 'button' }, icon('bell', { size: 18 }), w.reminderOn)
      on.onclick = async () => {
        on.disabled = true
        try {
          if ((await enablePush(ctx.client)) === 'on') {
            await ctx.data.updateSettings({ notifyDaily: true, timeZone: localTimeZone() })
            replace(reminder, h('p', { class: 'notice ok' }, icon('check', { size: 18 }), h('span', null, w.reminderDone)))
            return
          }
        } catch {
          // permission refused or no connection: it can be done later in the settings
        }
        on.disabled = false
      }
      replace(reminder, h('b', null, w.reminderTitle), h('p', { class: 'help' }, t.reminders.dailyHelp), on)
      reminder.hidden = false
    })
    return page(
      'celebrating',
      w.readyTitle,
      w.readyBody(minutes, perDay),
      h('div', { class: 'stack', style: { width: '100%' } }, reminder, h('p', { class: 'notice' }, icon('settings', { size: 18 }), h('span', null, w.changeLater))),
      h(
        'div',
        { class: 'stack', style: { width: '100%' } },
        returning
          ? h('button', { class: 'btn primary big block', type: 'button', 'data-autofocus': '', onclick: () => void finish('/home') }, w.toHome)
          : h('button', { class: 'btn primary big block', type: 'button', 'data-autofocus': '', onclick: () => void finish('/create') }, icon('plus'), w.firstWord),
        returning ? null : h('button', { class: 'btn big block', type: 'button', onclick: () => void finish('/home') }, w.toHome),
      ),
    )
  }

  render()
  return { el, nav: false }
}
