# Mijn Kledingkast

Een kleine web-app waarin je al je kledingstukken bewaart en daar outfits van
samenstelt. Werkt op je telefoon, zonder account en zonder server: alles blijft
lokaal op je eigen apparaat staan.

De app staat los van de rest van deze repository (de "Sinan & Aisha"-app in de
hoofdmap) en deelt daar geen bestanden mee.

## Openen

Als de repository via GitHub Pages wordt gepubliceerd, staat de app op
`.../Mijn_app/kledingkast/`. Lokaal proberen kan met een statische server, want
`file://` blokkeert opslag en de service worker:

```sh
cd kledingkast
npx http-server -p 8080 -c-1
# open daarna http://127.0.0.1:8080
```

Op iPhone: open de app in Safari en kies **Deel → Zet op beginscherm**. Daarna
start hij schermvullend op, met een eigen icoon, en werkt hij ook zonder
internet.

## Wat kun je ermee

**Kast**
- Kledingstukken toevoegen met een foto (camera of fotorol), naam, categorie,
  een of meer kleuren, seizoenen, merk, maat en notities.
- Meerdere foto's tegelijk inladen met de knop ⧉ rechtsboven; elke foto wordt
  een kledingstuk dat je later een naam geeft. Die krijgen het label
  "nog invullen" zolang de naam leeg is.
- Zoeken op naam, merk, kleur of categorie, en filteren op categorie, seizoen,
  kleur, favorieten of "nooit gedragen". Sorteren op nieuwste, naam of hoe vaak
  je iets draagt.

**Outfits**
- Een outfit is een naam plus een set kledingstukken uit je kast, met
  gelegenheid, seizoen en notities.
- "🎲 Verras me" stelt zelf een combinatie voor: een bovenstuk, een onderstuk en
  waar mogelijk schoenen, een jas en een accessoire.
- Verwijder je een kledingstuk uit je kast, dan verdwijnt het ook uit de outfits
  waar het in zat.

**Bijhouden**
- "Vandaag gedragen" op een kledingstuk of outfit houdt bij hoe vaak en wanneer
  je iets draagt. Bij een outfit telt dat door naar alle stukken erin.
- Onder **Meer** zie je hoeveel je hebt, de verdeling per categorie, wat je het
  meest draagt en wat nog nooit aan is geweest.

## Back-ups

De kast staat in IndexedDB van je browser. Dat betekent: leeg je je
browsergegevens, of stap je over op een ander apparaat of een andere browser,
dan is de kast weg.

Onder **Meer → Back-up** download je één JSON-bestand met alles erin, foto's
inbegrepen. Datzelfde bestand zet je op een ander apparaat weer terug met
"Back-up terugzetten"; stukken met hetzelfde id worden overschreven, de rest
komt erbij. Maak die back-up af en toe.

## Onder de motorkap

Losse bestanden, geen build-stap en geen externe libraries.

| Bestand | Rol |
| --- | --- |
| `index.html` | Het omhulsel: kopbalk, scherm, tabbalk |
| `app.js` | Alle schermen, formulieren en logica |
| `db.js` | IndexedDB-laag (`items`, `outfits`, `images`) |
| `style.css` | Vormgeving, met een lichte en donkere modus |
| `sw.js` | Service worker, zodat de app offline blijft werken |
| `icon.svg`, `icon-*.png` | Icoon voor het beginscherm |

Foto's worden bij het toevoegen verkleind naar maximaal 1400 px (plus een
miniatuur van 480 px voor het overzicht) en als JPEG-blob opgeslagen. Een foto
van de telefoon van enkele megabytes wordt zo een paar honderd kilobyte.

Pas je `app.js`, `style.css`, `db.js` of `index.html` aan, verhoog dan het
versienummer `CACHE` bovenin `sw.js`. Anders blijven bezoekers de oude versie
uit de cache zien.
