# Kledingkast in de App Store en de Play Store

De app is webtechniek (HTML, CSS, JS) zonder build-stap. Capacitor stopt die
in een echte iOS- en Android-app: dezelfde code, maar met een eigen icoon op
je beginscherm, een plek in de winkel, en toegang tot de camera.

Deze map bevat alles wat ik kon klaarzetten. Wat ik **niet** kon doen staat
onderaan onder "Wat jij zelf moet doen" — daar zitten dingen bij die geld
kosten of een Mac vereisen.

---

## Eerst even kijken hoe het is

Voordat je hier geld en accounts in steekt: je kunt de app nu al op je telefoon
bekijken. Op je eigen computer, in de map van dit project:

```sh
node server/server.js
```

Die vertelt zelf op welk adres je telefoon hem kan vinden. Tik dat in, zet hem
op je beginscherm, en je hebt precies wat er straks in de winkel komt — alleen
zonder de winkel. Zie `server/README.md`.

## Eenmalig klaarzetten

```sh
cd mobiel
npm install
```

Kijk eerst even of er een nieuwere Capacitor is dan wat er in `package.json`
staat:

```sh
npm view @capacitor/core version
```

Is dat een hogere hoofdversie (bijvoorbeeld 8 in plaats van 7), werk dan alle
`@capacitor/*`-regels in `package.json` bij naar diezelfde versie. Ze moeten
altijd bij elkaar passen.

Zet daarna je eigen app-id in `capacitor.config.json`. Nu staat er
`nl.kledingkast.app`; dat moet een adres zijn dat van jou is, omgedraaid —
bijvoorbeeld `nl.sinan.kledingkast`. **Dit kun je na de eerste publicatie
nooit meer veranderen**, dus kies hem met aandacht.

Dan de twee projecten aanmaken:

```sh
npx cap add ios       # kan alleen op een Mac
npx cap add android
```

Die maken de mappen `ios/` en `android/`. Die horen wél in git: er komen
instellingen in te staan die je later terug wilt kunnen vinden.

## Elke keer als de app verandert

```sh
KAST_API=https://kast.jouwdomein.nl npm run sync
```

`bouw.js` kopieert `kledingkast-online/` naar `www/` en bakt het serveradres
erin. In de browser vindt de app de server vanzelf op localhost, maar op een
telefoon bestaat localhost niet — daarom moet het adres erin.

Daarna openen in Xcode of Android Studio:

```sh
npm run ios         # opent Xcode
npm run android     # opent Android Studio
```

## Nog in te stellen in de projecten

Deze staan niet in code omdat ze in de native projecten horen die pas na
`cap add` bestaan.

**iOS — `ios/App/App/Info.plist`.** Zonder deze twee regels weigert Apple de
app, want hij vraagt om foto's:

```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>Om foto's van je kleding aan je kast toe te voegen.</string>
<key>NSCameraUsageDescription</key>
<string>Om een foto te maken van een kledingstuk.</string>
```

**Android — `android/app/src/main/AndroidManifest.xml`:**

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
```

**Iconen.** In `kledingkast-online/` staan `icon.svg`, `icon-192.png` en
`icon-512.png`. Voor de winkels heb je grotere nodig:

* iOS: één PNG van 1024×1024 **zonder doorzichtigheid** (Xcode → Assets →
  AppIcon)
* Android: Android Studio → rechtermuisknop op `res` → New → Image Asset,
  daar `icon.svg` in laden
* Play Store zelf: 512×512 PNG, plus een banner van 1024×500

---

## Wat jij zelf moet doen

Dit kan ik niet voor je regelen. Geen enkele hoeveelheid code helpt hier —
het zijn accounts, betalingen en formulieren op jouw naam.

### 1. Ontwikkelaarsaccounts

| winkel | kosten | bijzonderheden |
|--------|--------|----------------|
| Apple Developer Program | ± €99 per jaar, doorlopend | identiteitscontrole; bedrijf? dan ook een D-U-N-S-nummer |
| Google Play Console | eenmalig $25 | identiteitscontrole met legitimatie en adres |

Let op bij Google: een **persoonlijk** account dat je nu aanmaakt moet eerst
een gesloten test draaien met **minstens 12 testers die 14 dagen aaneen
meedoen** voordat je de app openbaar mag zetten. Reken daar dus twee weken
extra voor, en verzamel alvast twaalf mensen.

### 2. Een Mac voor de iOS-kant

Xcode draait alleen op macOS, en zonder Xcode kun je geen iOS-app
ondertekenen of uploaden. Geen Mac in huis? Dan kan het via een gehuurde Mac
in de cloud (MacStadium, Codemagic) of via de Mac van iemand die je kent.
Android kun je gewoon op Windows of Linux doen.

### 3. Een server met een eigen adres

De community draait op `server/`. Die moet ergens staan waar hij altijd
bereikbaar is, op **https** — beide winkels weigeren gewone http. Zie
`server/README.md`. Reken op een paar euro per maand.

Het adres dat je daar kiest vul je in bij `KAST_API` (hierboven).

### 4. Een privacyverklaring op een webadres

Verplicht, bij allebei. De app maakt accounts aan en bewaart foto's, dus je
moet vertellen wat je met die gegevens doet. In `privacyverklaring.md` staat
een tekst die klopt met wat de app en de server echt doen — vul je naam en
e-mailadres in en zet hem online (een simpele pagina is genoeg; GitHub Pages
kan het gratis).

### 5. Formulieren invullen

* **Apple:** App Privacy (welke gegevens je verzamelt), leeftijdsclassificatie
* **Google:** Data safety, inhoudsclassificatie, doelgroep
* Beide: schermafbeeldingen, een korte en een lange omschrijving, een
  contactadres

Wat je in die formulieren moet aanvinken, in het kort: e-mailadres (voor het
account), foto's en gebruikersinhoud. Niets daarvan gaat naar een derde
partij, er zitten geen advertenties in en er wordt niet gevolgd.

### 6. Beoordeling

Apple kijkt er met een mens naar; reken op een paar dagen, en op de kans dat
je iets moet aanpassen. Google is meestal sneller, maar bij een eerste app
kan het ook dagen duren.

---

## Wat er al in zit omdat de winkels het eisen

Bij een app waar mensen elkaars foto's zien let Apple (richtlijn 1.2) en
Google hier streng op. Dit zit er daarom al in:

* **Melden** — elke look van iemand anders heeft een meldknop
* **Automatisch weghalen** — drie meldingen van verschillende mensen halen een
  look meteen uit de feed
* **Blokkeren** — je kunt iemand verbergen; je ziet dan niets meer van die
  persoon, en hij of zij merkt daar niets van
* **Account verwijderen in de app zelf** — inclusief je looks en je back-up

Wat er nog **niet** in zit en waar je zelf iets voor moet regelen:

* **Binnen 24 uur reageren op meldingen.** Dat is de eis. Meldingen komen in
  de tabel `meldingen` in `kast.db`; er is nog geen schermpje voor. Zolang het
  om een handvol mensen gaat kun je in de database kijken; groeit het, dan is
  een simpel beheerpagina'tje het eerste wat je erbij wilt.
* **Een contactadres dat werkt.** Zet er een e-mailadres bij dat je ook echt
  leest.
* **E-mailadressen worden niet gecontroleerd.** Iemand kan zich met een
  verzonnen adres aanmelden, en wachtwoord-vergeten bestaat nog niet. Daar is
  een mailprovider voor nodig (Postmark, Resend, of SMTP van je eigen
  provider).
