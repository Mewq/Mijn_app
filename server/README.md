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

Instellingen gaan via omgevingsvariabelen:

| variabele   | standaard        | waarvoor                                            |
|-------------|------------------|-----------------------------------------------------|
| `PORT`      | `8787`           | poort waarop de server luistert                       |
| `KAST_DATA` | `server/data`    | map met `kast.db` en `uploads/`                       |
| `ORIGIN`    | `*`              | welk webadres de app mag benaderen (CORS)             |

Voor ontwikkelen op je eigen machine:

```sh
PORT=8788 ORIGIN='*' node server/server.js
```

De app in `kledingkast-online/` zoekt de server dan vanzelf op
`http://localhost:8788`. Wil je een ander adres, zet dan vóór het laden van
`api.js` een `window.KAST_API = 'https://...'` in `index.html`.

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

Zet dan `ORIGIN` op het adres waar de app staat, zodat niet elke willekeurige
site de API kan aanspreken.

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
