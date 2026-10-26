/* Achtergrond van een kledingfoto weghalen.

   Er zit geen model in en er wordt niets opgehaald: dit draait offline op de
   telefoon zelf, met de rekenkracht die een browser toch al heeft.

   Het idee is dat van een toverstaf. De achtergrond van een kledingfoto is
   bijna altijd één aaneengesloten vlak dat de rand van de foto raakt — een
   vloer, een bed, een muur. Dus: begin bij de rand, en loop door zolang de
   kleur blijft lijken op wat je daar zag. Waar het kledingstuk begint,
   verspringt de kleur en stopt de wandeling vanzelf.

   Twee dingen maken het verschil tussen "aardig" en "bruikbaar":

   1. Vergelijken in Lab in plaats van RGB, met de lichtheid half meegeteld.
      Een schaduw op de vloer is dezelfde kleur, alleen donkerder; in RGB is
      dat een groot verschil, in Lab met halve L een klein verschil. Zo loopt
      de wandeling door de schaduw heen in plaats van hem te laten staan.

   2. Naast de vergelijking met de rand ook een veel strengere vergelijking
      met de buurpixel. Daardoor volgt de wandeling een geleidelijk verlopende
      achtergrond (licht dat afneemt naar de hoeken) maar springt hij niet
      over een scherpe rand van een kledingstuk.

   Wat het niet kan: een kledingstuk op een drukke achtergrond, of een trui
   die precies de kleur van de bank heeft. Daarvoor zit er een penseel in. */
