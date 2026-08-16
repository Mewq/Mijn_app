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
- **Kleur wordt uit de foto herkend.** Voeg je een foto toe en heb je nog geen
  kleur aangetikt, dan vult de app er één in. Een eigen keuze wordt nooit
  overschreven, en met "🎨 Kleur uit de foto halen" doe je het alsnog of opnieuw.
  Is er geen kleur die overheerst, dan wordt het "Print". Zilver en goud stelt de
  app nooit voor — die kies je zelf.
- **Labels** in je eigen woorden — "comfy", "te klein", "cadeau van mama".
  Eerder gebruikte labels worden voorgesteld, en je kunt erop filteren en zoeken.
- Zoeken op naam, merk, kleur, label of categorie, en filteren op categorie,
  seizoen, kleur, label, favorieten of "nooit gedragen". Sorteren op nieuwste,
  naam, het cijfer van Askim of hoe vaak je iets draagt.
- **Dupliceren** is handig voor hetzelfde stuk in een andere kleur of maat. De
  foto's worden echt gekopieerd, niet gedeeld — verwijder je het origineel, dan
  houdt de kopie gewoon haar eigen foto's.

**Stylist**
- Het tabblad **🪄 Stylist** legt je kast in lagen boven elkaar: **Boven**
  (truien en shirts), daaronder **Onder** (broeken en rokken), daaronder
  **Schoenen**. Daar weer onder staan **Jas** en **Erbij** (tassen en
  accessoires) voor wat je er nog overheen of bij doet.
- Per laag blader je zijwaarts door je kast. Tik een stuk aan en het blijft
  staan met een rand en een vinkje; de rest van die laag treedt terug. Nog eens
  tikken haalt de keuze weer weg, en het kruisje in de kop slaat de hele laag
  over — want soms draag je geen jas.
- Het balkje onderaan telt op wat je gekozen hebt. "Bewaren" zet het als concept
  klaar in het gewone outfitformulier, waar je het een naam en een gelegenheid
  geeft. Zo blijft er één plek waar outfits ontstaan.
- 🎲 rechtsboven draait alle lagen tegelijk naar een willekeurig stuk, de een na
  de ander, en de banen schuiven zichtbaar mee.
- Alleen kleding die **in je kast** ligt doet mee: wat in de wasmand of op de
  doneerstapel ligt blijft weg. Met de seizoensknoppen bovenaan filter je de
  lagen, en favorieten en hoge cijfers van Askim staan vooraan.

**Outfits en mappen**
- Een outfit is een naam plus een set kledingstukken uit je kast, met
  gelegenheid, seizoen en notities.
- **Delen als plaatje.** De knop 📤 op een outfit tekent haar foto (of de
  collage van haar kledingstukken) met de naam eronder op één afbeelding, en
  opent het deelmenu. Kan de browser dat niet, dan wordt het een download.
- Een outfit mag ook **een eigen foto** hebben — een kiekje van de hele look in
  de paskamer of voor de spiegel. Heeft hij die, dan zie je die foto overal
  terug in plaats van het collagetje van losse stukken.
- Je hoeft niet in één keer klaar te zijn: een outfit met alleen een foto of
  alleen een naam kun je gewoon bewaren en later aanvullen. Op zo'n outfit staat
  een knop **"Kleding erbij zoeken"**. Helemaal leeg opslaan kan niet — dan
  stond er straks een lege regel in je lijst.
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
- Bij een kledingstuk en bij een outfit kun je optioneel een **prijs** invullen.
  Onder Meer zie je daarmee de waarde van je kast.
- Onder **Meer** zie je hoeveel je hebt, de verdeling per categorie en per
  kleur, wat je het meest draagt en wat nog nooit aan is geweest.

**Opruimen en bijhouden**
- Onder **Meer → Kast opruimen** staat wat je een jaar niet hebt aangehad. Per
  stuk drie knoppen: houden, in de was, of weggeven. "Houden" zet de klok
  opnieuw, zodat het niet volgende week weer bovenaan staat.
- Met de knop **✓** in de zoekbalk van je kast zet je de aanvinkmodus aan: dan
  noteert één tik op een tegel dat je dat vandaag droeg, en een tweede tik
  draait het terug. Handig voor een gewone dag waarop je geen hele outfit
  vastlegt.
