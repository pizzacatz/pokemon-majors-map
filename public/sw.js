/* Minimal offline support: network-first navigations and data (so deploys and
   fresh events show on next load), stale-while-revalidate hashed assets. */
const CACHE = 'pmm-v2'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin) return

  if (url.pathname.endsWith('/data/events.json') || request.mode === 'navigate') {
    // Network-first: fresh app shell and event data when online, last
    // snapshot when offline. Serving stale shells made fixed bugs linger.
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
          return res
        })
        .catch(() => caches.match(request).then((cached) => cached || Response.error())),
    )
    return
  }

  // Stale-while-revalidate for everything else (hashed assets, shell).
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(request, copy))
          }
          return res
        })
        .catch(() => cached)
      return cached || fetched
    }),
  )
})
