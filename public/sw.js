// public/sw.js
// Simple service worker for Tactical Compass PWA
const CACHE_NAME = 'tactical-compass-v2';
const ASSETS = [
  '/',
  '/src/index.html',
  '/src/css/main.css',
  '/src/js/compass.js',
  '/src/assets/compass.png',
  '/src/assets/m2_compass.png',
  '/public/icons/icon-192.png',
  '/public/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone the response before caching it
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