- Bij een dag in de agenda vul je zelf de **temperatuur** in. De stylist ziet
  die van vandaag en stelt het bijpassende seizoen voor — één tik en je banen
  staan goed. De app kan niet op internet, dus een verwachting ophalen gaat
  niet; dit is met opzet handwerk.

**Meer**
- Bovenaan een kaartje dat in één zin zegt hoe je ervoor staat.
- Daaronder **Snel naar**: acht knoppen naar alles wat de app te bieden heeft,
  met de aantallen erbij. Ook naar de schermen die geen eigen tabblad hebben —
  de mappen, de agenda, de wasmand en de doneerstapel. De wasmandknop zet het
  vak meteen goed, zodat je daar niet zelf een filter voor hoeft te zoeken.
- Een kaartje voor **deze maand**: hoe vaak je iets aanhad, hoeveel hele
  outfits dat waren en welk stuk je favoriet van de maand is.
- Daarna de cijfers, de staafjes per categorie, per kleur en **per merk**, het
  thema, de deelcode, de back-up en het opruimen.
- Op een kledingstuk laat **"Combineer je met"** zien wat je er in de praktijk
  het vaakst bij draagt, afgeleid uit je outfits.

**In de was**
- Een stuk dat gewassen moet worden leg je met één tik in de wasmand. Het valt
  dan uit je kast en doet niet mee met "🎲 Verras me" — het is immers even niet
  beschikbaar.
- Bovenaan de kast staat dan hoeveel er in de was ligt, met een knop om die
  stapel te bekijken. Zo raakt er niets zoek.
- Kast, wasmand en doneerstapel zijn drie aparte vakken; een stuk zit altijd in
  precies één ervan. Iets doneren haalt het vanzelf uit de wasmand.

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
- **Een briefje bij een cijfer.** Op het scherm van een kledingstuk of outfit
  staat onder het cijfer een regeltje waar ze kwijt kan waaróm — "deze staat je
  super", "die kraag vind ik niks". Dat briefje reist mee in de deelcode. Het
  staat met opzet niet in de beoordeelkaart: die vraagt één ding tegelijk.
- **"Wat zou jij aandoen?"** Twee outfits naast elkaar, tik de mooiste aan.
  De winnaar klimt een punt in cijfer, de verliezer zakt er een. Zo krijg je
  cijfers zonder dat iemand een cijfer hoeft te bedenken, en de rest van de app
  merkt er niets van — het blijft gewoon `rating`.
- **Haar top 3** staat als podium op haar scherm: zilver, goud, brons, met het
  hoogste stuk in het midden.
- **Een wenslijst.** Met 🤍 zet ze een stuk op haar lijstje van dingen die ze
  hem graag ziet dragen. Jij filtert je kast daarop met de chip 💖 Wenslijst.
- **Waar jullie het over eens zijn:** een kaartje dat telt bij hoeveel stukken
  jouw favoriet en haar 8-of-hoger samenvallen.
- De doneerstapel in één oogopslag bekijken.

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

  Wat je onderweg te zien krijgt:

  - Vóór het versturen een kaartje met hoe groot de code is en wat erin zit.
    De code zelf staat er ook, maar pas als je op "Code bekijken" tikt — het is
    een blok ruis waar niemand op zit te wachten.
  - Heb je nog niets beoordeeld, dan krijg je geen lege code maar uitleg en een
    knop naar het beoordeelscherm.
  - Bij het plakken staat er een knop **Plakken uit klembord**, en zodra er iets
    in het vak staat leest de app mee: hij zegt meteen of de code klopt, wat
    erin zit en wanneer hij gemaakt is.
  - Herkent hij kleding uit de code niet, dan zegt hij dat vooraf én achteraf —
    met de tip om eerst een volledige back-up te sturen. Zonder die melding zou
    een code uit een andere kast er gewoon leeg uitzien.
  - Na het overnemen blijft er een kaartje op het scherm staan met wat er
    precies veranderd is: cijfers bij kleding, cijfers bij outfits, nieuwe
    outfits en wat er op de doneerstapel bij kwam.
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

## Beweging

Schermwissels laten zien waar je heen gaat: dieper de app in (van de kast naar
een kledingstuk, van een kledingstuk naar het bewerkscherm) komt van rechts,
terugkomen van links, en tussen tabbladen komt het scherm gewoon op. Tegels en
lijstrijen verschijnen kort na elkaar in plaats van als één blok.

Er zijn een paar dingen die je écht ziet bewegen:

