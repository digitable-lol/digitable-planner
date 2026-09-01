const CACHE = 'digitable-planner-shell-v8'
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/digitable-logo-96.png', '/digitable-logo-192.png', '/digitable-logo-512.png', '/digitable-logo-maskable-512.png']

function isShellAsset(pathname) {
  return SHELL.includes(pathname) || /^\/assets\/[^/]+\.(?:js|css|map)$/.test(pathname)
}

async function precacheShell() {
  const cache = await caches.open(CACHE)
  await cache.addAll(SHELL)
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheShell())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (!isShellAsset(url.pathname)) return
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE).then((cache) => cache.put('/index.html', clone))
        }
        return response
      }).catch(() => caches.match('/index.html').then((cached) => cached || Response.error())),
    )
    return
  }
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const clone = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, clone))
      }
      return response
    }).catch(() => Response.error())),
  )
})
