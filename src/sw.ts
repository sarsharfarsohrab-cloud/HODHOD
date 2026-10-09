/// <reference lib="webworker" />
/**
 * Service worker: makes the app shell available offline and installable.
 * Only this app's own files are cached; requests to the backend are never touched.
 */
const sw = self as unknown as ServiceWorkerGlobalScope
declare const __BUILD_ID__: string
declare const __PRECACHE__: string[]

const CACHE = `hodhod-${__BUILD_ID__}`

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
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('hodhod-') && key !== CACHE).map((key) => caches.delete(key))))
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

export {}
