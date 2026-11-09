// The app used to live on apphodhod.com and now lives on app.apphodhod.com. This replaces
// the old service worker here: it clears the old copy and sends open windows to the app.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key)
      await self.registration.unregister()
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate('https://app.apphodhod.com/')
    })(),
  )
})
