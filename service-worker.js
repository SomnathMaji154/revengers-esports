const CACHE_NAME = 'revengers-esports-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/players.html',
  '/managers.html',
  '/trophies.html',
  '/contact.html',
  '/admin.html',
  '/about.html',
  '/registered-users.html',
  '/styles.css',
  '/script.js',
  '/uploads/default-player.jpg',
  '/uploads/default-manager.jpg',
  '/uploads/default-trophy.jpg',
  '/uploads/logo.webp'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request).catch(error => {
          console.log('Network request failed, serving cached content', error);
          // For HTML requests, return the cached index.html
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