- Een **streepje onder de tabbalk** schuift mee naar het tabblad waar je heen
  gaat, in plaats van meteen op te duiken. Op de pc staat het niet in de weg:
  daar markeert de gevulde rij in de zijbalk het actieve tabblad al.
- **Snippers** vliegen omhoog op de twee momenten dat er iets af is: als de
  beoordeelrij van Askim leeg is, en als een paklijst helemaal afgevinkt is.
- Een **draaiende ring** staat in beeld terwijl foto's verkleind worden. Bij een
  handvol foto's tegelijk duurt dat lang genoeg om anders te denken dat er niets
  gebeurt.
- De **tegel die je aantikt** in het kieslijstje vliegt krimpend naar de teller
  in de knop "Klaar", en die teller wipt bij aankomst. Alleen bij kiezen — bij
  loslaten zou een vliegend plaatje verwarren.
- Een **zwaaiende hanger** vult de lege kast, en de andere lege schermen laten
  hun icoon rustig op en neer wippen.
- Zolang de foto van een tegel nog uit de database moet komen, loopt er een
  **glans** overheen.
- In de stylist rollen de **banen** één voor één van rechts binnen, en 🎲 laat ze
  na elkaar naar hun nieuwe stuk draaien.

En vijf dingen die niet ná je tik gebeuren maar ermee mee:

- **De foto vliegt mee.** Tik je een kledingstuk of outfit aan, dan blijft die
  foto in beeld en groeit hij uit naar zijn plek op het detailscherm. Zolang hij
  onderweg is blijft de rest stil: het scherm schuift niet ook nog, want dan zijn
  het twee bewegingen in plaats van één. Kom je op een detailscherm zonder zo'n
  vlucht — na herladen bijvoorbeeld — dan zoomt de foto er gewoon in.
- **De banen van de stylist draaien mee met je vinger.** Elke kaart weet hoe ver
  hij van het midden staat en draait naar rato van je af, zodat wat in het midden
  ligt vooraan komt. Past een baan al helemaal in beeld, dan blijft alles recht:
  daar valt niets te bladeren, dus daar is ook geen midden.
- **Cijfers rollen door.** Een teller die van 2 naar 3 springt zie je niet; het
  oude cijfer rolt omhoog weg terwijl het nieuwe van onderen komt. Dat geldt voor
  de tellers van de stylist en van de kledingkiezer.
- **Een rimpel loopt weg vanaf je vinger** op knoppen, chips, tegels en rijen.
- **Sterren spatten weg** als je iets tot favoriet maakt — alleen bij aanzetten,
  want uitzetten is geen feest.
- **Bewaren in de stylist** laat de gekozen stukken eerst één voor één op een
  stapel vliegen, en pas daarna gaat het formulier open.

Verder beweegt:

- De **foto op een detailscherm** komt met een zoom naar voren.
- De **beoordeelkaart** in de sectie Askim schuift naar links weg zodra je een
  cijfer geeft, overslaat of doneert; de volgende komt van rechts binnen.
- De **cijferknop** die je kiest krijgt een zetje, en het **tabicoon** wipt als
  je van tabblad wisselt — niet als je binnen hetzelfde tabblad blijft.
- De **statistieken** tellen op vanaf nul en de staafjes groeien vanaf links.
  Het eindgetal staat in `data-target`, zodat er tijdens het tellen altijd een
  bron van waarheid is.
- "🎲 Verras me" laat de gekozen stukken één voor één binnenvallen.

Een paar dingen om te weten als je hieraan sleutelt:

- De overgang speelt alleen bij een echte routewissel, en de klasse wordt daarna
  weer weggehaald. Zonder dat zou het raster opnieuw komen opzetten bij elke
  toetsaanslag in het zoekveld, want dat vervangt de tegels.
- De opkomst verschuift tegels een stukje naar beneden. Daardoor viel de onderste
  tegel net buiten de voorlaadmarge van het lui laden van foto's; die marge staat
  daarom op 900 px.
- De tabbalk wordt nog maar **één keer** gebouwd en daarna alleen bijgewerkt.
  Zou hij bij elke tekenbeurt opnieuw gemaakt worden, dan was het streepje elke
  keer een nieuw element en schoof het nergens heen. Keerzijde: elementen die
  blijven bestaan houden hun animatieklasse vast, dus die moet er na afloop met
  een `setTimeout` weer af — anders wipt het icoon de tweede keer niet meer.