(function (global) {
  'use strict';

  var WERK = 520;            // breedte waarop gerekend wordt; genoeg voor een nette rand
  var UIT = 1000;            // grootste zijde van het resultaat

  /* ── Kleur ─────────────────────────────────────────────────────────────── */

  function pivotRgb(c) {
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  }

  function pivotXyz(c) {
    return c > 0.008856 ? Math.cbrt(c) : (7.787 * c) + 16 / 116;
  }

  /* Alle pixels in één keer naar Lab. Dit is het duurste stuk van de hele
     berekening, dus het gebeurt precies één keer per foto en niet opnieuw bij
     elk schuifje aan de tolerantie. */
  function naarLab(data, aantal) {
    var lab = new Float32Array(aantal * 3);
    for (var i = 0; i < aantal; i++) {
      var p = i * 4;
      var rl = pivotRgb(data[p] / 255);
      var gl = pivotRgb(data[p + 1] / 255);
      var bl = pivotRgb(data[p + 2] / 255);
      var x = pivotXyz((rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047);
      var y = pivotXyz(rl * 0.2126 + gl * 0.7152 + bl * 0.0722);
      var z = pivotXyz((rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883);
      var q = i * 3;
      lab[q] = 116 * y - 16;
      lab[q + 1] = 500 * (x - y);
      lab[q + 2] = 200 * (y - z);
    }
    return lab;
  }

  /* Lichtheid telt half mee: schaduw is wel donkerder maar niet anders. */
  function afstand2(lab, a, b) {
    var i = a * 3, j = b * 3;
    var dl = lab[i] - lab[j];
    var da = lab[i + 1] - lab[j + 1];
    var db = lab[i + 2] - lab[j + 2];
    return 0.45 * dl * dl + da * da + db * db;
  }

  function afstandTot2(lab, i, L, A, B) {
    var q = i * 3;
    var dl = lab[q] - L, da = lab[q + 1] - A, db = lab[q + 2] - B;
    return 0.45 * dl * dl + da * da + db * db;
  }

  /* ── De randkleur ──────────────────────────────────────────────────────── */

  /* De mediaan en niet het gemiddelde: ligt er een mouw over de rand van de
     foto, dan trekt die het gemiddelde scheef en de mediaan niet. */
  function randKleur(lab, w, h) {
    var Ls = [], As = [], Bs = [];
    function neem(x, y) {
      var q = (y * w + x) * 3;
      Ls.push(lab[q]); As.push(lab[q + 1]); Bs.push(lab[q + 2]);
    }
    for (var x = 0; x < w; x++) { neem(x, 0); neem(x, h - 1); }
    for (var y = 1; y < h - 1; y++) { neem(0, y); neem(w - 1, y); }
    function mediaan(a) {
      a.sort(function (p, q) { return p - q; });
      return a[a.length >> 1];
    }
    return [mediaan(Ls), mediaan(As), mediaan(Bs)];
  }

  /* ── De wandeling vanaf de rand ────────────────────────────────────────── */

  var VOOR = 1, ACHTER = 0;

  function vanafDeRand(lab, w, h, tolerantie) {
    var n = w * h;
    var masker = new Uint8Array(n);
    masker.fill(VOOR);
    var gezien = new Uint8Array(n);
    var rij = new Int32Array(n);
    var kop = 0, staart = 0;

    var ref = randKleur(lab, w, h);
    var L = ref[0], A = ref[1], B = ref[2];

    /* De tolerantie komt binnen als 0-100 en is zo geschaald dat de stand in
       het midden werkt voor de gewone gevallen: een donker, een beige en een
       bont kledingstuk op een vloer met schaduw. Onder de 30 laat hij alleen
       echt gelijke kleuren los; boven de 75 begint hij aan een licht
       kledingstuk te vreten. Met de hand gemeten op nagemaakte foto's — pas je
       een factor aan, meet dan opnieuw hoe de hele schaal loopt. */
    var grof = tolerantie * tolerantie * 0.04;      // vergelijking met de rand
    var fijn = grof * 0.16;                          // vergelijking met de buur
    /* De buurvergelijking is wat een geleidelijk verlopende achtergrond laat
       oplossen. Zonder grens zou die wandeling via piepkleine stapjes overal
       komen — ook dwars door een kledingstuk heen. Daarom mag een stapje
       alleen binnen deze ruimere schil rond de randkleur. Hoger dan 1.8 en de
       wandeling loopt bij een gewone tolerantie zo een donkere trui binnen. */
    var schil = grof * 1.8;

    function zaai(i) {
      if (gezien[i]) return;
      if (afstandTot2(lab, i, L, A, B) > grof) return;
      gezien[i] = 1;
      masker[i] = ACHTER;
      rij[staart++] = i;
    }

    for (var x = 0; x < w; x++) { zaai(x); zaai((h - 1) * w + x); }
    for (var y = 0; y < h; y++) { zaai(y * w); zaai(y * w + w - 1); }

    while (kop < staart) {
      var i = rij[kop++];
      var ix = i % w, iy = (i / w) | 0;
      for (var k = 0; k < 4; k++) {
        var nx = ix + (k === 0 ? -1 : k === 1 ? 1 : 0);
        var ny = iy + (k === 2 ? -1 : k === 3 ? 1 : 0);
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        var j = ny * w + nx;
        if (gezien[j]) continue;
        var vanRand = afstandTot2(lab, j, L, A, B);
        // Lijkt op de rand, óf nauwelijks te onderscheiden van de buurpixel en
        // nog altijd binnen de schil rond de achtergrondkleur.
        if (vanRand > grof && (vanRand > schil || afstand2(lab, i, j) > fijn)) continue;
        gezien[j] = 1;
        masker[j] = ACHTER;
        rij[staart++] = j;
      }
    }
    return masker;
  }

  /* ── Opruimen ──────────────────────────────────────────────────────────── */

  /* Een los stofje op de vloer blijft anders als zwevend vlekje staan, en een
     lichte plek midden op een trui wordt anders een gaatje. Eerst openen
     (vlekjes weg), dan sluiten (gaatjes dicht). */
  function schuif(masker, w, h, straal, wilVoor) {
    var uit = new Uint8Array(masker.length);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = y * w + x;
        var raak = 0;
        for (var dy = -straal; dy <= straal && !raak; dy++) {
          var yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (var dx = -straal; dx <= straal; dx++) {
            var xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            if (masker[yy * w + xx] === (wilVoor ? VOOR : ACHTER)) { raak = 1; break; }
          }
        }
        uit[i] = wilVoor ? (raak ? VOOR : ACHTER) : (raak ? ACHTER : VOOR);
      }
    }
    return uit;
  }

  function opruimen(masker, w, h) {
    var m = schuif(masker, w, h, 1, false);   // eroderen: vlekjes weg
    m = schuif(m, w, h, 1, true);             // dilateren: terug op maat
    m = schuif(m, w, h, 1, true);             // dilateren: gaatjes dicht
    return schuif(m, w, h, 1, false);         // eroderen: terug op maat
  }

  /* De rand zachter maken, anders zie je in een collage een uitgeknipt
     kartelrandje liggen. */
  function verzachten(masker, w, h, straal) {
    var n = w * h;
    var a = new Float32Array(n);
    for (var i = 0; i < n; i++) a[i] = masker[i] === VOOR ? 255 : 0;
    var tmp = new Float32Array(n);
    var breed = straal * 2 + 1;

    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var som = 0;
        for (var dx = -straal; dx <= straal; dx++) {
          var xx = Math.min(w - 1, Math.max(0, x + dx));
          som += a[y * w + xx];
        }
        tmp[y * w + x] = som / breed;
      }
    }
    var uit = new Uint8ClampedArray(n);
    for (var x2 = 0; x2 < w; x2++) {
      for (var y2 = 0; y2 < h; y2++) {
        var som2 = 0;
        for (var dy = -straal; dy <= straal; dy++) {
          var yy = Math.min(h - 1, Math.max(0, y2 + dy));
          som2 += tmp[yy * w + x2];
        }
        uit[y2 * w + x2] = som2 / breed;
      }
    }
    return uit;
  }

  /* ── Penseelstreken ────────────────────────────────────────────────────── */

  /* Streken worden apart bewaard en na élke herberekening opnieuw gezet. Zo
     blijft je handwerk staan als je daarna nog aan de tolerantie draait. */
  function strekenOp(alpha, w, h, streken) {
    for (var s = 0; s < streken.length; s++) {
      var st = streken[s];
      var cx = st.x * w, cy = st.y * h;
      var r = st.r * w;
      var r2 = r * r;
      var x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(w - 1, Math.ceil(cx + r));
      var y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(h - 1, Math.ceil(cy + r));
      for (var y = y0; y <= y1; y++) {
        for (var x = x0; x <= x1; x++) {
          var dx = x - cx, dy = y - cy;
          var d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          // Zachte rand aan het penseel, anders krijg je harde cirkels.
          var kracht = 1 - Math.sqrt(d2) / r;
          kracht = Math.min(1, kracht * 2.2);
          var i = y * w + x;
          var doel = st.terug ? 255 : 0;
          alpha[i] = alpha[i] + (doel - alpha[i]) * kracht;
        }
      }
    }
  }

  /* ── Het geheel ────────────────────────────────────────────────────────── */

  function tekenOpMaat(bron, maxZijde) {
    var bw = bron.width || bron.naturalWidth;
    var bh = bron.height || bron.naturalHeight;
    var schaal = Math.min(1, maxZijde / Math.max(bw, bh));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bw * schaal));
    c.height = Math.max(1, Math.round(bh * schaal));
    var ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bron, 0, 0, c.width, c.height);
    return c;
  }

  /* Een sessie houdt het dure rekenwerk vast, zodat het schuifje voor de
     tolerantie direct reageert: de Lab-waarden worden één keer berekend en
     daarna alleen de wandeling opnieuw gedaan. */
  function sessie(bron) {
    var klein = tekenOpMaat(bron, WERK);
    var w = klein.width, h = klein.height;
    var beeld = klein.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h);
    var lab = naarLab(beeld.data, w * h);

    var groot = tekenOpMaat(bron, UIT);
    var maskerCanvas = document.createElement('canvas');
    maskerCanvas.width = w;
    maskerCanvas.height = h;
    var uitCanvas = document.createElement('canvas');
    uitCanvas.width = groot.width;
    uitCanvas.height = groot.height;

    /* basis = het resultaat van de wandeling bij de huidige tolerantie.
       werk  = diezelfde alpha met de penseelstreken erop.
       Ze staan los van elkaar zodat een streek alleen zijn eigen rondje hoeft
       aan te raken: bij elke beweging van je vinger alles opnieuw berekenen
       zou schokkerig zijn. */
    var basis = null;
    var werk = null;

    var api = {
      breedte: w,
      hoogte: h,
      uitBreedte: groot.width,
      uitHoogte: groot.height,

      /* Het dure werk: de wandeling vanaf de rand. Hierna staan de streken
         er weer af, dus wie ze wil houden zet ze er met herzet() op terug. */
      basisVoor: function (tolerantie) {
        var masker = vanafDeRand(lab, w, h, tolerantie);
        masker = opruimen(masker, w, h);
        basis = verzachten(masker, w, h, 1);
        werk = new Uint8ClampedArray(basis);
        return api;
      },

      /* Eén streek erbij — alleen het rondje eronder verandert. */
      streek: function (st) {
        if (!werk) return api;
        strekenOp(werk, w, h, [st]);
        return api;
      },

      /* Alles opnieuw vanaf de basis, met deze streken erop. */
      herzet: function (streken) {
        if (!basis) return api;
        werk = new Uint8ClampedArray(basis);
        if (streken && streken.length) strekenOp(werk, w, h, streken);
        return api;
      },

      /* Het kledingstuk met een doorzichtige achtergrond. */
      beeld: function () {
        var mBeeld = new ImageData(w, h);
        for (var i = 0; i < w * h; i++) {
          var p = i * 4;
          mBeeld.data[p] = mBeeld.data[p + 1] = mBeeld.data[p + 2] = 255;
          mBeeld.data[p + 3] = werk[i];
        }
        maskerCanvas.getContext('2d').putImageData(mBeeld, 0, 0);

        var uctx = uitCanvas.getContext('2d');
        uctx.clearRect(0, 0, uitCanvas.width, uitCanvas.height);
        uctx.globalCompositeOperation = 'source-over';
        uctx.drawImage(groot, 0, 0);
        // Het masker wordt bij het opschalen vanzelf vloeiend; precies wat je
        // wilt voor een rand die niet mag kartelen.
        uctx.globalCompositeOperation = 'destination-in';
        uctx.imageSmoothingEnabled = true;
        uctx.drawImage(maskerCanvas, 0, 0, uitCanvas.width, uitCanvas.height);
        uctx.globalCompositeOperation = 'source-over';
        return uitCanvas;
      },

      /* In één keer, voor wie geen penseel gebruikt. */
      knip: function (tolerantie, streken) {
        return api.basisVoor(tolerantie).herzet(streken).beeld();
      },

      /* Hoeveel van de foto blijft er staan? Blijft bijna alles staan, of juist
         bijna niets, dan is het misgegaan en kun je dat beter zeggen dan doen
         alsof er iets uitgeknipt is. */
      aandeel: function (canvas) {
        var c = tekenOpMaat(canvas, 160);
        var d = c.getContext('2d', { willReadFrequently: true })
          .getImageData(0, 0, c.width, c.height).data;
        var n = c.width * c.height, vol = 0;
        for (var i = 0; i < n; i++) if (d[i * 4 + 3] > 128) vol++;
        return vol / n;
      }
    };
    return api;
  }

  /* WebP is met doorzichtigheid een stuk kleiner dan PNG; kan de browser het
     niet, dan is PNG het vangnet. */
  function naarBlob(canvas) {
    return new Promise(function (klaar) {
      if (!canvas.toBlob) return klaar(null);
      canvas.toBlob(function (blob) {
        if (blob && blob.type === 'image/webp') return klaar(blob);
        canvas.toBlob(function (png) { klaar(png); }, 'image/png');
      }, 'image/webp', 0.9);
    });
  }

  /* Het kledingstuk strak in beeld: alles wat doorzichtig is eraf snijden.
     Zonder dit staat een sok met een halve meter lucht eromheen in je collage. */
  function bijsnijden(canvas) {
    var w = canvas.width, h = canvas.height;
    var d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    var x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] < 24) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
    if (x1 < x0 || y1 < y0) return canvas;         // alles weggesneden
    var rand = Math.round(Math.max(w, h) * 0.015);
    x0 = Math.max(0, x0 - rand); y0 = Math.max(0, y0 - rand);
    x1 = Math.min(w - 1, x1 + rand); y1 = Math.min(h - 1, y1 + rand);
    var uit = document.createElement('canvas');
    uit.width = x1 - x0 + 1;
    uit.height = y1 - y0 + 1;
    uit.getContext('2d').drawImage(canvas, x0, y0, uit.width, uit.height, 0, 0, uit.width, uit.height);
    return uit;
  }

  global.Knipsel = {
    sessie: sessie,
    naarBlob: naarBlob,
    bijsnijden: bijsnijden,
    WERK: WERK
  };
})(window);
