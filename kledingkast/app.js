/* Mijn Kledingkast — kledingstukken bewaren en outfits samenstellen.
   Alles draait lokaal in de browser; opslag zit in db.js. */
(function () {
  'use strict';

  /* ─────────────────────────── Vaste keuzelijsten ─────────────────────────── */

  var CATEGORIES = [
    { key: 'tops',        label: 'Tops & shirts',    icon: '👕' },
    { key: 'truien',      label: 'Truien & vesten',  icon: '🧶' },
    { key: 'broeken',     label: 'Broeken',          icon: '👖' },
    { key: 'rokken',      label: 'Rokken & jurken',  icon: '👗' },
    { key: 'jassen',      label: 'Jassen',           icon: '🧥' },
    { key: 'schoenen',    label: 'Schoenen',         icon: '👟' },
    { key: 'tassen',      label: 'Tassen',           icon: '👜' },
    { key: 'accessoires', label: 'Accessoires',      icon: '🧣' },
    { key: 'sport',       label: 'Sportkleding',     icon: '🏃' },
    { key: 'ondergoed',   label: 'Ondergoed & sokken', icon: '🧦' },
    { key: 'overig',      label: 'Overig',           icon: '✨' }
  ];

  var COLORS = [
    { key: 'zwart',      label: 'Zwart',       hex: '#1c1b19' },
    { key: 'wit',        label: 'Wit',         hex: '#f6f4f0' },
    { key: 'grijs',      label: 'Grijs',       hex: '#9b9793' },
    { key: 'beige',      label: 'Beige',       hex: '#d9c8a9' },
    { key: 'bruin',      label: 'Bruin',       hex: '#7b5433' },
    { key: 'blauw',      label: 'Blauw',       hex: '#2f5da8' },
    { key: 'lichtblauw', label: 'Lichtblauw',  hex: '#8ebfe4' },
    { key: 'groen',      label: 'Groen',       hex: '#3e7a51' },
    { key: 'olijf',      label: 'Olijf',       hex: '#79803f' },
    { key: 'geel',       label: 'Geel',        hex: '#e7c04b' },
    { key: 'oranje',     label: 'Oranje',      hex: '#e08a3c' },
    { key: 'rood',       label: 'Rood',        hex: '#b73338' },
    { key: 'roze',       label: 'Roze',        hex: '#e6a2b7' },
    { key: 'paars',      label: 'Paars',       hex: '#7a5aa8' },
    { key: 'goud',       label: 'Goud',        hex: '#c9a227' },
    { key: 'zilver',     label: 'Zilver',      hex: '#c3c3cb' },
    { key: 'print',      label: 'Print',       hex: 'conic-gradient(#b73338,#e7c04b,#3e7a51,#2f5da8,#7a5aa8,#b73338)' }
  ];

  var SEASONS = [
    { key: 'lente',  label: 'Lente',  icon: '🌸' },
    { key: 'zomer',  label: 'Zomer',  icon: '☀️' },
    { key: 'herfst', label: 'Herfst', icon: '🍂' },
    { key: 'winter', label: 'Winter', icon: '❄️' }
  ];

  var OCCASIONS = [
    { key: 'dagelijks', label: 'Dagelijks' },
    { key: 'werk',      label: 'Werk' },
    { key: 'sport',     label: 'Sport' },
    { key: 'feest',     label: 'Feest' },
    { key: 'formeel',   label: 'Formeel' },
    { key: 'vakantie',  label: 'Vakantie' },
    { key: 'thuis',     label: 'Thuis' },
    { key: 'date',      label: 'Date' }
  ];

  /* Iconen voor mappen — puur om ze snel uit elkaar te houden. */
  var FOLDER_ICONS = ['📁', '🛍️', '✈️', '💼', '🎉', '❄️', '☀️', '❤️', '👗', '🏋️'];

  /* Volgorde waarin "Verras me" een outfit opbouwt. */
  var SUGGEST_SLOTS = [
    { cats: ['tops', 'truien'], required: true },
    { cats: ['broeken', 'rokken'], required: true },
    { cats: ['schoenen'], required: false },
    { cats: ['jassen'], required: false },
    { cats: ['accessoires', 'tassen'], required: false }
  ];

  var catMap = index(CATEGORIES);
  var colorMap = index(COLORS);
  var seasonMap = index(SEASONS);
  var occasionMap = index(OCCASIONS);

  function index(list) {
    var m = {};
    list.forEach(function (o) { m[o.key] = o; });
    return m;
  }

  /* ─────────────────────────────── Toestand ──────────────────────────────── */

  var state = {
    items: [],
    outfits: [],
    folders: [],
    ready: false,
    filters: { q: '', cat: '', season: '', color: '', fav: false, unworn: false, donate: false, sort: 'recent' },
    filtersOpen: false,
    draft: null,          // formuliergegevens tijdens bewerken
    pickerSel: null,      // selectie in de kiezer
    pickerMode: null,     // 'items' | 'outfits' | 'folders'
    assignFor: null,      // outfit waarvoor we mappen aanvinken
    askimSkipped: [],     // deze sessie overgeslagen in de beoordeelrij
    askimRateMode: 'items', // beoordeelt Askim nu kleding of outfits?
    outfitSort: 'recent',
    outfitFilter: { q: '', occasion: '', author: '' }
  };

  var els = {};
  var urlPromises = new Map();   // "beeld-id:soort" -> Promise<objectURL>
  var liveUrls = new Map();      // idem, maar de opgeloste URL (om in te trekken)

  /* ─────────────────────────────── Hulpjes ───────────────────────────────── */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function formatDate(iso) {
    if (!iso) return '';
    var p = String(iso).split('-');
    if (p.length !== 3) return String(iso);
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    var today = new Date();
    var diff = Math.round((new Date(today.getFullYear(), today.getMonth(), today.getDate()) - d) / 86400000);
    if (diff === 0) return 'vandaag';
    if (diff === 1) return 'gisteren';
    if (diff > 1 && diff < 7) return diff + ' dagen geleden';
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function toast(msg) {
    var t = els.toast;
    t.textContent = msg;
    t.hidden = false;
    t.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.hidden = true; }, 250);
    }, 2400);
  }

  function go(hash) { location.hash = hash; }

  /* ──────────────────────────────── Thema ────────────────────────────────
     'systeem' volgt de telefoon; 'licht' en 'donker' overrulen dat. */

  var THEME_KEY = 'kledingkast-thema';

  function currentTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'systeem'; }
    catch (e) { return 'systeem'; }
  }

  function setTheme(t) {
    try {
      if (t === 'systeem') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, t);
    } catch (e) { /* privémodus: dan geldt de keuze alleen deze sessie */ }
    applyTheme(t);
  }

  function applyTheme(t) {
    var root = document.documentElement;
    if (t === 'licht') root.setAttribute('data-theme', 'light');
    else if (t === 'donker') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
  }

  /* ───────────────────────────── Afbeeldingen ────────────────────────────── */

  function loadBitmap(file) {
    if (typeof createImageBitmap === 'function') {
      // imageOrientation zet foto's van de telefoon meteen rechtop.
      return createImageBitmap(file, { imageOrientation: 'from-image' })['catch'](function () {
        return createImageBitmap(file);
      });
    }
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Kan de afbeelding niet lezen')); };
      img.src = url;
    });
  }

  function drawToBlob(bmp, maxSize, quality) {
    var w = bmp.width, h = bmp.height;
    var scale = Math.min(1, maxSize / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));
    var canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0, cw, ch);
    return new Promise(function (resolve) {
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) { resolve(blob); }, 'image/jpeg', quality);
      } else {
        resolve(dataUrlToBlob(canvas.toDataURL('image/jpeg', quality)));
      }
    });
  }

  /* Foto's van een telefoon zijn zo enkele megabytes; verkleinen houdt de
     kast snel en de back-up hanteerbaar. */
  async function processImage(file) {
    var bmp = await loadBitmap(file);
    var full = await drawToBlob(bmp, 1400, 0.85);
    var thumb = await drawToBlob(bmp, 480, 0.75);
    if (bmp.close) bmp.close();
    return { full: full, thumb: thumb };
  }

  function imageUrl(id, kind) {
    var key = id + ':' + kind;
    if (urlPromises.has(key)) return urlPromises.get(key);
    var p = KastDB.get(KastDB.IMAGES, id).then(function (rec) {
      if (!rec) return '';
      var blob = kind === 'full' ? (rec.full || rec.thumb) : (rec.thumb || rec.full);
      if (!blob) return '';
      var url = URL.createObjectURL(blob);
      liveUrls.set(key, url);
      return url;
    })['catch'](function () { return ''; });
    urlPromises.set(key, p);
    return p;
  }

  function forgetImage(id) {
    ['thumb', 'full'].forEach(function (kind) {
      var key = id + ':' + kind;
      var url = liveUrls.get(key);
      if (url) URL.revokeObjectURL(url);
      liveUrls['delete'](key);
      urlPromises['delete'](key);
    });
  }

  function loadImgEl(img) {
    var parts = img.getAttribute('data-img').split(':');
    imageUrl(parts[0], parts[1] || 'thumb').then(function (url) {
      if (!url) return;
      img.src = url;
      img.classList.add('loaded');
      // De categorie-emoji eronder uitfaden, anders schemert die door de foto.
      if (img.parentNode) img.parentNode.classList.add('has-photo');
    });
  }

  var observers = new Map();

  /* rootMargin rekt alleen de root van de waarnemer op, niet de scrollende
     containers daartussen. Een raster dat in .view scrolt heeft dus een
     waarnemer nodig met .view als root, anders laadt niets onder de vouw. */
  function observerFor(scroller) {
    var key = scroller || 'venster';
    if (!observers.has(key)) {
      observers.set(key, new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          obs.unobserve(e.target);
          loadImgEl(e.target);
        });
      }, { root: scroller || null, rootMargin: '600px 0px' }));
    }
    return observers.get(key);
  }

  /* Foto's pas uit de database halen als ze in de buurt van het scherm komen.
     Bij een kast van honderden stukken scheelt dat evenveel blob-URL's. */
  function hydrateImages(root) {
    var nodes = (root || document).querySelectorAll('img[data-img]');
    Array.prototype.forEach.call(nodes, function (img) {
      if (img.getAttribute('data-img-done')) return;
      img.setAttribute('data-img-done', '1');
      if (typeof IntersectionObserver !== 'function' || !img.closest) {
        loadImgEl(img);
        return;
      }
      observerFor(img.closest('.view, .sheet-body')).observe(img);
    });
  }

  /* Waarnemers van gesloten panelen opruimen; die van .view blijft. */
  function pruneObservers() {
    observers.forEach(function (obs, key) {
      if (key === 'venster' || key === els.view || document.contains(key)) return;
      obs.disconnect();
      observers['delete'](key);
    });
  }

  function blobToDataUrl(blob) {
    if (!blob) return Promise.resolve(null);
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () { resolve(fr.result); };
      fr.onerror = function () { reject(fr.error); };
      fr.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    var comma = dataUrl.indexOf(',');
    var meta = dataUrl.slice(0, comma);
    var mime = (meta.match(/:(.*?);/) || [])[1] || 'image/jpeg';
    var bin = atob(dataUrl.slice(comma + 1));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  /* ──────────────────────────── Gegevensbewerking ────────────────────────── */

  function newItem() {
    return {
      id: uid('itm'), name: '', category: 'tops', colors: [], seasons: [],
      brand: '', size: '', notes: '', favorite: false,
      wearCount: 0, lastWorn: null, imageIds: [], coverImageId: null,
      rating: null,        // cijfer van Askim, 1 t/m 10
      donate: false,       // ligt op de doneerstapel
      createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  function newOutfit(author) {
    return {
      id: uid('out'), name: '', itemIds: [], occasion: 'dagelijks', seasons: [],
      notes: '', favorite: false, wearCount: 0, lastWorn: null,
      author: author || 'ik',   // 'ik' of 'askim'
      rating: null,             // cijfer van Askim, 1 t/m 10
      createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  function newFolder() {
    return {
      id: uid('fld'), name: '', icon: '📁', outfitIds: [], notes: '',
      createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  /* Een kledingstuk kan meerdere foto's hebben; deze is de hoofdfoto die in
     het overzicht en op outfits te zien is. */
  function coverImageOf(item) {
    var ids = item.imageIds || [];
    if (!ids.length) return null;
    if (item.coverImageId && ids.indexOf(item.coverImageId) !== -1) return item.coverImageId;
    return ids[0];
  }

  /* Records uit een oudere versie (of een oude back-up) hadden één imageId. */
  function normalizeItem(i) {
    i.colors = i.colors || [];
    i.seasons = i.seasons || [];
    i.wearCount = i.wearCount || 0;
    if (!i.imageIds) i.imageIds = i.imageId ? [i.imageId] : [];
    if (!i.coverImageId) i.coverImageId = i.imageIds[0] || null;
    if (i.rating === undefined) i.rating = null;
    if (i.donate === undefined) i.donate = false;
    delete i.imageId;
    return i;
  }

  function getItem(id) {
    for (var i = 0; i < state.items.length; i++) if (state.items[i].id === id) return state.items[i];
    return null;
  }

  function getOutfit(id) {
    for (var i = 0; i < state.outfits.length; i++) if (state.outfits[i].id === id) return state.outfits[i];
    return null;
  }

  function getFolder(id) {
    for (var i = 0; i < state.folders.length; i++) if (state.folders[i].id === id) return state.folders[i];
    return null;
  }

  /* Mappen waar deze outfit in zit. */
  function foldersOf(outfitId) {
    return state.folders.filter(function (f) { return f.outfitIds.indexOf(outfitId) !== -1; });
  }

  /* De kledingstukken van alle outfits in een map, zonder dubbelingen —
     genoeg voor het plaatje op de mapkaart. */
  function folderItems(folder) {
    var seen = {};
    var out = [];
    folder.outfitIds.forEach(function (oid) {
      var o = getOutfit(oid);
      if (!o) return;
      o.itemIds.forEach(function (iid) {
        if (seen[iid]) return;
        var it = getItem(iid);
        if (it) { seen[iid] = 1; out.push(it); }
      });
    });
    return out;
  }

  function upsert(list, obj) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === obj.id) { list[i] = obj; return; }
    }
    list.push(obj);
  }

  async function saveItem(item) {
    item.updatedAt = Date.now();
    await KastDB.put(KastDB.ITEMS, item);
    upsert(state.items, item);
  }

  async function saveOutfit(outfit) {
    outfit.updatedAt = Date.now();
    await KastDB.put(KastDB.OUTFITS, outfit);
    upsert(state.outfits, outfit);
  }

  async function saveFolder(folder) {
    folder.updatedAt = Date.now();
    await KastDB.put(KastDB.FOLDERS, folder);
    upsert(state.folders, folder);
  }

  async function deleteItem(id) {
    var item = getItem(id);
    if (!item) return;
    for (var n = 0; n < item.imageIds.length; n++) {
      await KastDB.remove(KastDB.IMAGES, item.imageIds[n]);
      forgetImage(item.imageIds[n]);
    }
    await KastDB.remove(KastDB.ITEMS, id);
    state.items = state.items.filter(function (i) { return i.id !== id; });

    // Het stuk mag niet als geest achterblijven in bestaande outfits.
    var touched = state.outfits.filter(function (o) { return o.itemIds.indexOf(id) !== -1; });
    for (var i = 0; i < touched.length; i++) {
      touched[i].itemIds = touched[i].itemIds.filter(function (x) { return x !== id; });
      await saveOutfit(touched[i]);
    }
  }

  async function deleteOutfit(id) {
    await KastDB.remove(KastDB.OUTFITS, id);
    state.outfits = state.outfits.filter(function (o) { return o.id !== id; });

    // ... en niet als dode verwijzing in een map.
    var touched = foldersOf(id);
    for (var i = 0; i < touched.length; i++) {
      touched[i].outfitIds = touched[i].outfitIds.filter(function (x) { return x !== id; });
      await saveFolder(touched[i]);
    }
  }

  /* Een map weggooien laat de outfits zelf staan; het is maar een verzameling. */
  async function deleteFolder(id) {
    await KastDB.remove(KastDB.FOLDERS, id);
    state.folders = state.folders.filter(function (f) { return f.id !== id; });
  }

  async function markItemWorn(item) {
    item.wearCount = (item.wearCount || 0) + 1;
    item.lastWorn = todayISO();
    await saveItem(item);
  }

  async function markOutfitWorn(outfit) {
    outfit.wearCount = (outfit.wearCount || 0) + 1;
    outfit.lastWorn = todayISO();
    await saveOutfit(outfit);
    for (var i = 0; i < outfit.itemIds.length; i++) {
      var it = getItem(outfit.itemIds[i]);
      if (it) await markItemWorn(it);
    }
  }

  /* ───────────────────────────── Filteren/sorteren ───────────────────────── */

  function itemMatchesSeason(item, season) {
    if (!season) return true;
    if (!item.seasons || !item.seasons.length) return true; // geen keuze = het hele jaar door
    return item.seasons.indexOf(season) !== -1;
  }

  function filteredItems() {
    var f = state.filters;
    var q = f.q.trim().toLowerCase();
    var list = state.items.filter(function (it) {
      // Wat weggegeven wordt hoort niet meer in het dagelijkse overzicht.
      if (!!it.donate !== !!f.donate) return false;
      if (f.cat && it.category !== f.cat) return false;
      if (f.color && (it.colors || []).indexOf(f.color) === -1) return false;
      if (!itemMatchesSeason(it, f.season)) return false;
      if (f.fav && !it.favorite) return false;
      if (f.unworn && (it.wearCount || 0) > 0) return false;
      if (q) {
        var hay = [it.name, it.brand, it.notes, (catMap[it.category] || {}).label]
          .concat((it.colors || []).map(function (c) { return (colorMap[c] || {}).label; }))
          .join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });

    var sort = f.sort;
    list.sort(function (a, b) {
      if (sort === 'name') return (a.name || 'zzz').localeCompare(b.name || 'zzz', 'nl');
      if (sort === 'worn') return (b.wearCount || 0) - (a.wearCount || 0);
      if (sort === 'unworn') return (a.wearCount || 0) - (b.wearCount || 0) || b.createdAt - a.createdAt;
      // Zonder cijfer achteraan, zodat de favorieten van Askim bovenaan staan.
      if (sort === 'rating') return (b.rating || -1) - (a.rating || -1) || b.createdAt - a.createdAt;
      return b.createdAt - a.createdAt;
    });
    return list;
  }

  function activeFilterCount() {
    var f = state.filters;
    return (f.season ? 1 : 0) + (f.color ? 1 : 0) + (f.fav ? 1 : 0) + (f.unworn ? 1 : 0) +
      (f.donate ? 1 : 0) + (f.sort !== 'recent' ? 1 : 0);
  }

  function donateItems() {
    return state.items.filter(function (i) { return i.donate; });
  }

  /* Stukken die Askim nog niet beoordeeld heeft (en deze sessie niet overslaat). */
  function askimQueue() {
    return state.items.filter(function (i) {
      return !i.donate && (i.rating === null || i.rating === undefined) &&
        state.askimSkipped.indexOf(i.id) === -1;
    });
  }

  function askimOutfits() {
    return state.outfits.filter(function (o) { return o.author === 'askim'; });
  }

  /* Outfits die Askim nog niet beoordeeld heeft — die van haarzelf horen daar
     net zo goed bij. */
  function askimOutfitQueue() {
    return state.outfits.filter(function (o) {
      return (o.rating === null || o.rating === undefined) &&
        state.askimSkipped.indexOf(o.id) === -1;
    });
  }

  /* ──────────────────────────── Stukjes opmaak ───────────────────────────── */

  function itemThumb(item, cls) {
    var cat = catMap[item.category] || catMap.overig;
    var tint = colorMap[(item.colors || [])[0]];
    var bg = tint && tint.hex.indexOf('gradient') === -1 ? tint.hex : '';
    var style = bg ? ' style="background:' + esc(bg) + '"' : '';
    var cover = coverImageOf(item);
    var photo = cover ? '<img class="ph-img" data-img="' + esc(cover) + ':thumb" alt="">' : '';
    return '<div class="' + (cls || 'tile-photo') + '">' +
             '<div class="ph-fallback"' + style + '><span>' + cat.icon + '</span></div>' +
             photo +
           '</div>';
  }

  function colorDots(colors) {
    if (!colors || !colors.length) return '';
    return '<span class="dots">' + colors.slice(0, 4).map(function (c) {
      var col = colorMap[c];
      if (!col) return '';
      return '<i class="dot" style="background:' + esc(col.hex) + '" title="' + esc(col.label) + '"></i>';
    }).join('') + '</span>';
  }

  function chipRow(list, selected, act, opts) {
    opts = opts || {};
    var out = '';
    if (opts.allLabel) {
      out += '<button type="button" class="chip' + (!selected ? ' active' : '') + '" data-act="' + act + '" data-val="">' +
             esc(opts.allLabel) + '</button>';
    }
    out += list.map(function (o) {
      var isSel = Array.isArray(selected) ? selected.indexOf(o.key) !== -1 : selected === o.key;
      var swatch = o.hex ? '<i class="chip-swatch" style="background:' + esc(o.hex) + '"></i>' : '';
      var icon = o.icon ? o.icon + ' ' : '';
      return '<button type="button" class="chip' + (isSel ? ' active' : '') + '" data-act="' + act + '" data-val="' + esc(o.key) + '">' +
             swatch + icon + esc(o.label) + '</button>';
    }).join('');
    return out;
  }

  function emptyState(icon, title, text, action) {
    return '<div class="empty">' +
      '<div class="empty-icon">' + icon + '</div>' +
      '<h2 class="empty-title">' + esc(title) + '</h2>' +
      '<p class="empty-text">' + esc(text) + '</p>' +
      (action || '') + '</div>';
  }

  /* ────────────────────────────── Navigatie/route ────────────────────────── */

  function parseRoute() {
    var h = location.hash.replace(/^#\/?/, '');
    var parts = h.split('/').filter(Boolean);
    if (!parts.length) return ['kast'];
    return parts;
  }

  function rootTab(parts) {
    if (parts[0] === 'kast' || parts[0] === 'item') return 'kast';
    if (parts[0] === 'outfits' || parts[0] === 'outfit') return 'outfits';
    if (parts[0] === 'mappen' || parts[0] === 'map') return 'outfits';
    if (parts[0] === 'askim') return 'askim';
    if (parts[0] === 'meer' || parts[0] === 'doneren') return 'meer';
    return 'kast';
  }

  var lastRoute = null;

  function render() {
    if (!state.ready) return;
    var parts = parseRoute();
    var view = '';
    var top = '';

    switch (parts[0]) {
      case 'item':
        if (parts[1] === 'new') { top = topBar('Nieuw kledingstuk', '#/kast'); view = viewItemForm(null); }
        else if (parts[2] === 'edit') { top = topBar('Bewerken', '#/item/' + parts[1]); view = viewItemForm(parts[1]); }
        else { top = topBar('', '#/kast'); view = viewItemDetail(parts[1]); }
        break;
      case 'outfits':
        top = topBar('Outfits', null, '<button class="icon-btn" data-act="new-outfit" title="Nieuwe outfit">+</button>');
        view = viewOutfits();
        break;
      case 'outfit':
        if (parts[1] === 'new') { top = topBar('Nieuwe outfit', '#/outfits'); view = viewOutfitForm(null, 'ik'); }
        else if (parts[1] === 'new-askim') { top = topBar('Outfit van Askim', '#/askim'); view = viewOutfitForm(null, 'askim'); }
        else if (parts[2] === 'edit') { top = topBar('Bewerken', '#/outfit/' + parts[1]); view = viewOutfitForm(parts[1]); }
        else { top = topBar('', '#/outfits'); view = viewOutfitDetail(parts[1]); }
        break;
      case 'askim':
        top = topBar('Mijn Askim');
        view = viewAskim();
        break;
      case 'doneren':
        top = topBar('Doneren', '#/meer');
        view = viewDoneren();
        break;
      case 'mappen':
        top = topBar('Outfits', null, '<button class="icon-btn" data-act="new-folder" title="Nieuwe map">+</button>');
        view = viewFolders();
        break;
      case 'map':
        if (parts[1] === 'new') { top = topBar('Nieuwe map', '#/mappen'); view = viewFolderForm(null); }
        else if (parts[2] === 'edit') { top = topBar('Map bewerken', '#/map/' + parts[1]); view = viewFolderForm(parts[1]); }
        else { top = topBar('', '#/mappen'); view = viewFolderDetail(parts[1]); }
        break;
      case 'meer':
        top = topBar('Meer');
        view = viewMeer();
        break;
      default:
        top = topBar('Mijn kledingkast', null,
          '<button class="icon-btn" data-act="bulk-add" title="Meerdere kledingstukken toevoegen">⧉</button>' +
          '<button class="icon-btn" data-act="new-item" title="Nieuw kledingstuk">+</button>');
        view = viewKast();
    }

    els.topbar.innerHTML = top;
    els.view.innerHTML = view;
    els.view.setAttribute('data-route', parts[0]);
    els.tabbar.innerHTML = tabBar(rootTab(parts));

    // Alleen bij een echte schermwissel laten opkomen — niet bij elk tikje
    // op een filterchip, want dan knippert het hele scherm mee.
    var here = parts.join('/');
    if (here !== lastRoute) {
      lastRoute = here;
      els.view.classList.remove('is-entering');
      void els.view.offsetWidth;
      els.view.classList.add('is-entering');
    }

    hydrateImages(els.view);
  }

  function topBar(title, backHref, actions) {
    return (backHref ? '<a class="icon-btn" href="' + esc(backHref) + '" aria-label="Terug">‹</a>' : '<span class="icon-btn ghost"></span>') +
      '<h1 class="topbar-title">' + esc(title || '') + '</h1>' +
      '<div class="topbar-actions">' + (actions || '') + '</div>';
  }

  /* Hetzelfde hangertje als het app-icoon; op een telefoon verborgen, want
     daar is de tabbalk onderaan geen plek voor een woordmerk. */
  var BRAND = '<div class="brand">' +
    '<svg class="brand-mark" viewBox="0 0 512 512" aria-hidden="true">' +
      '<g fill="none" stroke="currentColor" stroke-width="34" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M256 243 L256 207 A 32 32 0 1 1 288 179"/>' +
        '<path d="M256 243 L106 357 L406 357 Z"/>' +
      '</g></svg>' +
    '<span class="brand-name">Kledingkast</span></div>';

  function tabBar(active) {
    var tabs = [
      { key: 'kast', href: '#/kast', icon: '🚪', label: 'Kast' },
      { key: 'outfits', href: '#/outfits', icon: '✨', label: 'Outfits' },
      { key: 'askim', href: '#/askim', icon: '💛', label: 'Askim' },
      { key: 'meer', href: '#/meer', icon: '☰', label: 'Meer' }
    ];
    return BRAND + tabs.map(function (t) {
      return '<a class="tab' + (t.key === active ? ' active' : '') + '" href="' + t.href + '"' +
        (t.key === active ? ' aria-current="page"' : '') + '>' +
        '<span class="tab-icon">' + t.icon + '</span><span class="tab-label">' + t.label + '</span></a>';
    }).join('');
  }

  function segment(active) {
    return '<div class="segment">' +
      '<a class="segment-btn' + (active === 'outfits' ? ' active' : '') + '" href="#/outfits">Outfits</a>' +
      '<a class="segment-btn' + (active === 'mappen' ? ' active' : '') + '" href="#/mappen">Mappen</a>' +
    '</div>';
  }

  /* ───────────────────────────────── Kast ────────────────────────────────── */

  function viewKast() {
    if (!state.items.length) {
      return emptyState('🧺', 'Je kast is nog leeg',
        'Voeg je eerste kledingstuk toe met een foto, of zet in één keer meerdere foto\'s in de kast.',
        '<div class="empty-actions">' +
          '<button class="btn btn-primary" data-act="new-item">Kledingstuk toevoegen</button>' +
          '<button class="btn btn-ghost" data-act="bulk-add">Meerdere foto\'s</button>' +
        '</div>');
    }

    return '' +
      '<div class="toolbar">' +
        '<div class="search"><span class="search-icon">🔎</span>' +
          '<input id="search" class="search-input" type="search" placeholder="Zoek op naam, merk of kleur" value="' + esc(state.filters.q) + '">' +
          '<button class="icon-btn small' + (state.filtersOpen ? ' active' : '') + '" data-act="toggle-filters">' +
            '⚙︎' + (activeFilterCount() ? '<i class="badge-dot"></i>' : '') +
          '</button>' +
        '</div>' +
        '<div class="chips scroll-x">' + chipRow(CATEGORIES, state.filters.cat, 'filter-cat', { allLabel: 'Alles' }) + '</div>' +
        (state.filtersOpen ? filterPanel() : '') +
      '</div>' +
      '<div id="grid" class="grid">' + gridHtml() + '</div>';
  }

  function filterPanel() {
    var f = state.filters;
    return '<div class="filter-panel">' +
      '<div class="filter-group"><span class="filter-label">Seizoen</span>' +
        '<div class="chips">' + chipRow(SEASONS, f.season, 'filter-season', { allLabel: 'Alle' }) + '</div></div>' +
      '<div class="filter-group"><span class="filter-label">Kleur</span>' +
        '<div class="chips">' + chipRow(COLORS, f.color, 'filter-color', { allLabel: 'Alle' }) + '</div></div>' +
      '<div class="filter-group"><span class="filter-label">Tonen</span>' +
        '<div class="chips">' +
          '<button type="button" class="chip' + (f.fav ? ' active' : '') + '" data-act="filter-fav">★ Favorieten</button>' +
          '<button type="button" class="chip' + (f.unworn ? ' active' : '') + '" data-act="filter-unworn">Nooit gedragen</button>' +
          '<button type="button" class="chip' + (f.donate ? ' active' : '') + '" data-act="filter-donate">🎁 Doneerstapel</button>' +
        '</div></div>' +
      '<div class="filter-group"><span class="filter-label">Sorteren</span>' +
        '<div class="chips">' + chipRow([
          { key: 'recent', label: 'Nieuwste' },
          { key: 'name', label: 'Naam' },
          { key: 'rating', label: '💛 Cijfer van Askim' },
          { key: 'worn', label: 'Meest gedragen' },
          { key: 'unworn', label: 'Minst gedragen' }
        ], f.sort, 'filter-sort') + '</div></div>' +
      (activeFilterCount() ? '<button class="btn btn-ghost btn-block" data-act="filter-reset">Filters wissen</button>' : '') +
    '</div>';
  }

  function gridHtml() {
    var list = filteredItems();
    if (!list.length) {
      return '<div class="empty small"><div class="empty-icon">🔍</div>' +
        '<p class="empty-text">Niets gevonden met deze filters.</p>' +
        '<button class="btn btn-ghost" data-act="filter-reset">Filters wissen</button></div>';
    }
    return list.map(function (it) {
      var cat = catMap[it.category] || catMap.overig;
      var extra = (it.imageIds || []).length;
      return '<a class="tile" href="#/item/' + esc(it.id) + '">' +
        '<div class="tile-media">' +
          itemThumb(it) +
          (it.favorite ? '<span class="tile-fav">★</span>' : '') +
          (extra > 1 ? '<span class="tile-count">' + extra + ' 📷</span>' : '') +
          (it.rating ? '<span class="tile-rating">' + it.rating + '</span>' : '') +
          (!it.name ? '<span class="tile-badge">nog invullen</span>' : '') +
        '</div>' +
        '<div class="tile-body">' +
          '<span class="tile-name">' + esc(it.name || 'Naamloos') + '</span>' +
          '<span class="tile-meta">' + esc(cat.label) + colorDots(it.colors) + '</span>' +
        '</div></a>';
    }).join('');
  }

  function refreshGrid() {
    var grid = document.getElementById('grid');
    if (!grid) return;
    grid.innerHTML = gridHtml();
    hydrateImages(grid);
  }

  /* ──────────────────────────── Kledingstuk-detail ───────────────────────── */

  function viewItemDetail(id) {
    var it = getItem(id);
    if (!it) return emptyState('🤔', 'Niet gevonden', 'Dit kledingstuk bestaat niet meer.', '<a class="btn btn-primary" href="#/kast">Naar de kast</a>');

    var cat = catMap[it.category] || catMap.overig;
    var inOutfits = state.outfits.filter(function (o) { return o.itemIds.indexOf(it.id) !== -1; });
    var cover = coverImageOf(it);
    var ids = it.imageIds || [];

    var rows = '';
    rows += metaRow('Categorie', cat.icon + ' ' + cat.label);
    if ((it.colors || []).length) {
      rows += metaRow('Kleur', it.colors.map(function (c) { return (colorMap[c] || {}).label || c; }).join(', '));
    }
    rows += metaRow('Seizoen', (it.seasons || []).length
      ? it.seasons.map(function (s) { return (seasonMap[s] || {}).label || s; }).join(', ')
      : 'Het hele jaar door');
    if (it.brand) rows += metaRow('Merk', it.brand);
    if (it.size) rows += metaRow('Maat', it.size);
    rows += metaRow('Gedragen', (it.wearCount || 0) + ' keer' +
      (it.lastWorn ? ' · laatst ' + formatDate(it.lastWorn) : ''));
    rows += metaRow('Cijfer van Askim', it.rating ? it.rating + ' / 10' : 'nog geen cijfer');

    // Meer dan één foto? Dan een strookje eronder om doorheen te bladeren.
    var gallery = ids.length > 1
      ? '<div class="gallery-strip scroll-x">' + ids.map(function (imgId) {
          return '<button type="button" class="gallery-thumb' + (imgId === cover ? ' is-active' : '') + '" ' +
            'data-act="show-photo" data-id="' + esc(imgId) + '">' +
            '<img class="ph-img" data-img="' + esc(imgId) + ':thumb" alt=""></button>';
        }).join('') + '</div>'
      : '';

    return '<div class="detail">' +
      '<div class="detail-photo">' +
        '<div class="photo-frame">' +
          '<div class="ph-fallback"><span>' + cat.icon + '</span></div>' +
          (cover ? '<img id="detailPhoto" class="ph-img" data-img="' + esc(cover) + ':full" alt="">' : '') +
        '</div>' +
        gallery +
      '</div>' +
      '<div class="detail-body">' +
        '<div class="detail-head">' +
          '<h2 class="detail-title">' + esc(it.name || 'Naamloos') + '</h2>' +
          '<button class="icon-btn star' + (it.favorite ? ' on' : '') + '" data-act="toggle-fav-item" data-id="' + esc(it.id) + '">' +
            (it.favorite ? '★' : '☆') + '</button>' +
        '</div>' +
        '<div class="meta-list">' + rows + '</div>' +
        (it.notes ? '<p class="notes">' + esc(it.notes) + '</p>' : '') +
        (it.donate
          ? '<div class="banner">🎁 Dit stuk ligt op de doneerstapel.</div>' +
            '<button class="btn btn-secondary btn-block" data-act="undonate-item" data-id="' + esc(it.id) + '">Terug in de kast</button>'
          : '<button class="btn btn-primary btn-block" data-act="wear-item" data-id="' + esc(it.id) + '">Vandaag gedragen</button>') +

        '<h3 class="section-title">Cijfer van Askim</h3>' +
        ratingRow(it, 'rate-item') +
        (!it.donate
          ? '<button class="btn btn-ghost btn-block" data-act="donate-item" data-id="' + esc(it.id) + '">🎁 Naar de doneerstapel</button>'
          : '') +

        (inOutfits.length
          ? '<h3 class="section-title">In outfits (' + inOutfits.length + ')</h3>' +
            '<div class="list">' + inOutfits.map(outfitRowHtml).join('') + '</div>'
          : '') +
        combinesWithHtml(it) +
        '<div class="row-actions">' +
          '<a class="btn btn-secondary" href="#/item/' + esc(it.id) + '/edit">Bewerken</a>' +
          '<button class="btn btn-danger" data-act="delete-item" data-id="' + esc(it.id) + '">Verwijderen</button>' +
        '</div>' +
      '</div></div>';
  }

  function metaRow(key, val) {
    return '<div class="meta-row"><span class="meta-key">' + esc(key) + '</span><span class="meta-val">' + esc(val) + '</span></div>';
  }

  /* Wat draag je hier meestal bij? Afgeleid uit de outfits waar dit stuk in zit. */
  function combinesWithHtml(it) {
    var tally = {};
    state.outfits.forEach(function (o) {
      if (o.itemIds.indexOf(it.id) === -1) return;
      o.itemIds.forEach(function (id) {
        if (id !== it.id) tally[id] = (tally[id] || 0) + 1;
      });
    });
    var others = Object.keys(tally)
      .map(function (id) { return { item: getItem(id), n: tally[id] }; })
      .filter(function (x) { return x.item && !x.item.donate; })
      .sort(function (a, b) { return b.n - a.n; })
      .slice(0, 6);
    if (!others.length) return '';

    return '<h3 class="section-title">Combineer je met</h3>' +
      '<div class="grid grid-small">' + others.map(function (x) {
        return '<a class="tile" href="#/item/' + esc(x.item.id) + '">' +
          '<div class="tile-media">' + itemThumb(x.item) +
            (x.n > 1 ? '<span class="tile-count">' + x.n + '×</span>' : '') + '</div>' +
          '<div class="tile-body"><span class="tile-name">' + esc(x.item.name || 'Naamloos') + '</span></div>' +
        '</a>';
      }).join('') + '</div>';
  }

  /* Knoppen 1 t/m 10 waarmee Askim een kledingstuk of outfit een cijfer geeft. */
  function ratingRow(obj, act) {
    var buttons = '';
    for (var n = 1; n <= 10; n++) {
      buttons += '<button type="button" class="rate-btn' + (obj.rating === n ? ' active' : '') + '" ' +
        'data-act="' + act + '" data-id="' + esc(obj.id) + '" data-val="' + n + '">' + n + '</button>';
    }
    return '<div class="rate-row">' + buttons + '</div>' +
      (obj.rating ? '<button type="button" class="btn btn-ghost btn-block" data-act="' + act + '" ' +
        'data-id="' + esc(obj.id) + '" data-val="">Cijfer wissen</button>' : '');
  }

  /* ─────────────────────────── Kledingstuk-formulier ─────────────────────── */

  function viewItemForm(id) {
    var existing = id ? getItem(id) : null;
    if (id && !existing) return emptyState('🤔', 'Niet gevonden', 'Dit kledingstuk bestaat niet meer.', '<a class="btn btn-primary" href="#/kast">Naar de kast</a>');

    if (!state.draft || state.draft.kind !== 'item' || state.draft.id !== (existing ? existing.id : 'new')) {
      var base = existing ? JSON.parse(JSON.stringify(existing)) : newItem();
      state.draft = {
        kind: 'item', id: existing ? existing.id : 'new', data: base,
        // photos: {id, url} — url alleen bij net gekozen foto's; blobs pas bij opslaan naar de database
        photos: (base.imageIds || []).map(function (imgId) { return { id: imgId, url: '', blobs: null }; }),
        cover: coverImageOf(base),
        removed: []
      };
    }
    var d = state.draft;
    var it = d.data;
    var coverPhoto = null;
    d.photos.forEach(function (p) { if (p.id === d.cover) coverPhoto = p; });
    if (!coverPhoto) coverPhoto = d.photos[0] || null;

    var coverHtml = '';
    if (coverPhoto) {
      coverHtml = coverPhoto.url
        ? '<img class="ph-img loaded" src="' + esc(coverPhoto.url) + '" alt="">'
        : '<img class="ph-img" data-img="' + esc(coverPhoto.id) + ':full" alt="">';
    }

    var strip = d.photos.map(function (p) {
      var img = p.url
        ? '<img class="ph-img loaded" src="' + esc(p.url) + '" alt="">'
        : '<img class="ph-img" data-img="' + esc(p.id) + ':thumb" alt="">';
      return '<div class="photo-thumb' + (p.id === (coverPhoto && coverPhoto.id) ? ' is-cover' : '') + '" ' +
        'data-act="set-cover" data-id="' + esc(p.id) + '">' +
        img +
        '<span class="cover-mark">★</span>' +
        '<button type="button" class="thumb-x" data-act="drop-photo" data-id="' + esc(p.id) + '" aria-label="Foto verwijderen">×</button>' +
      '</div>';
    }).join('');

    return '<form class="form" id="itemForm" novalidate>' +
      '<button type="button" class="photo-picker" data-act="pick-photo">' +
        '<div class="photo-frame' + (coverPhoto && coverPhoto.url ? ' has-photo' : '') + '">' +
          '<div class="ph-fallback"><span>📷</span></div>' + coverHtml +
        '</div>' +
        '<span class="photo-hint">' + (d.photos.length ? 'Foto\'s toevoegen' : 'Foto toevoegen') + '</span>' +
      '</button>' +

      (d.photos.length
        ? '<div class="photo-strip scroll-x">' + strip +
            '<button type="button" class="photo-add" data-act="pick-photo" aria-label="Foto toevoegen">+</button>' +
          '</div>' +
          '<p class="hint block">' + (d.photos.length > 1
            ? 'Tik op een foto om die als hoofdfoto te kiezen — die zie je in de kast en op outfits.'
            : 'Voeg gerust meer foto\'s toe; de foto met ★ is de hoofdfoto.') + '</p>'
        : '') +

      '<div class="field"><label for="f-name">Naam</label>' +
        '<input id="f-name" class="input" type="text" value="' + esc(it.name) + '" placeholder="Bijv. zwarte coltrui" autocomplete="off"></div>' +

      '<div class="field"><label>Categorie</label>' +
        '<div class="chips">' + chipRow(CATEGORIES, it.category, 'draft-cat') + '</div></div>' +

      '<div class="field"><label>Kleur <span class="hint">(meerdere mogelijk)</span></label>' +
        '<div class="chips">' + chipRow(COLORS, it.colors, 'draft-color') + '</div></div>' +

      '<div class="field"><label>Seizoen <span class="hint">(leeg = hele jaar)</span></label>' +
        '<div class="chips">' + chipRow(SEASONS, it.seasons, 'draft-season') + '</div></div>' +

      '<div class="field-row">' +
        '<div class="field"><label for="f-brand">Merk</label>' +
          '<input id="f-brand" class="input" type="text" value="' + esc(it.brand) + '" autocomplete="off"></div>' +
        '<div class="field"><label for="f-size">Maat</label>' +
          '<input id="f-size" class="input" type="text" value="' + esc(it.size) + '" autocomplete="off"></div>' +
      '</div>' +

      '<div class="field"><label for="f-notes">Notities</label>' +
        '<textarea id="f-notes" class="input textarea" rows="3" placeholder="Waar past dit goed bij?">' + esc(it.notes) + '</textarea></div>' +

      '<label class="switch"><input type="checkbox" id="f-fav"' + (it.favorite ? ' checked' : '') + '><span>Favoriet</span></label>' +

      '<div class="form-actions">' +
        '<button type="button" class="btn btn-secondary" data-act="cancel-form">Annuleren</button>' +
        '<button type="button" class="btn btn-primary" data-act="save-item">Opslaan</button>' +
      '</div>' +
    '</form>';
  }

  function syncItemDraftFromDom() {
    var d = state.draft;
    if (!d || d.kind !== 'item') return;
    var v = function (sel) { var e = document.getElementById(sel); return e ? e.value : ''; };
    d.data.name = v('f-name').trim();
    d.data.brand = v('f-brand').trim();
    d.data.size = v('f-size').trim();
    d.data.notes = v('f-notes').trim();
    var fav = document.getElementById('f-fav');
    d.data.favorite = !!(fav && fav.checked);
  }

  async function commitItem() {
    syncItemDraftFromDom();
    var d = state.draft;
    var it = d.data;

    for (var r = 0; r < d.removed.length; r++) {
      await KastDB.remove(KastDB.IMAGES, d.removed[r]);
      forgetImage(d.removed[r]);
    }
    for (var p = 0; p < d.photos.length; p++) {
      var ph = d.photos[p];
      if (!ph.blobs) continue;
      await KastDB.put(KastDB.IMAGES, { id: ph.id, full: ph.blobs.full, thumb: ph.blobs.thumb });
      forgetImage(ph.id);
    }

    it.imageIds = d.photos.map(function (x) { return x.id; });
    it.coverImageId = (d.cover && it.imageIds.indexOf(d.cover) !== -1) ? d.cover : (it.imageIds[0] || null);

    await saveItem(it);
    clearDraft();
    toast('Opgeslagen');
    go('#/item/' + it.id);
  }

  function clearDraft() {
    if (state.draft && state.draft.photos) {
      state.draft.photos.forEach(function (p) { if (p.url) URL.revokeObjectURL(p.url); });
    }
    state.draft = null;
  }

  /* ────────────────────────────────  Outfits ─────────────────────────────── */

  function viewOutfits() {
    if (!state.outfits.length) {
      return segment('outfits') + emptyState('✨', 'Nog geen outfits',
        state.items.length
          ? 'Combineer kledingstukken uit je kast tot een outfit die je later zo terugvindt.'
          : 'Voeg eerst wat kleding toe aan je kast, dan kun je die hier combineren.',
        state.items.length
          ? '<button class="btn btn-primary" data-act="new-outfit">Outfit maken</button>'
          : '<button class="btn btn-primary" data-act="new-item">Kledingstuk toevoegen</button>');
    }
    var f = state.outfitFilter;
    return segment('outfits') +
      '<div class="toolbar sub">' +
        '<div class="search"><span class="search-icon">🔎</span>' +
          '<input id="outfitSearch" class="search-input" type="search" ' +
            'placeholder="Zoek op naam of kledingstuk" value="' + esc(f.q) + '">' +
        '</div>' +
        '<div class="chips scroll-x">' +
          chipRow(OCCASIONS, f.occasion, 'outfit-occasion', { allLabel: 'Alle' }) +
        '</div>' +
        '<div class="chips scroll-x">' +
          '<button type="button" class="chip' + (f.author === 'askim' ? ' active' : '') + '" ' +
            'data-act="outfit-author" data-val="askim">💛 Van Askim</button>' +
          '<button type="button" class="chip' + (f.author === 'ik' ? ' active' : '') + '" ' +
            'data-act="outfit-author" data-val="ik">Van mij</button>' +
          chipRow([
            { key: 'recent', label: 'Nieuwste' },
            { key: 'rating', label: '💛 Hoogste cijfer' }
          ], state.outfitSort, 'outfit-sort') +
        '</div>' +
      '</div>' +
      '<div id="outfitList">' + outfitListHtml() + '</div>';
  }

  function outfitListHtml() {
    var f = state.outfitFilter;
    var q = f.q.trim().toLowerCase();
    var matched = state.outfits.filter(function (o) {
      if (f.occasion && o.occasion !== f.occasion) return false;
      if (f.author && o.author !== f.author) return false;
      if (!q) return true;
      var hay = [o.name, o.notes, (occasionMap[o.occasion] || {}).label]
        .concat(o.itemIds.map(function (id) { return (getItem(id) || {}).name; }))
        .join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    if (!matched.length) {
      return '<div class="empty small"><div class="empty-icon">🔍</div>' +
        '<p class="empty-text">Geen outfits met deze filters.</p>' +
        '<button class="btn btn-ghost" data-act="outfit-filter-reset">Filters wissen</button></div>';
    }
    return '<div class="list list-cards">' + sortedOutfits(matched).map(outfitCardHtml).join('') + '</div>';
  }

  function refreshOutfitList() {
    var el = document.getElementById('outfitList');
    if (!el) return;
    el.innerHTML = outfitListHtml();
    hydrateImages(el);
  }

  function sortedOutfits(list) {
    return list.slice().sort(function (a, b) {
      if (state.outfitSort === 'rating') {
        return (b.rating || -1) - (a.rating || -1) || b.updatedAt - a.updatedAt;
      }
      return b.updatedAt - a.updatedAt;
    });
  }

  function outfitCardHtml(o) {
    var items = o.itemIds.map(getItem).filter(Boolean);
    var occ = occasionMap[o.occasion];
    var mappen = foldersOf(o.id);
    return '<a class="outfit-card" href="#/outfit/' + esc(o.id) + '">' +
      '<div class="tile-media">' + collageHtml(items) +
        (o.rating ? '<span class="tile-rating">' + o.rating + '</span>' : '') + '</div>' +
      '<div class="outfit-body">' +
        '<span class="outfit-name">' + esc(o.name || 'Naamloze outfit') +
          (o.author === 'askim' ? ' <span class="by-askim">💛 Askim</span>' : '') +
          (o.favorite ? ' <span class="star-inline">★</span>' : '') + '</span>' +
        '<span class="outfit-meta">' + plural(items.length, 'stuk', 'stukken') +
          (occ ? ' · ' + esc(occ.label) : '') +
          (o.wearCount ? ' · ' + o.wearCount + '× gedragen' : '') + '</span>' +
        (mappen.length ? '<span class="pill-list">' + mappen.map(function (f) {
          return '<span class="pill">' + f.icon + ' ' + esc(f.name || 'Naamloze map') + '</span>';
        }).join('') + '</span>' : '') +
      '</div></a>';
  }

  function outfitRowHtml(o) {
    var items = o.itemIds.map(getItem).filter(Boolean);
    return '<a class="list-item" href="#/outfit/' + esc(o.id) + '">' +
      collageHtml(items, 'collage small') +
      '<span class="list-text"><b>' + esc(o.name || 'Naamloze outfit') + '</b>' +
      '<span class="list-sub">' + plural(items.length, 'stuk', 'stukken') + '</span></span>' +
      '<span class="chev">›</span></a>';
  }

  function collageHtml(items, cls) {
    var cells = items.slice(0, 4);
    if (!cells.length) {
      return '<div class="' + (cls || 'collage') + ' empty-collage"><span>✨</span></div>';
    }
    return '<div class="' + (cls || 'collage') + ' cells-' + cells.length + '">' +
      cells.map(function (it) { return itemThumb(it, 'collage-cell'); }).join('') + '</div>';
  }

  function viewOutfitDetail(id) {
    var o = getOutfit(id);
    if (!o) return emptyState('🤔', 'Niet gevonden', 'Deze outfit bestaat niet meer.', '<a class="btn btn-primary" href="#/outfits">Naar outfits</a>');
    var items = o.itemIds.map(getItem).filter(Boolean);
    var occ = occasionMap[o.occasion];
    var mappen = foldersOf(o.id);

    return '<div class="detail">' +
      '<div class="detail-photo">' + collageHtml(items, 'collage big') + '</div>' +
      '<div class="detail-body">' +
        '<div class="detail-head">' +
          '<h2 class="detail-title">' + esc(o.name || 'Naamloze outfit') + '</h2>' +
          '<button class="icon-btn star' + (o.favorite ? ' on' : '') + '" data-act="toggle-fav-outfit" data-id="' + esc(o.id) + '">' +
            (o.favorite ? '★' : '☆') + '</button>' +
        '</div>' +
        '<div class="meta-list">' +
          (occ ? metaRow('Gelegenheid', occ.label) : '') +
          metaRow('Seizoen', (o.seasons || []).length
            ? o.seasons.map(function (s) { return (seasonMap[s] || {}).label || s; }).join(', ')
            : 'Het hele jaar door') +
          metaRow('Gedragen', (o.wearCount || 0) + ' keer' + (o.lastWorn ? ' · laatst ' + formatDate(o.lastWorn) : '')) +
          metaRow('Samengesteld door', o.author === 'askim' ? 'Askim' : 'jou') +
          metaRow('Cijfer van Askim', o.rating ? o.rating + ' / 10' : 'nog geen cijfer') +
        '</div>' +
        (o.notes ? '<p class="notes">' + esc(o.notes) + '</p>' : '') +
        '<button class="btn btn-primary btn-block" data-act="wear-outfit" data-id="' + esc(o.id) + '">Vandaag gedragen</button>' +

        '<h3 class="section-title">Cijfer van Askim</h3>' +
        ratingRow(o, 'rate-outfit') +

        '<h3 class="section-title">Mappen</h3>' +
        (mappen.length
          ? '<div class="pill-list big">' + mappen.map(function (f) {
              return '<a class="pill" href="#/map/' + esc(f.id) + '">' + f.icon + ' ' + esc(f.name || 'Naamloze map') + '</a>';
            }).join('') + '</div>'
          : '<p class="hint block">Deze outfit zit nog in geen enkele map.</p>') +
        '<button class="btn btn-secondary btn-block" data-act="assign-folders" data-id="' + esc(o.id) + '">In een map zetten</button>' +

        '<h3 class="section-title">Kledingstukken (' + items.length + ')</h3>' +
        (items.length
          ? '<div class="list">' + items.map(function (it) {
              var cat = catMap[it.category] || catMap.overig;
              return '<a class="list-item" href="#/item/' + esc(it.id) + '">' +
                itemThumb(it, 'list-thumb') +
                '<span class="list-text"><b>' + esc(it.name || 'Naamloos') + '</b>' +
                '<span class="list-sub">' + esc(cat.label) + '</span></span>' +
                '<span class="chev">›</span></a>';
            }).join('') + '</div>'
          : '<p class="empty-text">Deze outfit heeft nog geen kledingstukken.</p>') +
        '<div class="row-actions">' +
          '<a class="btn btn-secondary" href="#/outfit/' + esc(o.id) + '/edit">Bewerken</a>' +
          '<button class="btn btn-secondary" data-act="duplicate-outfit" data-id="' + esc(o.id) + '">Dupliceren</button>' +
          '<button class="btn btn-danger" data-act="delete-outfit" data-id="' + esc(o.id) + '">Verwijderen</button>' +
        '</div>' +
      '</div></div>';
  }

  function viewOutfitForm(id, author) {
    var existing = id ? getOutfit(id) : null;
    if (id && !existing) return emptyState('🤔', 'Niet gevonden', 'Deze outfit bestaat niet meer.', '<a class="btn btn-primary" href="#/outfits">Naar outfits</a>');

    if (!state.draft || state.draft.kind !== 'outfit' || state.draft.id !== (existing ? existing.id : 'new')) {
      state.draft = {
        kind: 'outfit', id: existing ? existing.id : 'new',
        data: existing ? JSON.parse(JSON.stringify(existing)) : newOutfit(author)
      };
    }
    var o = state.draft.data;
    var chosen = o.itemIds.map(getItem).filter(Boolean);

    return '<form class="form" id="outfitForm" novalidate>' +
      '<div class="field"><label for="o-name">Naam</label>' +
        '<input id="o-name" class="input" type="text" value="' + esc(o.name) + '" placeholder="Bijv. maandag op kantoor" autocomplete="off"></div>' +

      '<div class="field"><label>Kledingstukken <span class="hint">(' + chosen.length + ' gekozen)</span></label>' +
        (chosen.length
          ? '<div class="sel-strip scroll-x">' + chosen.map(function (it) {
              return '<div class="sel-chip">' + itemThumb(it, 'sel-thumb') +
                '<span class="sel-name">' + esc(it.name || 'Naamloos') + '</span>' +
                '<button type="button" class="sel-x" data-act="unpick-item" data-id="' + esc(it.id) + '" aria-label="Verwijderen">×</button>' +
              '</div>';
            }).join('') + '</div>'
          : '<p class="hint block">Nog niets gekozen.</p>') +
        '<div class="row-actions">' +
          '<button type="button" class="btn btn-secondary" data-act="open-picker">Kleding kiezen</button>' +
          '<button type="button" class="btn btn-ghost" data-act="suggest-outfit">🎲 Verras me</button>' +
        '</div>' +
      '</div>' +

      '<div class="field"><label>Gelegenheid</label>' +
        '<div class="chips">' + chipRow(OCCASIONS, o.occasion, 'draft-occasion') + '</div></div>' +

      '<div class="field"><label>Seizoen <span class="hint">(leeg = hele jaar)</span></label>' +
        '<div class="chips">' + chipRow(SEASONS, o.seasons, 'draft-oseason') + '</div></div>' +

      '<div class="field"><label for="o-notes">Notities</label>' +
        '<textarea id="o-notes" class="input textarea" rows="3">' + esc(o.notes) + '</textarea></div>' +

      '<label class="switch"><input type="checkbox" id="o-fav"' + (o.favorite ? ' checked' : '') + '><span>Favoriet</span></label>' +

      '<div class="form-actions">' +
        '<button type="button" class="btn btn-secondary" data-act="cancel-form">Annuleren</button>' +
        '<button type="button" class="btn btn-primary" data-act="save-outfit">Opslaan</button>' +
      '</div>' +
    '</form>';
  }

  function syncOutfitDraftFromDom() {
    var d = state.draft;
    if (!d || d.kind !== 'outfit') return;
    var name = document.getElementById('o-name');
    var notes = document.getElementById('o-notes');
    var fav = document.getElementById('o-fav');
    if (name) d.data.name = name.value.trim();
    if (notes) d.data.notes = notes.value.trim();
    if (fav) d.data.favorite = !!fav.checked;
  }

  async function commitOutfit() {
    syncOutfitDraftFromDom();
    var o = state.draft.data;
    if (!o.itemIds.length) {
      toast('Kies eerst minstens één kledingstuk');
      return;
    }
    await saveOutfit(o);
    clearDraft();
    toast('Outfit opgeslagen');
    go('#/outfit/' + o.id);
  }

  function suggestOutfit() {
    var pool = state.items.filter(function (it) {
      return itemMatchesSeason(it, (state.draft.data.seasons || [])[0] || '');
    });
    var picked = [];
    SUGGEST_SLOTS.forEach(function (slot) {
      var candidates = pool.filter(function (it) {
        return slot.cats.indexOf(it.category) !== -1 && picked.indexOf(it.id) === -1;
      });
      if (!candidates.length) return;
      if (!slot.required && Math.random() < 0.35) return;
      picked.push(candidates[Math.floor(Math.random() * candidates.length)].id);
    });
    if (!picked.length) {
      toast('Te weinig kleding in je kast voor een voorstel');
      return;
    }
    syncOutfitDraftFromDom();
    state.draft.data.itemIds = picked;
    render();
  }

  /* ─────────────────────────────────  Mappen ─────────────────────────────── */

  function viewFolders() {
    if (!state.folders.length) {
      return segment('mappen') + emptyState('📁', 'Nog geen mappen',
        'In een map verzamel je outfits die bij elkaar horen. Bijvoorbeeld "Nog kopen" ' +
        'voor outfits die je nog wilt aanschaffen, of "Vakantie Italië".',
        '<button class="btn btn-primary" data-act="new-folder">Map maken</button>');
    }
    var sorted = state.folders.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    return segment('mappen') + '<div class="list list-cards">' + sorted.map(folderCardHtml).join('') + '</div>';
  }

  function folderCardHtml(f) {
    return '<a class="outfit-card" href="#/map/' + esc(f.id) + '">' +
      collageHtml(folderItems(f)) +
      '<div class="outfit-body">' +
        '<span class="outfit-name">' + f.icon + ' ' + esc(f.name || 'Naamloze map') + '</span>' +
        '<span class="outfit-meta">' + plural(f.outfitIds.length, 'outfit', 'outfits') + '</span>' +
      '</div></a>';
  }

  function viewFolderDetail(id) {
    var f = getFolder(id);
    if (!f) return emptyState('🤔', 'Niet gevonden', 'Deze map bestaat niet meer.', '<a class="btn btn-primary" href="#/mappen">Naar mappen</a>');
    var outfits = f.outfitIds.map(getOutfit).filter(Boolean);

    return '<div class="detail">' +
      '<div class="detail-photo">' + collageHtml(folderItems(f), 'collage big') + '</div>' +
      '<div class="detail-body">' +
        '<div class="detail-head">' +
          '<h2 class="detail-title">' + f.icon + ' ' + esc(f.name || 'Naamloze map') + '</h2>' +
        '</div>' +
        (f.notes ? '<p class="notes">' + esc(f.notes) + '</p>' : '') +
        '<h3 class="section-title">Outfits (' + outfits.length + ')</h3>' +
        (outfits.length
          ? '<div class="list list-cards flush">' + outfits.map(outfitCardHtml).join('') + '</div>'
          : '<p class="hint block">Deze map is nog leeg. Kies via "Bewerken" welke outfits erin horen.</p>') +
        '<div class="row-actions">' +
          '<a class="btn btn-secondary" href="#/map/' + esc(f.id) + '/edit">Bewerken</a>' +
          '<button class="btn btn-danger" data-act="delete-folder" data-id="' + esc(f.id) + '">Verwijderen</button>' +
        '</div>' +
      '</div></div>';
  }

  function viewFolderForm(id) {
    var existing = id ? getFolder(id) : null;
    if (id && !existing) return emptyState('🤔', 'Niet gevonden', 'Deze map bestaat niet meer.', '<a class="btn btn-primary" href="#/mappen">Naar mappen</a>');

    if (!state.draft || state.draft.kind !== 'folder' || state.draft.id !== (existing ? existing.id : 'new')) {
      state.draft = {
        kind: 'folder', id: existing ? existing.id : 'new',
        data: existing ? JSON.parse(JSON.stringify(existing)) : newFolder()
      };
    }
    var f = state.draft.data;
    var chosen = f.outfitIds.map(getOutfit).filter(Boolean);

    return '<form class="form" id="folderForm" novalidate>' +
      '<div class="field"><label for="m-name">Naam</label>' +
        '<input id="m-name" class="input" type="text" value="' + esc(f.name) + '" placeholder="Bijv. nog kopen" autocomplete="off"></div>' +

      '<div class="field"><label>Icoon</label>' +
        '<div class="chips">' + FOLDER_ICONS.map(function (ic) {
          return '<button type="button" class="chip icon-chip' + (ic === f.icon ? ' active' : '') + '" ' +
            'data-act="draft-folder-icon" data-val="' + esc(ic) + '">' + ic + '</button>';
        }).join('') + '</div></div>' +

      '<div class="field"><label>Outfits <span class="hint">(' + chosen.length + ' gekozen)</span></label>' +
        (chosen.length
          ? '<div class="sel-strip scroll-x">' + chosen.map(function (o) {
              return '<div class="sel-chip">' + collageHtml(o.itemIds.map(getItem).filter(Boolean), 'collage sel-thumb') +
                '<span class="sel-name">' + esc(o.name || 'Naamloos') + '</span>' +
                '<button type="button" class="sel-x" data-act="unpick-outfit" data-id="' + esc(o.id) + '" aria-label="Verwijderen">×</button>' +
              '</div>';
            }).join('') + '</div>'
          : '<p class="hint block">Nog geen outfits in deze map.</p>') +
        '<button type="button" class="btn btn-secondary btn-block" data-act="open-picker">Outfits kiezen</button>' +
      '</div>' +

      '<div class="field"><label for="m-notes">Notities</label>' +
        '<textarea id="m-notes" class="input textarea" rows="3" placeholder="Waar is deze map voor?">' + esc(f.notes) + '</textarea></div>' +

      '<div class="form-actions">' +
        '<button type="button" class="btn btn-secondary" data-act="cancel-form">Annuleren</button>' +
        '<button type="button" class="btn btn-primary" data-act="save-folder">Opslaan</button>' +
      '</div>' +
    '</form>';
  }

  function syncFolderDraftFromDom() {
    var d = state.draft;
    if (!d || d.kind !== 'folder') return;
    var name = document.getElementById('m-name');
    var notes = document.getElementById('m-notes');
    if (name) d.data.name = name.value.trim();
    if (notes) d.data.notes = notes.value.trim();
  }

  async function commitFolder() {
    syncFolderDraftFromDom();
    var f = state.draft.data;
    if (!f.name) {
      toast('Geef de map eerst een naam');
      return;
    }
    await saveFolder(f);
    clearDraft();
    toast('Map opgeslagen');
    go('#/map/' + f.id);
  }

  /* ────────────────────────────── Mijn Askim ─────────────────────────────── */

  function viewAskim() {
    var itemQ = askimQueue();
    var outfitQ = askimOutfitQueue();
    var hers = askimOutfits();
    var donate = donateItems();
    var top = state.items.filter(function (i) { return i.rating && !i.donate; })
      .sort(function (a, b) { return b.rating - a.rating; }).slice(0, 6);

    // Wijs vanzelf naar de rij waar nog werk ligt.
    var mode = state.askimRateMode;
    if (mode === 'items' && !itemQ.length && outfitQ.length) mode = 'outfits';
    if (mode === 'outfits' && !outfitQ.length && itemQ.length) mode = 'items';

    var card;
    if (mode === 'outfits' && outfitQ.length) card = askimOutfitCard(outfitQ);
    else if (itemQ.length) card = askimQueueCard(itemQ);
    else card = askimDoneCard();

    return '<div class="page">' +
      '<p class="askim-intro">Geef cijfers, stel je eigen outfits samen en leg spullen op de doneerstapel.</p>' +

      '<h3 class="section-title">Beoordelen</h3>' +
      '<div class="segment small">' +
        '<button type="button" class="segment-btn' + (mode === 'items' ? ' active' : '') + '" ' +
          'data-act="askim-mode" data-val="items">Kleding (' + itemQ.length + ')</button>' +
        '<button type="button" class="segment-btn' + (mode === 'outfits' ? ' active' : '') + '" ' +
          'data-act="askim-mode" data-val="outfits">Outfits (' + outfitQ.length + ')</button>' +
      '</div>' +
      card +

      (top.length
        ? '<h3 class="section-title">Jouw hoogste cijfers</h3>' +
          '<div class="grid grid-small">' + top.map(function (it) {
            return '<a class="tile" href="#/item/' + esc(it.id) + '">' +
              '<div class="tile-media">' + itemThumb(it) +
                '<span class="tile-rating">' + it.rating + '</span></div>' +
              '<div class="tile-body"><span class="tile-name">' + esc(it.name || 'Naamloos') + '</span></div>' +
            '</a>';
          }).join('') + '</div>'
        : '') +

      '<h3 class="section-title">Jouw outfits (' + hers.length + ')</h3>' +
      (hers.length
        ? '<div class="list list-cards flush">' + hers.map(outfitCardHtml).join('') + '</div>'
        : '<p class="hint block">Je hebt nog geen outfits samengesteld.</p>') +
      '<button class="btn btn-primary btn-block" data-act="new-outfit-askim">Outfit samenstellen</button>' +

      '<h3 class="section-title">Doneerstapel</h3>' +
      '<p class="hint block">' + (donate.length
        ? plural(donate.length, 'kledingstuk ligt', 'kledingstukken liggen') + ' klaar om weg te geven.'
        : 'Nog niets om weg te geven.') + '</p>' +
      '<a class="btn btn-secondary btn-block" href="#/doneren">🎁 Doneerstapel bekijken</a>' +

      '<h3 class="section-title">Klaar? Stuur je keuzes terug</h3>' +
      '<p class="hint block">Je cijfers en outfits passen als tekstcode in een berichtje — ' +
        'geen bestand nodig.</p>' +
      '<button class="btn btn-primary btn-block" data-act="share-choices">📋 Keuzes kopiëren als code</button>' +
      '<button class="btn btn-ghost btn-block" data-act="paste-choices">Keuzes plakken</button>' +
    '</div>';
  }

  function askimQueueCard(queue) {
    var it = queue[0];
    var cat = catMap[it.category] || catMap.overig;
    return '<div class="askim-card">' +
      itemThumb(it, 'photo-frame') +
      '<h4 class="askim-name">' + esc(it.name || 'Naamloos') + '</h4>' +
      '<p class="hint center">' + esc(cat.label) + (it.brand ? ' · ' + esc(it.brand) : '') + '</p>' +
      '<p class="rate-label">Hoe leuk vind je dit?</p>' +
      ratingRow(it, 'rate-item') +
      '<div class="row-actions">' +
        '<button type="button" class="btn btn-secondary" data-act="skip-askim" data-id="' + esc(it.id) + '">Sla over</button>' +
        '<button type="button" class="btn btn-ghost" data-act="donate-item" data-id="' + esc(it.id) + '">🎁 Doneren</button>' +
      '</div>' +
      '<p class="hint center">Nog ' + plural(queue.length, 'stuk', 'stukken') + ' te gaan</p>' +
    '</div>';
  }

  function askimOutfitCard(queue) {
    var o = queue[0];
    var items = o.itemIds.map(getItem).filter(Boolean);
    var occ = occasionMap[o.occasion];
    return '<div class="askim-card">' +
      collageHtml(items) +
      '<h4 class="askim-name">' + esc(o.name || 'Naamloze outfit') + '</h4>' +
      '<p class="hint center">' + plural(items.length, 'stuk', 'stukken') +
        (occ ? ' · ' + esc(occ.label) : '') +
        (o.author === 'askim' ? ' · van jou' : '') + '</p>' +
      '<p class="rate-label">Hoe leuk vind je deze outfit?</p>' +
      ratingRow(o, 'rate-outfit') +
      '<div class="row-actions">' +
        '<button type="button" class="btn btn-secondary" data-act="skip-askim" data-id="' + esc(o.id) + '">Sla over</button>' +
        '<a class="btn btn-ghost" href="#/outfit/' + esc(o.id) + '">Bekijk</a>' +
      '</div>' +
      '<p class="hint center">Nog ' + plural(queue.length, 'outfit', 'outfits') + ' te gaan</p>' +
    '</div>';
  }

  function askimDoneCard() {
    var skipped = state.askimSkipped.length;
    return '<div class="askim-card done">' +
      '<div class="empty-icon">💛</div>' +
      '<p class="empty-text">' + (state.items.length
        ? 'Je hebt alles beoordeeld. Lief van je!'
        : 'Er staat nog geen kleding in de kast om te beoordelen.') + '</p>' +
      (skipped
        ? '<button class="btn btn-ghost" data-act="askim-unskip">Overgeslagen stukken opnieuw tonen (' + skipped + ')</button>'
        : '') +
    '</div>';
  }

  /* ──────────────────────────────── Doneren ──────────────────────────────── */

  function viewDoneren() {
    var list = donateItems();
    if (!list.length) {
      return emptyState('🎁', 'Doneerstapel is leeg',
        'Kleding die je niet meer draagt kun je vanaf het kledingstuk zelf op deze stapel leggen. ' +
        'Zo blijft je kast overzichtelijk zonder dat je meteen iets weggooit.',
        '<a class="btn btn-primary" href="#/kast">Naar de kast</a>');
    }
    return '<div class="page">' +
      '<p class="hint block">' + plural(list.length, 'kledingstuk ligt', 'kledingstukken liggen') +
        ' klaar om weg te geven. Ze tellen niet meer mee in je kast.</p>' +
      '<div class="list">' + list.map(function (it) {
        var cat = catMap[it.category] || catMap.overig;
        return '<div class="list-item column">' +
          '<a class="list-line" href="#/item/' + esc(it.id) + '">' +
            itemThumb(it, 'list-thumb') +
            '<span class="list-text"><b>' + esc(it.name || 'Naamloos') + '</b>' +
            '<span class="list-sub">' + esc(cat.label) +
              (it.rating ? ' · cijfer ' + it.rating : '') + '</span></span>' +
            '<span class="chev">›</span>' +
          '</a>' +
          '<div class="row-actions tight">' +
            '<button class="btn btn-secondary" data-act="undonate-item" data-id="' + esc(it.id) + '">Terug in de kast</button>' +
            '<button class="btn btn-danger" data-act="delete-item" data-id="' + esc(it.id) + '">Definitief weg</button>' +
          '</div>' +
        '</div>';
      }).join('') + '</div></div>';
  }

  /* ─────────────────────────────── Kiezers ───────────────────────────────── */

  function openPicker() {
    var d = state.draft;
    if (!d) return;
    if (d.kind === 'outfit') {
      syncOutfitDraftFromDom();
      state.pickerMode = 'items';
      state.pickerSel = d.data.itemIds.slice();
      showSheet('Kleding kiezen', itemPickerBody());
    } else if (d.kind === 'folder') {
      syncFolderDraftFromDom();
      state.pickerMode = 'outfits';
      state.pickerSel = d.data.outfitIds.slice();
      showSheet('Outfits kiezen', outfitPickerBody());
    }
  }

  function openFolderAssign(outfitId) {
    if (!state.folders.length) {
      toast('Maak eerst een map aan');
      go('#/map/new');
      return;
    }
    state.pickerMode = 'folders';
    state.assignFor = outfitId;
    state.pickerSel = foldersOf(outfitId).map(function (f) { return f.id; });
    showSheet('In een map zetten', folderPickerBody());
  }

  function showSheet(title, body, footer) {
    var foot = footer !== undefined ? footer :
      '<button class="btn btn-primary btn-block" data-act="picker-done">' +
        'Klaar (<span id="pickCount">' + state.pickerSel.length + '</span>)</button>';
    els.overlay.innerHTML = '<div class="sheet">' +
      '<div class="sheet-head"><h3>' + esc(title) + '</h3>' +
        '<button class="icon-btn" data-act="picker-close" aria-label="Sluiten">×</button></div>' +
      '<div class="sheet-body">' + body + '</div>' +
      '<div class="sheet-foot">' + foot + '</div></div>';
    els.overlay.hidden = false;
    document.body.classList.add('locked');
    hydrateImages(els.overlay);
  }

  async function openShareCode() {
    var payload = choicePayload();
    if (!payload.items.length && !payload.outfits.length) {
      toast('Nog geen cijfers of outfits om te delen');
      return;
    }
    var code = await packCode(JSON.stringify(payload));
    showSheet('Keuzes delen',
      '<p class="sheet-intro">Deze code bevat de cijfers en doneerkeuzes van ' +
        plural(payload.items.length, 'kledingstuk', 'kledingstukken') + ' en ' +
        plural(payload.outfits.length, 'outfit', 'outfits') + '. Er zitten geen foto\'s in, ' +
        'dus hij past gewoon in een berichtje. De ander kiest daar "Keuzes plakken".</p>' +
      '<div class="sheet-form">' +
        '<textarea id="shareCode" class="input code-box" readonly>' + esc(code) + '</textarea>' +
      '</div>',
      '<button class="btn btn-primary btn-block" data-act="copy-code">Kopieer naar klembord</button>' +
      (navigator.share ? '<button class="btn btn-secondary btn-block" data-act="share-code">Delen…</button>' : '') +
      '<button class="btn btn-ghost btn-block" data-act="picker-close">Sluiten</button>');
  }

  function openPasteCode() {
    showSheet('Keuzes plakken',
      '<p class="sheet-intro">Plak hier de code die je hebt gekregen. Alleen cijfers, ' +
        'doneerkeuzes en outfits worden overgenomen — je eigen kleding en foto\'s blijven zoals ze zijn.</p>' +
      '<div class="sheet-form">' +
        '<textarea id="pasteCode" class="input code-box" placeholder="KAST1Z…" ' +
          'autocomplete="off" autocapitalize="off" spellcheck="false"></textarea>' +
      '</div>',
      '<button class="btn btn-primary btn-block" data-act="apply-code">Overnemen</button>' +
      '<button class="btn btn-ghost btn-block" data-act="picker-close">Annuleren</button>');
    var ta = document.getElementById('pasteCode');
    if (ta) ta.focus();
  }

  function itemPickerBody() {
    var byCat = {};
    state.items.forEach(function (it) {
      (byCat[it.category] = byCat[it.category] || []).push(it);
    });
    var body = CATEGORIES.filter(function (c) { return byCat[c.key] && byCat[c.key].length; })
      .map(function (c) {
        return '<h4 class="picker-cat">' + c.icon + ' ' + esc(c.label) + '</h4>' +
          '<div class="grid grid-picker">' + byCat[c.key].map(function (it) {
            var sel = state.pickerSel.indexOf(it.id) !== -1;
            return '<button type="button" class="tile picker-tile' + (sel ? ' selected' : '') + '" data-act="picker-toggle" data-id="' + esc(it.id) + '">' +
              itemThumb(it) +
              '<span class="pick-mark">✓</span>' +
              '<div class="tile-body"><span class="tile-name">' + esc(it.name || 'Naamloos') + '</span></div>' +
            '</button>';
          }).join('') + '</div>';
      }).join('');
    return body || '<p class="empty-text">Je kast is nog leeg. Voeg eerst kleding toe.</p>';
  }

  function outfitPickerBody() {
    if (!state.outfits.length) {
      return '<p class="empty-text">Je hebt nog geen outfits. Maak er eerst een.</p>';
    }
    var sorted = state.outfits.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    return '<div class="list sheet-list">' + sorted.map(function (o) {
      var sel = state.pickerSel.indexOf(o.id) !== -1;
      var items = o.itemIds.map(getItem).filter(Boolean);
      return '<div class="assign-row' + (sel ? ' selected' : '') + '" data-act="picker-toggle" data-id="' + esc(o.id) + '">' +
        collageHtml(items, 'collage small') +
        '<span class="list-text"><b>' + esc(o.name || 'Naamloze outfit') + '</b>' +
        '<span class="list-sub">' + plural(items.length, 'stuk', 'stukken') + '</span></span>' +
        '<span class="pick-mark">✓</span></div>';
    }).join('') + '</div>';
  }

  function folderPickerBody() {
    return '<div class="list sheet-list">' + state.folders.map(function (f) {
      var sel = state.pickerSel.indexOf(f.id) !== -1;
      return '<div class="assign-row' + (sel ? ' selected' : '') + '" data-act="picker-toggle" data-id="' + esc(f.id) + '">' +
        '<span class="assign-icon">' + f.icon + '</span>' +
        '<span class="list-text"><b>' + esc(f.name || 'Naamloze map') + '</b>' +
        '<span class="list-sub">' + plural(f.outfitIds.length, 'outfit', 'outfits') + '</span></span>' +
        '<span class="pick-mark">✓</span></div>';
    }).join('') + '</div>' +
    '<button class="btn btn-ghost btn-block" data-act="new-folder-from-sheet">+ Nieuwe map</button>';
  }

  async function applyPicker() {
    if (state.pickerMode === 'items') {
      state.draft.data.itemIds = state.pickerSel.slice();
    } else if (state.pickerMode === 'outfits') {
      state.draft.data.outfitIds = state.pickerSel.slice();
    } else if (state.pickerMode === 'folders') {
      var outfitId = state.assignFor;
      for (var i = 0; i < state.folders.length; i++) {
        var f = state.folders[i];
        var has = f.outfitIds.indexOf(outfitId) !== -1;
        var want = state.pickerSel.indexOf(f.id) !== -1;
        if (has === want) continue;
        f.outfitIds = want
          ? f.outfitIds.concat([outfitId])
          : f.outfitIds.filter(function (x) { return x !== outfitId; });
        await saveFolder(f);
      }
    }
    closeOverlay();
    render();
  }

  function closeOverlay() {
    els.overlay.hidden = true;
    els.overlay.innerHTML = '';
    document.body.classList.remove('locked');
    pruneObservers();
  }

  /* ─────────────────────────────── Meer / back-up ────────────────────────── */

  function viewMeer() {
    // De doneerstapel telt niet mee als "in de kast".
    var items = state.items.filter(function (i) { return !i.donate; });
    var donate = donateItems();
    var totalWorn = state.items.reduce(function (s, i) { return s + (i.wearCount || 0); }, 0);
    var never = items.filter(function (i) { return !(i.wearCount > 0); }).length;
    var mostWorn = items.slice().sort(function (a, b) { return (b.wearCount || 0) - (a.wearCount || 0); }).slice(0, 5)
      .filter(function (i) { return (i.wearCount || 0) > 0; });

    var counts = {};
    items.forEach(function (i) { counts[i.category] = (counts[i.category] || 0) + 1; });
    var max = Math.max.apply(null, [1].concat(Object.keys(counts).map(function (k) { return counts[k]; })));
    var bars = CATEGORIES.filter(function (c) { return counts[c.key]; }).map(function (c) {
      return '<div class="bar-row"><span class="bar-label">' + c.icon + ' ' + esc(c.label) + '</span>' +
        '<span class="bar"><i style="width:' + Math.round(counts[c.key] / max * 100) + '%"></i></span>' +
        '<span class="bar-num">' + counts[c.key] + '</span></div>';
    }).join('');

    return '<div class="page">' +
      '<div class="stat-grid">' +
        stat(items.length, 'kledingstukken') +
        stat(state.outfits.length, 'outfits') +
        stat(state.folders.length, 'mappen') +
        stat(donate.length, 'op de doneerstapel') +
        stat(totalWorn, 'keer gedragen') +
        stat(never, 'nooit gedragen') +
      '</div>' +

      '<h3 class="section-title">Doneren</h3>' +
      '<p class="hint block">Kleding die je niet meer draagt leg je op de doneerstapel. ' +
        'Die verdwijnt uit je kast, maar blijft bewaard tot je hem echt weggeeft.</p>' +
      '<a class="btn btn-secondary btn-block" href="#/doneren">🎁 Doneerstapel (' + donate.length + ')</a>' +

      (bars ? '<h3 class="section-title">Per categorie</h3><div class="bars">' + bars + '</div>' : '') +

      (function () {
        var byColor = {};
        items.forEach(function (i) {
          (i.colors || []).forEach(function (c) { byColor[c] = (byColor[c] || 0) + 1; });
        });
        var keys = Object.keys(byColor);
        if (!keys.length) return '';
        var top = Math.max.apply(null, keys.map(function (k) { return byColor[k]; }));
        var rows = COLORS.filter(function (c) { return byColor[c.key]; })
          .sort(function (a, b) { return byColor[b.key] - byColor[a.key]; })
          .map(function (c) {
            return '<div class="bar-row">' +
              '<span class="bar-label"><i class="chip-swatch" style="background:' + esc(c.hex) + '"></i> ' + esc(c.label) + '</span>' +
              '<span class="bar"><i style="width:' + Math.round(byColor[c.key] / top * 100) + '%"></i></span>' +
              '<span class="bar-num">' + byColor[c.key] + '</span></div>';
          }).join('');
        return '<h3 class="section-title">Per kleur</h3><div class="bars">' + rows + '</div>';
      })() +

      (mostWorn.length
        ? '<h3 class="section-title">Meest gedragen</h3><div class="list">' + mostWorn.map(function (it) {
            return '<a class="list-item" href="#/item/' + esc(it.id) + '">' + itemThumb(it, 'list-thumb') +
              '<span class="list-text"><b>' + esc(it.name || 'Naamloos') + '</b>' +
              '<span class="list-sub">' + it.wearCount + '× gedragen</span></span>' +
              '<span class="chev">›</span></a>';
          }).join('') + '</div>'
        : '') +

      '<h3 class="section-title">Weergave</h3>' +
      '<div class="setting-row"><span>Thema</span>' +
        '<div class="seg">' + [
          { key: 'systeem', label: 'Systeem' },
          { key: 'licht', label: 'Licht' },
          { key: 'donker', label: 'Donker' }
        ].map(function (t) {
          return '<button type="button" class="seg-btn' + (currentTheme() === t.key ? ' active' : '') + '" ' +
            'data-act="set-theme" data-val="' + t.key + '">' + t.label + '</button>';
        }).join('') + '</div>' +
      '</div>' +

      '<h3 class="section-title">Keuzes delen zonder bestand</h3>' +
      '<p class="hint block">Cijfers, doneerkeuzes en outfits passen als tekstcode in een berichtje. ' +
        'Handig om heen en weer te sturen zonder iets te downloaden.</p>' +
      '<button class="btn btn-secondary btn-block" data-act="share-choices">📋 Keuzes kopiëren als code</button>' +
      '<button class="btn btn-secondary btn-block" data-act="paste-choices">📥 Keuzes plakken</button>' +

      '<h3 class="section-title">Volledige back-up</h3>' +
      '<p class="hint block">Met foto\'s erbij, dus te groot voor een code. Je kast staat alleen in deze ' +
        'browser op dit apparaat — maak af en toe een back-up.</p>' +
      (navigator.share
        ? '<button class="btn btn-secondary btn-block" data-act="share-backup">📤 Back-up delen</button>'
        : '') +
      '<button class="btn btn-secondary btn-block" data-act="export">⬇︎ Back-up downloaden</button>' +
      '<button class="btn btn-secondary btn-block" data-act="import">⬆︎ Back-up terugzetten</button>' +

      '<h3 class="section-title">Opruimen</h3>' +
      '<button class="btn btn-danger btn-block" data-act="wipe">Alles verwijderen</button>' +

      '<p class="footer-note">Mijn Kledingkast · alles blijft lokaal op je eigen apparaat</p>' +
    '</div>';
  }

  function stat(num, label) {
    return '<div class="stat"><span class="stat-num">' + num + '</span><span class="stat-label">' + esc(label) + '</span></div>';
  }

  async function buildBackupBlob() {
    var images = await KastDB.getAll(KastDB.IMAGES);
    var out = [];
    for (var i = 0; i < images.length; i++) {
      out.push({
        id: images[i].id,
        full: await blobToDataUrl(images[i].full),
        thumb: await blobToDataUrl(images[i].thumb)
      });
    }
    var payload = {
      app: 'kledingkast', version: 2, exportedAt: new Date().toISOString(),
      items: state.items, outfits: state.outfits, folders: state.folders, images: out
    };
    return new Blob([JSON.stringify(payload)], { type: 'application/json' });
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  async function exportBackup() {
    toast('Back-up voorbereiden…');
    var blob = await buildBackupBlob();
    downloadBlob(blob, 'kledingkast-backup-' + todayISO() + '.json');
    toast('Back-up gedownload');
  }

  /* Via het deelmenu van de telefoon: rechtstreeks naar WhatsApp of AirDrop,
     zonder eerst iets in Bestanden te parkeren. */
  async function shareBackup() {
    toast('Back-up voorbereiden…');
    var blob = await buildBackupBlob();
    var name = 'kledingkast-backup-' + todayISO() + '.json';
    if (typeof File === 'function' && navigator.canShare) {
      var file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Mijn Kledingkast' });
          return;
        } catch (err) {
          if (err && err.name === 'AbortError') return;
        }
      }
    }
    downloadBlob(blob, name);
    toast('Delen kan hier niet — back-up gedownload');
  }

  /* ─────────────────────── Deelcode (zonder bestand) ─────────────────────
     Alles wat Askim toevoegt — cijfers, doneerkeuzes en haar outfits — is
     platte tekst zonder foto's, en past dus in een berichtje. */

  function bytesToBase64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }

  function base64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  async function packCode(text) {
    if (typeof CompressionStream === 'function') {
      var stream = new Blob([new TextEncoder().encode(text)]).stream()
        .pipeThrough(new CompressionStream('gzip'));
      var buf = await new Response(stream).arrayBuffer();
      return 'KAST1Z' + bytesToBase64(new Uint8Array(buf));
    }
    return 'KAST1R' + bytesToBase64(new TextEncoder().encode(text));
  }

  async function unpackCode(code) {
    var clean = String(code).replace(/\s+/g, '');
    var m = /^KAST1([ZR])(.+)$/.exec(clean);
    if (!m) throw new Error('geen geldige code');
    var bytes = base64ToBytes(m[2]);
    if (m[1] === 'R') return new TextDecoder().decode(bytes);
    if (typeof DecompressionStream !== 'function') throw new Error('inpakken niet ondersteund');
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }

  function choicePayload() {
    return {
      app: 'kledingkast', kind: 'keuzes', version: 2,
      items: state.items
        .filter(function (i) { return i.rating != null || i.donate; })
        .map(function (i) { return { id: i.id, rating: i.rating, donate: !!i.donate }; }),
      outfits: state.outfits
        .filter(function (o) { return o.author === 'askim' || o.rating != null; })
        .map(function (o) {
          return {
            id: o.id, name: o.name, itemIds: o.itemIds, occasion: o.occasion,
            seasons: o.seasons, notes: o.notes, author: o.author, rating: o.rating,
            createdAt: o.createdAt, updatedAt: o.updatedAt
          };
        })
    };
  }

  async function importBackup(file) {
    var text = await file.text();
    var data;
    try { data = JSON.parse(text); } catch (e) { toast('Dit bestand kan ik niet lezen'); return; }
    if (!data || data.app !== 'kledingkast' || !Array.isArray(data.items)) {
      toast('Dit is geen kledingkast-back-up');
      return;
    }
    var folders = data.folders || [];
    var mode = await choiceDialog({
      title: 'Wat wil je overnemen?',
      body: 'Het bestand bevat ' + data.items.length + ' kledingstukken, ' + (data.outfits || []).length +
            ' outfits en ' + folders.length + ' mappen.',
      choices: [
        {
          key: 'merge', label: 'Alleen Askims keuzes', primary: true,
          hint: 'Neemt haar cijfers, doneerkeuzes en outfits over in jouw kast. Jouw foto\'s en gegevens blijven zoals ze zijn.'
        },
        {
          key: 'replace', label: 'Alles terugzetten',
          hint: 'Voor een verhuizing naar een nieuwe telefoon. Overschrijft records met hetzelfde id.'
        }
      ]
    });
    if (!mode) return;

    if (mode === 'merge') {
      toast('Keuzes van Askim overnemen…');
      var res = await mergeAskim(data);
      render();
      toast(res.ratings + ' cijfers en ' + plural(res.outfits, 'outfit', 'outfits') + ' overgenomen');
      return;
    }

    toast('Bezig met terugzetten…');
    var images = (data.images || []).map(function (rec) {
      return {
        id: rec.id,
        full: rec.full ? dataUrlToBlob(rec.full) : null,
        thumb: rec.thumb ? dataUrlToBlob(rec.thumb) : null
      };
    });
    await KastDB.putMany(KastDB.IMAGES, images);
    await KastDB.putMany(KastDB.ITEMS, data.items.map(normalizeItem));
    await KastDB.putMany(KastDB.OUTFITS, data.outfits || []);
    await KastDB.putMany(KastDB.FOLDERS, folders);
    images.forEach(function (rec) { forgetImage(rec.id); });
    await loadAll();
    render();
    toast('Back-up teruggezet');
  }

  /* Neemt uit een back-up alleen over wat Askim heeft toegevoegd: cijfers,
     doneerkeuzes en haar eigen outfits. De rest van jouw kast blijft intact. */
  async function mergeAskim(data) {
    var ratings = 0, outfitsAdded = 0;

    for (var i = 0; i < data.items.length; i++) {
      var src = normalizeItem(data.items[i]);
      var mine = getItem(src.id);
      if (!mine) continue;
      var changed = false;
      if (src.rating != null && src.rating !== mine.rating) { mine.rating = src.rating; changed = true; }
      if (src.donate && !mine.donate) { mine.donate = true; changed = true; }
      if (changed) { await saveItem(mine); ratings++; }
    }

    var outs = data.outfits || [];
    for (var j = 0; j < outs.length; j++) {
      var o = outs[j];
      var mineOutfit = getOutfit(o.id);
      if (mineOutfit) {
        // Bestaat de outfit al bij mij, dan neem ik alleen haar cijfer over.
        if (o.rating != null && o.rating !== mineOutfit.rating) {
          mineOutfit.rating = o.rating;
          await saveOutfit(mineOutfit);
          ratings++;
        }
        continue;
      }
      if (o.author !== 'askim') continue;
      // Alleen kleding die ik ook echt heb; de rest zou dode verwijzingen geven.
      o.itemIds = (o.itemIds || []).filter(function (id) { return !!getItem(id); });
      o.seasons = o.seasons || [];
      o.wearCount = o.wearCount || 0;
      o.lastWorn = o.lastWorn || null;
      o.favorite = !!o.favorite;
      o.occasion = o.occasion || 'dagelijks';
      if (o.rating === undefined) o.rating = null;
      await saveOutfit(o);
      outfitsAdded++;
    }

    var flds = data.folders || [];
    for (var k = 0; k < flds.length; k++) {
      if (getFolder(flds[k].id)) continue;
      flds[k].outfitIds = (flds[k].outfitIds || []).filter(function (id) { return !!getOutfit(id); });
      flds[k].icon = flds[k].icon || '📁';
      await saveFolder(flds[k]);
    }

    return { ratings: ratings, outfits: outfitsAdded };
  }

  /* ─────────────────────────────── Dialoogje ─────────────────────────────── */

  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      els.overlay.innerHTML = '<div class="dialog">' +
        '<h3 class="dialog-title">' + esc(opts.title) + '</h3>' +
        '<p class="dialog-body">' + esc(opts.body || '') + '</p>' +
        '<div class="dialog-actions">' +
          '<button class="btn btn-secondary" data-dlg="no">Annuleren</button>' +
          '<button class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-dlg="yes">' +
            esc(opts.confirmLabel || 'Ja') + '</button>' +
        '</div></div>';
      els.overlay.hidden = false;
      document.body.classList.add('locked');

      els.overlay.onclick = function (ev) {
        var btn = ev.target.closest('[data-dlg]');
        if (!btn && ev.target !== els.overlay) return;
        var answer = btn ? btn.getAttribute('data-dlg') === 'yes' : false;
        els.overlay.onclick = null;
        closeOverlay();
        resolve(answer);
      };
    });
  }

  /* Zelfde idee, maar met meerdere uitkomsten. Levert de gekozen sleutel op,
     of null als er geannuleerd wordt. */
  function choiceDialog(opts) {
    return new Promise(function (resolve) {
      els.overlay.innerHTML = '<div class="dialog">' +
        '<h3 class="dialog-title">' + esc(opts.title) + '</h3>' +
        '<p class="dialog-body">' + esc(opts.body || '') + '</p>' +
        '<div class="choice-list">' + opts.choices.map(function (c) {
          return '<button class="choice' + (c.primary ? ' primary' : '') + '" data-dlg="' + esc(c.key) + '">' +
            '<b>' + esc(c.label) + '</b>' +
            (c.hint ? '<span>' + esc(c.hint) + '</span>' : '') + '</button>';
        }).join('') + '</div>' +
        '<div class="dialog-actions">' +
          '<button class="btn btn-secondary btn-block" data-dlg="">Annuleren</button>' +
        '</div></div>';
      els.overlay.hidden = false;
      document.body.classList.add('locked');

      els.overlay.onclick = function (ev) {
        var btn = ev.target.closest('[data-dlg]');
        if (!btn && ev.target !== els.overlay) return;
        var key = btn ? btn.getAttribute('data-dlg') : '';
        els.overlay.onclick = null;
        closeOverlay();
        resolve(key || null);
      };
    });
  }

  /* ────────────────────────────── Gebeurtenissen ─────────────────────────── */

  var actions = {
    'new-item': function () { clearDraft(); go('#/item/new'); },
    'new-outfit': function () { clearDraft(); go('#/outfit/new'); },
    'new-outfit-askim': function () { clearDraft(); go('#/outfit/new-askim'); },
    'new-folder': function () { clearDraft(); go('#/map/new'); },
    'new-folder-from-sheet': function () { closeOverlay(); clearDraft(); go('#/map/new'); },
    'bulk-add': function () { els.fileBulk.click(); },
    'pick-photo': function () { els.filePhoto.click(); },

    'toggle-filters': function () { state.filtersOpen = !state.filtersOpen; render(); },
    'filter-cat': function (btn) { state.filters.cat = btn.getAttribute('data-val'); render(); },
    'filter-season': function (btn) { state.filters.season = btn.getAttribute('data-val'); render(); },
    'filter-color': function (btn) { state.filters.color = btn.getAttribute('data-val'); render(); },
    'filter-sort': function (btn) { state.filters.sort = btn.getAttribute('data-val'); render(); },
    'filter-fav': function () { state.filters.fav = !state.filters.fav; render(); },
    'filter-unworn': function () { state.filters.unworn = !state.filters.unworn; render(); },
    'filter-donate': function () { state.filters.donate = !state.filters.donate; render(); },
    'filter-reset': function () {
      state.filters = { q: state.filters.q, cat: '', season: '', color: '', fav: false, unworn: false, donate: false, sort: 'recent' };
      render();
    },

    /* Cijfers van Askim en de doneerstapel */
    'rate-item': async function (btn) {
      var it = getItem(btn.getAttribute('data-id'));
      if (!it) return;
      var val = btn.getAttribute('data-val');
      it.rating = val === '' ? null : Number(val);
      await saveItem(it);
      render();
      if (it.rating) toast('Cijfer ' + it.rating + ' opgeslagen');
    },
    'rate-outfit': async function (btn) {
      var o = getOutfit(btn.getAttribute('data-id'));
      if (!o) return;
      var val = btn.getAttribute('data-val');
      o.rating = val === '' ? null : Number(val);
      await saveOutfit(o);
      render();
      if (o.rating) toast('Cijfer ' + o.rating + ' opgeslagen');
    },
    'askim-mode': function (btn) {
      state.askimRateMode = btn.getAttribute('data-val');
      render();
    },
    'outfit-sort': function (btn) {
      state.outfitSort = btn.getAttribute('data-val');
      render();
    },
    'outfit-occasion': function (btn) {
      state.outfitFilter.occasion = btn.getAttribute('data-val');
      render();
    },
    'outfit-author': function (btn) {
      var val = btn.getAttribute('data-val');
      state.outfitFilter.author = state.outfitFilter.author === val ? '' : val;
      render();
    },
    'outfit-filter-reset': function () {
      state.outfitFilter = { q: '', occasion: '', author: '' };
      state.outfitSort = 'recent';
      render();
    },
    'duplicate-outfit': async function (btn) {
      var o = getOutfit(btn.getAttribute('data-id'));
      if (!o) return;
      var kopie = JSON.parse(JSON.stringify(o));
      kopie.id = uid('out');
      kopie.name = (o.name || 'Naamloze outfit') + ' (kopie)';
      // Een kopie begint met een schone lei: nog niet gedragen, nog geen cijfer.
      kopie.wearCount = 0;
      kopie.lastWorn = null;
      kopie.rating = null;
      kopie.createdAt = Date.now();
      await saveOutfit(kopie);
      toast('Kopie gemaakt');
      go('#/outfit/' + kopie.id + '/edit');
    },
    'skip-askim': function (btn) {
      state.askimSkipped.push(btn.getAttribute('data-id'));
      render();
    },
    'askim-unskip': function () { state.askimSkipped = []; render(); },
    'donate-item': async function (btn) {
      var it = getItem(btn.getAttribute('data-id'));
      if (!it) return;
      it.donate = true;
      await saveItem(it);
      render();
      toast('Op de doneerstapel gelegd');
    },
    'undonate-item': async function (btn) {
      var it = getItem(btn.getAttribute('data-id'));
      if (!it) return;
      it.donate = false;
      await saveItem(it);
      render();
      toast('Terug in de kast');
    },

    'draft-cat': function (btn) {
      state.draft.data.category = btn.getAttribute('data-val');
      selectSingle(btn);
    },
    'draft-color': function (btn) { toggleMulti(btn, state.draft.data.colors); },
    'draft-season': function (btn) { toggleMulti(btn, state.draft.data.seasons); },
    'draft-occasion': function (btn) {
      state.draft.data.occasion = btn.getAttribute('data-val');
      selectSingle(btn);
    },
    'draft-oseason': function (btn) { toggleMulti(btn, state.draft.data.seasons); },
    'draft-folder-icon': function (btn) {
      state.draft.data.icon = btn.getAttribute('data-val');
      selectSingle(btn);
    },

    /* Foto's van een kledingstuk */
    'set-cover': function (btn) {
      var d = state.draft;
      if (!d || d.kind !== 'item') return;
      d.cover = btn.getAttribute('data-id');
      syncItemDraftFromDom();
      render();
      toast('Hoofdfoto ingesteld');
    },
    'drop-photo': function (btn) {
      var d = state.draft;
      if (!d || d.kind !== 'item') return;
      var pid = btn.getAttribute('data-id');
      d.photos = d.photos.filter(function (p) {
        if (p.id !== pid) return true;
        if (p.url) URL.revokeObjectURL(p.url);
        // Stond deze al in de database? Dan pas bij opslaan echt weggooien.
        if (!p.blobs) d.removed.push(p.id);
        return false;
      });
      if (d.cover === pid) d.cover = d.photos.length ? d.photos[0].id : null;
      syncItemDraftFromDom();
      render();
    },
    'show-photo': function (btn) {
      var imgId = btn.getAttribute('data-id');
      var main = document.getElementById('detailPhoto');
      if (!main) return;
      Array.prototype.forEach.call(document.querySelectorAll('.gallery-thumb'), function (t) {
        t.classList.toggle('is-active', t === btn);
      });
      imageUrl(imgId, 'full').then(function (url) {
        if (!url) return;
        main.src = url;
        main.classList.add('loaded');
        if (main.parentNode) main.parentNode.classList.add('has-photo');
      });
    },

    'save-item': function () { commitItem(); },
    'save-outfit': function () { commitOutfit(); },
    'save-folder': function () { commitFolder(); },
    'cancel-form': function () {
      var kind = state.draft ? state.draft.kind : 'item';
      var id = state.draft && state.draft.id !== 'new' ? state.draft.id : null;
      var fromAskim = state.draft && state.draft.kind === 'outfit' && !id && state.draft.data.author === 'askim';
      clearDraft();
      if (fromAskim) go('#/askim');
      else if (kind === 'outfit') go(id ? '#/outfit/' + id : '#/outfits');
      else if (kind === 'folder') go(id ? '#/map/' + id : '#/mappen');
      else go(id ? '#/item/' + id : '#/kast');
    },

    'open-picker': function () { openPicker(); },
    'assign-folders': function (btn) { openFolderAssign(btn.getAttribute('data-id')); },
    'picker-close': function () { closeOverlay(); render(); },
    'picker-done': function () { applyPicker(); },
    'picker-toggle': function (btn) {
      var id = btn.getAttribute('data-id');
      var i = state.pickerSel.indexOf(id);
      if (i === -1) state.pickerSel.push(id); else state.pickerSel.splice(i, 1);
      btn.classList.toggle('selected');
      var count = document.getElementById('pickCount');
      if (count) count.textContent = state.pickerSel.length;
    },
    'unpick-item': function (btn) {
      syncOutfitDraftFromDom();
      var id = btn.getAttribute('data-id');
      state.draft.data.itemIds = state.draft.data.itemIds.filter(function (x) { return x !== id; });
      render();
    },
    'unpick-outfit': function (btn) {
      syncFolderDraftFromDom();
      var id = btn.getAttribute('data-id');
      state.draft.data.outfitIds = state.draft.data.outfitIds.filter(function (x) { return x !== id; });
      render();
    },
    'suggest-outfit': function () { suggestOutfit(); },

    'toggle-fav-item': async function (btn) {
      var it = getItem(btn.getAttribute('data-id'));
      if (!it) return;
      it.favorite = !it.favorite;
      await saveItem(it);
      render();
    },
    'toggle-fav-outfit': async function (btn) {
      var o = getOutfit(btn.getAttribute('data-id'));
      if (!o) return;
      o.favorite = !o.favorite;
      await saveOutfit(o);
      render();
    },
    'wear-item': async function (btn) {
      var it = getItem(btn.getAttribute('data-id'));
      if (!it) return;
      await markItemWorn(it);
      render();
      toast('Genoteerd: vandaag gedragen');
    },
    'wear-outfit': async function (btn) {
      var o = getOutfit(btn.getAttribute('data-id'));
      if (!o) return;
      await markOutfitWorn(o);
      render();
      toast('Genoteerd: vandaag gedragen');
    },

    'delete-item': async function (btn) {
      var it = getItem(btn.getAttribute('data-id'));
      if (!it) return;
      var ok = await confirmDialog({
        title: 'Verwijderen?',
        body: '"' + (it.name || 'Dit kledingstuk') + '" wordt uit je kast en uit alle outfits gehaald.',
        confirmLabel: 'Verwijderen', danger: true
      });
      if (!ok) return;
      await deleteItem(it.id);
      toast('Verwijderd');
      go('#/kast');
    },
    'delete-outfit': async function (btn) {
      var o = getOutfit(btn.getAttribute('data-id'));
      if (!o) return;
      var ok = await confirmDialog({
        title: 'Outfit verwijderen?',
        body: 'De kledingstukken zelf blijven gewoon in je kast staan.',
        confirmLabel: 'Verwijderen', danger: true
      });
      if (!ok) return;
      await deleteOutfit(o.id);
      toast('Outfit verwijderd');
      go('#/outfits');
    },
    'delete-folder': async function (btn) {
      var f = getFolder(btn.getAttribute('data-id'));
      if (!f) return;
      var ok = await confirmDialog({
        title: 'Map verwijderen?',
        body: 'Alleen de map verdwijnt; de outfits erin blijven gewoon bestaan.',
        confirmLabel: 'Verwijderen', danger: true
      });
      if (!ok) return;
      await deleteFolder(f.id);
      toast('Map verwijderd');
      go('#/mappen');
    },

    'export': function () { exportBackup(); },
    'share-backup': function () { shareBackup(); },
    'import': function () { els.fileImport.click(); },
    'share-choices': function () { openShareCode(); },
    'paste-choices': function () { openPasteCode(); },
    'copy-code': async function () {
      var ta = document.getElementById('shareCode');
      if (!ta) return;
      try {
        await navigator.clipboard.writeText(ta.value);
        toast('Code gekopieerd');
      } catch (err) {
        // Oudere browsers (en Safari zonder toestemming) via de selectie.
        ta.removeAttribute('readonly');
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
        ta.setAttribute('readonly', 'readonly');
        toast(ok ? 'Code gekopieerd' : 'Selecteer de code en kopieer hem zelf');
      }
    },
    'share-code': async function () {
      var ta = document.getElementById('shareCode');
      if (!ta || !navigator.share) return;
      try { await navigator.share({ title: 'Kledingkast — keuzes', text: ta.value }); }
      catch (err) { /* geannuleerd */ }
    },
    'apply-code': async function () {
      var ta = document.getElementById('pasteCode');
      if (!ta || !ta.value.trim()) { toast('Plak eerst een code'); return; }
      var data;
      try {
        data = JSON.parse(await unpackCode(ta.value));
      } catch (err) {
        toast('Deze code kan ik niet lezen');
        return;
      }
      if (!data || data.app !== 'kledingkast' || !Array.isArray(data.items)) {
        toast('Dit is geen kledingkast-code');
        return;
      }
      closeOverlay();
      toast('Keuzes overnemen…');
      var res = await mergeAskim(data);
      render();
      toast(res.ratings + ' cijfers en ' + plural(res.outfits, 'outfit', 'outfits') + ' overgenomen');
    },
    'set-theme': function (btn) {
      setTheme(btn.getAttribute('data-val'));
      render();
    },
    'wipe': async function () {
      var ok = await confirmDialog({
        title: 'Alles verwijderen?',
        body: 'Al je kledingstukken, outfits, mappen en foto\'s worden gewist. Dit kan niet ongedaan worden gemaakt.',
        confirmLabel: 'Alles wissen', danger: true
      });
      if (!ok) return;
      var sure = await confirmDialog({
        title: 'Zeker weten?',
        body: 'Download eerst een back-up als je twijfelt.',
        confirmLabel: 'Ja, wissen', danger: true
      });
      if (!sure) return;
      await KastDB.clearAll();
      liveUrls.forEach(function (url) { URL.revokeObjectURL(url); });
      liveUrls.clear();
      urlPromises.clear();
      await loadAll();
      render();
      toast('Alles gewist');
    }
  };

  function selectSingle(btn) {
    var parent = btn.parentNode;
    Array.prototype.forEach.call(parent.querySelectorAll('.chip'), function (c) { c.classList.remove('active'); });
    btn.classList.add('active');
  }

  function toggleMulti(btn, arr) {
    var val = btn.getAttribute('data-val');
    var i = arr.indexOf(val);
    if (i === -1) arr.push(val); else arr.splice(i, 1);
    btn.classList.toggle('active');
  }

  function onClick(ev) {
    var target = ev.target.closest('[data-act]');
    if (!target) return;
    var act = target.getAttribute('data-act');
    if (!actions[act]) return;
    ev.preventDefault();
    actions[act](target, ev);
  }

  /* Zoeken vernieuwt alleen het raster, zodat het toetsenbord niet wegspringt. */
  function onInput(ev) {
    if (ev.target.id === 'search') {
      state.filters.q = ev.target.value;
      refreshGrid();
    } else if (ev.target.id === 'outfitSearch') {
      state.outfitFilter.q = ev.target.value;
      refreshOutfitList();
    }
  }

  /* Escape sluit wat er open staat — op een pc verwacht je dat. */
  function onKeydown(ev) {
    if (ev.key !== 'Escape' || els.overlay.hidden) return;
    var dialog = els.overlay.querySelector('[data-dlg]');
    if (dialog) {
      // Een dialoog wacht op een antwoord; die moet zelf afronden.
      els.overlay.click();
      return;
    }
    closeOverlay();
    render();
  }

  async function onPhotoChosen(ev) {
    var files = Array.prototype.slice.call(ev.target.files || []);
    ev.target.value = '';
    if (!files.length || !state.draft || state.draft.kind !== 'item') return;
    syncItemDraftFromDom();
    toast(files.length > 1 ? files.length + ' foto\'s verwerken…' : 'Foto verwerken…');
    var d = state.draft;
    var added = 0;
    for (var i = 0; i < files.length; i++) {
      try {
        var processed = await processImage(files[i]);
        var imgId = uid('img');
        d.photos.push({ id: imgId, url: URL.createObjectURL(processed.thumb), blobs: processed });
        if (!d.cover) d.cover = imgId;
        added++;
      } catch (err) { /* sla onleesbare bestanden over */ }
    }
    render();
    if (!added) toast('Kan deze foto niet gebruiken');
  }

  async function onBulkChosen(ev) {
    var files = Array.prototype.slice.call(ev.target.files || []);
    ev.target.value = '';
    if (!files.length) return;
    toast(files.length + ' foto\'s verwerken…');
    var made = 0;
    for (var i = 0; i < files.length; i++) {
      try {
        var processed = await processImage(files[i]);
        var imgId = uid('img');
        await KastDB.put(KastDB.IMAGES, { id: imgId, full: processed.full, thumb: processed.thumb });
        var item = newItem();
        item.imageIds = [imgId];
        item.coverImageId = imgId;
        item.category = 'overig';
        await saveItem(item);
        made++;
      } catch (err) { /* sla onleesbare bestanden over */ }
    }
    render();
    toast(made + ' toegevoegd — vul ze nu verder in');
  }

  async function onImportChosen(ev) {
    var file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (file) await importBackup(file);
  }

  /* ──────────────────────────────── Opstarten ────────────────────────────── */

  async function loadAll() {
    var res = await Promise.all([
      KastDB.getAll(KastDB.ITEMS),
      KastDB.getAll(KastDB.OUTFITS),
      KastDB.getAll(KastDB.FOLDERS)
    ]);
    // Oudere of geïmporteerde records missen soms een veld; hier één keer rechtzetten.
    state.items = (res[0] || []).map(normalizeItem);
    state.outfits = (res[1] || []).map(function (o) {
      o.itemIds = o.itemIds || [];
      o.seasons = o.seasons || [];
      o.wearCount = o.wearCount || 0;
      o.author = o.author || 'ik';
      if (o.rating === undefined) o.rating = null;
      return o;
    });
    state.folders = (res[2] || []).map(function (f) {
      f.outfitIds = f.outfitIds || [];
      f.icon = f.icon || '📁';
      return f;
    });
  }

  async function init() {
    els.topbar = document.getElementById('topbar');
    els.view = document.getElementById('view');
    els.tabbar = document.getElementById('tabbar');
    els.overlay = document.getElementById('overlay');
    els.toast = document.getElementById('toast');
    els.filePhoto = document.getElementById('filePhoto');
    els.fileBulk = document.getElementById('fileBulk');
    els.fileImport = document.getElementById('fileImport');

    applyTheme(currentTheme());
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('keydown', onKeydown);
    els.filePhoto.addEventListener('change', onPhotoChosen);
    els.fileBulk.addEventListener('change', onBulkChosen);
    els.fileImport.addEventListener('change', onImportChosen);

    window.addEventListener('hashchange', function () {
      // Een half ingevuld formulier verlaten betekent: concept weggooien.
      if (state.draft) {
        var parts = parseRoute();
        var stillEditing = (parts[0] === 'item' || parts[0] === 'outfit' || parts[0] === 'map') &&
          (String(parts[1]).indexOf('new') === 0 || parts[2] === 'edit');
        if (!stillEditing) clearDraft();
      }
      render();
      els.view.scrollTop = 0;
    });

    try {
      await loadAll();
    } catch (err) {
      els.view.innerHTML = emptyState('⚠️', 'Opslag niet beschikbaar',
        'Deze browser laat geen lokale opslag toe (privémodus?). Probeer een gewoon venster.');
      return;
    }

    state.ready = true;
    render();

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js')['catch'](function () { /* offline is een extraatje */ });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
