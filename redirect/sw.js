// The app moved to https://apphodhod.com. This replaces the old service worker on the
// old address: it clears the old copy of the app and sends open windows to the new address.
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
