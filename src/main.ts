/** Application entry: configuration → session → data → shell and routing. */
import { AudioPlayer } from './audio/audio.ts'
import { BrowserSpeechProvider } from './audio/browserSpeech.ts'
import { CloudSpeechProvider } from './audio/cloudSpeech.ts'
import { createFsrsScheduler } from './core/fsrsScheduler.ts'
import { queueCounts } from './core/queue.ts'
import type { Scheduler } from './core/scheduler.ts'
import type { Settings } from './core/types.ts'
import { AppData } from './data/appData.ts'
import { logClientError } from './data/platform.ts'
import { toAppError } from './data/errors.ts'
import { openLocalDb } from './data/localDb.ts'
import { SupabaseClient, type KeyValueStore, type Session, type SupabaseConfig } from './data/supabase.ts'
import type { Ctx, Screen, ScreenFactory } from './ui/context.ts'
import { h, icon, replace, type IconName } from './ui/dom.ts'
import { num } from './ui/format.ts'
import { mascot, preloadMascot } from './ui/mascot.ts'
import { adminItemScreen, adminPackScreen, adminReportScreen, adminScreen } from './ui/screens/admin.ts'
import { adminUserScreen } from './ui/screens/adminUser.ts'
import { authScreen } from './ui/screens/auth.ts'
import { languageScreen } from './ui/screens/language.ts'
import { refreshPush } from './data/push.ts'
import { createScreen } from './ui/screens/create.ts'
import { homeScreen } from './ui/screens/home.ts'
import { importScreen } from './ui/screens/import.ts'
import { friendsScreen } from './ui/screens/friends.ts'
import { quizScreen } from './ui/screens/quiz.ts'
import { settingsScreen } from './ui/screens/settings.ts'
import { statsScreen } from './ui/screens/stats.ts'
import { packLessonScreen } from './ui/screens/packLesson.ts'
import { packScreen, storeScreen } from './ui/screens/store.ts'
import { storiesScreen, storyScreen } from './ui/screens/stories.ts'
import { learnScreen, lessonScreen, podcastScreen, verbFamilyScreen } from './ui/screens/learn.ts'
import { studyScreen } from './ui/screens/study.ts'
import { wordDetailScreen, wordEditScreen } from './ui/screens/wordDetail.ts'
import { welcomeScreen } from './ui/screens/welcome.ts'
import { decksScreen } from './ui/screens/decks.ts'
import { wordsScreen } from './ui/screens/words.ts'
import { appName, currentLanguage, describeError, setLanguage, t } from './ui/strings.ts'
import { setLearningPair } from './ui/learning.ts'
import { isUiLanguage, targetsFor } from './ui/i18n/languages.ts'
import { confirmSheet, emptyState, toast } from './ui/widgets.ts'

declare global {
  interface Window {
    HODHOD_CONFIG?: { supabaseUrl?: string; supabaseAnonKey?: string }
  }
}

declare const __APP_VERSION__: string | undefined

const root = document.getElementById('app')!
const THEME_KEY = 'hodhod.theme'
const STALE_SYNC_MS = 5 * 60_000

// --- small platform wrappers ---------------------------------------------------

/**
 * The test version lives under /staging/ on the same site, so it shares the browser's
 * storage with the real app: its keys get their own prefix (different accounts, different server).
 */
