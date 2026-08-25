/* Alle serverkennis van de app zit in dit ene bestand.

   Dat is met opzet: wil je later van server wisselen — naar Supabase, naar een
   eigen machine, naar wat dan ook — dan pas je dit bestand aan en verder niets.
   De rest van de app weet niet eens dat er een netwerk bestaat. */
(function (global) {
  'use strict';

  /* Waar staat de server? In de browser tijdens ontwikkelen op dezelfde
     machine; in de echte app het adres dat je bij het bouwen meegeeft. */
  var BASIS = (global.KAST_API || '').replace(/\/$/, '') ||
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://' + location.hostname + ':8788'
      : '');

  var TOKEN_KEY = 'kledingkast-online-token';
  var USER_KEY = 'kledingkast-online-gebruiker';

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }

  function zetSessie(t, gebruiker) {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY);
      if (gebruiker) localStorage.setItem(USER_KEY, JSON.stringify(gebruiker));
      else localStorage.removeItem(USER_KEY);
    } catch (e) { /* privémodus: dan geldt de sessie alleen deze keer */ }
  }

  function gebruiker() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; }
  }

  var ingelogd = function () { return !!token(); };

  /* Eén plek waar een verzoek de deur uit gaat. Fouten komen terug als een
     Error met een leesbare tekst, zodat elk scherm hetzelfde kan doen:
     de melding tonen die de server gaf. */
  async function roep(methode, pad, body) {
    if (!BASIS) throw new Error('Er is geen server ingesteld.');
    var opties = { method: methode, headers: {} };
    if (body !== undefined) {
      opties.headers['content-type'] = 'application/json';
      opties.body = JSON.stringify(body);
    }
    if (token()) opties.headers.authorization = 'Bearer ' + token();

    var res;
    try {
      res = await fetch(BASIS + pad, opties);
    } catch (e) {
      // Geen verbinding is iets anders dan een fout van de server, en verdient
      // ook een ander verhaal op het scherm.
      var offline = new Error('Geen verbinding met de server.');
      offline.offline = true;
      throw offline;
    }

    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }

    if (res.status === 401 && token()) {
      // De sessie is verlopen of ingetrokken; opruimen, anders blijft de app
      // proberen met een token dat nooit meer werkt.
      zetSessie('', null);
    }
    if (!res.ok) {
      var err = new Error((data && data.fout) || 'Er ging iets mis (' + res.status + ').');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* Een foto van de server heeft een adres dat begint met /uploads/. */
  function fotoUrl(pad) {
    if (!pad) return '';
    return /^https?:/i.test(pad) ? pad : BASIS + pad;
  }

  global.KastAPI = {
    basis: function () { return BASIS; },
    zetBasis: function (url) { BASIS = String(url || '').replace(/\/$/, ''); },
    ingelogd: ingelogd,
    gebruiker: gebruiker,
    fotoUrl: fotoUrl,

    status: function () { return roep('GET', '/api/status'); },

    async registreer(velden) {
      var uit = await roep('POST', '/api/auth/register', velden);
      zetSessie(uit.token, uit.gebruiker);
      return uit.gebruiker;
    },

    async login(email, wachtwoord) {
      var uit = await roep('POST', '/api/auth/login', { email: email, wachtwoord: wachtwoord });
      zetSessie(uit.token, uit.gebruiker);
      return uit.gebruiker;
    },

    async logout() {
      try { await roep('POST', '/api/auth/logout'); } catch (e) { /* dan lokaal opruimen */ }
      zetSessie('', null);
    },

    me: function () { return roep('GET', '/api/me'); },
    wisAccount: async function () {
      await roep('DELETE', '/api/me');
      zetSessie('', null);
    },

    feed: function (filters) {
      var q = new URLSearchParams();
      Object.keys(filters || {}).forEach(function (k) {
        if (filters[k]) q.set(k, filters[k]);
      });
      var vraag = q.toString();
      return roep('GET', '/api/feed' + (vraag ? '?' + vraag : ''));
    },

    look: function (id) { return roep('GET', '/api/looks/' + encodeURIComponent(id)); },
    publiceer: function (look) { return roep('POST', '/api/looks', look); },
    verwijderLook: function (id) { return roep('DELETE', '/api/looks/' + encodeURIComponent(id)); },

    like: function (id, aan) {
      return roep(aan ? 'POST' : 'DELETE', '/api/looks/' + encodeURIComponent(id) + '/like');
    },
    bewaar: function (id, aan) {
      return roep(aan ? 'POST' : 'DELETE', '/api/looks/' + encodeURIComponent(id) + '/save');
    },
    bewaarde: function () { return roep('GET', '/api/me/saves'); },
    meld: function (id, reden) {
      return roep('POST', '/api/looks/' + encodeURIComponent(id) + '/melden', { reden: reden });
    },

    blokkeer: function (handle, aan) {
      return roep(aan ? 'POST' : 'DELETE',
        '/api/gebruikers/' + encodeURIComponent(handle) + '/blokkeer');
    },
    blokkades: function () { return roep('GET', '/api/me/blokkades'); },

    zetKastBackup: function (inhoud) { return roep('PUT', '/api/me/kast', { inhoud: inhoud }); },
    haalKastBackup: function () { return roep('GET', '/api/me/kast'); }
  };
})(window);
