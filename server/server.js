/* Kledingkast-server: accounts, een gedeelde feed met looks, en een plek waar
   je je eigen kast in back-up kunt zetten.

   Geen dependencies. Alles wat hier gebruikt wordt zit in Node zelf, dus er is
   niets te installeren, niets dat verouderd raakt en niets dat je later moet
   bijwerken vanwege een lek in een pakket dat je nooit bewust koos.

   Starten:  node server/server.js
   Poort:    PORT (standaard 8787)
   Gegevens: KAST_DATA (standaard server/data) */
'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { db, UPLOAD_DIR } = require('./db');

const PORT = Number(process.env.PORT || 8787);

/* ── Grenzen ──
   Alles wat van buiten komt heeft een bovengrens. Zonder deze getallen is één
   verkeerd verzoek genoeg om de schijf vol te schrijven. */
const MAX_BODY = 12 * 1024 * 1024;      // 12 MB per verzoek
const MAX_FOTO = 2 * 1024 * 1024;       // 2 MB per foto
const MAX_STUKKEN = 12;                 // kledingstukken per look
const MAX_BACKUP = 60 * 1024 * 1024;    // 60 MB voor een kastback-up
const FEED_PAGINA = 20;

/* ─────────────────────────────── Hulpjes ─────────────────────────────────── */

const nu = () => Date.now();
const uid = (p) => p + '_' + crypto.randomBytes(9).toString('base64url');

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  });
  res.end(body);
}

const fout = (res, code, bericht) => json(res, code, { fout: bericht });

function leesBody(req) {
  return new Promise((klaar, mis) => {
    let lengte = 0;
    const stukken = [];
    req.on('data', (c) => {
      lengte += c.length;
      if (lengte > MAX_BODY) { mis(new Error('te groot')); req.destroy(); return; }
      stukken.push(c);
    });
    req.on('end', () => {
      if (!stukken.length) return klaar({});
      try { klaar(JSON.parse(Buffer.concat(stukken).toString('utf8'))); }
      catch (e) { mis(new Error('geen geldige json')); }
    });
    req.on('error', mis);
  });
}

/* Wachtwoorden met scrypt: traag met opzet, zodat een gestolen database niet
   in een middag te kraken is. */
function hashWachtwoord(wachtwoord) {
  const zout = crypto.randomBytes(16);
  const hash = crypto.scryptSync(wachtwoord, zout, 64);
  return zout.toString('hex') + ':' + hash.toString('hex');
}

function klopt(wachtwoord, opgeslagen) {
  const [zoutHex, hashHex] = String(opgeslagen).split(':');
  if (!zoutHex || !hashHex) return false;
  const hash = crypto.scryptSync(wachtwoord, Buffer.from(zoutHex, 'hex'), 64);
  const opgeslagenBuf = Buffer.from(hashHex, 'hex');
  // Even lang vergelijken, anders verraadt de tijd hoeveel er klopte.
  return opgeslagenBuf.length === hash.length && crypto.timingSafeEqual(hash, opgeslagenBuf);
}

/* Alleen http en https. Dit staat óók in de app, maar wat van buiten komt
   controleer je opnieuw: de app is niet de enige die kan posten. */
function netteLink(ruw) {
  const tekst = String(ruw == null ? '' : ruw).trim();
  if (!tekst) return '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(tekst) ? tekst : 'https://' + tekst);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    return u.href.slice(0, 500);
  } catch (e) { return ''; }
}

const kort = (s, n) => String(s == null ? '' : s).slice(0, n);

/* Een foto komt binnen als data-URL en gaat als bestand naar schijf. De naam
   is de hash van de inhoud: dezelfde foto twee keer kost één keer ruimte. */
function bewaarFoto(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const m = /^data:image\/(jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length || buf.length > MAX_FOTO) return null;
  const ext = m[1] === 'jpg' ? 'jpg' : m[1];
  const naam = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 32) + '.' + ext;
  const pad = path.join(UPLOAD_DIR, naam);
  if (!fs.existsSync(pad)) fs.writeFileSync(pad, buf);
  return naam;
}

