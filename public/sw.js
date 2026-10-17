/* Service worker — makes the app installable and fast/offline-capable.
   - Page navigations: network first (so a new deploy shows up right away),
     falling back to the cached app shell when offline.
   - Same-origin build files (/assets/*, icons, fonts): cache first (they are
     content-hashed, so a cached copy never goes stale).
   - /api/* (live prices) is NEVER touched or cached, so a price can never be stale-from-cache.
   - Everything cross-origin (Supabase, image hosts, APIs) is NEVER touched,
     so login, cloud sync and shared links always hit the network. */
const VERSION = 'v3'
const SHELL = `mm-shell-${VERSION}`
const ASSETS = `mm-assets-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/', '/manifest.webmanifest', '/favicon.svg'])))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![SHELL, ASSETS].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  // Phase 14: live prices must always come from the network — never cache or replay /api/*
  if (url.pathname.startsWith('/api/')) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/').then((r) => r || Response.error())),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone()
          caches.open(ASSETS).then((c) => c.put(req, copy))
        }
        return res
      })
    }),
  )
})
