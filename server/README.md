# Kledingkast-server

De server achter de community: accounts, gedeelde looks, likes, bewaren,
melden en een back-up van je eigen kast.

Er zit **geen enkele afhankelijkheid** in. Geen npm install, geen
`node_modules`, geen build. Alles komt uit Node zelf:

* `node:http` — de webserver
* `node:sqlite` — de database (één bestand op schijf)
* `node:crypto` — wachtwoorden (scrypt) en tokens

Dat is met opzet. Een server die je over een jaar nog wilt kunnen draaien
heeft niets aan een map met driehonderd pakketten die dan al verouderd zijn.

## Draaien

Node 22 of nieuwer (daarin zit `node:sqlite`).

```sh
node server/server.js
```

Dat is alles. De server geeft niet alleen de API maar ook de app zelf, en
vertelt bij het starten waar je hem kunt openen:

```
Kledingkast draait.

  op deze computer   http://localhost:8787
  op je telefoon     http://192.168.1.23:8787   (zelfde wifi)
```

Dat tweede adres tik je op je telefoon in — zelfde wifi, verder niets nodig.
Wil je hem tussen je apps hebben staan: in Safari of Chrome op "delen" en dan
"Zet op beginscherm". Zo ziet hij eruit als in de winkel, alleen zonder de
winkel.

De app zoekt de API op hetzelfde adres als waar hij zelf vandaan komt, dus er
valt niets in te stellen.

Instellingen gaan via omgevingsvariabelen:

| variabele   | standaard             | waarvoor                                   |
|-------------|-----------------------|--------------------------------------------|
| `PORT`      | `8787`                | poort waarop de server luistert              |
| `KAST_DATA` | `server/data`         | map met `kast.db` en `uploads/`              |
| `ORIGIN`    | `*`                   | welk webadres de app mag benaderen (CORS)    |
| `KAST_WEB`  | `../kledingkast-online` | map met de app; leeg = alleen de API       |

## De data

Alles staat in `KAST_DATA`:

* `kast.db` — de database (plus `-wal` en `-shm` van SQLite)
* `uploads/` — de foto's van gepubliceerde looks

**Een back-up is een kopie van die map.** Meer is het niet. Zet er een
dagelijkse kopie op, want dit is het enige wat niet opnieuw te maken is.

## Naar buiten zetten

De server praat gewoon HTTP. Zet er een reverse proxy voor die HTTPS doet
(Caddy is hiervoor het minste werk — die regelt het certificaat zelf):

```
kast.jouwdomein.nl {
  reverse_proxy localhost:8787
}
```

Staat de app op datzelfde adres — dus laat je de server hem gewoon geven —
dan hoef je met `ORIGIN` niets te doen. Zet je de app ergens anders neer, zet
`ORIGIN` dan op dát adres, zodat niet elke willekeurige site de API kan
aanspreken.

Werkt net zo goed op Fly.io, Railway, een Hetzner-VPS of een Raspberry Pi
thuis. Eis is alleen: Node 22+, een schijf die blijft bestaan (voor
`KAST_DATA`), en HTTPS ervoor.

## Wat er nog niet in zit

Eerlijk, zodat je niet voor verrassingen komt te staan:

* **E-mail wordt niet gecontroleerd.** Iemand kan zich met een verzonnen
  adres aanmelden. Voor een wachtwoord-vergeten-knop is een mailer nodig.
* **Meldingen gaan naar de database, niet naar jou.** Drie verschillende
  melders halen een look automatisch uit de feed; verder kijken doe je zelf
  in `kast.db`.
* **Foto's worden niet gekeurd.** Zodra er vreemden meedoen wil een winkel
  (en de wet) dat je daar iets mee kunt.
