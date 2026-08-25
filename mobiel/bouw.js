/* Zet de webapp klaar in www/, zodat Capacitor hem in de echte app kan stoppen.

   Er valt niets te "builden" — de app is gewoon HTML, CSS en JS. Dit script
   kopieert die bestanden en zet er één ding bij: het adres van de server.
   In de browser tijdens ontwikkelen wordt dat vanzelf localhost, maar in de
   echte app staat er geen localhost, dus daar moet het erin gebakken worden.

     KAST_API=https://kast.jouwdomein.nl node bouw.js
*/
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BRON = path.join(__dirname, '..', 'kledingkast-online');
const DOEL = path.join(__dirname, 'www');
const API = (process.env.KAST_API || '').replace(/\/$/, '');
/* Beide appwinkels eisen een privacyverklaring op een webadres en een
   contactadres dat je echt leest. Die horen ook in de app zelf te staan. */
const PRIVACY = (process.env.KAST_PRIVACY || '').trim();
const CONTACT = (process.env.KAST_CONTACT || '').trim();

/* Bestanden die alleen op het web betekenis hebben: in de app zit alles al
   op de telefoon, dus een service worker kan daar alleen maar een oude versie
   vasthouden na een update. */
const NIET_MEE = new Set(['sw.js']);
const isTekstje = (naam) => naam.toLowerCase().endsWith('.md');   // uitleg hoort niet in de app

if (!API) {
  console.error('\nGeen KAST_API meegegeven.\n');
  console.error('  KAST_API=https://kast.jouwdomein.nl node bouw.js\n');
  console.error('Zonder serveradres kan de app in de winkel niet bij de community.\n');
  process.exit(1);
}
if (!/^https:\/\//i.test(API)) {
  // Beide appwinkels weigeren gewoon http; beter nu stuklopen dan bij de review.
  console.error('\nKAST_API moet met https:// beginnen. Kreeg: ' + API + '\n');
  process.exit(1);
}

fs.rmSync(DOEL, { recursive: true, force: true });
fs.mkdirSync(DOEL, { recursive: true });

let aantal = 0;
for (const naam of fs.readdirSync(BRON)) {
  if (NIET_MEE.has(naam) || isTekstje(naam)) continue;
  const van = path.join(BRON, naam);
  if (fs.statSync(van).isDirectory()) continue;
  fs.copyFileSync(van, path.join(DOEL, naam));
  aantal++;
}

/* Het serveradres komt vóór api.js binnen, want dat bestand leest het bij het
   laden. Eén regel erbij in index.html, verder blijft alles hetzelfde. */
const indexPad = path.join(DOEL, 'index.html');
let html = fs.readFileSync(indexPad, 'utf8');
const regel = '<script>' +
  'window.KAST_APP = true;' +                      // hier hoort geen service worker
  'window.KAST_API = ' + JSON.stringify(API) + ';' +
  (PRIVACY ? ' window.KAST_PRIVACY = ' + JSON.stringify(PRIVACY) + ';' : '') +
  (CONTACT ? ' window.KAST_CONTACT = ' + JSON.stringify(CONTACT) + ';' : '') +
  '</script>\n';
if (!html.includes('<script src="api.js">')) {
  console.error('\nindex.html laadt api.js niet meer — dit script klopt dan niet meer.\n');
  process.exit(1);
}
html = html.replace('<script src="api.js"></script>', regel + '<script src="api.js"></script>');
fs.writeFileSync(indexPad, html);

console.log('www/ klaar: ' + aantal + ' bestanden, server op ' + API);
if (!PRIVACY || !CONTACT) {
  const mist = [!PRIVACY && 'KAST_PRIVACY', !CONTACT && 'KAST_CONTACT'].filter(Boolean);
  console.log('\nLet op: ' + mist.join(' en ') + (mist.length > 1 ? ' ontbreken' : ' ontbreekt') +
    '. Dat mag tijdens het proberen, maar de winkels vragen erom.');
  console.log('  KAST_API=… KAST_PRIVACY=https://…/privacy KAST_CONTACT=jij@… node bouw.js');
}
