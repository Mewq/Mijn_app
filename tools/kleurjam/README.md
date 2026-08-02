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

## Als je de spelregels aanpast

`engine.js` is een kopie van de regels in `kleurjam.html` (`fitsInside`,
`exitSteps`, `dragRange`). Verander je daar iets, pas dan allebei aan — anders
kloppen de berekende pars niet meer met het spel. `playsolve.js` is de test die
dat verschil aan het licht brengt.
