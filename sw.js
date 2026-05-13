// Service Worker — K-Beauty Mijal
// Strategy:
//   - HTML/navigation requests: NETWORK-FIRST (always try GitHub Pages, fall back to cache only when offline)
//   - External libs (React, Babel, fonts): CACHE-FIRST (don't change often, save bandwidth)
// This means every time the app opens with network, the user gets the latest index.html from GitHub.

const CACHE = 'kbeauty-v2';
const PRECACHE = [
  '/rutina-kbeauty/',
  '/rutina-kbeauty/index.html',
  '/rutina-kbeauty/manifest.json',
  '/rutina-kbeauty/icon-192.png',
  '/rutina-kbeauty/icon-512.png',
];
const STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isHTML =
    req.mode === 'navigate' ||
    req.destination === 'document' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('.html');
  const isStaticExternal = STATIC_HOSTS.includes(url.hostname);

  if (isHTML) {
    // NETWORK-FIRST: always try fresh from GitHub, fall back to cache offline.
    e.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then(c => c || caches.match('/rutina-kbeauty/')))
    );
    return;
  }

  if (isStaticExternal) {
    // CACHE-FIRST: libs and fonts rarely change.
    e.respondWith(
      caches.match(req).then(c => c || fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return res;
      }))
    );
    return;
  }

  // Default: stale-while-revalidate for everything else (icons, manifest).
  e.respondWith(
    caches.match(req).then(cached => {
      const fetched = fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
