// Pulled into the generated service worker (workbox importScripts, see
// vite.config.ts). The nightly push has no payload; the text lives here.

self.addEventListener('push', (event) => {
  // Every push must show a notification (iOS revokes the subscription otherwise).
  event.waitUntil(self.registration.showNotification('Did you take any shots today?', {
    body: "There's still time.",
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: 'reminder',
    data: { url: '/' },
  }))
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