- De snippers, de vlieger, de rimpel en de sterren hangen aan `document.body`,
  buiten het scherm dat ververst wordt, zodat een tekenbeurt ze niet halverwege
  weghaalt. Ze ruimen zichzelf op. Dit is niet theoretisch: de rimpel zat eerst
  ín de knop, en omdat bijna elke knop het scherm opnieuw tekent, gooide hij
  zijn eigen rimpel meteen weer weg.
- De meevliegende foto meet waar hij heen moet. Dat kan alleen als het doel
  stilstaat, dus `.met-vlucht` zet de opkomst van het scherm en de zoom van de
  detailfoto zolang uit. Zonder dat meet je het eerste beeldje van die
  animaties — een positie die 54 px verderop ligt — en landt de foto ernaast.
- Het oude cijfer van een rollende teller staat in `data-oud` en wordt met
  `content: attr()` getekend. Als echt element zou het tijdens het rollen in de
  tekst van de teller staan, en dan lezen zowel een schermlezer als een test
  "32" waar 3 hoort te staan.

De tijden zijn met opzet aan de lange kant — een scherm komt in ruim een halve
seconde op, tegels in zeven tienden — zodat je de beweging echt ziet in plaats
van vermoedt. Verander je er een, verander dan de bijbehorende `setTimeout` in
`app.js` mee: die ruimen de klassen en de losse elementen op, en lopen ze voor,
dan knipt een animatie halverwege af.

Alles hierboven verdwijnt zodra het systeem om minder beweging vraagt.

## Op de telefoon en op de pc

Dezelfde HTML, twee indelingen. Op een smal scherm staat de navigatie onderaan
als tabbalk en is het raster twee kolommen breed. Vanaf 900 px wordt diezelfde
tabbalk een zijbalk links, groeit het raster naar vier of vijf kolommen, en
komen op een detailscherm de foto en de gegevens naast elkaar te staan met de
foto meescrollend in beeld. In de stylist worden de banen daar ruimer en de
kaarten groter. Muisaanwijzers krijgen hover-feedback die op touch niets in de
weg zit.

De drie kernlagen van de stylist passen op een telefoon samen in beeld. Dat is
geen toeval maar een grens waar de maten omheen gekozen zijn: kaarten van 98 px
breed, een kop van één regel en compacte seizoenschips. Wordt daar iets groter,
dan valt de schoenenbaan onder de vouw en is het idee weg.

## Stijl en kleur

Onder **Meer → Weergave** kies je de stijl:

- **Papier** — waar we mee begonnen: warm papier, serif-titels, bruine
  accentkleur en zachte schaduwen. Deze blijft gewoon bestaan.
- **Apple** — glas in plaats van vlak. De systeemletter voor alles, capsules
  in plaats van rechthoeken, en zwevende lagen: de tabbalk hangt als een
  capsule boven de inhoud, panelen en dialogen zijn doorschijnend met een
  lichtrand langs de bovenkant, alsof licht over de rand van dik glas valt.
  In donkere modus wordt het papier echt zwart.

Daaronder kies je met zes rondjes een **kleur**: Standaard, Olijf, Inkt, Roos,
Pruim of Zee. De achtergrond blijft daarbij precies zoals hij is — dat is wat
maakt dat elke combinatie klopt: alleen de accentkleur en het zachte vlak
eronder verschuiven mee, in dezelfde ingehouden toon als het oorspronkelijke
papier. Dezelfde keuze staat in de Apple-stijl een tandje feller, want koele
vlakken slikken een gedempte tint anders op.

Stijl en kleur staan los van elkaar en van het thema, dus alle combinaties
kunnen. Wisselen verandert niets aan je kast.

Onder dezelfde kop kies je het thema: systeem, licht of donker. Alle drie de
keuzes worden onthouden en al vóór het tekenen toegepast, zodat er niets
flikkert.

De titel bovenin is een **kopregel**: klein, in hoofdletters en gespatieerd, in
de gewone letter in plaats van de serif. Onder de balk staat geen streep meer —
de inhoud vervaagt eronder weg in een verloop. Zo weet je waar de balk ophoudt
zonder dat er een lijn doorheen snijdt.

