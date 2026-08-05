# Kleurjam levelgereedschap

Hiermee zijn de levels in `kleurjam.html` gemaakt. Alles draait op kale Node
(getest op Node 22), zonder dependencies — behalve `playsolve.js`, dat Playwright
nodig heeft.

Alle commando's hieronder draai je vanuit deze map (`tools/kleurjam`).

## Hoe een level ontstaat

1. **`gen.js` — achterstevoren bouwen.** Het bord begint leeg. Blokken schuiven
   via hun eigen poort naar *binnen* en worden daarna dieper het bord in geduwd.
   Omdat elke zet omkeerbaar is, is elk zo gebouwd level per definitie oplosbaar.
2. **`densify.js` — volproppen.** Er wordt telkens één blok extra in een gat
   gelegd; blijft het level oplosbaar, dan mag het blijven, anders gaat het er
   weer uit. Dit is wat de zware levels zwaar maakt.
3. **`harden.js` — opschudden.** Willekeurige geldige zetten op de startstand.
   Dat kan de oplosbaarheid niet stukmaken (zetten zijn omkeerbaar), dus het is
   veilig zoeken naar een lastigere beginstand.
4. **`solver.js` — narekenen.** Zoekt per fase de goedkoopste manier om *een*
   blok naar buiten te krijgen en plakt die fases aan elkaar. De uitkomst is een
   echte, naspeelbare zettenreeks; de lengte daarvan wordt `par`.

`par` is dus de kortste route die de solver vindt, geen bewezen minimum. Vandaar
dat de interface het "doel" noemt.

## Nieuwe levels maken

### 1. Levels genereren

```sh
# zware levels (veel kleine stukken, ~100-150 zetten)
node --max-old-space-size=3000 pipeline.js 4000 4040 nieuw-zwaar.json dust 130 8

# stevige levels (~90-130 zetten)
node --max-old-space-size=3000 pipeline.js 4100 4140 nieuw-swarm.json swarm 100 12

# middenmoot (~60-100 zetten)
node --max-old-space-size=2500 pipeline.js 4200 4240 nieuw-mid.json small 30 12

# makkelijke levels (6-55 zetten)
node ramp.js nieuw-makkelijk.json 0
```

Argumenten van `pipeline.js`:

```
pipeline.js <eersteSeed> <laatsteSeed> <uitvoer.json> <preset> [adds] [hardenIters] [colored] [colors] [shapes]
```

* **preset** — `dust` (heel veel kleine stukken, hoogste par), `swarm`, `tiny`,
  `small`, `mixed`, `chunky` (weinig, grote stukken). Staan bovenin
  `pipeline.js`; nieuwe presets voeg je daar toe.
* **adds** — hoeveel blokken `densify` mag proberen bij te leggen. Hoger = zwaarder
  en trager.
* **hardenIters** — hoeveel schud-iteraties.

Elke seed levert nul of één level op en wordt meteen weggeschreven, dus je kunt
een run altijd afbreken. Reken op ~1-10 minuten per zwaar level; draai gerust
drie of vier runs met verschillende seed-reeksen naast elkaar.

Regel van duim: **par ligt rond 2,2 × het aantal blokken.** Meer blokken op het
bord is de enige echte knop voor een hogere par.

### 2. De ladder in het spel zetten

`emit.js` kiest uit alle pools het level dat het dichtst bij elk streefgetal ligt,
rekent het nog een keer na en schrijft de complete `LEVELS`-array in het HTML-bestand.

```sh
TARGETS="6,9,13,17,22,27,33,39,46,59,66,73,85,97,102,110,120,130,140,150" \
node --max-old-space-size=3000 emit.js ../../kleurjam.html \
  nieuw-makkelijk.json nieuw-mid.json nieuw-swarm.json nieuw-zwaar.json
```

Wil je **meer dan 20 levels**, zet dan meer getallen in `TARGETS` en vul de
`NAMES`-lijst bovenin `emit.js` aan met evenveel `["naam", "hint"]`-paren.
Zonder naam krijgt een level gewoon "Level 21".

Let op: `emit.js` vervangt de hele levelset. Wil je de huidige levels behouden en
alleen uitbreiden, geef dan ook de oude pool-bestanden mee, of bewaar ze.

### 3. Bijschaven en controleren

```sh
# par verlagen naar de kortste route die we kunnen vinden
node --max-old-space-size=3000 tighten.js ../../kleurjam.html

# levels op par sorteren (namen blijven op hun plek in de ladder)
node reorder.js ../../kleurjam.html

# alles nalopen: oplosbaar, geen overlap, poorten los van elkaar, 12x12
node --max-old-space-size=3000 finalcheck.js ../../kleurjam.html
```

