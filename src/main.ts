/** Application entry: configuration → session → data → shell and routing. */
import { AudioPlayer } from './audio/audio.ts'
import { BrowserSpeechProvider } from './audio/browserSpeech.ts'
import { createFsrsScheduler } from './core/fsrsScheduler.ts'
import { queueCounts } from './core/queue.ts'
import type { Scheduler } from './core/scheduler.ts'
import type { Settings } from './core/types.ts'
import { AppData } from './data/appData.ts'
import { toAppError } from './data/errors.ts'
import { openLocalDb } from './data/localDb.ts'
import { SupabaseClient, type KeyValueStore, type Session, type SupabaseConfig } from './data/supabase.ts'
import type { Ctx, Screen, ScreenFactory } from './ui/context.ts'
import { h, icon, replace, type IconName } from './ui/dom.ts'
import { fa } from './ui/format.ts'
import { mascot } from './ui/mascot.ts'
import { authScreen } from './ui/screens/auth.ts'
import { createScreen } from './ui/screens/create.ts'
import { homeScreen } from './ui/screens/home.ts'
import { settingsScreen } from './ui/screens/settings.ts'
import { studyScreen } from './ui/screens/study.ts'
import { wordDetailScreen, wordEditScreen } from './ui/screens/wordDetail.ts'
import { wordsScreen } from './ui/screens/words.ts'
import { APP_NAME, describeError, t } from './ui/strings.ts'
import { confirmSheet, emptyState, toast } from './ui/widgets.ts'

declare global {
  interface Window {
    HODHOD_CONFIG?: { supabaseUrl?: string; supabaseAnonKey?: string }
  }
}

const root = document.getElementById('app')!
const THEME_KEY = 'hodhod.theme'
const STALE_SYNC_MS = 5 * 60_000

// --- small platform wrappers ---------------------------------------------------

/** localStorage that never throws (blocked storage, private mode). */
const storage: KeyValueStore = (() => {
  const memory = new Map<string, string>()
  const safe = <T>(work: () => T, fallback: T): T => {
    try {
      return work()
    } catch {
      return fallback
    }
  }
  return {
    getItem: (key) => safe(() => localStorage.getItem(key), null) ?? memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value)
      safe(() => localStorage.setItem(key, value), undefined)
    },
    removeItem: (key) => {
      memory.delete(key)
      safe(() => localStorage.removeItem(key), undefined)
    },
  }
})()

const darkQuery = matchMedia('(prefers-color-scheme: dark)')

