/* Kleine service worker: de app blijft werken zonder verbinding.
   Bump CACHE bij elke wijziging aan de bestanden hieronder, anders blijven
   bezoekers de oude versie uit de cache zien. */
var CACHE = 'kledingkast-online-v5';
var ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './api.js',
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
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  /* De server mag op hetzelfde adres staan als de app — dat is juist hoe je
     dit hoort te hosten. Dan komen /api/ en /uploads/ hier ook langs, en die
     mogen absoluut niet uit de cache:

       - de feed zou voorgoed blijven staan op wat je de eerste keer zag;
       - antwoorden op iemands ingelogde verzoeken zouden op het apparaat
         achterblijven, ook nadat die persoon is uitgelogd.

     De foto's van de server hebben hun eigen naam per inhoud en staan al een
     jaar in de gewone browsercache; die hebben ons hier niet nodig. */
  if (url.pathname.indexOf('/api/') === 0 || url.pathname.indexOf('/uploads/') === 0) return;

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