`finalcheck.js` moet eindigen met `all levels OK`.

### 4. Echt naspelen in een browser

Speelt elke oplossing met muis-drags af in Chromium en controleert of het spel
zelf "gehaald" zegt. Dit vangt problemen die de solver niet ziet, zoals blokken
die je niet kunt pakken.

```sh
cp ../../kleurjam.html play.html
node --max-old-space-size=3000 playsolve.js play.html 0,1,2,3,4
```

Vraagt Playwright. In dit project staat Chromium al klaar; los daarvan is
`npm i playwright` genoeg.

## Zelf spelen / publiceren

`kleurjam.html` is één los bestand: openen in een browser is genoeg, ook zonder
webserver. Wil je het als webpagina delen, dan maakt `artifact.js` er een versie
van zonder verwijzingen naar buiten:

```sh
node artifact.js ../../kleurjam.html kleurjam-artifact.html
```

Die versie mist alleen de webfonts (die zijn in zo'n pagina geblokkeerd) en valt
terug op afgeronde systeemletters.

## Bestanden

| bestand | rol |
| --- | --- |
| `engine.js` | spelregels — identiek aan die in `kleurjam.html` |
| `solver.js` | fase-zoeker die een echte oplossing oplevert |
| `gen.js` | levelgenerator (achterstevoren spelen) |
| `densify.js` | blokken bijleggen zolang het oplosbaar blijft |
| `harden.js` | startstand opschudden op zoek naar meer zetten |
| `masks.js`, `rooms.js` | muurpatronen (wig, kern, kamers, pilaren…) |
| `pipeline.js` | genereren → volproppen → opschudden → narekenen |
| `ramp.js` | de makkelijke levels |
| `emit.js` | ladder kiezen en in het HTML-bestand schrijven |
| `tighten.js` | par verlagen naar de kortste gevonden route |
| `reorder.js` | levels op par sorteren |
| `finalcheck.js` | controle van het uiteindelijke bestand |
| `playsolve.js` | oplossingen naspelen in een echte browser |
| `artifact.js` | pagina-versie zonder externe verzoeken |
| `decorate.js` | mechanics afleiden uit een geverifieerde oplossing |
| `genfx.js` | levels mét ijs- of pijltegels |
| `mechanics.js` | het leerplan over de ladder verdelen |
| `addlevels.js` | levels aan de ladder toevoegen en het leerplan bewaken |
| `pickhard.js` | levels kiezen op weinig directe uitgangen en veel vallen |
| `analyse.js` | die eigenschappen meten |
| `solutions.json` | bewaarde, geverifieerde routes |

## De negen mechanics

Alle negen zitten in het spel én in `engine.js`, zodat de solver er goed mee
rekent. Het leerplan staat in `mechanics.js`: elke mechanic krijgt eerst een
eigen rustig level waar hij de enige nieuwe regel is, en pas daarna wordt hij
gecombineerd.

| level | mechanic | hoe het werkt |
| --- | --- | --- |
| 4 | klok | `timeLimit` in seconden; loopt pas vanaf de eerste zet |
| 5 | poort op slot | `gate.locked.openAfter` — gaat open na zoveel vertrokken blokken |
| 6 | bevroren blok | `block.frozen.thawAfter` — onbeweeglijk, gedraagt zich als muur |
| 7 | bom | `block.bomb {type:"zetten"\|"seconden", value}` |
| 8 | twee kleuren | `block.colors` + `bonusColor` — mag door beide poorten |
| 9 | pijltegels | `level.arrows [[r,c,richting]]` — alleen mee met de pijl |
| 10 | ijstegels | `level.ice [[r,c]]` — doorglijden tot iets tegenhoudt |
| 11 | sleutel & slot | `block.key` + `gate.keyLocked` |
| overal | sterren | 3 sterren op `par`, 2 tot `par × (1 + starMargin)`, anders 1 |

Sterren staan vanaf level 1 aan; de andere acht worden één voor één ingevoerd.

### Mechanics aan levels hangen

```sh
node --max-old-space-size=3000 mechanics.js ../../kleurjam.html ice-all.json arrows2.json
```

`mechanics.js` leest het leerplan bovenin zichzelf. Voor klok, bom, slot,
bevroren, sleutel en tweekleurig gebruikt het `decorate.js`; voor ijs en pijlen
haalt het een level uit een pool van `genfx.js`.

`decorate.js` leidt elke mechanic af uit een oplossing die al geverifieerd is:
een poort gaat pas op slot vanaf een moment dat die oplossing hem toch nog niet
gebruikte, een blok blijft alleen bevroren tot vlak voor de zet waarop het nodig
is, en een bom krijgt de zet waarop het blok toch al vertrok plus wat marge.
Daardoor blijft diezelfde oplossing geldig en is het level dus nog steeds uit te
spelen — de speler moet die volgorde alleen zelf vinden.

IJs en pijlen kunnen niet op die manier: die veranderen hoe blokken bewegen. Die
komen uit `genfx.js`, dat een gewoon level bouwt, er tegels in legt en de solver
laat kijken of het nog uitspeelbaar is. Het controleert ook of de tegels écht
iets doen — bij ijs moet er ergens een blok doorglijden, bij pijlen moet de
oplossing er overheen gaan of aantoonbaar langer worden.

```sh
node genfx.js ice    100 400 ice.json     18 55        # kleine ijslevels
node genfx.js ice   2000 2400 ice-big.json 30 80 10 20 # grotere
node genfx.js arrows 3000 3500 arrows2.json 15 80 5 18
```

### Levels met veel muren

Muren kosten de solver niets — ze zitten niet in de toestand, dus de zoekruimte
blijft even groot — maar ze dwingen blokken door nauwe doorgangen, en juist de
grote vormen komen daar klem te zitten. De `maze`-preset zet ze eerst neer en
propt de blokken daarna in wat overblijft:

```sh
# kamer met één deuropening, 6 losse pilaren erbij
node --max-old-space-size=2500 pipeline.js 9300 9380 maze.json maze 100 12 28 8 "" chamber 6

# twee kamers naast elkaar
node --max-old-space-size=2500 pipeline.js 9400 9480 maze2.json maze 100 12 28 8 "" split 7
```

De twee laatste argumenten zijn het muurpatroon (`chamber`, `cross`, `band`,
`pillars`, `combs` uit `rooms.js`) en het aantal extra pilaren. Levert een
patroon een onoplosbaar bord op, dan valt dat vanzelf af: de solver vindt geen
route en de kandidaat gaat weg.

Toevoegen aan de ladder gaat met `addlevels.js`, dat elk level opnieuw oplost,
er mechanics aan hangt, de ladder op zwaarte sorteert en nakijkt dat elke
mechanic nog steeds solo voorkomt voordat hij gecombineerd wordt:

```sh
MINWALLS=12 node --max-old-space-size=3000 addlevels.js ../../kleurjam.html 5 maze.json maze2.json
```

### Levels waar het bijna perfect moet

`pickhard.js` kiest levels op eigenschappen die niet uit de par blijken, en
meet ze met `analyse.js`:

* **meteen eruit** — hoeveel blokken bij de start al naar buiten kunnen. Gesloten
  poorten zijn hier het stuurmiddel: zolang een poort dicht is kan geen enkel
  blok van die kleur weg.
* **traag** — het aandeel blokken dat pas na vijf of meer zetten überhaupt
  uitgangsklaar staat. Gemeten door de oplossing af te spelen.
* **vallen** — hoeveel openingszetten leiden tot een stand waar de solver, mét
  terugstappen, geen route meer vindt. Geen bewijs van een doodlopende weg — de
  solver is niet volledig — maar wel precies het vastgelopen-gevoel.

```sh
MINPAR=95 BOMBSLACK=5 node --max-old-space-size=3000 pickhard.js ../../kleurjam.html 5 pool1.json pool2.json
```

Bommen krijgen een marge die meeschaalt met het moment waarop het blok toch al
vertrekt (`frac`, standaard 0,3). Een vaste marge van drie zetten is op zet 5
wurgend en op zet 40 niets.

### solutions.json: het bewijs bij het level

Bij zulke strakke bommen vindt een nieuwe zoektocht zelden nog een route die
alles haalt, terwijl de route waaruit het level gebouwd is dat aantoonbaar wel
doet. Die route wordt daarom bewaard in `solutions.json`. `playsolve.js` speelt
hem na als hij er is, en valt anders terug op zelf zoeken.

Dat is meteen de eerlijkste maat voor "bijna perfect": een level waarvoor de
solver zelf geen alternatieve route meer vindt, laat de speler ook nauwelijks
speling.

### Wat de solver wel en niet nakijkt

`verify()` controleert de zetten, de winst én de bommen die in *zetten*
aftellen. Wat op de klok loopt (`timeLimit` en bommen in seconden) valt buiten
een zoekruimte van zetten; die waarden worden afgeleid uit de lengte van de
gevonden oplossing, met ruime marge.

## Als je de spelregels aanpast

`engine.js` is een kopie van de regels in `kleurjam.html` (`fitsInside`,
`exitSteps`, `dragRange`). Verander je daar iets, pas dan allebei aan — anders
kloppen de berekende pars niet meer met het spel. `playsolve.js` is de test die
dat verschil aan het licht brengt.
