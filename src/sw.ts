/// <reference lib="webworker" />
/**
 * Service worker: makes the app shell available offline and installable.
 * Only this app's own files are cached; requests to the backend are never touched.
 */
const sw = self as unknown as ServiceWorkerGlobalScope
declare const __BUILD_ID__: string
declare const __PRECACHE__: string[]

// The real app and the test version (/staging/) share one site: each keeps its own caches.
const SCOPE = new URL(sw.registration.scope).pathname.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root'
const PREFIX = `hodhod-${SCOPE}-`
const CACHE = `${PREFIX}${__BUILD_ID__}`
/** Caches of older app versions, named before the test version existed. */
const LEGACY = /^hodhod-[0-9a-f]{12}$/

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(__PRECACHE__))
      .then(() => sw.skipWaiting()),
  )
})

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => (key.startsWith(PREFIX) && key !== CACHE) || LEGACY.test(key)).map((key) => caches.delete(key))))
      .then(() => sw.clients.claim()),
  )
})

sw.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== sw.location.origin) return

  // Fingerprinted files never change: serve from cache.
  if (url.pathname.includes('/assets/')) {
    event.respondWith(caches.match(request).then((hit) => hit ?? fetch(request)))
    return
  }

  // Pictures of the bird and icons: from the cache at once, refreshed in the background.
  if (url.pathname.includes('/mascot/') || url.pathname.includes('/icons/')) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(request)
        const fresh = fetch(request)
          .then((response) => {
            if (response.ok) void cache.put(request, response.clone())
            return response
          })
          .catch(() => hit ?? Response.error())
        return hit ?? fresh
      }),
    )
    return
  }

  // The page itself and its settings: fresh when online (so updates arrive), cached copy when not.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          void caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(async () => {
        const hit = (await caches.match(request)) ?? (request.mode === 'navigate' ? await caches.match('./index.html') : undefined)
        return hit ?? Response.error()
      }),
  )
})

// --- reminders (Web Push) ---------------------------------------------------------------

sw.addEventListener('push', (event) => {
  let message: { title?: string; body?: string; url?: string; tag?: string } = {}
  try {
    message = event.data?.json() ?? {}
  } catch {
    message = { body: event.data?.text() }
  }
  event.waitUntil(
    sw.registration.showNotification(message.title || 'هدهد', {
      body: message.body ?? '',
      tag: message.tag,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      lang: 'fa',
      dir: 'rtl',
      data: { url: message.url ?? './#/home' },
    }),
  )
})

sw.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data as { url?: string } | null)?.url ?? './#/home', sw.registration.scope).href
  event.waitUntil(
    sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((w) => w.url.startsWith(sw.registration.scope))
      if (open) {
        await open.focus()
        return void (await open.navigate(target).catch(() => undefined))
      }
      await sw.clients.openWindow(target)
    }),
  )
})

export {}
