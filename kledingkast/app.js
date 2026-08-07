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
    ready: false,
    filters: { q: '', cat: '', season: '', color: '', fav: false, unworn: false, sort: 'recent' },
    filtersOpen: false,
    draft: null,          // formuliergegevens tijdens bewerken
    pickerSel: null       // selectie in de kledingkiezer
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

  function hydrateImages(root) {
    var nodes = (root || document).querySelectorAll('img[data-img]');
    Array.prototype.forEach.call(nodes, function (img) {
      if (img.getAttribute('data-img-done')) return;
      img.setAttribute('data-img-done', '1');
      var parts = img.getAttribute('data-img').split(':');
      imageUrl(parts[0], parts[1] || 'thumb').then(function (url) {
        if (!url) return;
        img.src = url;
        img.classList.add('loaded');
        // De categorie-emoji eronder uitfaden, anders schemert die door de foto.
        if (img.parentNode) img.parentNode.classList.add('has-photo');
      });
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
      wearCount: 0, lastWorn: null, imageId: null,
      createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  function newOutfit() {
    return {
      id: uid('out'), name: '', itemIds: [], occasion: 'dagelijks', seasons: [],
      notes: '', favorite: false, wearCount: 0, lastWorn: null,
      createdAt: Date.now(), updatedAt: Date.now()
    };
  }

  function getItem(id) {
    for (var i = 0; i < state.items.length; i++) if (state.items[i].id === id) return state.items[i];
    return null;
  }

  function getOutfit(id) {
    for (var i = 0; i < state.outfits.length; i++) if (state.outfits[i].id === id) return state.outfits[i];
    return null;
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

  async function deleteItem(id) {
    var item = getItem(id);
    if (!item) return;
    if (item.imageId) {
      await KastDB.remove(KastDB.IMAGES, item.imageId);
      forgetImage(item.imageId);
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
      return b.createdAt - a.createdAt;
    });
    return list;
  }

  function activeFilterCount() {
    var f = state.filters;
    return (f.season ? 1 : 0) + (f.color ? 1 : 0) + (f.fav ? 1 : 0) + (f.unworn ? 1 : 0) + (f.sort !== 'recent' ? 1 : 0);
  }

  /* ──────────────────────────── Stukjes opmaak ───────────────────────────── */

  function itemThumb(item, cls) {
    var cat = catMap[item.category] || catMap.overig;
    var tint = colorMap[(item.colors || [])[0]];
    var bg = tint && tint.hex.indexOf('gradient') === -1 ? tint.hex : '';
    var style = bg ? ' style="background:' + esc(bg) + '"' : '';
    var photo = item.imageId
      ? '<img class="ph-img" data-img="' + esc(item.imageId) + ':thumb" alt="">'
      : '';
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
      out += '<button class="chip' + (!selected ? ' active' : '') + '" data-act="' + act + '" data-val="">' +
             esc(opts.allLabel) + '</button>';
    }
    out += list.map(function (o) {
      var isSel = Array.isArray(selected) ? selected.indexOf(o.key) !== -1 : selected === o.key;
      var swatch = o.hex ? '<i class="chip-swatch" style="background:' + esc(o.hex) + '"></i>' : '';
      var icon = o.icon ? o.icon + ' ' : '';
      return '<button class="chip' + (isSel ? ' active' : '') + '" data-act="' + act + '" data-val="' + esc(o.key) + '">' +
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
    if (parts[0] === 'meer') return 'meer';
    return 'kast';
  }

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
        if (parts[1] === 'new') { top = topBar('Nieuwe outfit', '#/outfits'); view = viewOutfitForm(null); }
        else if (parts[2] === 'edit') { top = topBar('Bewerken', '#/outfit/' + parts[1]); view = viewOutfitForm(parts[1]); }
        else { top = topBar('', '#/outfits'); view = viewOutfitDetail(parts[1]); }
        break;
      case 'meer':
        top = topBar('Meer');
        view = viewMeer();
        break;
      default:
        top = topBar('Mijn kledingkast', null,
          '<button class="icon-btn" data-act="bulk-add" title="Meerdere foto\'s toevoegen">⧉</button>' +
          '<button class="icon-btn" data-act="new-item" title="Nieuw kledingstuk">+</button>');
        view = viewKast();
    }

    els.topbar.innerHTML = top;
    els.view.innerHTML = view;
    els.tabbar.innerHTML = tabBar(rootTab(parts));
    hydrateImages(els.view);
  }

  function topBar(title, backHref, actions) {
    return (backHref ? '<a class="icon-btn" href="' + esc(backHref) + '" aria-label="Terug">‹</a>' : '<span class="icon-btn ghost"></span>') +
      '<h1 class="topbar-title">' + esc(title || '') + '</h1>' +
      '<div class="topbar-actions">' + (actions || '') + '</div>';
  }

  function tabBar(active) {
    var tabs = [
      { key: 'kast', href: '#/kast', icon: '🚪', label: 'Kast' },
      { key: 'outfits', href: '#/outfits', icon: '✨', label: 'Outfits' },
      { key: 'meer', href: '#/meer', icon: '☰', label: 'Meer' }
    ];
    return tabs.map(function (t) {
      return '<a class="tab' + (t.key === active ? ' active' : '') + '" href="' + t.href + '">' +
        '<span class="tab-icon">' + t.icon + '</span><span class="tab-label">' + t.label + '</span></a>';
    }).join('');
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
          '<button class="chip' + (f.fav ? ' active' : '') + '" data-act="filter-fav">★ Favorieten</button>' +
          '<button class="chip' + (f.unworn ? ' active' : '') + '" data-act="filter-unworn">Nooit gedragen</button>' +
        '</div></div>' +
      '<div class="filter-group"><span class="filter-label">Sorteren</span>' +
        '<div class="chips">' + chipRow([
          { key: 'recent', label: 'Nieuwste' },
          { key: 'name', label: 'Naam' },
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
      return '<a class="tile" href="#/item/' + esc(it.id) + '">' +
        itemThumb(it) +
        (it.favorite ? '<span class="tile-fav">★</span>' : '') +
        (!it.name ? '<span class="tile-badge">nog invullen</span>' : '') +
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

    return '<div class="detail">' +
      '<div class="detail-photo">' + itemThumb(it, 'photo-frame') + '</div>' +
      '<div class="detail-body">' +
        '<div class="detail-head">' +
          '<h2 class="detail-title">' + esc(it.name || 'Naamloos') + '</h2>' +
          '<button class="icon-btn star' + (it.favorite ? ' on' : '') + '" data-act="toggle-fav-item" data-id="' + esc(it.id) + '">' +
            (it.favorite ? '★' : '☆') + '</button>' +
        '</div>' +
        '<div class="meta-list">' + rows + '</div>' +
        (it.notes ? '<p class="notes">' + esc(it.notes) + '</p>' : '') +
        '<button class="btn btn-primary btn-block" data-act="wear-item" data-id="' + esc(it.id) + '">Vandaag gedragen</button>' +
        (inOutfits.length
          ? '<h3 class="section-title">In outfits (' + inOutfits.length + ')</h3>' +
            '<div class="list">' + inOutfits.map(outfitRowHtml).join('') + '</div>'
          : '') +
        '<div class="row-actions">' +
          '<a class="btn btn-secondary" href="#/item/' + esc(it.id) + '/edit">Bewerken</a>' +
          '<button class="btn btn-danger" data-act="delete-item" data-id="' + esc(it.id) + '">Verwijderen</button>' +
        '</div>' +
      '</div></div>';
  }

  function metaRow(key, val) {
    return '<div class="meta-row"><span class="meta-key">' + esc(key) + '</span><span class="meta-val">' + esc(val) + '</span></div>';
  }

  /* ─────────────────────────── Kledingstuk-formulier ─────────────────────── */

  function viewItemForm(id) {
    var existing = id ? getItem(id) : null;
    if (id && !existing) return emptyState('🤔', 'Niet gevonden', 'Dit kledingstuk bestaat niet meer.', '<a class="btn btn-primary" href="#/kast">Naar de kast</a>');

    if (!state.draft || state.draft.kind !== 'item' || state.draft.id !== (existing ? existing.id : 'new')) {
      var base = existing ? JSON.parse(JSON.stringify(existing)) : newItem();
      state.draft = {
        kind: 'item', id: existing ? existing.id : 'new', data: base,
        newImage: null, previewUrl: '', removeImage: false
      };
    }
    var d = state.draft;
    var it = d.data;

    var previewHtml;
    if (d.previewUrl) {
      previewHtml = '<img class="ph-img loaded" src="' + esc(d.previewUrl) + '" alt="">';
    } else if (it.imageId && !d.removeImage) {
      previewHtml = '<img class="ph-img" data-img="' + esc(it.imageId) + ':full" alt="">';
    } else {
      previewHtml = '';
    }
    var hasPhoto = !!(d.previewUrl || (it.imageId && !d.removeImage));

    return '<form class="form" id="itemForm" novalidate>' +
      '<button type="button" class="photo-picker" data-act="pick-photo">' +
        '<div class="photo-frame' + (d.previewUrl ? ' has-photo' : '') + '">' +
          '<div class="ph-fallback"><span>📷</span></div>' + previewHtml +
        '</div>' +
        '<span class="photo-hint">' + (hasPhoto ? 'Foto vervangen' : 'Foto toevoegen') + '</span>' +
      '</button>' +
      (hasPhoto ? '<button type="button" class="btn btn-ghost btn-block" data-act="remove-photo">Foto verwijderen</button>' : '') +

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

    if (!it.name) it.name = ''; // naamloos mag; de kast toont dan "nog invullen"

    if (d.removeImage && it.imageId && !d.newImage) {
      await KastDB.remove(KastDB.IMAGES, it.imageId);
      forgetImage(it.imageId);
      it.imageId = null;
    }
    if (d.newImage) {
      var imgId = it.imageId || uid('img');
      await KastDB.put(KastDB.IMAGES, { id: imgId, full: d.newImage.full, thumb: d.newImage.thumb });
      forgetImage(imgId);
      it.imageId = imgId;
    }
    await saveItem(it);
    clearDraft();
    toast('Opgeslagen');
    go('#/item/' + it.id);
  }

  function clearDraft() {
    if (state.draft && state.draft.previewUrl) URL.revokeObjectURL(state.draft.previewUrl);
    state.draft = null;
  }

  /* ────────────────────────────────  Outfits ─────────────────────────────── */

  function viewOutfits() {
    if (!state.outfits.length) {
      return emptyState('✨', 'Nog geen outfits',
        state.items.length
          ? 'Combineer kledingstukken uit je kast tot een outfit die je later zo terugvindt.'
          : 'Voeg eerst wat kleding toe aan je kast, dan kun je die hier combineren.',
        state.items.length
          ? '<button class="btn btn-primary" data-act="new-outfit">Outfit maken</button>'
          : '<button class="btn btn-primary" data-act="new-item">Kledingstuk toevoegen</button>');
    }
    var sorted = state.outfits.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    return '<div class="list list-cards">' + sorted.map(outfitCardHtml).join('') + '</div>';
  }

  function outfitCardHtml(o) {
    var items = o.itemIds.map(getItem).filter(Boolean);
    var occ = occasionMap[o.occasion];
    return '<a class="outfit-card" href="#/outfit/' + esc(o.id) + '">' +
      collageHtml(items) +
      '<div class="outfit-body">' +
        '<span class="outfit-name">' + esc(o.name || 'Naamloze outfit') + (o.favorite ? ' <span class="star-inline">★</span>' : '') + '</span>' +
        '<span class="outfit-meta">' + items.length + ' stuk' + (items.length === 1 ? '' : 'ken') +
          (occ ? ' · ' + esc(occ.label) : '') +
          (o.wearCount ? ' · ' + o.wearCount + '× gedragen' : '') + '</span>' +
      '</div></a>';
  }

  function outfitRowHtml(o) {
    var items = o.itemIds.map(getItem).filter(Boolean);
    return '<a class="list-item" href="#/outfit/' + esc(o.id) + '">' +
      collageHtml(items, 'collage small') +
      '<span class="list-text"><b>' + esc(o.name || 'Naamloze outfit') + '</b>' +
      '<span class="list-sub">' + items.length + ' stuk' + (items.length === 1 ? '' : 'ken') + '</span></span>' +
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
        '</div>' +
        (o.notes ? '<p class="notes">' + esc(o.notes) + '</p>' : '') +
        '<button class="btn btn-primary btn-block" data-act="wear-outfit" data-id="' + esc(o.id) + '">Vandaag gedragen</button>' +
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
          '<button class="btn btn-danger" data-act="delete-outfit" data-id="' + esc(o.id) + '">Verwijderen</button>' +
        '</div>' +
      '</div></div>';
  }

  function viewOutfitForm(id) {
    var existing = id ? getOutfit(id) : null;
    if (id && !existing) return emptyState('🤔', 'Niet gevonden', 'Deze outfit bestaat niet meer.', '<a class="btn btn-primary" href="#/outfits">Naar outfits</a>');

    if (!state.draft || state.draft.kind !== 'outfit' || state.draft.id !== (existing ? existing.id : 'new')) {
      state.draft = {
        kind: 'outfit', id: existing ? existing.id : 'new',
        data: existing ? JSON.parse(JSON.stringify(existing)) : newOutfit()
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

  /* ───────────────────────────── Kledingkiezer ───────────────────────────── */

  function openPicker() {
    syncOutfitDraftFromDom();
    state.pickerSel = state.draft.data.itemIds.slice();
    els.overlay.innerHTML = pickerHtml();
    els.overlay.hidden = false;
    document.body.classList.add('locked');
    hydrateImages(els.overlay);
  }

  function pickerHtml() {
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

    if (!body) body = '<p class="empty-text">Je kast is nog leeg. Voeg eerst kleding toe.</p>';

    return '<div class="sheet">' +
      '<div class="sheet-head"><h3>Kleding kiezen</h3>' +
        '<button class="icon-btn" data-act="picker-close" aria-label="Sluiten">×</button></div>' +
      '<div class="sheet-body">' + body + '</div>' +
      '<div class="sheet-foot">' +
        '<button class="btn btn-primary btn-block" data-act="picker-done">' +
          'Klaar (<span id="pickCount">' + state.pickerSel.length + '</span>)</button>' +
      '</div></div>';
  }

  function closeOverlay() {
    els.overlay.hidden = true;
    els.overlay.innerHTML = '';
    document.body.classList.remove('locked');
  }

  /* ─────────────────────────────── Meer / back-up ────────────────────────── */

  function viewMeer() {
    var items = state.items;
    var totalWorn = items.reduce(function (s, i) { return s + (i.wearCount || 0); }, 0);
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
        stat(totalWorn, 'keer gedragen') +
        stat(never, 'nooit gedragen') +
      '</div>' +

      (bars ? '<h3 class="section-title">Per categorie</h3><div class="bars">' + bars + '</div>' : '') +

      (mostWorn.length
        ? '<h3 class="section-title">Meest gedragen</h3><div class="list">' + mostWorn.map(function (it) {
            return '<a class="list-item" href="#/item/' + esc(it.id) + '">' + itemThumb(it, 'list-thumb') +
              '<span class="list-text"><b>' + esc(it.name || 'Naamloos') + '</b>' +
              '<span class="list-sub">' + it.wearCount + '× gedragen</span></span>' +
              '<span class="chev">›</span></a>';
          }).join('') + '</div>'
        : '') +

      '<h3 class="section-title">Back-up</h3>' +
      '<p class="hint block">Je kast staat alleen in deze browser op dit apparaat. Maak af en toe een back-up, en zet die terug als je van telefoon wisselt.</p>' +
      '<button class="btn btn-secondary btn-block" data-act="export">Back-up downloaden</button>' +
      '<button class="btn btn-secondary btn-block" data-act="import">Back-up terugzetten</button>' +

      '<h3 class="section-title">Opruimen</h3>' +
      '<button class="btn btn-danger btn-block" data-act="wipe">Alles verwijderen</button>' +

      '<p class="footer-note">Mijn Kledingkast · alles blijft lokaal op je eigen apparaat</p>' +
    '</div>';
  }

  function stat(num, label) {
    return '<div class="stat"><span class="stat-num">' + num + '</span><span class="stat-label">' + esc(label) + '</span></div>';
  }

  async function exportBackup() {
    toast('Back-up voorbereiden…');
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
      app: 'kledingkast', version: 1, exportedAt: new Date().toISOString(),
      items: state.items, outfits: state.outfits, images: out
    };
    var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'kledingkast-backup-' + todayISO() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    toast('Back-up gedownload');
  }

  async function importBackup(file) {
    var text = await file.text();
    var data;
    try { data = JSON.parse(text); } catch (e) { toast('Dit bestand kan ik niet lezen'); return; }
    if (!data || data.app !== 'kledingkast' || !Array.isArray(data.items)) {
      toast('Dit is geen kledingkast-back-up');
      return;
    }
    var ok = await confirmDialog({
      title: 'Back-up terugzetten?',
      body: 'Er komen ' + data.items.length + ' kledingstukken en ' + (data.outfits || []).length +
            ' outfits bij. Bestaande stukken met hetzelfde id worden overschreven.',
      confirmLabel: 'Terugzetten'
    });
    if (!ok) return;

    toast('Bezig met terugzetten…');
    var images = (data.images || []).map(function (rec) {
      return {
        id: rec.id,
        full: rec.full ? dataUrlToBlob(rec.full) : null,
        thumb: rec.thumb ? dataUrlToBlob(rec.thumb) : null
      };
    });
    await KastDB.putMany(KastDB.IMAGES, images);
    await KastDB.putMany(KastDB.ITEMS, data.items);
    await KastDB.putMany(KastDB.OUTFITS, data.outfits || []);
    images.forEach(function (rec) { forgetImage(rec.id); });
    await loadAll();
    render();
    toast('Back-up teruggezet');
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

  /* ────────────────────────────── Gebeurtenissen ─────────────────────────── */

  var actions = {
    'new-item': function () { clearDraft(); go('#/item/new'); },
    'new-outfit': function () { clearDraft(); go('#/outfit/new'); },
    'bulk-add': function () { els.fileBulk.click(); },
    'pick-photo': function () { els.filePhoto.click(); },

    'toggle-filters': function () { state.filtersOpen = !state.filtersOpen; render(); },
    'filter-cat': function (btn) { state.filters.cat = btn.getAttribute('data-val'); render(); },
    'filter-season': function (btn) { state.filters.season = btn.getAttribute('data-val'); render(); },
    'filter-color': function (btn) { state.filters.color = btn.getAttribute('data-val'); render(); },
    'filter-sort': function (btn) { state.filters.sort = btn.getAttribute('data-val'); render(); },
    'filter-fav': function () { state.filters.fav = !state.filters.fav; render(); },
    'filter-unworn': function () { state.filters.unworn = !state.filters.unworn; render(); },
    'filter-reset': function () {
      state.filters = { q: state.filters.q, cat: '', season: '', color: '', fav: false, unworn: false, sort: 'recent' };
      render();
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

    'remove-photo': function () {
      var d = state.draft;
      if (d.previewUrl) { URL.revokeObjectURL(d.previewUrl); d.previewUrl = ''; }
      d.newImage = null;
      d.removeImage = true;
      syncItemDraftFromDom();
      render();
    },

    'save-item': function () { commitItem(); },
    'save-outfit': function () { commitOutfit(); },
    'cancel-form': function () {
      var kind = state.draft ? state.draft.kind : 'item';
      var id = state.draft && state.draft.id !== 'new' ? state.draft.id : null;
      clearDraft();
      if (kind === 'outfit') go(id ? '#/outfit/' + id : '#/outfits');
      else go(id ? '#/item/' + id : '#/kast');
    },

    'open-picker': function () { openPicker(); },
    'picker-close': function () { closeOverlay(); render(); },
    'picker-done': function () {
      state.draft.data.itemIds = state.pickerSel.slice();
      closeOverlay();
      render();
    },
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

    'export': function () { exportBackup(); },
    'import': function () { els.fileImport.click(); },
    'wipe': async function () {
      var ok = await confirmDialog({
        title: 'Alles verwijderen?',
        body: 'Al je kledingstukken, outfits en foto\'s worden gewist. Dit kan niet ongedaan worden gemaakt.',
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
    }
  }

  async function onPhotoChosen(ev) {
    var file = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!file || !state.draft || state.draft.kind !== 'item') return;
    syncItemDraftFromDom();
    toast('Foto verwerken…');
    try {
      var processed = await processImage(file);
      var d = state.draft;
      if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
      d.newImage = processed;
      d.removeImage = false;
      d.previewUrl = URL.createObjectURL(processed.thumb);
      render();
    } catch (err) {
      toast('Kan deze foto niet gebruiken');
    }
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
        item.imageId = imgId;
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
      KastDB.getAll(KastDB.OUTFITS)
    ]);
    // Oudere of geïmporteerde records missen soms een veld; hier één keer rechtzetten.
    state.items = (res[0] || []).map(function (i) {
      i.colors = i.colors || [];
      i.seasons = i.seasons || [];
      i.wearCount = i.wearCount || 0;
      return i;
    });
    state.outfits = (res[1] || []).map(function (o) {
      o.itemIds = o.itemIds || [];
      o.seasons = o.seasons || [];
      o.wearCount = o.wearCount || 0;
      return o;
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

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    els.filePhoto.addEventListener('change', onPhotoChosen);
    els.fileBulk.addEventListener('change', onBulkChosen);
    els.fileImport.addEventListener('change', onImportChosen);

    window.addEventListener('hashchange', function () {
      // Een half ingevuld formulier verlaten betekent: concept weggooien.
      if (state.draft) {
        var parts = parseRoute();
        var stillEditing = (parts[0] === 'item' || parts[0] === 'outfit') &&
          (parts[1] === 'new' || parts[2] === 'edit');
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