/* ─────────────────────────── Wie ben je ──────────────────────────────────── */

function gebruikerVan(req) {
  const kop = req.headers.authorization || '';
  const token = kop.startsWith('Bearer ') ? kop.slice(7) : '';
  if (!token) return null;
  const rij = db.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
  ).get(token);
  if (!rij || rij.geblokkeerd) return null;
  db.prepare('UPDATE sessions SET laatst = ? WHERE token = ?').run(nu(), token);
  return rij;
}

const publiekeGebruiker = (u) => ({ id: u.id, handle: u.handle, naam: u.naam || u.handle });

/* ── Eenvoudige rem ──
   Per IP een teller die elke minuut leegloopt. Houdt geen aanval tegen, maar
   wel het per ongeluk in een lus posten van dezelfde look. */
const remmen = new Map();
function remt(sleutel, max, res) {
  const minuut = Math.floor(Date.now() / 60000);
  const k = sleutel + '|' + minuut;
  const n = (remmen.get(k) || 0) + 1;
  remmen.set(k, n);
  if (remmen.size > 5000) remmen.clear();
  if (n > max) { fout(res, 429, 'Even rustig aan — probeer het zo nog eens.'); return true; }
  return false;
}

/* ────────────────────────────── Looks ────────────────────────────────────── */

function lookMetStukken(id, kijker) {
  const l = db.prepare(
    `SELECT looks.*, users.handle, users.naam AS makerNaam
       FROM looks JOIN users ON users.id = looks.user_id
      WHERE looks.id = ?`).get(id);
  if (!l) return null;
  const stukken = db.prepare(
    'SELECT * FROM look_items WHERE look_id = ? ORDER BY positie').all(id);
  return vormLook(l, stukken, kijker);
}

function vormLook(l, stukken, kijker) {
  const geliked = kijker
    ? !!db.prepare('SELECT 1 FROM likes WHERE user_id = ? AND look_id = ?').get(kijker.id, l.id)
    : false;
  const bewaard = kijker
    ? !!db.prepare('SELECT 1 FROM saves WHERE user_id = ? AND look_id = ?').get(kijker.id, l.id)
    : false;
  /* De likes worden geteld, niet bijgehouden. Een opgeslagen teller loopt
     namelijk scheef zodra er elders iets verdwijnt — wist iemand zijn account,
     dan gaan zijn likes mee maar blijft de teller staan. Met een index op
     look_id is dit tellen goedkoop. */
  const likes = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE look_id = ?').get(l.id).n;
  return {
    id: l.id,
    naam: l.naam,
    notitie: l.notitie,
    occasion: l.occasion,
    seasons: l.seasons ? l.seasons.split(',') : [],
    cover: l.cover ? '/uploads/' + l.cover : null,
    likes,
    geliked,
    bewaard,
    vanMij: kijker ? kijker.id === l.user_id : false,
    maker: { handle: l.handle, naam: l.makerNaam || l.handle },
    createdAt: l.created_at,
    stukken: (stukken || []).map((st) => ({
      naam: st.naam,
      categorie: st.categorie,
      kleuren: st.kleuren ? st.kleuren.split(',') : [],
      merk: st.merk,
      link: st.link,
      foto: st.foto ? '/uploads/' + st.foto : null
    }))
  };
}

/* ────────────────────────────── Routes ───────────────────────────────────── */