const STAGING = /\/staging\//.test(location.pathname)
const ns = (key: string) => (STAGING ? `staging:${key}` : key)

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
    getItem: (key) => safe(() => localStorage.getItem(ns(key)), null) ?? memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value)
      safe(() => localStorage.setItem(ns(key), value), undefined)
    },
    removeItem: (key) => {
      memory.delete(key)
      safe(() => localStorage.removeItem(ns(key)), undefined)
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

const LANGUAGE_KEY = 'hodhod.language'

/** Switches the interface language and remembers it on this device (used before sign-in, too). */
function applyLanguage(code: string | null | undefined): void {
  const applied = setLanguage(code)
  storage.setItem(LANGUAGE_KEY, applied)
}

/** test.apphodhod.com: the test mode, against a stand-in server in the browser (src/demo/demo.ts). */
const DEMO = location.hostname.startsWith('test.') || (location.hostname === 'localhost' && new URLSearchParams(location.search).has('demo'))

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
  { pattern: /^\/import$/, keys: [], screen: importScreen, tab: 'create' },
  { pattern: /^\/words$/, keys: [], screen: wordsScreen, tab: 'words' },
  { pattern: /^\/words\/([^/]+)\/edit$/, keys: ['id'], screen: wordEditScreen, tab: 'words' },
  { pattern: /^\/words\/([^/]+)$/, keys: ['id'], screen: wordDetailScreen, tab: 'words' },
  { pattern: /^\/study$/, keys: [], screen: studyScreen, tab: 'study' },
  { pattern: /^\/quiz$/, keys: [], screen: quizScreen, tab: 'quiz' },
  { pattern: /^\/stats$/, keys: [], screen: statsScreen, tab: 'home' },
  { pattern: /^\/settings$/, keys: [], screen: settingsScreen, tab: null },
  { pattern: /^\/welcome$/, keys: [], screen: welcomeScreen, tab: null },
  { pattern: /^\/decks$/, keys: [], screen: decksScreen, tab: 'home' },
  { pattern: /^\/store$/, keys: [], screen: storeScreen, tab: 'home' },
  { pattern: /^\/stories$/, keys: [], screen: storiesScreen, tab: 'home' },
  { pattern: /^\/friends$/, keys: [], screen: friendsScreen, tab: 'home' },
  { pattern: /^\/stories\/([^/]+)$/, keys: ['id'], screen: storyScreen, tab: 'home' },
  { pattern: /^\/store\/([^/]+)$/, keys: ['id'], screen: packScreen, tab: 'home' },
  { pattern: /^\/store\/([^/]+)\/lesson\/(\d+)$/, keys: ['id', 'lesson'], screen: packLessonScreen, tab: 'home' },
  { pattern: /^\/learn$/, keys: [], screen: learnScreen, tab: 'home' },
  { pattern: /^\/learn\/podcast\/([^/]+)$/, keys: ['id'], screen: podcastScreen, tab: 'home' },
  { pattern: /^\/learn\/lesson\/([^/]+)$/, keys: ['id'], screen: lessonScreen, tab: 'home' },
  { pattern: /^\/learn\/verbs\/([^/]+)$/, keys: ['id'], screen: verbFamilyScreen, tab: 'home' },
  { pattern: /^\/admin$/, keys: [], screen: adminScreen, tab: null },
  { pattern: /^\/admin\/(overview|money|growth|users|inbox|news|packs)$/, keys: ['tab'], screen: adminScreen, tab: null },
  { pattern: /^\/admin\/users\/([^/]+)$/, keys: ['id'], screen: adminUserScreen, tab: null },
  { pattern: /^\/admin\/packs\/([^/]+)$/, keys: ['id'], screen: adminPackScreen, tab: null },
  { pattern: /^\/admin\/packs\/([^/]+)\/items\/([^/]+)$/, keys: ['id', 'item'], screen: adminItemScreen, tab: null },
  { pattern: /^\/admin\/reports\/([^/]+)$/, keys: ['id'], screen: adminReportScreen, tab: null },
]

