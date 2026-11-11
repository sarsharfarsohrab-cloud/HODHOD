import { AppError, toAppError } from '../../data/errors.ts'
import type { SupabaseClient } from '../../data/supabase.ts'
import { h, icon, replace } from '../dom.ts'
import { mascot } from '../mascot.ts'
import { appName, currentLanguage, describeError, t } from '../strings.ts'
import { UI_LANGUAGE_INFO, UI_LANGUAGES } from '../i18n/languages.ts'
import { segmented } from '../widgets.ts'
import { captchaSiteKey, createCaptcha } from '../captcha.ts'

type Mode = 'signin' | 'signup' | 'recovery'

const MIN_PASSWORD = 8

/** Where e-mail links should bring the user back to: this app, without any route fragment. */
export function appUrl(): string {
  return `${location.origin}${location.pathname}`
}

function authMessage(error: AppError): string {
  // Supabase's own limits (e-mails per hour, sign-ups per hour) arrive as "too many requests"
  if (error.kind === 'rate_limit' && t.auth.errors[error.code]) return t.auth.errors[error.code]!
  if (error.kind === 'auth' || error.kind === 'validation') {
    const known = t.auth.errors[error.code === 'validation_failed' || error.code === 'email_address_invalid' ? 'email_invalid' : error.code]
    return known ?? t.auth.errors.fallback!
  }
  return describeError(error)
}

