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

| variabele          | standaard               | waarvoor                                   |
|--------------------|-------------------------|--------------------------------------------|
| `PORT`             | `8787`                  | poort waarop de server luistert            |
| `KAST_DATA`        | `server/data`           | map met `kast.db` en `uploads/`            |
| `ORIGIN`           | `*`                     | welk webadres de app mag benaderen (CORS)  |
| `KAST_WEB`         | `../kledingkast-online` | map met de app; leeg = alleen de API       |
| `KAST_UITNODIGING` | leeg                    | aanmelden kan alleen met deze code         |

Die laatste is belangrijk zodra de server van buiten bereikbaar is. Staat hij
leeg, dan kan iedereen die bij het adres kan ook een account maken. Zet er iets
in en alleen wie de code kent komt erin; bij het starten zegt de server welke
van de twee het is.

## De data

Alles staat in `KAST_DATA`:

* `kast.db` — de database (plus `-wal` en `-shm` van SQLite)
* `uploads/` — de foto's van gepubliceerde looks

Dat is het enige wat je moet bewaren — zie "Back-up" hieronder.

## Op je eigen server neerzetten

Eis is alleen: Node 22.13+, een schijf die blijft bestaan voor `KAST_DATA`, en
HTTPS zodra het van buiten bereikbaar is.

```sh
sudo useradd --system --home /opt/kledingkast kledingkast
sudo git clone https://github.com/Mewq/Mijn_app /opt/kledingkast
sudo mkdir -p /var/lib/kledingkast
sudo chown -R kledingkast:kledingkast /opt/kledingkast /var/lib/kledingkast
```

In `kledingkast.service` staat een systemd-dienst die hem start bij het
opstarten en herstart als hij omvalt. Paden en de uitnodigingscode aanpassen,
dan:

```sh
sudo cp /opt/kledingkast/server/kledingkast.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kledingkast
journalctl -u kledingkast -f
```

Bijwerken is `git pull` en `systemctl restart kledingkast`.

## Zodat iemand anders erbij kan

Nu draait hij, maar alleen op je eigen netwerk. Er zijn drie manieren om daar
van buiten bij te komen. Ze verschillen vooral in wie er nog meer bij kan.

### 1. Tailscale — alleen jullie, niets open

Het minste werk en het veiligst. Tailscale maakt een eigen netwerkje tussen
jouw apparaten; er hoeft geen poort open in je router.

```sh
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
sudo tailscale serve --bg 8787        # geeft een https-adres op je tailnet
```

Je krijgt een adres als `https://homeserver.jouw-tailnet.ts.net`. Zij
installeert Tailscale op haar telefoon, logt in op hetzelfde netwerkje, en
opent dat adres. HTTPS zit erbij, dus "Zet op beginscherm" werkt ook.

Nadeel: zij moet Tailscale op haar telefoon hebben staan. Voordeel: er staat
niets van jou op het open internet, en je hoeft niets aan je router te doen.
Voor twee mensen is dit bijna altijd de beste keuze.

### 2. Cloudflare Tunnel — een gewoon webadres, geen poort open

Als zij niets wil installeren. `cloudflared` maakt van binnenuit verbinding met
Cloudflare; ook hier blijft je router dicht.

```sh
cloudflared tunnel login
cloudflared tunnel create kledingkast
cloudflared tunnel route dns kledingkast kast.jouwdomein.nl
cloudflared tunnel run --url http://localhost:8787 kledingkast
```

Je hebt er een domein voor nodig dat bij Cloudflare staat (een paar tientjes
per jaar). HTTPS regelt Cloudflare. Het adres staat wél op het open internet:
iedereen die het kent komt bij het inlogscherm. **Zet hier `KAST_UITNODIGING`**,
anders kan iedereen die het adres vindt een account maken.

### 3. Poort openzetten met Caddy ervoor

De klassieke manier: poort 80 en 443 doorsturen in je router, en Caddy ervoor
voor het certificaat.

```
kast.jouwdomein.nl {
  reverse_proxy localhost:8787
}
```

Dit is de meeste moeite en het meeste risico. Je hebt een domein nodig, een
vast IP of dynamische DNS, en je zet echt een poort open. Let ook op CGNAT: bij
sommige providers heb je geen eigen IPv4-adres en werkt doorsturen helemaal
niet — dan vallen optie 1 en 2 over.

Staat de app op hetzelfde adres als de API — en dat is zo als je de server hem
gewoon laat geven — dan hoef je met `ORIGIN` niets te doen. Zet je de app ergens
anders neer, zet `ORIGIN` dan op dát adres.

## Back-up

Alles staat in `KAST_DATA`. Een back-up is een kopie van die map, maar niet
terwijl de server schrijft: SQLite houdt een deel in `kast.db-wal`, dus een
losse kopie van `kast.db` kan half werk zijn.

```sh
sudo systemctl stop kledingkast
sudo cp -a /var/lib/kledingkast /pad/naar/backup/kast-$(date +%F)
sudo systemctl start kledingkast
```

Een paar seconden offline, en je hebt een kopie waar je echt op kunt
terugvallen. Zet dit in een cron-taak; dit is het enige in het hele project wat
niet opnieuw te maken is.

## Wat er nog niet in zit

Eerlijk, zodat je niet voor verrassingen komt te staan:

* **E-mail wordt niet gecontroleerd.** Iemand kan zich met een verzonnen
  adres aanmelden. Voor een wachtwoord-vergeten-knop is een mailer nodig.
* **Meldingen gaan naar de database, niet naar jou.** Drie verschillende
  melders halen een look automatisch uit de feed; verder kijken doe je zelf
  in `kast.db`.
* **Foto's worden niet gekeurd.** Zodra er vreemden meedoen wil een winkel
  (en de wet) dat je daar iets mee kunt.