const routes = {
  'POST /api/auth/register': async (req, res) => {
    /* Ruim genoeg dat mensen achter hetzelfde IP — kantoor, school, mobiel
       netwerk — elkaar niet in de weg zitten. De echte rem op nepaccounts is
       e-mailbevestiging; die komt er zodra er een mailprovider aan hangt. */
    if (remt('reg|' + ip(req), 20, res)) return;
    const b = await leesBody(req);
    const email = kort(b.email, 200).trim().toLowerCase();
    const handle = kort(b.handle, 30).trim().toLowerCase();
    const wachtwoord = String(b.wachtwoord || '');

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fout(res, 400, 'Vul een geldig e-mailadres in.');
    if (!/^[a-z0-9_.]{3,30}$/.test(handle)) return fout(res, 400, 'Kies een naam van 3-30 tekens: letters, cijfers, _ en .');
    if (wachtwoord.length < 8) return fout(res, 400, 'Kies een wachtwoord van minstens 8 tekens.');
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return fout(res, 409, 'Dit e-mailadres is al in gebruik.');
    if (db.prepare('SELECT 1 FROM users WHERE handle = ?').get(handle)) return fout(res, 409, 'Deze naam is al bezet.');

    const user = {
      id: uid('u'), email, handle,
      naam: kort(b.naam, 60).trim() || handle,
      wachtwoord: hashWachtwoord(wachtwoord),
      created_at: nu()
    };
    db.prepare(`INSERT INTO users (id, email, handle, naam, wachtwoord, created_at)
                VALUES (?, ?, ?, ?, ?, ?)`)
      .run(user.id, user.email, user.handle, user.naam, user.wachtwoord, user.created_at);
    return json(res, 201, { token: nieuweSessie(user.id), gebruiker: publiekeGebruiker(user) });
  },

  'POST /api/auth/login': async (req, res) => {
    if (remt('login|' + ip(req), 10, res)) return;
    const b = await leesBody(req);
    const email = kort(b.email, 200).trim().toLowerCase();
    const rij = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    // Eén antwoord voor beide fouten: anders kun je uitvissen welke adressen bestaan.
    if (!rij || !klopt(String(b.wachtwoord || ''), rij.wachtwoord)) {
      return fout(res, 401, 'E-mailadres of wachtwoord klopt niet.');
    }
    if (rij.geblokkeerd) return fout(res, 403, 'Dit account is geblokkeerd.');
    return json(res, 200, { token: nieuweSessie(rij.id), gebruiker: publiekeGebruiker(rij) });
  },

  'POST /api/auth/logout': async (req, res) => {
    const kop = req.headers.authorization || '';
    if (kop.startsWith('Bearer ')) db.prepare('DELETE FROM sessions WHERE token = ?').run(kop.slice(7));
    return json(res, 200, { ok: true });
  },

  'GET /api/me': async (req, res, ctx) => {
    if (!ctx.user) return fout(res, 401, 'Niet ingelogd.');
    const aantal = db.prepare('SELECT COUNT(*) AS n FROM looks WHERE user_id = ?').get(ctx.user.id).n;
    const backup = db.prepare('SELECT bytes, updated_at FROM kast_backups WHERE user_id = ?').get(ctx.user.id);
    return json(res, 200, {
      gebruiker: publiekeGebruiker(ctx.user),
      looks: aantal,
      backup: backup ? { bytes: backup.bytes, updatedAt: backup.updated_at } : null
    });
  },

  /* Verplicht voor beide appwinkels: je account kunnen wissen, in de app zelf. */
  'DELETE /api/me': async (req, res, ctx) => {
    if (!ctx.user) return fout(res, 401, 'Niet ingelogd.');
    const fotos = db.prepare(
      `SELECT cover AS f FROM looks WHERE user_id = ?
       UNION SELECT foto AS f FROM look_items
        WHERE look_id IN (SELECT id FROM looks WHERE user_id = ?)`).all(ctx.user.id, ctx.user.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(ctx.user.id);   // cascade doet de rest
    ruimFotosOp(fotos.map((r) => r.f));
    return json(res, 200, { ok: true });
  },

  'GET /api/feed': async (req, res, ctx) => {
    const q = ctx.url.searchParams;
    const waar = ["looks.status = 'zichtbaar'"];
    const args = [];
    if (q.get('occasion')) { waar.push('looks.occasion = ?'); args.push(kort(q.get('occasion'), 30)); }
    if (q.get('van')) { waar.push('users.handle = ?'); args.push(kort(q.get('van'), 30)); }
    // Wie je geblokkeerd hebt komt niet meer voorbij. Één kant op: die persoon
    // merkt er niets van, want anders is blokkeren een bericht op zich.
    if (ctx.user) {
      waar.push('looks.user_id NOT IN (SELECT ander_id FROM blokkades WHERE user_id = ?)');
      args.push(ctx.user.id);
    }
    const cursor = Number(q.get('cursor') || 0);
    if (cursor > 0) { waar.push('looks.created_at < ?'); args.push(cursor); }

    let rijen = db.prepare(
      `SELECT looks.*, users.handle, users.naam AS makerNaam
         FROM looks JOIN users ON users.id = looks.user_id
        WHERE ${waar.join(' AND ')}
        ORDER BY looks.created_at DESC
        LIMIT ?`).all(...args, FEED_PAGINA + 1);

    const meer = rijen.length > FEED_PAGINA;
    rijen = rijen.slice(0, FEED_PAGINA);

    // Seizoen en kleur zitten in de stukken, dus die filteren we erna.
    const seizoen = kort(q.get('season') || '', 20);
    const kleur = kort(q.get('color') || '', 20);
    let looks = rijen.map((l) => vormLook(
      l, db.prepare('SELECT * FROM look_items WHERE look_id = ? ORDER BY positie').all(l.id), ctx.user));
    if (seizoen) looks = looks.filter((l) => !l.seasons.length || l.seasons.indexOf(seizoen) !== -1);
    if (kleur) looks = looks.filter((l) => l.stukken.some((st) => st.kleuren.indexOf(kleur) !== -1));

    return json(res, 200, {
      looks,
      volgende: meer && rijen.length ? rijen[rijen.length - 1].created_at : null
    });
  },

  'GET /api/me/saves': async (req, res, ctx) => {
    if (!ctx.user) return fout(res, 401, 'Niet ingelogd.');
    const rijen = db.prepare(
      `SELECT looks.*, users.handle, users.naam AS makerNaam
         FROM saves JOIN looks ON looks.id = saves.look_id
         JOIN users ON users.id = looks.user_id
        WHERE saves.user_id = ? AND looks.status = 'zichtbaar'
          AND looks.user_id NOT IN (SELECT ander_id FROM blokkades WHERE user_id = ?)
        ORDER BY saves.created_at DESC LIMIT 100`).all(ctx.user.id, ctx.user.id);
    return json(res, 200, {
      looks: rijen.map((l) => vormLook(
        l, db.prepare('SELECT * FROM look_items WHERE look_id = ? ORDER BY positie').all(l.id), ctx.user))
    });
  },

  'POST /api/looks': async (req, res, ctx) => {
    if (!ctx.user) return fout(res, 401, 'Log in om te publiceren.');
    if (remt('post|' + ctx.user.id, 20, res)) return;
    const b = await leesBody(req);
    const stukkenIn = Array.isArray(b.stukken) ? b.stukken.slice(0, MAX_STUKKEN) : [];
    if (!stukkenIn.length && !b.cover) return fout(res, 400, 'Een look heeft minstens een foto of een kledingstuk nodig.');

    const look = {
      id: uid('l'),
      user_id: ctx.user.id,
      naam: kort(b.naam, 80).trim(),
      notitie: kort(b.notitie, 400).trim(),
      occasion: kort(b.occasion, 30),
      seasons: Array.isArray(b.seasons) ? b.seasons.slice(0, 4).map((s) => kort(s, 20)).join(',') : '',
      cover: b.cover ? bewaarFoto(b.cover) : null,
      created_at: nu()
    };
    db.prepare(`INSERT INTO looks (id, user_id, naam, notitie, occasion, seasons, cover, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(look.id, look.user_id, look.naam, look.notitie, look.occasion,
           look.seasons, look.cover, look.created_at);

    stukkenIn.forEach((st, i) => {
      db.prepare(`INSERT INTO look_items (id, look_id, positie, naam, categorie, kleuren, merk, link, foto)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(uid('li'), look.id, i, kort(st.naam, 80), kort(st.categorie, 30),
             Array.isArray(st.kleuren) ? st.kleuren.slice(0, 4).map((k) => kort(k, 20)).join(',') : '',
             kort(st.merk, 60), netteLink(st.link), st.foto ? bewaarFoto(st.foto) : null);
    });

    return json(res, 201, { look: lookMetStukken(look.id, ctx.user) });
  },

  'GET /api/looks/:id': async (req, res, ctx) => {
    const l = lookMetStukken(ctx.params.id, ctx.user);
    if (!l) return fout(res, 404, 'Deze look bestaat niet (meer).');
    // Geblokkeerd is geblokkeerd, ook als je het adres rechtstreeks intikt.
    if (ctx.user && db.prepare(
      `SELECT 1 FROM blokkades JOIN users ON users.id = blokkades.ander_id
        WHERE blokkades.user_id = ? AND users.handle = ?`).get(ctx.user.id, l.maker.handle)) {
      return fout(res, 404, 'Deze look bestaat niet (meer).');
    }
    return json(res, 200, { look: l });
  },

  'DELETE /api/looks/:id': async (req, res, ctx) => {
    if (!ctx.user) return fout(res, 401, 'Niet ingelogd.');
    const l = db.prepare('SELECT * FROM looks WHERE id = ?').get(ctx.params.id);
    if (!l) return fout(res, 404, 'Deze look bestaat niet (meer).');
    if (l.user_id !== ctx.user.id) return fout(res, 403, 'Dit is niet jouw look.');
    const fotos = [l.cover].concat(
      db.prepare('SELECT foto FROM look_items WHERE look_id = ?').all(l.id).map((r) => r.foto));
    db.prepare('DELETE FROM looks WHERE id = ?').run(l.id);
    ruimFotosOp(fotos);
    return json(res, 200, { ok: true });
  },

  'POST /api/looks/:id/like': async (req, res, ctx) => zetLike(res, ctx, true),
  'DELETE /api/looks/:id/like': async (req, res, ctx) => zetLike(res, ctx, false),
  'POST /api/looks/:id/save': async (req, res, ctx) => zetSave(res, ctx, true),
  'DELETE /api/looks/:id/save': async (req, res, ctx) => zetSave(res, ctx, false),

  'POST /api/looks/:id/melden': async (req, res, ctx) => {
    if (!ctx.user) return fout(res, 401, 'Log in om te melden.');
    const b = await leesBody(req);
    const l = db.prepare('SELECT * FROM looks WHERE id = ?').get(ctx.params.id);
    if (!l) return fout(res, 404, 'Deze look bestaat niet (meer).');
    db.prepare(`INSERT INTO meldingen (id, look_id, user_id, reden, created_at)
                VALUES (?, ?, ?, ?, ?)`)
      .run(uid('m'), l.id, ctx.user.id, kort(b.reden, 300), nu());

    /* Drie meldingen van verschillende mensen halen hem meteen uit de feed.
       Beter iets te vroeg weg dan dagenlang zichtbaar terwijl niemand kijkt;
       terugzetten kan altijd. */
    const aantal = db.prepare(
      'SELECT COUNT(DISTINCT user_id) AS n FROM meldingen WHERE look_id = ?').get(l.id).n;
    if (aantal >= 3 && l.status === 'zichtbaar') {
      db.prepare("UPDATE looks SET status = 'gemeld' WHERE id = ?").run(l.id);
    }
    return json(res, 200, { ok: true, gemeld: aantal });
  },

  /* ── Iemand niet meer willen zien ──
     Verplicht zodra vreemden elkaars foto's te zien krijgen: melden is niet
     genoeg, je moet ook zelf iemand kunnen wegdoen zonder op iemand anders te
     wachten. */
  'POST /api/gebruikers/:handle/blokkeer': async (req, res, ctx) => zetBlok(res, ctx, true),
  'DELETE /api/gebruikers/:handle/blokkeer': async (req, res, ctx) => zetBlok(res, ctx, false),

  'GET /api/me/blokkades': async (req, res, ctx) => {
    if (!ctx.user) return fout(res, 401, 'Niet ingelogd.');
    const rijen = db.prepare(
      `SELECT users.handle, users.naam, blokkades.created_at
         FROM blokkades JOIN users ON users.id = blokkades.ander_id
        WHERE blokkades.user_id = ? ORDER BY blokkades.created_at DESC`).all(ctx.user.id);
    return json(res, 200, {
      geblokkeerd: rijen.map((r) => ({ handle: r.handle, naam: r.naam, sinds: r.created_at }))
    });
  },

  /* ── Je eigen kast in back-up ──
     De server leest de inhoud niet; het is hetzelfde exportbestand dat de app
     al kon maken. Zo begint een nieuwe telefoon niet leeg. */
  'PUT /api/me/kast': async (req, res, ctx) => {
    if (!ctx.user) return fout(res, 401, 'Niet ingelogd.');
    const b = await leesBody(req);
    if (typeof b.inhoud !== 'string' || !b.inhoud) return fout(res, 400, 'Geen back-up meegestuurd.');
    const buf = Buffer.from(b.inhoud, 'utf8');
    if (buf.length > MAX_BACKUP) return fout(res, 413, 'Deze back-up is te groot.');
    db.prepare(`INSERT INTO kast_backups (user_id, inhoud, bytes, updated_at) VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET inhoud = excluded.inhoud,
                bytes = excluded.bytes, updated_at = excluded.updated_at`)
      .run(ctx.user.id, buf, buf.length, nu());
    return json(res, 200, { ok: true, bytes: buf.length });
  },

  'GET /api/me/kast': async (req, res, ctx) => {
    if (!ctx.user) return fout(res, 401, 'Niet ingelogd.');
    const rij = db.prepare('SELECT * FROM kast_backups WHERE user_id = ?').get(ctx.user.id);
    if (!rij) return fout(res, 404, 'Er staat nog geen back-up in je account.');
    return json(res, 200, {
      inhoud: Buffer.from(rij.inhoud).toString('utf8'),
      bytes: rij.bytes,
      updatedAt: rij.updated_at
    });
  }
};