Wat je in de stylist gekozen hebt staat onderin als **ronde schijfjes** die
elkaar overlappen, in plaats van een rij namen: sneller te lezen, en je ziet
meteen wát je gekozen hebt. Het actieve tabblad krijgt een rond vlak achter
zich.

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
`coverImageId` voor de hoofdfoto. Een outfit gebruikt precies dezelfde twee
velden, zodat één `outfitConcept()` en één `kopieerFotos()` voor allebei
werken. Back-ups uit een eerdere versie hadden één `imageId`; die worden bij
het inladen automatisch omgezet.

Let op als je een concept ergens anders vandaan vult — de stylist doet dat —
dat het dezelfde vorm heeft. Een outfitconcept zonder `photos` liet het
formulier meteen struikelen.

Kleurherkenning gebeurt lokaal op een canvas van 64×80 pixels, in Lab-ruimte:
in RGB liggen zwart en donkergrijs dicht bij elkaar terwijl ze er duidelijk
anders uitzien.

Elke pixel bij de dichtstbijzijnde paletkleur zoeken werkt níét, en dat is de
moeite waard om te onthouden. Grijs en zilver liggen midden in het kleurvlak en
zijn daardoor de buur van elke schaduw, plooi en muur; op een echte foto winnen
ze dan altijd. Vandaar drie stappen:

1. De achtergrond eruit, geschat als de mediaan van de randstrook. Vult het
   kledingstuk het hele beeld, dan valt die stap weg.
2. Is meer dan 60% van wat overblijft ontzadigd, dan is het een neutraal stuk en
   beslist alleen de helderheid tussen zwart, grijs en wit.
3. Anders tellen alleen de kleurige pixels mee, gewogen naar hoe verzadigd ze
   zijn. De tint komt uit hun gewogen gemiddelde, zodat een donkere plooi rood
   niet naar bruin trekt. Is de verdeling te breed, dan wordt het "Print".

Test dit met fotoachtige beelden, niet met vlakke kleurvlakken: die laatste zijn
te makkelijk en lieten precies deze fout door.

Een `<img>` in een fotohouder staat absoluut gepositioneerd. Krijgt zo'n houder
zelf geen `position`, dan valt de foto terug op de pagina en legt hij zich over
het halve scherm — klikbaar en al. Elke nieuwe houder hoort dus in de gedeelde
regel met `.tile-photo` en vrienden.

De temperatuur per dag staat in `localStorage` onder `kledingkast-weer`, niet in
IndexedDB: het is een handjevol getallen, geen kledingstuk. Hij reist wel mee in
de back-up, zodat hij een verhuizing overleeft.

Een paar dingen zijn er op snelheid uitgezocht. De banen van de stylist meten
eerst álle kaarten op en schrijven daarna pas — door elkaar heen lezen en
schrijven laat de browser bij elke kaart opnieuw de lay-out uitrekenen, precies
terwijl je vinger beweegt. Het zoekveld wacht een tiende seconde voordat het
raster opnieuw gebouwd wordt. En de banen van de stylist worden per tekenbeurt
één keer uitgerekend in plaats van per baan opnieuw.

Foto's worden pas uit de database gehaald als ze in de buurt van het scherm
komen. Let op als je daaraan sleutelt: `rootMargin` van een `IntersectionObserver`
rekt alleen de root op, niet de scrollende containers ertussen. De waarnemer
krijgt daarom de echte scrollcontainer (`.rail`, `.view` of `.sheet-body`) als
root — met de standaardroot laadt niets onder de vouw. De banen van de stylist
schuiven zijwaarts, dus de marge staat aan alle vier de kanten.

De stylist tekent niet opnieuw als je een stuk aantikt. Dat is met opzet: een
tekenbeurt zou alle banen terugspoelen naar het begin terwijl jij net ergens in
het midden aan het bladeren was. In plaats daarvan wisselen de klassen op de
kaarten en werken alleen de teller in de kop en het balkje onderaan zich bij.
Wat wél opnieuw tekent — het seizoensfilter — zet daarna elke baan meteen weer
op het gekozen stuk.

Een baan kan niet voorbij zijn eigen einde schuiven. Het laatste stuk van een
korte baan komt dus niet precies in het midden, alleen helemaal in beeld. Dat
is normaal gedrag van een scroller, geen bug om omheen te bouwen.

Pas je `app.js`, `style.css`, `db.js` of `index.html` aan, verhoog dan het
versienummer `CACHE` bovenin `sw.js`. Anders blijven bezoekers de oude versie
uit de cache zien.
