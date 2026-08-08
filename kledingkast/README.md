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
- Kledingstukken toevoegen met een of meer foto's (camera of fotorol), naam,
  categorie, een of meer kleuren, seizoenen, merk, maat en notities.
- Heeft een stuk meerdere foto's, dan kies je met een tik welke de **hoofdfoto**
  is (die met ★). Dat is de foto die je in de kast en op outfits terugziet; de
  rest blader je door op het detailscherm.
- Meerdere foto's tegelijk inladen met de knop ⧉ rechtsboven; elke foto wordt
  dan een apart kledingstuk dat je later een naam geeft. Die krijgen het label
  "nog invullen" zolang de naam leeg is.
- Zoeken op naam, merk, kleur of categorie, en filteren op categorie, seizoen,
  kleur, favorieten of "nooit gedragen". Sorteren op nieuwste, naam, het cijfer
  van Askim of hoe vaak je iets draagt.
- **Dupliceren** is handig voor hetzelfde stuk in een andere kleur of maat. De
  foto's worden echt gekopieerd, niet gedeeld — verwijder je het origineel, dan
  houdt de kopie gewoon haar eigen foto's.

**Outfits en mappen**
- Een outfit is een naam plus een set kledingstukken uit je kast, met
  gelegenheid, seizoen en notities.
- Zoeken op naam of op een kledingstuk dat erin zit, filteren op gelegenheid en
  op wie hem maakte, en sorteren op nieuwste of op het cijfer van Askim.
- **Dupliceren** maakt een kopie die meteen openklapt om aan te passen — handig
  voor een variant op een outfit die al werkt. De kopie begint zonder cijfer en
  zonder draaggeschiedenis.
- "🎲 Verras me" stelt zelf een combinatie voor: een bovenstuk, een onderstuk en
  waar mogelijk schoenen, een jas en een accessoire.
- In een **map** verzamel je outfits die bij elkaar horen — bijvoorbeeld
  "Nog kopen" of "Vakantie Italië". Een outfit mag in meerdere mappen zitten.
  Verwijder je een map, dan blijven de outfits zelf gewoon bestaan.
- Elke map heeft een **paklijst**: alle kledingstukken uit haar outfits, elk één
  keer, om af te vinken terwijl de koffer open ligt.
- Verwijder je een kledingstuk, dan verdwijnt het ook uit de outfits waar het in
  zat; verwijder je een outfit, dan verdwijnt die ook uit de mappen.

**Agenda**
- Onder **Outfits → Agenda** zie je per week wat je aanhad en wat je van plan
  bent. Tik op een dag om er een outfit aan te hangen.
- Een dag in de toekomst wordt **ingepland**; vandaag of eerder telt meteen als
  **gedragen**, inclusief alle kledingstukken van die outfit.
- Eén outfit per dag: kies je iets anders, dan schuift het vorige eruit.
  "Dag leegmaken" maakt de dag weer vrij.

**Bijhouden**
- "Vandaag gedragen" op een kledingstuk of outfit houdt bij hoe vaak en wanneer
  je iets draagt. Bij een outfit telt dat door naar alle stukken erin. Vergist?
  Dezelfde knop draait het weer terug.
- Draagbeurten worden per dag geteld. Trek je een trui los aan en noteer je
  diezelfde dag ook de outfit waar hij in zit, dan is dat één draagbeurt — geen
  twee.
- Vul je bij een kledingstuk een **prijs** in, dan rekent de app de **kosten per
  keer** uit. Onder Meer zie je de waarde van je kast en welke aankopen zich het
  best hebben terugverdiend.
- Onder **Meer** zie je hoeveel je hebt, de verdeling per categorie en per
  kleur, wat je het meest draagt en wat nog nooit aan is geweest.
- Op een kledingstuk laat **"Combineer je met"** zien wat je er in de praktijk
  het vaakst bij draagt, afgeleid uit je outfits.

**Doneren**
- Kleding die je niet meer wilt dragen leg je op de doneerstapel, vanaf het
  kledingstuk zelf of vanuit de sectie Mijn Askim.
- Die stukken tellen niet meer mee in je kast, statistieken of outfitvoorstellen,
  maar blijven bewaard tot je ze echt weggeeft. Onder **Meer → Doneerstapel**
  zet je ze terug in de kast of verwijder je ze definitief.

## Mijn Askim

Het tabblad **💛 Askim** is haar plek in de app. Daar kan zij:

- **Cijfers geven** van 1 tot 10, één ding tegelijk. Met de schakelaar
  **Kleding / Outfits** kiest ze wat ze beoordeelt; de tellers laten zien hoeveel
  er nog wacht. Wat ze niet weet slaat ze over; kleding die weg mag legt ze
  meteen op de doneerstapel. Is de ene rij leeg en de andere niet, dan pakt de
  app die vanzelf op.
- **Zelf outfits samenstellen.** Die krijgen het label 💛 Askim, zodat je ziet van
  wie ze zijn. Ze beoordeelt zowel jouw outfits als die van haarzelf.