function zetLike(res, ctx, aan) {
  if (!ctx.user) return fout(res, 401, 'Log in om te liken.');
  const l = db.prepare('SELECT * FROM looks WHERE id = ?').get(ctx.params.id);
  if (!l) return fout(res, 404, 'Deze look bestaat niet (meer).');
  if (aan) {
    db.prepare('INSERT OR IGNORE INTO likes (user_id, look_id, created_at) VALUES (?, ?, ?)')
      .run(ctx.user.id, l.id, nu());
  } else {
    db.prepare('DELETE FROM likes WHERE user_id = ? AND look_id = ?').run(ctx.user.id, l.id);
  }
  const n = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE look_id = ?').get(l.id).n;
  return json(res, 200, { likes: n, geliked: aan });
}

function zetSave(res, ctx, aan) {
  if (!ctx.user) return fout(res, 401, 'Log in om te bewaren.');
  const l = db.prepare('SELECT id FROM looks WHERE id = ?').get(ctx.params.id);
  if (!l) return fout(res, 404, 'Deze look bestaat niet (meer).');
  if (aan) {
    db.prepare('INSERT OR IGNORE INTO saves (user_id, look_id, created_at) VALUES (?, ?, ?)')
      .run(ctx.user.id, l.id, nu());
  } else {
    db.prepare('DELETE FROM saves WHERE user_id = ? AND look_id = ?').run(ctx.user.id, l.id);
  }
  return json(res, 200, { bewaard: aan });
}

