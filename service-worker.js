const CACHE_NAME = 'revengers-esports-v3-always-fresh';
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

// Fetch event - always fetch fresh content, use cache as fallback only
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If fetch is successful, clone and cache the response
        const responseClone = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseClone);
          });
        return response;
      })
      .catch(error => {
        console.log('Network request failed, serving cached content', error);
        // Only serve cached content when network fails
        return caches.match(event.request)
          .then(response => {
            if (response) {
              return response;
            }
            // For HTML requests, return the cached index.html as last resort
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