- Haar hoogste cijfers en de doneerstapel in één oogopslag bekijken.

Jij sorteert daarna je kast én je outfitlijst op "💛 Cijfer van Askim" om te zien
wat zij het leukst vindt. Cijfers staan als badge op de tegels en zijn vanaf elk
detailscherm aan te passen of te wissen.

### Samen werken

Jullie telefoons delen niets automatisch. De heenweg gaat één keer via een
bestand (daar zitten de foto's in), de terugweg kan als tekstcode.

1. Jij: **Meer → Back-up delen** (of downloaden) en stuur hem naar haar.
2. Zij: **Meer → Back-up terugzetten → "Alles terugzetten"**. Nu staat jouw kast
   op haar telefoon.
3. Zij geeft cijfers en maakt outfits.
4. Zij: **Askim → Keuzes kopiëren als code**, en plakt die code in WhatsApp.
5. Jij: **Meer → Keuzes plakken**, code erin, klaar.

Stap 4 en 5 gaan zonder bestand — zie hieronder. Wil je liever met bestanden
werken, dan kan zij ook een volledige back-up terugsturen; kies dan bij het
terugzetten **"Alleen Askims keuzes"** in plaats van "Alles terugzetten".

## Delen zonder bestanden

Niet alles hoeft via de Bestanden-app.

- **Keuzes als code.** Cijfers, doneerkeuzes en outfits zijn platte tekst zonder
  foto's. De app zet ze samengeperst om in een code als `KAST1Z…` van een paar
  honderd tekens, die je gewoon in een berichtje plakt. Kopiëren gaat met één
  tik naar het klembord; aan de andere kant plak je hem bij **Keuzes plakken**.
  Dat voegt samen — je eigen kleding en foto's blijven zoals ze zijn.
- **Back-up delen.** Op een telefoon opent **Back-up delen** het gewone
  deelmenu, zodat het bestand rechtstreeks naar WhatsApp of AirDrop gaat zonder
  eerst ergens te landen. Kan de browser dat niet, dan valt hij terug op
  downloaden.

Het verschil tussen de twee keuzes bij het terugzetten van een bestand:
"Alles terugzetten" overschrijft records met hetzelfde id (bedoeld voor een
verhuizing naar een nieuwe telefoon), "Alleen Askims keuzes" voegt samen.

## Back-ups

De kast staat in IndexedDB van je browser. Dat betekent: leeg je je
browsergegevens, of stap je over op een ander apparaat of een andere browser,
dan is de kast weg.

Onder **Meer → Back-up** download je één JSON-bestand met alles erin, foto's
inbegrepen. Maak die back-up af en toe.

## Op de telefoon en op de pc

Dezelfde HTML, twee indelingen. Op een smal scherm staat de navigatie onderaan
als tabbalk en is het raster twee kolommen breed. Vanaf 900 px wordt diezelfde
tabbalk een zijbalk links, groeit het raster naar vier of vijf kolommen, en
komen op een detailscherm de foto en de gegevens naast elkaar te staan met de
foto meescrollend in beeld. Muisaanwijzers krijgen hover-feedback die op touch
niets in de weg zit.

Onder **Meer → Weergave** kies je het thema: systeem, licht of donker. Die keuze
wordt onthouden en al vóór het tekenen toegepast, zodat er niets flikkert.

## Onder de motorkap

Losse bestanden, geen build-stap en geen externe libraries.

| Bestand | Rol |
| --- | --- |
| `index.html` | Het omhulsel: kopbalk, scherm, tabbalk |
| `app.js` | Alle schermen, formulieren en logica |
| `db.js` | IndexedDB-laag (`items`, `outfits`, `folders`, `images`) |
| `style.css` | Vormgeving, met een lichte en donkere modus |
| `sw.js` | Service worker, zodat de app offline blijft werken |
| `icon.svg`, `icon-*.png` | Icoon voor het beginscherm |

Foto's worden bij het toevoegen verkleind naar maximaal 1400 px (plus een
miniatuur van 480 px voor het overzicht) en als JPEG-blob opgeslagen. Een foto
van de telefoon van enkele megabytes wordt zo een paar honderd kilobyte.

Een kledingstuk bewaart zijn foto's als `imageIds` met daarnaast een
`coverImageId` voor de hoofdfoto. Back-ups uit een eerdere versie hadden één
`imageId`; die worden bij het inladen automatisch omgezet.

Foto's worden pas uit de database gehaald als ze in de buurt van het scherm
komen. Let op als je daaraan sleutelt: `rootMargin` van een `IntersectionObserver`
rekt alleen de root op, niet de scrollende containers ertussen. De waarnemer
krijgt daarom de echte scrollcontainer (`.view` of `.sheet-body`) als root — met
de standaardroot laadt niets onder de vouw.

Pas je `app.js`, `style.css`, `db.js` of `index.html` aan, verhoog dan het
versienummer `CACHE` bovenin `sw.js`. Anders blijven bezoekers de oude versie
uit de cache zien.
