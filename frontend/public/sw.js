/* Service worker da On Perfumaria.
 * Serve para o app instalado (PWA) receber as notificacoes de venda do admin.
 * Nao guarda paginas em cache de proposito: a loja sempre mostra precos e
 * estoque atuais, direto do servidor. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'On Perfumaria'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      vibrate: [120, 60, 120],
      data: { url: data.url || '/admin?painel=pedidos' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      // Reaproveita uma janela do app ja aberta em vez de abrir outra.
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client.navigate(target).then((page) => (page || client).focus())
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
