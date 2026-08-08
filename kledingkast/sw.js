/* Kleine service worker: de app blijft werken zonder verbinding.
   Bump CACHE bij elke wijziging aan de bestanden hieronder, anders blijven
   bezoekers de oude versie uit de cache zien. */
var CACHE = 'kledingkast-v9';
var ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  './icon.svg',
  './manifest.webmanifest'
];

self.addEventListener('install', function (ev) {
  ev.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (ev) {
  ev.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches['delete'](k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== location.origin) return;

  // Navigaties: eerst het netwerk, zodat een nieuwe versie meteen doorkomt.
  if (req.mode === 'navigate') {
    ev.respondWith(
      fetch(req)['catch'](function () {
        return caches.match('./index.html').then(function (r) { return r || Response.error(); });
      })
    );
    return;
  }

  ev.respondWith(
    caches.match(req).then(function (cached) {
      if (cached) return cached;
      return fetch(req).then(function (res) {
        if (res && res.ok && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