function zetBlok(res, ctx, aan) {
  if (!ctx.user) return fout(res, 401, 'Log in om iemand te blokkeren.');
  const handle = kort(ctx.params.handle, 30).trim().toLowerCase();
  const ander = db.prepare('SELECT id, handle FROM users WHERE handle = ?').get(handle);
  if (!ander) return fout(res, 404, 'Deze persoon bestaat niet (meer).');
  if (ander.id === ctx.user.id) return fout(res, 400, 'Jezelf blokkeren heeft weinig zin.');
  if (aan) {
    db.prepare('INSERT OR IGNORE INTO blokkades (user_id, ander_id, created_at) VALUES (?, ?, ?)')
      .run(ctx.user.id, ander.id, nu());
    // Wat je van iemand bewaard had wil je ook niet meer tussen je bewaarde
    // looks zien staan; die filter zit al in de feed, maar dit ruimt het echt op.
    db.prepare(`DELETE FROM saves WHERE user_id = ?
                  AND look_id IN (SELECT id FROM looks WHERE user_id = ?)`)
      .run(ctx.user.id, ander.id);
  } else {
    db.prepare('DELETE FROM blokkades WHERE user_id = ? AND ander_id = ?').run(ctx.user.id, ander.id);
  }
  return json(res, 200, { geblokkeerd: aan, handle: ander.handle });
}