function applyTheme(theme: Settings['theme']): void {
  const dark = theme === 'dark' || (theme === 'system' && darkQuery.matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#131127' : '#f1f1f9')
  storage.setItem(THEME_KEY, theme) // read by the inline script in index.html before first paint
}

function readConfig(): SupabaseConfig | null {
  const raw = window.HODHOD_CONFIG
  const url = raw?.supabaseUrl?.trim().replace(/\/+$/, '')
  const anonKey = raw?.supabaseAnonKey?.trim()
  if (!url || !anonKey || !/^https?:\/\//.test(url)) return null
  return { url, anonKey }
}

// --- routes -----------------------------------------------------------------------

const ROUTES: { pattern: RegExp; keys: string[]; screen: ScreenFactory; tab: string | null }[] = [
  { pattern: /^\/home$/, keys: [], screen: homeScreen, tab: 'home' },
  { pattern: /^\/create$/, keys: [], screen: createScreen, tab: 'create' },
  { pattern: /^\/words$/, keys: [], screen: wordsScreen, tab: 'words' },
  { pattern: /^\/words\/([^/]+)\/edit$/, keys: ['id'], screen: wordEditScreen, tab: 'words' },
  { pattern: /^\/words\/([^/]+)$/, keys: ['id'], screen: wordDetailScreen, tab: 'words' },
  { pattern: /^\/study$/, keys: [], screen: studyScreen, tab: 'study' },
  { pattern: /^\/settings$/, keys: [], screen: settingsScreen, tab: null },
]

const TABS: { id: string; path: string; label: string; icon: IconName }[] = [
  { id: 'home', path: '/home', label: t.nav.home, icon: 'home' },
  { id: 'create', path: '/create', label: t.nav.create, icon: 'plus' },
  { id: 'words', path: '/words', label: t.nav.words, icon: 'book' },
  { id: 'study', path: '/study', label: t.nav.study, icon: 'cards' },
]

function parseHash(): { path: string; params: Record<string, string> } {
  const raw = location.hash.replace(/^#/, '') || '/home'
  const [path = '/home', query = ''] = raw.split('?')
  return { path, params: Object.fromEntries(new URLSearchParams(query)) }
}

// --- the signed-in app ---------------------------------------------------------------

interface RunningApp {
  stop(): void
}

async function startApp(client: SupabaseClient, session: Session): Promise<RunningApp> {
  let stopped = false
  const cleanups: (() => void)[] = []
  const stop = () => {
    stopped = true
    for (const cleanup of cleanups) cleanup()
  }

  const db = await openLocalDb(session.userId)
  const data = new AppData({ client, db, userId: session.userId })
  cleanups.push(() => data.close())
  await data.load()
  applyTheme(data.settings.theme)

  // First visit on this device: the Word Bank has to arrive before there is anything to show.
  while (!data.hasSyncedOnce && !stopped) {
    replace(root, h('main', { class: 'screen no-nav' }, emptyState({ art: mascot('thinking', { size: 120 }), title: t.sync.firstLoad })))
    await data.syncNow()
    if (data.hasSyncedOnce || stopped) break
    const problem = data.sync.problem ?? toAppError(new Error('sync failed'))
    if (problem.kind === 'auth') return { stop } // the session listener shows the sign-in screen
    await new Promise<void>((resolve) => {
      replace(
        root,
        h(
          'main',
          { class: 'screen no-nav' },
          emptyState({
            art: mascot('confused', { size: 120 }),
            title: t.sync.firstLoadFailed,
            body: problem.kind === 'not_configured' ? t.setup.backendMissing : describeError(problem),
            action: h(
              'div',
              { class: 'stack' },
              h('button', { class: 'btn primary', onclick: () => resolve() }, icon('refresh'), t.common.retry),
              h('button', { class: 'btn ghost', onclick: () => void client.signOut() }, t.settings.signOut),
            ),
          }),
        ),
      )
    })
  }
  if (stopped) return { stop }

  const audio = new AudioPlayer([new BrowserSpeechProvider()])
  let scheduler: { retention: number; instance: Scheduler } | null = null

  const ctx: Ctx = {
    client,
    data,
    audio,
    scheduler() {
      const retention = data.settings.desiredRetention
      if (scheduler?.retention !== retention) scheduler = { retention, instance: createFsrsScheduler({ desiredRetention: retention }) }
      return scheduler.instance
    },
    go(path, options) {
      if (options?.replace) location.replace(`#${path}`)
      else location.hash = path
    },
    toast,
    confirm: confirmSheet,
    now: () => new Date(),
  }

  // --- shell ---
  const banner = h('div', { class: 'banner', role: 'status', hidden: true })
  const nav = h('nav', { class: 'nav', 'aria-label': APP_NAME })
  const outlet = h('div', { class: 'grow', style: { display: 'flex', flexDirection: 'column', minWidth: '0' } })
  const shell = h('div', { class: 'shell' }, nav, outlet)
  replace(root, banner, shell)

  let screen: Screen | null = null
  let activeTab: string | null = null
  let currentHash = ''
  let restoring = false

  const renderNav = () => {
    const counts = queueCounts(data.activeCards(), { settings: data.settings, now: ctx.now() })
    replace(
      nav,
      h('div', { class: 'nav-brand' }, mascot('idle', { size: 40 }), APP_NAME),
      TABS.map((tab) =>
        h(
          'a',
          { class: 'nav-item', href: `#${tab.path}`, 'aria-current': tab.id === activeTab ? 'page' : undefined },
          h('span', { class: 'nav-icon' }, icon(tab.icon)),
          tab.label,
          tab.id === 'study' && counts.total > 0 ? h('span', { class: 'nav-badge', 'aria-label': t.study.remaining(counts.total) }, fa(Math.min(counts.total, 999))) : null,
        ),
      ),
    )
  }

  const renderChrome = () => {
    banner.hidden = data.sync.online
    if (!data.sync.online) replace(banner, icon('offline', { size: 16 }), t.sync.offlineBanner)
    applyTheme(data.settings.theme)
    renderNav()
  }

  async function route() {
    if (stopped) return
    if (restoring) {
      restoring = false
      return
    }
    if (location.hash === currentHash && screen) return
    if (screen?.canLeave && !(await screen.canLeave())) {
      restoring = true
      location.hash = currentHash // stay where we are
      return
    }
    const { path, params } = parseHash()
    let match: RegExpExecArray | null = null
    const found = ROUTES.find((r) => (match = r.pattern.exec(path)))
    if (!found || !match) return ctx.go('/home', { replace: true })
    const values = (match as RegExpExecArray).slice(1)
    found.keys.forEach((key, i) => (params[key] = decodeURIComponent(values[i] ?? '')))

    screen?.destroy?.()
    audio.stop()
    const first = screen === null
    screen = found.screen(ctx, params)
    currentHash = location.hash
    activeTab = found.tab
    nav.hidden = screen.nav === false
    replace(outlet, screen.el)
    renderNav()
    window.scrollTo({ top: 0 })
    if (!first) {
      // move keyboard and screen-reader focus to the new page
      screen.el.tabIndex = -1
      screen.el.style.outline = 'none'
      screen.el.focus({ preventScroll: true })
    }
  }

  const onHash = () => void route()
  window.addEventListener('hashchange', onHash)
  cleanups.push(() => window.removeEventListener('hashchange', onHash), () => screen?.destroy?.(), () => audio.stop())

  cleanups.push(
    data.subscribe(() => {
      renderChrome()
      screen?.onData?.()
    }),
  )

  const onOnline = () => void data.syncNow()
  const onOffline = () => void data.flushOutbox() // re-reads the connection state and tells the screens
  const onVisible = () => {
    if (document.visibilityState !== 'visible') return
    const last = data.sync.lastSyncedAt ? Date.parse(data.sync.lastSyncedAt) : 0
    if (Date.now() - last > STALE_SYNC_MS || data.sync.pending > 0) void data.syncNow()
  }
  const onScheme = () => applyTheme(data.settings.theme)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)
  darkQuery.addEventListener('change', onScheme)
  cleanups.push(
    () => window.removeEventListener('online', onOnline),
    () => window.removeEventListener('offline', onOffline),
    () => document.removeEventListener('visibilitychange', onVisible),
    () => darkQuery.removeEventListener('change', onScheme),
  )

  renderChrome()
  await route()
  void data.syncNow()
  return { stop }
}

// --- boot -------------------------------------------------------------------------------

async function boot() {
  applyTheme((storage.getItem(THEME_KEY) as Settings['theme'] | null) ?? 'system')
  const config = readConfig()
  if (!config) {
    replace(root, h('main', { class: 'screen no-nav' }, emptyState({ art: mascot('confused', { size: 120 }), title: t.setup.title, body: t.setup.body })))
    return
  }

  const client = new SupabaseClient(config, storage)
  window.addEventListener('storage', () => client.reloadFromStorage())

  // E-mail confirmation and password-reset links come back with the session in the address.
  let recovery = false
  let linkProblem: string | undefined
  if (/(^|[#&])(access_token|error|error_description)=/.test(location.hash)) {
    try {
      const result = await client.consumeUrlFragment(location.hash)
      recovery = result?.type === 'recovery'
    } catch (err) {
      const error = toAppError(err)
      linkProblem = t.auth.errors[error.code] ?? (error.kind === 'auth' ? t.auth.errors.otp_expired : describeError(error))
    }
    history.replaceState(null, '', `${location.pathname}${location.search}#/home`)
  }

  let running: RunningApp | null = null
  let shownFor: string | null | undefined

  const show = async (session: Session | null) => {
    const who = session?.userId ?? null
    if (who === shownFor && !recovery) return
    shownFor = who
    running?.stop()
    running = null
    if (!session) {
      applyTheme('system')
      if (!/^#\/(home)?$/.test(location.hash)) history.replaceState(null, '', `${location.pathname}${location.search}#/home`)
      replace(root, authScreen(client, { notice: linkProblem }))
      linkProblem = undefined
      return
    }
    if (recovery) {
      replace(
        root,
        authScreen(client, {
          mode: 'recovery',
          onPasswordChanged: () => {
            recovery = false
            toast(t.auth.passwordChanged)
            shownFor = undefined
            void show(client.session)
          },
        }),
      )
      return
    }
    running = await startApp(client, session)
  }

  client.onSessionChange((session) => void show(session))
  await show(client.session)

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined)
  }
}

void boot()