// labels are read at render time: the interface language can change
const TABS: { id: string; path: string; label: () => string; icon: IconName }[] = [
  { id: 'home', path: '/home', label: () => t.nav.home, icon: 'home' },
  { id: 'create', path: '/create', label: () => t.nav.create, icon: 'plus' },
  { id: 'words', path: '/words', label: () => t.nav.words, icon: 'book' },
  { id: 'study', path: '/study', label: () => t.nav.study, icon: 'cards' },
  { id: 'quiz', path: '/quiz', label: () => t.nav.quiz, icon: 'quiz' },
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
  /** The account's languages decide the interface language and the deck on screen. Returns true when the interface language changed. */
  const syncLanguages = (): boolean => {
    setLearningPair({ target: data.profile.activeTargetLanguage, native: data.profile.nativeLanguage })
    rememberEmailLanguage(data.profile.nativeLanguage)
    if (data.profile.nativeLanguage === currentLanguage()) return false
    applyLanguage(data.profile.nativeLanguage)
    return true
  }
  // the account e-mails follow the interface language; told to the server once per change
  function rememberEmailLanguage(code: string) {
    const key = `hodhod.emailLanguage.${session.userId}`
    if (!isUiLanguage(code) || storage.getItem(key) === code) return
    client.setEmailLanguage(code).then(() => storage.setItem(key, code), () => undefined)
  }
  // a new account takes over the language chosen on this device before signing up
  const adoptChosenLanguage = async () => {
    let chosen = storage.getItem(LANGUAGE_KEY)
    // the confirmation e-mail often opens in another browser, which knows no choice: ask the account
    if (!data.settings.onboarded && !isUiLanguage(chosen)) chosen = await client.emailLanguage().catch(() => null)
    if (!data.settings.onboarded && isUiLanguage(chosen) && chosen !== data.profile.nativeLanguage) {
      const target = data.profile.activeTargetLanguage === chosen ? targetsFor(chosen)[0]! : data.profile.activeTargetLanguage
      await data.setLanguages({ native: chosen, target }).catch(() => undefined)
    }
  }
  // until the account has arrived from the server, its settings are not known: keep the device's language
  if (data.hasSyncedOnce) {
    await adoptChosenLanguage()
    syncLanguages()
  }
  // someone learning several languages picks today's one when the app opens (once per visit)
  try {
    if (data.settings.onboarded && data.decks().length > 1 && /^#?\/?(home)?$/.test(location.hash.replace(/^#/, '')) && !sessionStorage.getItem('hodhod.deckAsked')) {
      sessionStorage.setItem('hodhod.deckAsked', '1')
      history.replaceState(null, '', `${location.pathname}${location.search}#/decks`)
    }
  } catch {
    // storage unavailable: just open the home screen
  }

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
  await adoptChosenLanguage()
  syncLanguages()
  // keep this device's reminder address fresh on the server (never asks for permission)
  if (!DEMO) void refreshPush(client, data.settings.notifyDaily || data.settings.notifyStreak).catch(() => undefined)

  // natural voice from the server first; the phone's own voice whenever that is not possible
  const cloudSpeech = new CloudSpeechProvider({
    fetchUrl: async (text, voice, language) => (await client.invoke<{ url: string }>('tts', { text, voice, language }, { timeoutMs: 15_000 })).url,
    enabled: () => !DEMO && data.settings.aiVoice, // the test mode has no real voice server
    voice: () => data.settings.aiVoiceGender,
    online: () => navigator.onLine !== false,
    storage,
  })
  const audio = new AudioPlayer([cloudSpeech, new BrowserSpeechProvider()])
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
    back(fallback) {
      // after editing, the history entry before is this same page: go to the fallback instead
      if (previousHash && !previousHash.startsWith(location.hash)) history.back()
      else ctx.go(fallback)
    },
    toast,
    confirm: confirmSheet,
    now: () => new Date(),
  }

  // --- shell ---
  const banner = h('div', { class: 'banner', role: 'status', hidden: true })
  const nav = h('nav', { class: 'nav', 'aria-label': appName() })
  const outlet = h('div', { class: 'grow', style: { display: 'flex', flexDirection: 'column', minWidth: '0' } })
  const shell = h('div', { class: 'shell' }, nav, outlet)
  replace(root, banner, shell)

  let screen: Screen | null = null
  let activeTab: string | null = null
  let currentHash = ''
  let previousHash = ''
  let restoring = false

  const renderNav = () => {
    const counts = queueCounts(data.activeCards(), { settings: data.settings, now: ctx.now() })
    replace(
      nav,
      h('div', { class: 'nav-brand' }, mascot('idle', { size: 44, enter: 'none' }), appName()),
      TABS.map((tab) =>
        h(
          'a',
          { class: 'nav-item', href: `#${tab.path}`, 'aria-current': tab.id === activeTab ? 'page' : undefined },
          h('span', { class: 'nav-icon' }, icon(tab.icon)),
          h('span', { class: 'nav-label' }, tab.label()),
          tab.id === 'study' && counts.total > 0 ? h('span', { class: 'nav-badge', 'aria-label': t.study.remaining(counts.total) }, num(Math.min(counts.total, 999))) : null,
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

  /** Shows the screen of the current address; `force` rebuilds it even when the address is unchanged (new language). */
  async function route(force = false) {
    if (stopped) return
    if (restoring) {
      restoring = false
      return
    }
    if (!force && location.hash === currentHash && screen) return
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
    // a celebration belongs to the screen it happened on
    document.querySelectorAll('.burst').forEach((n) => n.remove())
    const first = screen === null
    screen = found.screen(ctx, params)
    previousHash = currentHash
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

  // the tour after an update: the phone's saved settings say "done" until the first sync
  // brings the server's answer, so look again whenever data arrives (only from the home screen)
  let welcomeSent = false
  const maybeWelcome = () => {
    if (welcomeSent || data.settings.onboarded || location.hash.startsWith('#/welcome')) return
    if (!['', '#', '#/', '#/home'].includes(location.hash)) return
    welcomeSent = true
    ctx.go('/welcome', { replace: true })
  }

  cleanups.push(
    data.subscribe(() => {
      if (syncLanguages()) {
        renderChrome()
        void route(true)
        return
      }
      renderChrome()
      screen?.onData?.()
      maybeWelcome()
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

  // unexpected errors are reported to the server log (no word data, only the message and place)
  const appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
  const onError = (event: ErrorEvent) => logClientError(client, event.error ?? event.message, appVersion)
  const onRejection = (event: PromiseRejectionEvent) => {
    const error = toAppError(event.reason)
    // network trouble and expired sessions are expected, not bugs
    if (['offline', 'timeout', 'auth', 'rate_limit'].includes(error.kind)) return
    logClientError(client, event.reason, appVersion)
  }
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  cleanups.push(() => window.removeEventListener('error', onError), () => window.removeEventListener('unhandledrejection', onRejection))

  renderChrome()
  // a brand-new account starts with the welcome tour
  if (!data.settings.onboarded && !location.hash.startsWith('#/welcome')) history.replaceState(null, '', `${location.pathname}${location.search}#/welcome`)
  await route()
  preloadMascot()
  void data.syncNow()
  return { stop }
}

// --- boot -------------------------------------------------------------------------------

async function boot() {
  // a new device has no language yet: it opens in English and asks first (see languageScreen)
  // coming from the introduction site (app.apphodhod.com/?lang=de): that page's language is the choice
  const fromSite = new URLSearchParams(location.search).get('lang')
  if (isUiLanguage(fromSite)) {
    storage.setItem(LANGUAGE_KEY, fromSite)
    const params = new URLSearchParams(location.search)
    params.delete('lang')
    const rest = params.toString()
    history.replaceState(null, '', `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}`)
  }
  let languageChosen = isUiLanguage(storage.getItem(LANGUAGE_KEY))
  if (languageChosen) applyLanguage(storage.getItem(LANGUAGE_KEY))
  else setLanguage(null)
  if (STAGING) document.body.append(h('div', { class: 'staging-ribbon', 'aria-hidden': 'true' }, t.staging))
  applyTheme((storage.getItem(THEME_KEY) as Settings['theme'] | null) ?? 'system')
  const demo = DEMO ? await import('./demo/demo.ts') : null
  const backend = demo?.startDemo()
  const config = backend ? backend.config : readConfig()
  if (!config) {
    replace(root, h('main', { class: 'screen no-nav' }, emptyState({ art: mascot('confused', { size: 120 }), title: t.setup.title, body: t.setup.body })))
    return
  }

  const client = backend ? new SupabaseClient(config, storage, backend.fetch) : new SupabaseClient(config, storage)
  window.addEventListener('storage', () => client.reloadFromStorage())
  if (demo) {
    document.body.prepend(
      demo.demoBar(async () => {
        await client.signOut()
        await client.signIn(demo.SAMPLE_EMAIL, demo.SAMPLE_PASSWORD)
        location.replace('/#/home')
        location.reload()
      }),
    )
  }

  // admin.apphodhod.com is the same app, opened straight on the admin panel
  if (location.hostname.startsWith('admin.') && ['', '#', '#/', '#/home'].includes(location.hash)) history.replaceState(null, '', `${location.pathname}${location.search}#/admin`)

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
      // signed out: start over at home (on admin.apphodhod.com: at the admin panel, after signing in)
      const start = location.hostname.startsWith('admin.') ? '#/admin' : '#/home'
      if (location.hash !== start) history.replaceState(null, '', `${location.pathname}${location.search}${start}`)
      const signIn = () =>
        replace(
          root,
          authScreen(client, {
            notice: linkProblem,
            // the language can be chosen before an account exists; the new account takes it over
            onLanguage: (code) => {
              applyLanguage(code)
              signIn()
            },
          }),
        )
      if (languageChosen) signIn()
      else
        replace(
          root,
          languageScreen((code) => {
            languageChosen = true
            applyLanguage(code)
            signIn()
          }),
        )
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

  watchForUpdates()
}

// --- "a new version is ready" -------------------------------------------------------------

function showUpdateBanner(): void {
  if (document.querySelector('.update-banner')) return
  const banner = h(
    'div',
    { class: 'update-banner', role: 'status' },
    mascot('excited', { size: 44, enter: 'hop' }),
    h('span', { class: 'grow' }, h('b', null, t.update.title), h('small', null, t.update.body)),
    h('button', { class: 'btn primary small', type: 'button', onclick: () => location.reload() }, icon('refresh', { size: 16 }), t.update.reload),
    h('button', { class: 'icon-btn compact', type: 'button', 'aria-label': t.common.close, onclick: () => banner.remove() }, icon('close', { size: 18 })),
  )
  document.body.append(banner)
}

/**
 * The service worker of a newer build takes over in the background. When that happens
 * while the app is open, the learner is offered a reload instead of running old code.
 * The app also looks for a new build whenever it comes back to the foreground.
 */
function watchForUpdates(): void {
  window.addEventListener('hodhod:update-ready', showUpdateBanner)
  if (!('serviceWorker' in navigator) || location.protocol !== 'https:') return
  const hadController = navigator.serviceWorker.controller !== null
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // the very first install also "changes" the controller; that is not an update
    if (hadController) showUpdateBanner()
  })
  navigator.serviceWorker
    .register('./sw.js')
    .then((registration) => {
      let last = Date.now()
      const check = () => {
        if (document.visibilityState !== 'visible' || Date.now() - last < 30 * 60_000) return
        last = Date.now()
        void registration.update().catch(() => undefined)
      }
      document.addEventListener('visibilitychange', check)
      setInterval(check, 60 * 60_000)
    })
    .catch(() => undefined)
}

void boot()