/** Sign-in, sign-up and "set a new password" (after a reset link). Shown whenever nobody is signed in. */
export function authScreen(
  client: SupabaseClient,
  options: { mode?: Mode; notice?: string; onPasswordChanged?: () => void; onLanguage?: (code: string) => void } = {},
): HTMLElement {
  let mode: Mode = options.mode ?? 'signin'
  let busy = false
  const form = h('form', { class: 'card stack', novalidate: true })
  const message = h('div', { role: 'alert', 'aria-live': 'assertive' })

  const show = (text: string, kind: 'error' | 'ok') => replace(message, h('div', { class: `notice ${kind}` }, text))
  // the human check, when the server asks for one (one widget for the whole screen)
  const siteKey = captchaSiteKey()
  const captcha = siteKey ? createCaptcha(siteKey) : null
  const token = async () => {
    if (!captcha) return null
    const value = await captcha.token()
    if (!value) throw new AppError('auth', 'captcha_failed')
    return value
  }

  const render = () => {
    const name = h('input', { class: 'input', type: 'text', name: 'name', autocomplete: 'given-name', maxLength: 60, placeholder: t.auth.namePlaceholder })
    const email = h('input', { class: 'input', type: 'email', name: 'email', autocomplete: 'email', inputMode: 'email', dir: 'ltr', required: true, autocapitalize: 'off', spellcheck: false })
    const password = h('input', {
      class: 'input', type: 'password', name: 'password', dir: 'ltr', required: true, minLength: MIN_PASSWORD,
      autocomplete: mode === 'signin' ? 'current-password' : 'new-password',
    })
    const submit = h('button', { class: 'btn primary big block', type: 'submit' }, mode === 'signin' ? t.auth.submitSignIn : mode === 'signup' ? t.auth.submitSignUp : t.auth.newPasswordSubmit)

    const run = async (work: () => Promise<void>) => {
      if (busy) return
      busy = true
      submit.disabled = true
      replace(message)
      try {
        await work()
      } catch (err) {
        show(authMessage(toAppError(err)), 'error')
      } finally {
        captcha?.reset()
        busy = false
        submit.disabled = false
      }
    }

    form.onsubmit = (event) => {
      event.preventDefault()
      const mail = email.value.trim()
      if (mode !== 'recovery' && !/^\S+@\S+\.\S+$/.test(mail)) return show(t.auth.errors.email_invalid!, 'error')
      if (mode !== 'signin' && password.value.length < MIN_PASSWORD) return show(t.auth.errors.password_short!, 'error')
      void run(async () => {
        if (mode === 'signin') await client.signIn(mail, password.value, await token())
        else if (mode === 'signup') {
          const result = await client.signUp(mail, password.value, name.value.trim(), appUrl(), await token(), currentLanguage())
          if (result.needsEmailConfirmation) {
            mode = 'signin'
            render()
            show(t.auth.confirmSent, 'ok')
          }
        } else {
          await client.updatePassword(password.value)
          options.onPasswordChanged?.()
        }
      })
    }

    replace(
      form,
      mode === 'recovery'
        ? h('h2', null, t.auth.newPasswordTitle)
        : segmented<Mode>([{ value: 'signin', label: t.auth.signIn }, { value: 'signup', label: t.auth.signUp }], mode, (value) => { mode = value; replace(message); render() }, t.auth.signIn),
      mode === 'signup' ? h('label', { class: 'field' }, h('span', null, t.auth.name), name) : null,
      mode !== 'recovery' ? h('label', { class: 'field' }, h('span', null, t.auth.email), email) : null,
      h('label', { class: 'field' }, h('span', null, t.auth.password), password, mode !== 'signin' ? h('span', { class: 'help' }, t.auth.passwordHint) : null),
      mode !== 'recovery' ? captcha?.el ?? null : null,
      message,
      submit,
      mode === 'signin'
        ? h(
            'button',
            {
              class: 'btn ghost small',
              type: 'button',
              onclick: () => {
                const mail = email.value.trim()
                if (!/^\S+@\S+\.\S+$/.test(mail)) return show(t.auth.resetNeedsEmail, 'error')
                void run(async () => {
                  await client.sendPasswordReset(mail, appUrl(), await token())
                  show(t.auth.resetSent, 'ok')
                })
              },
            },
            t.auth.forgot,
          )
        : null,
    )
  }

  render()
  if (options.notice) show(options.notice, 'error')
  const languagePicker = options.onLanguage ? languageMenu(options.onLanguage) : null
  return h(
    'main',
    { class: 'screen no-nav auth' },
    languagePicker ? h('div', { class: 'auth-language' }, languagePicker) : null,
    h(
      'div',
      { class: 'auth-hero' },
      // the bird on its own ink-blue perch, as in the app icon and the welcome tour
      h('div', { class: 'auth-bird' }, mascot('happy', { size: 128, enter: 'hop' }), h('p', { class: 'auth-bubble' }, t.auth.hello)),
      h('h1', null, appName()),
      h('p', { class: 'muted' }, t.auth.tagline),
    ),
    form,
  )
}

/** A small flag menu: the chosen language's flag and English name; open it to switch. */
function languageMenu(onLanguage: (code: string) => void): HTMLElement {
  const current = UI_LANGUAGE_INFO[currentLanguage()]
  const flag = (code: string) => h('img', { class: 'language-flag', src: `./flags/${code}.svg`, alt: '', width: 24, height: 18, decoding: 'async' })
  return h(
    'details',
    { class: 'language-menu', dir: 'ltr' },
    h('summary', { 'aria-label': t.auth.language }, flag(current.code), h('span', null, current.english), icon('chevron', { size: 16 })),
    h(
      'div',
      { class: 'language-menu-list', role: 'list' },
      UI_LANGUAGES.map((code) =>
        h(
          'button',
          { type: 'button', class: code === current.code ? 'current' : '', 'data-language': code, 'aria-current': code === current.code ? 'true' : null, onclick: () => onLanguage(code) },
          flag(code),
          h('span', null, UI_LANGUAGE_INFO[code].english),
          UI_LANGUAGE_INFO[code].name === UI_LANGUAGE_INFO[code].english ? null : h('small', { lang: code, dir: UI_LANGUAGE_INFO[code].dir }, UI_LANGUAGE_INFO[code].name),
        ),
      ),
    ),
  )
}
