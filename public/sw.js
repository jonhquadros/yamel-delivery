/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Service Worker for Yamel PWA
const CACHE_NAME = 'yamel-app-shell-v1';

// Key static assets to cache initially for the Offline App Shell
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// 1. Install Event: Pre-cache core shell resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching App Shell');
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      // Force immediate takeover
      return self.skipWaiting();
    })
  );
});

// 2. Activate Event: Clean up old cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache store:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// 3. Fetch Event: Serve from Cache or Network depending on Resource Type
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Avoid intercepting API routes or websocket connections (prevent transational data cache)
  if (requestUrl.pathname.startsWith('/api') || event.request.method !== 'GET') {
    return;
  }

  // Handle SPA routing & static files
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in the background to update cache (stale-while-revalidate pattern for static files)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {
          // Silent offline ignore
        });

        return cachedResponse;
      }

      // Fetch from network and add to dynamic cache if successful
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch((err) => {
        // If offline and request is a navigation page, serve index.html fallback (SPA App Shell)
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
        throw err;
      });
    })
  );
});
