/**
 * Cloudflare Turnstile — the "are you a person?" check that Supabase Auth can require on
 * sign-up, sign-in and password reset. Only active when a site key is configured
 * (window.HODHOD_CONFIG.turnstileSiteKey); most people never see a puzzle.
 */
import { h } from './dom.ts'

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string
  reset(id: string): void
  remove(id: string): void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let loading: Promise<TurnstileApi> | null = null

export function captchaSiteKey(): string | null {
  const key = (window.HODHOD_CONFIG as { turnstileSiteKey?: string } | undefined)?.turnstileSiteKey?.trim()
  return key ? key : null
}

function load(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile)
    const script = h('script', { src: SCRIPT, async: true, defer: true })
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile missing')))
    script.onerror = () => {
      loading = null
      reject(new Error('turnstile could not load'))
    }
    document.head.append(script)
  })
  return loading
}

export interface Captcha {
  el: HTMLElement
  /** The current one-time token, waiting briefly for the check to finish. Null when it failed. */
  token(): Promise<string | null>
  /** Tokens work once: get a fresh one after every attempt. */
  reset(): void
}

export function createCaptcha(siteKey: string): Captcha {
  const el = h('div', { class: 'captcha' })
  let current: string | null = null
  let widget: string | null = null
  let waiters: ((token: string | null) => void)[] = []
  const settle = (token: string | null) => {
    current = token
    for (const w of waiters) w(token)
    waiters = []
  }
  void load()
    .then((api) => {
      widget = api.render(el, {
        sitekey: siteKey,
        language: 'fa',
        theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light',
        size: 'flexible',
        appearance: 'interaction-only',
        callback: (token: string) => settle(token),
        'expired-callback': () => (current = null),
        'error-callback': () => settle(null),
      })
    })
    .catch(() => settle(null))
  return {
    el,
    token: () =>
      current
        ? Promise.resolve(current)
        : new Promise<string | null>((resolve) => {
            waiters.push(resolve)
            setTimeout(() => resolve(current), 15_000)
          }),
    reset: () => {
      current = null
      if (widget && window.turnstile) window.turnstile.reset(widget)
    },
  }
}
