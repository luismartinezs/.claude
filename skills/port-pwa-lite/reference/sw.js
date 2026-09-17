/// @ts-nocheck
const CACHE_NAME = 'hellosafelyfed-__BUILD_HASH__';

// Install: activate immediately, no precaching needed for a storefront
self.addEventListener('install', () => self.skipWaiting());

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for everything, cache static assets as fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip API calls and auth-related navigations entirely — let the browser handle them
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/login')) {
    return;
  }

  // Only cache static assets (images, CSS, JS), not navigation requests
  if (request.mode === 'navigate') {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (request.method === 'GET' && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
