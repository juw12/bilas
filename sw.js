/* Bilas service worker: everything is local, so cache it all and play offline.
   Bump VERSION whenever a file changes; the old cache is dropped on activate. */
const VERSION = "bilas-v16";
const FILES = [
  "./",
  "index.html",
  "css/style.css",
  "js/three.global.js",
  "js/audio.js",
  "js/world.js",
  "js/shirts.js",
  "js/i18n.js",
  "js/app.js",
  "assets/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-192.png",
  "icons/maskable-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png",
  "manifest.webmanifest"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(VERSION).then(function (cache) {
      return cache.addAll(FILES);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k !== VERSION;
      }).map(function (k) {
        return caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// cache first, refresh in the background so the next visit gets updates
self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") {
    return;
  }
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    caches.open(VERSION).then(function (cache) {
      return cache.match(event.request, { ignoreSearch: true }).then(function (hit) {
        const fresh = fetch(event.request).then(function (res) {
          if (res && res.ok) {
            cache.put(event.request, res.clone());
          }
          return res;
        }).catch(function () {
          return hit;
        });
        return hit || fresh;
      });
    })
  );
});