/* Een foto mag pas weg als niemand anders hem meer gebruikt — de bestandsnaam
   is de hash van de inhoud, dus twee looks kunnen hetzelfde bestand delen. */
function ruimFotosOp(namen) {
  [...new Set(namen.filter(Boolean))].forEach((naam) => {
    const inGebruik =
      db.prepare('SELECT 1 FROM looks WHERE cover = ?').get(naam) ||
      db.prepare('SELECT 1 FROM look_items WHERE foto = ?').get(naam);
    if (inGebruik) return;
    try { fs.unlinkSync(path.join(UPLOAD_DIR, naam)); } catch (e) { /* al weg */ }
  });
}

function nieuweSessie(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('INSERT INTO sessions (token, user_id, created_at, laatst) VALUES (?, ?, ?, ?)')
    .run(token, userId, nu(), nu());
  return token;
}

const ip = (req) =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';

/* ─────────────────────────── Het serveren zelf ───────────────────────────── */

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };

function serveerFoto(res, naam) {
  // Alleen de naam zelf, geen paden: anders lees je zo /etc/passwd uit.
  if (!/^[a-f0-9]{32}\.(jpg|jpeg|png|webp)$/.test(naam)) return fout(res, 404, 'Niet gevonden.');
  const pad = path.join(UPLOAD_DIR, naam);
  fs.readFile(pad, (err, buf) => {
    if (err) return fout(res, 404, 'Niet gevonden.');
    res.writeHead(200, {
      'content-type': MIME[path.extname(naam)] || 'application/octet-stream',
      'content-length': buf.length,
      // De naam is de inhoud, dus dit bestand verandert nooit meer.
      'cache-control': 'public, max-age=31536000, immutable'
    });
    res.end(buf);
  });
}

