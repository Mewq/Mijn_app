# Kledingkast Online — bouwplan

Dit is een kopie van `kledingkast/` als startpunt voor de versie mét server: een
echte app die je kunt delen, met een gedeelde inspiratiefeed. De lokale app in
`kledingkast/` blijft ongemoeid werken; die twee lopen vanaf hier uit elkaar.

De kopie heeft al eigen opslagnamen (`kledingkast-online` in IndexedDB, eigen
localStorage-sleutels, eigen service-worker-cache). Dat moest, want als beide
versies vanaf hetzelfde adres draaien delen ze anders elkaars opslag.

---

## 1. Wat verandert er principieel

De huidige app heeft één eigenschap die alles simpel houdt: **er is geen ander**.
Geen accounts, geen netwerk, geen mensen die iets kunnen zien wat niet van hen is.
Zodra er een gedeelde feed komt, vervalt dat, en dan komen er dingen bij die niets
met kleding te maken hebben:

| Nu | Straks |
| --- | --- |
| Alles lokaal, geen account | Inloggen, want een like moet aan iemand hangen |
| Foto's als blob in de browser | Foto's op een server, met een publieke URL |
| Kapot = jouw kast weg | Kapot = ieders kast weg; back-ups zijn nu jouw taak |
| Niemand ziet iets | Publieke content: melden, verwijderen, misbruik |
| Gratis | Hosting, opslag en bandbreedte kosten geld |

Dat is geen reden om het niet te doen, maar het is wel de helft van het werk.

---

## 2. Wat blijft lokaal

Niet alles hoeft naar de server, en dat is een keuze die je maar één keer goed
hoeft te maken. Mijn voorstel:

- **Lokaal blijft**: je hele kast (kledingstukken, foto's, outfits, mappen,
  agenda, wasmand, doneerstapel, de cijfers van Askim, de temperaturen). Dat is
  privé, groot in megabytes, en het werkt nu al zonder internet.
- **Naar de server gaat**: alleen een **look** die je zelf publiceert — de
  losgeweekte kopie die de app al maakt, met foto's, en de winkellinks eronder.
  Plus wie hem plaatste, likes en meldingen.

Voordelen: de app blijft offline werken, je uploadt nooit per ongeluk je hele
kast, de opslagkosten blijven laag, en de privacyvraag wordt klein en uitlegbaar.

---

## 3. Datamodel op de server

```
users
  id            uuid
  handle        text uniek      -- @sinan
  naam          text
  avatar_url    text null
  created_at    timestamptz
  geblokkeerd   bool

looks
  id            uuid
  user_id       uuid -> users
  naam          text
  notitie       text
  occasion      text null
  seasons       text[]
  cover_url     text null
  status        text            -- 'zichtbaar' | 'verborgen' | 'gemeld'
  likes_count   int             -- bijgehouden, niet elke keer geteld
  created_at    timestamptz

look_items                      -- de losgeweekte kledingstukken
  id            uuid
  look_id       uuid -> looks
  positie       int
  naam          text
  categorie     text
  kleuren       text[]
  merk          text null
  link          text null       -- de winkellink; alleen http(s)
  foto_url      text null

likes
  user_id       uuid
  look_id       uuid
  created_at    timestamptz
  primary key (user_id, look_id)

saves                           -- "bewaard als inspiratie"
  user_id, look_id, created_at
  primary key (user_id, look_id)

meldingen
  id, look_id, user_id, reden, created_at, afgehandeld
```

Indexen die je meteen nodig hebt: `looks(created_at desc)` voor de feed,
`looks(user_id)` voor een profiel, en `look_items(look_id)`.

---

## 4. Endpoints

```
POST   /auth/magic-link          e-mail erin, inloglink eruit
POST   /auth/verify              token -> sessie

GET    /feed?cursor=&occasion=&season=&color=
                                 pagina van 20 looks, nieuwste eerst
GET    /looks/:id                één look met zijn stukken
POST   /looks                    publiceren (met foto-uploads)
DELETE /looks/:id                alleen je eigen look

POST   /looks/:id/like           idempotent
DELETE /looks/:id/like
POST   /looks/:id/save
DELETE /looks/:id/save
GET    /me/saves                 wat jij bewaarde

POST   /looks/:id/melden         reden erbij
GET    /users/:handle            profiel + zijn looks

POST   /uploads                  foto erin, URL eruit
DELETE /me                       account en alles wat eraan hangt weg
```

