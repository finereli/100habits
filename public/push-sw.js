// Pulled into the generated service worker (workbox importScripts, see
// vite.config.ts). The nightly push has no payload: the text comes from the
// habits on this device, which the app mirrors into the Cache API
// (src/lib/reminders.svelte.ts), so habit names never leave the phone.

const SNAPSHOT_CACHE = '100shots-reminder'
const SNAPSHOT_URL = '/__reminder.json'

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let names = []
    try {
      const res = await (await caches.open(SNAPSHOT_CACHE)).match(SNAPSHOT_URL)
      if (res) names = (await res.json()).names || []
    } catch (e) {}
    const name = names.length ? names[Math.floor(Math.random() * names.length)] : ''
    // Every push must show a notification (iOS revokes the subscription otherwise).
    await self.registration.showNotification('Any shots today?', {
      body: name ? `${name}, or anything else you practiced. Tap to log.` : 'Anything you practiced counts. Tap to log.',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: 'reminder',
      data: { url: '/' },
    })
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = all.find((c) => new URL(c.url).origin === self.location.origin)
    if (open) return open.focus()
    return self.clients.openWindow('/')
  })())
})