function zoekRoute(methode, pad) {
  const recht = methode + ' ' + pad;
  if (routes[recht]) return { fn: routes[recht], params: {} };
  const delen = pad.split('/');
  for (const sleutel of Object.keys(routes)) {
    const [m, patroon] = sleutel.split(' ');
    if (m !== methode) continue;
    const p = patroon.split('/');
    if (p.length !== delen.length) continue;
    const params = {};
    let past = true;
    for (let i = 0; i < p.length; i++) {
      if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(delen[i]);
      else if (p[i] !== delen[i]) { past = false; break; }
    }
    if (past) return { fn: routes[sleutel], params };
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  /* De app draait in een webview of op een ander adres, dus CORS moet aan.
     Zet ORIGIN in productie op je eigen adres in plaats van *. */
  res.setHeader('access-control-allow-origin', process.env.ORIGIN || '*');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
  res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('x-content-type-options', 'nosniff');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (url.pathname === '/api/status') return json(res, 200, { ok: true, tijd: nu() });
  if (url.pathname.startsWith('/uploads/')) return serveerFoto(res, url.pathname.slice(9));

  const route = zoekRoute(req.method, url.pathname);
  if (!route) return fout(res, 404, 'Onbekend adres.');

  try {
    await route.fn(req, res, { user: gebruikerVan(req), params: route.params, url });
  } catch (err) {
    // Nooit de echte fout naar buiten: die verraadt hoe de server in elkaar zit.
    console.error('fout bij', req.method, url.pathname, err);
    if (!res.headersSent) fout(res, 500, 'Er ging iets mis op de server.');
  }
});

if (require.main === module) {
  server.listen(PORT, () => console.log('Kledingkast-server luistert op poort ' + PORT));
}

module.exports = { server, db };
