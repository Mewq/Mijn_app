/* Opslaglaag voor Mijn Kledingkast.
   Alles staat lokaal in IndexedDB op dit apparaat: kledingstukken, outfits en
   foto's (als Blob). Er is geen server, dus maak af en toe een back-up via
   het scherm "Meer". */
(function (global) {
  'use strict';

  var DB_NAME = 'kledingkast';
  var DB_VERSION = 2;
  var STORE_ITEMS = 'items';
  var STORE_OUTFITS = 'outfits';
  var STORE_IMAGES = 'images';
  var STORE_FOLDERS = 'folders';

  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function (ev) {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE_ITEMS)) {
          db.createObjectStore(STORE_ITEMS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_OUTFITS)) {
          db.createObjectStore(STORE_OUTFITS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_IMAGES)) {
          db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
        }
        // v2: mappen om outfits in te verzamelen
        if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
          db.createObjectStore(STORE_FOLDERS, { keyPath: 'id' });
        }
        void ev;
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('Database geblokkeerd door een ander tabblad')); };
    });
    return dbPromise;
  }

  function tx(storeNames, mode) {
    return open().then(function (db) {
      return db.transaction(storeNames, mode);
    });
  }

  function wrap(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  /* Wacht op het afronden van de transactie, niet alleen op het verzoek:
     pas dan staat de schrijfactie echt op schijf. */
  function done(transaction, result) {
    return new Promise(function (resolve, reject) {
      transaction.oncomplete = function () { resolve(result); };
      transaction.onerror = function () { reject(transaction.error); };
      transaction.onabort = function () { reject(transaction.error || new Error('Transactie afgebroken')); };
    });
  }

  function getAll(store) {
    return tx(store, 'readonly').then(function (t) {
      return wrap(t.objectStore(store).getAll());
    });
  }

  function get(store, key) {
    return tx(store, 'readonly').then(function (t) {
      return wrap(t.objectStore(store).get(key));
    });
  }

  function put(store, value) {
    return tx(store, 'readwrite').then(function (t) {
      t.objectStore(store).put(value);
      return done(t, value);
    });
  }

  function putMany(store, values) {
    if (!values.length) return Promise.resolve([]);
    return tx(store, 'readwrite').then(function (t) {
      var os = t.objectStore(store);
      values.forEach(function (v) { os.put(v); });
      return done(t, values);
    });
  }

  function remove(store, key) {
    return tx(store, 'readwrite').then(function (t) {
      t.objectStore(store)['delete'](key);
      return done(t, key);
    });
  }

  function clearAll() {
    return tx([STORE_ITEMS, STORE_OUTFITS, STORE_IMAGES, STORE_FOLDERS], 'readwrite').then(function (t) {
      t.objectStore(STORE_ITEMS).clear();
      t.objectStore(STORE_OUTFITS).clear();
      t.objectStore(STORE_IMAGES).clear();
      t.objectStore(STORE_FOLDERS).clear();
      return done(t, true);
    });
  }

  global.KastDB = {
    ITEMS: STORE_ITEMS,
    OUTFITS: STORE_OUTFITS,
    IMAGES: STORE_IMAGES,
    FOLDERS: STORE_FOLDERS,
    open: open,
    getAll: getAll,
    get: get,
    put: put,
    putMany: putMany,
    remove: remove,
    clearAll: clearAll
  };
})(window);