Let op bij de feed: **cursor-paginering** op `created_at`, geen `offset`. Met
offset schuift de lijst onder je vingers weg zodra er iemand iets plaatst.

---

## 5. Wat er in de app zelf verandert

1. **Een netwerklaagje** naast `db.js` — `api.js` — dat weet waar de server staat
   en wat te doen als die er niet is.
2. **Inloggen**: een scherm onder Meer. Zonder inloggen werkt alles behalve
   publiceren, liken en bewaren; de feed mag je gewoon lezen.
3. **De inspiratietab wordt twee dingen**: "Ontdek" (van de server) en "Mijn
   looks" (wat je zelf plaatste en bewaarde). De bestaande lokale looks blijven
   werken; een look die je van iemand krijgt via een bestand blijft dus mogelijk.
4. **Publiceren** krijgt er een stap bij: kiezen of hij alleen voor jou is of
   voor iedereen. Met een waarschuwing die eerlijk is — publiek is publiek.
5. **Offline**: de laatst geladen feed in IndexedDB bewaren en die tonen met een
   melding "je bent offline". Liken en publiceren komen in een wachtrij.
6. **Melden en blokkeren** op elke look van iemand anders.

---

## 6. Volgorde van bouwen

Elke stap is los bruikbaar; je kunt na elke stap stoppen en het werkt.

1. **Server met alleen lezen.** Feed en look-detail, gevuld met jouw eigen
   gepubliceerde looks. Nog geen accounts: je ziet of het idee werkt.
2. **Inloggen** met een magic link (geen wachtwoorden om te lekken).
3. **Publiceren en foto-upload**, met een grens op formaat en aantal.
4. **Likes en bewaren.**
5. **Melden, verbergen, blokkeren** — dit is geen extraatje, zie hieronder.
6. **Profielen** en het volgen van iemand.
7. **Offline en wachtrij.**

---

## 7. Waar het geld en het gedoe zit

**Kosten.** Het rekenwerk is klein; de foto's zijn het punt. Reken op ~250 kB per
look. Duizend looks is een kwart gigabyte opslag, en bandbreedte is wat mensen
bekijken. De gratis trappen van de meeste aanbieders zijn ruim genoeg om te
beginnen, en gaan pijn doen rond de tienduizenden actieve gebruikers. Zet vanaf
dag één een limiet op uploads per gebruiker per dag.

**Moderatie.** Zodra vreemden elkaars foto's zien, is een meldknop het minimum,
en moet iemand die meldingen ook echt bekijken — jij dus. Reken ook op de saaie
variant: reclame en spamlinks in de winkellink. Een lijst met toegestane
webshops, of nofollow en een waarschuwingsscherm bij het verlaten van de app.

**Regels.** Voor een app die je in Nederland deelt: een privacyverklaring, een
manier om je account en alles erin te wissen, geen kinderen onder de 16 zonder
toestemming, en een bewaartermijn. De AVG vraagt niet om een advocaat, wel om
opschrijven wat je bewaart en waarom.

**Winkellinks.** Als je hier ooit affiliate-links van wilt maken: dat moet je
zichtbaar melden bij de link. Doe je dat niet, dan is het misleiding.

---

## 8. Keuze van hosting — nog open

Je wist nog niet waar het moet draaien. De keuze is te maken op één vraag: wil je
snel iets werkends, of wil je er zelf de baas over blijven?

| | Supabase / Firebase | Eigen Node-server |
| --- | --- | --- |
| Werkend in | dagen | weken |
| Inloggen, opslag, database | zit erin | zelf bouwen |
| Kosten klein beginnen | gratis trap | ~5–10 euro/maand vanaf dag één |
| Verhuizen later | lastig | makkelijk |
| Wie kan de regels veranderen | zij | jij |

**Mijn advies:** begin met Supabase. Het is Postgres met een randje, dus de
database die je bouwt verhuist later gewoon naar je eigen server als je dat wilt.
Firebase is dat níét — dat is een eigen model waar je moeilijk uit komt. Houd bij
het bouwen één regel aan: alle serverkennis in `api.js`, nergens anders. Dan is
overstappen later één bestand.

---

## 9. Wat ik nodig heb om te beginnen

1. De keuze uit stap 8 (of: "doe maar Supabase").
2. Hoe heet de app naar buiten toe?
3. Publiek of op uitnodiging? Op uitnodiging beginnen scheelt in het begin een
   hoop moderatiewerk, en je kunt later opengooien.
