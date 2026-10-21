# SnupLive

Køb brugt live: sælgeren viser tingene frem på video, køberne chatter med og snupper med ét tryk.
Det, der ikke bliver snuppet, kan købes bagefter til fast pris. Det hele kører i browseren på snuplive.dk.

## Hvad virker nu?

- Login med e-mail (link eller kode, ingen adgangskode)
- Profil med brugernavn og en fast side pr. sælger: `snuplive.dk/live/brugernavn`
- Sælgere opretter shows, lægger ting i køen og går live med kamera og mikrofon fra studiet
- Seerne ser videoen live, chatter og snupper. Den første, der trykker, får tingen
- Lynrunder på 10 sekunder
- "Live nu" med alle live-shows og et program over kommende shows
- "Mine snup" for købere og en salgsoversigt for sælgere
- SEO-sider: forside, Sælg live, Sådan virker det, FAQ (med FAQ-schema), sitemap og robots.txt
- Profilbilleder og live-billeder fra kameraet på kortene under Live nu
- Betaling med MobilePay og kort via Stripe. Pengene holdes tilbage, til køberen har fået sine ting, og går derefter til sælgerens bankkonto
- Fragt til DAO- og GLS-pakkeshops med fragtlabels og sporing via Shipmondo
- Moderation i chatten (fjern beskeder, blokér brugere) og "Meld et problem" på ordrer med en admin-side til sager
- Backoffice på /admin med tal, ordrer, medlemmer og shows
- En forside til købere, fem kategorier (`/kategori/...`) og en side for hver ting (`/ting/...`) med billeder, beskrivelse og pris
- "Husk mig" på ting og shows før showet (mail, når showet starter) og "Køb nu" til fast pris for det, der ikke blev solgt
- Budsalg live: 30 sekunder, faste budtrin og 10 sekunder ekstra ved sene bud. "Kommende budsalg" på forsiden

MitID kommer senere (se nederst).

## Det skal du bruge

| Tjeneste | Til | Pris i beta |
| --- | --- | --- |
| GitHub | Koden (dette repo) | Gratis |
| Supabase | Database, login og realtid | Gratis plan |
| LiveKit Cloud | Video | Gratis plan |
| Stripe | Betaling og udbetaling til sælgere | Gratis at oprette. Gebyr pr. betaling |
| Shipmondo | Pakkeshops, fragtlabels og sporing | Gratis plan. Du betaler pr. label |
| Resend | Login-mails fra snuplive.dk | Gratis op til 3.000 mails om måneden |
| Vercel | Hosting af siden | Hobby er gratis, men kun til ikke-kommerciel brug. Skift til Pro, før I tager penge |
| Simply | Domænet snuplive.dk | Har du allerede |

> Læg aldrig nøgler i chatten, i koden eller i GitHub. De skal kun ind i Vercel (og i `.env.local` på din egen computer).

---

## Trin 1: Opret databasen i Supabase

1. Gå til [supabase.com](https://supabase.com), log ind med GitHub, og tryk **New project**.
   - Navn: `snuplive`
   - Region: en region i EU. **West EU (Ireland)** er fint, og det samme er Stockholm eller Frankfurt, hvis de kan vælges.
     Data bliver i EU, og forskellen i hastighed fra Danmark er så lille, at brugerne ikke mærker den.
   - Gem database-adgangskoden i din password manager.
2. Når projektet er klar: åbn **SQL Editor → New query**, indsæt hele indholdet af
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), og tryk **Run**.
   Der skal stå *Success. No rows returned*. Gør derefter det samme med
   [`supabase/migrations/0002_billeder.sql`](supabase/migrations/0002_billeder.sql) (profilbilleder og live-billeder).
   Nye SQL-filer i `supabase/migrations` skal altid køres i Supabase, *før* den nye version lægges op på Vercel.
3. **Authentication → URL Configuration**
   - Site URL: `https://snuplive.dk`
   - Redirect URLs (tilføj alle tre):
     - `https://snuplive.dk/**`
     - `https://*.vercel.app/**` (så test-versioner fra Vercel også kan logge ind)
     - `http://localhost:3000/**` (til udvikling på din egen computer)
4. **Login-mails kan vente.** Med Supabase' egen mail kan du allerede logge ind selv: tryk på linket i mailen
   i den samme browser, som du bad om det i. Mailen er på engelsk og har ingen kode, men det er fint til at teste.
   Før andre skal logge ind, skal du sætte din egen mailafsender op (Supabase sender kun til dit eget team og kun få mails i timen):
   1. Opret en gratis konto hos [Resend](https://resend.com). Gratis-planen giver 3.000 mails om måneden (100 om dagen).
   2. Tilføj domænet `snuplive.dk` i Resend, og opret de DNS-poster, Resend viser, hos Simply. Vent, til Resend skriver *Verified*.
   3. Lav en API-nøgle i Resend.
   4. I Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
      - Sender email: `login@snuplive.dk`, Sender name: `SnupLive`
      - Host: `smtp.resend.com`, Port: `465`, Username: `resend`, Password: API-nøglen fra Resend
   5. Sæt grænsen under **Authentication → Rate Limits** op, fx 30 mails i timen.
5. **Authentication → Emails → Templates** (kan først rettes, når custom SMTP er slået til). Ret både **Confirm signup**
   og **Magic Link**, så mailen er på dansk og indeholder både en kode og et link, der virker på alle enheder:

   Emne: `Log ind på SnupLive`

   ```html
   <h2>Log ind på SnupLive</h2>
   <p>Din kode er: <strong style="font-size:22px;letter-spacing:2px">{{ .Token }}</strong></p>
   <p>Eller tryk her for at logge ind:</p>
   <p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Log ind på SnupLive</a></p>
   <p>Har du ikke bedt om at logge ind, kan du se bort fra mailen.</p>
   ```
6. **Project Settings → API Keys**: her finder du **Project URL** og **Publishable key**.
   Dem skal du bruge i trin 3. Brug aldrig *secret*- eller *service_role*-nøglen i SnupLive.

## Trin 2: Opret video i LiveKit Cloud

1. Gå til [cloud.livekit.io](https://cloud.livekit.io), opret en konto og et projekt, der hedder `snuplive`.
2. Åbn **Settings → API Keys → Create key**. Du får tre værdier:
   - **URL** (starter med `wss://`)
   - **API Key**
   - **API Secret** (vises kun én gang: sæt den direkte ind i Vercel i trin 3)

## Trin 3: Læg siden op på Vercel

1. Gå til [vercel.com](https://vercel.com), log ind med GitHub, og tryk **Add New → Project**.
2. Vælg repoet `cspedersen93/snuplive` og tryk **Import**. Vercel finder selv ud af, at det er Next.js.
3. Åbn **Environment Variables**, og tilføj disse seks (til Production, Preview og Development):

   | Navn | Værdi |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL fra Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key fra Supabase |
   | `LIVEKIT_URL` | URL fra LiveKit (`wss://…`) |
   | `LIVEKIT_API_KEY` | API Key fra LiveKit |
   | `LIVEKIT_API_SECRET` | API Secret fra LiveKit |
   | `NEXT_PUBLIC_SITE_URL` | `https://snuplive.dk` |

   **Vigtigt om typen:** de tre, der starter med `NEXT_PUBLIC_`, skal have typen **Config**. De skal bruges i browseren,
   og Vercel bygger ikke værdier af typen *Secret* ind i siden. De tre `LIVEKIT_`-variabler skal være **Secret**.
   En gemt Secret kan ikke laves om til Config, så slet den og opret den igen, hvis typen er forkert.

4. Tryk **Deploy**. Efter et par minutter får du en adresse som `snuplive.vercel.app`.
5. Under **Settings → Functions → Function Region** vælger du den region, der ligger tættest på databasen:
   **Dublin (dub1)**, hvis Supabase ligger i Irland (Stockholm (arn1) til Stockholm, Frankfurt (fra1) til Frankfurt).
   Det gør siden hurtigere, fordi serveren og databasen taler sammen mange gange pr. side.

Retter du en nøgle senere, skal du trykke **Redeploy**, før ændringen virker.

## Trin 4: Peg snuplive.dk på Vercel

1. I Vercel: **Settings → Domains → Add**, skriv `snuplive.dk`, og tilføj også `www.snuplive.dk`
   (vælg, at www sender videre til snuplive.dk).
2. Vercel viser nu de DNS-poster, der skal oprettes (typisk en **A-post** for `snuplive.dk` og en **CNAME-post** for `www`).
3. Log ind hos Simply, åbn DNS-indstillingerne for snuplive.dk, og opret præcis de poster, Vercel viser.
   Slet eventuelle gamle A-poster for `@`, der peger andre steder hen.
4. Når Vercel viser **Valid Configuration**, er siden live på snuplive.dk med HTTPS. Det tager typisk fra få minutter til et par timer.

## Trin 5: Test det hele

1. Åbn snuplive.dk på computeren, tryk **Log ind**, og skriv din e-mail. Log ind med koden eller linket.
2. Gå til **Min konto**, ret dit brugernavn, og tryk **Bliv sælger**.
3. Opret et show, og læg 3–4 ting i køen.
4. Tryk **Tænd kameraet** i studiet, og giv browseren lov til kamera og mikrofon. Tryk **Gå live**.
5. Åbn `snuplive.dk/live/dit-brugernavn` på telefonen (eller bed en ven om det). Videoen skal vise dig.
6. Tryk **Vis næste** i studiet, og snup tingen fra telefonen. Prøv chatten og en lynrunde.
7. Tryk **Afslut show**. Salget står nu under **Mine shows** og hos køberen under **Mine snup**.

---

## Betaling med Stripe

Køberen betaler alt i kurven på én gang med MobilePay, kort, Apple Pay eller Google Pay. Pengene står hos SnupLive,
indtil køberen trykker "Jeg har fået mine ting" (eller automatisk 7 dage efter, at sælgeren har markeret pakken som sendt).
Så sendes beløbet for tingene til sælgerens Stripe-konto (og fragten, hvis sælgeren selv har sendt pakken uden SnupLives label).
SnupLive beholder køberbeskyttelsen (5 % + 5 kr pr. pakke).

Start i Stripes **testmiljø**. Det kræver hverken CVR eller bankkonto, og der bliver ikke flyttet rigtige penge.

1. **Supabase → SQL Editor:** kør [`supabase/migrations/0003_betaling.sql`](supabase/migrations/0003_betaling.sql).
2. **Stripe (testmiljø):**
   - **Connect → Get started:** vælg platform/marketplace, hvor sælgere får udbetalt.
   - **Settings → Developers → API policies:** slå **Accounts v1 support** til. SnupLive opretter sælgernes
     udbetalingskonti med den version af Stripes API, og nye Stripe-konti har den slået fra.
   - **Settings → Payment methods:** slå **MobilePay** til (kort, Apple Pay og Google Pay er slået til i forvejen).
   - **Settings → Payouts:** sæt SnupLives egne udbetalinger til **manuelt** eller **ugentligt**, så der altid er penge til at betale sælgerne.
   - **Developers → API keys:** kopiér **Secret key** (`sk_test_…`).
   - **Developers → Webhooks → Add destination:**
     - *Events from:* **Your account**. Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
       `checkout.session.async_payment_failed`, `checkout.session.expired`.
     - *Endpoint URL:* `https://snuplive.dk/api/stripe/webhook`. Kopiér **Signing secret** (`whsec_…`).
     - Lav en destination mere med *Events from:* **Connected accounts**, event `account.updated`, samme URL.
       Kopiér også dens signing secret.
3. **Vercel → Environment Variables** (alle af typen **Secret**):

   | Navn | Værdi |
   | --- | --- |
   | `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → Secret key (`sb_secret_…`) |
   | `STRIPE_SECRET_KEY` | Stripe Secret key (`sk_test_…`) |
   | `STRIPE_WEBHOOK_SECRET` | Signing secret fra destinationen "Your account" |
   | `STRIPE_CONNECT_WEBHOOK_SECRET` | Signing secret fra destinationen "Connected accounts" |
   | `CRON_SECRET` | Et langt, tilfældigt kodeord (fx 40 tegn fra din password manager) |

4. **Deploy** en ny version af `main`. Vercel kører nu `/api/cron/daily` én gang i døgnet (se `vercel.json`). Jobbet afslutter
   gamle ordrer, sender ventende udbetalinger og annullerer snup, der ikke er betalt efter 3 dage.
5. **Test:**
   - Som sælger: gå til **Mine shows → Tilknyt udbetaling**. I testmiljøet har Stripe knapper til at udfylde med testdata.
   - Som køber (en anden konto): snup noget, gå til **Mine snup**, og betal med kortnummer `4242 4242 4242 4242`.
   - Som sælger: markér pakken som sendt. Som køber: tryk **Jeg har fået mine ting**. Overførslen kan ses i Stripe under **Connect → Transfers**.

**Før rigtige penge:** aktivér Stripe-kontoen med virksomhedsoplysninger (CVR og bankkonto), skift til de rigtige nøgler
(`sk_live_…` og nye webhook-secrets), tjek at **Accounts v1 support** også er slået til uden for testmiljøet, opgrader Vercel til Pro, og få en revisor til at se på moms af køberbeskyttelsen.

## Fragt med Shipmondo

Køberen vælger en **DAO- eller GLS-pakkeshop** i kurven og betaler 49 kr i fragt pr. pakke (op til 5 kg). Sælgeren trykker
**Lav fragtlabel** under Mine shows, printer labelen og afleverer pakken. SnupLive betaler labelen hos Shipmondo med de penge,
køberen har betalt i fragt, og sælgeren får beløbet for tingene. Sporingen kommer fra Shipmondo, så ordren skifter selv til
"Sendt", når pakken bliver scannet, og afsluttes 2 dage efter, at køberen har hentet den.

Uden Shipmondo-nøgler virker siden som før: køberen vælger ikke pakkeshop, og sælgeren sender selv og får fragten.

1. **Supabase → SQL Editor:** kør [`supabase/migrations/0004_fragt.sql`](supabase/migrations/0004_fragt.sql).
2. **Shipmondo:**
   - Opret en gratis konto på [shipmondo.com](https://shipmondo.com) (planen **Free** er nok).
   - Skriv til Shipmondos support og bed om en **testkonto (sandbox)**: dit navn, din e-mail, adresse og land, sprog (dansk)
     og grunden ("tester integration til markedsplads"). Du får login til `sandbox.shipmondo.com` på mail.
   - Log ind på testkontoen → **Indstillinger → API → Adgang**. Kopiér **API-bruger** og **API-nøgle**.
3. **Vercel → Environment Variables** (alle af typen **Secret**):

   | Navn | Værdi |
   | --- | --- |
   | `SHIPMONDO_API_USER` | API-brugeren fra Shipmondo |
   | `SHIPMONDO_API_KEY` | API-nøglen fra Shipmondo |
   | `SHIPMONDO_SANDBOX` | `1` (så længe du bruger testkontoen) |

4. **Deploy** en ny version af `main`. Første gang en sælger laver en label, opretter SnupLive selv webhooken til sporing hos
   Shipmondo (du kan se den under Indstillinger → Webhooks som "SnupLive sporing").
5. **Test:**
   - Som køber: snup noget, gå til **Mine snup**, skriv dit postnummer, vælg DAO eller GLS og en pakkeshop, og betal.
   - Som sælger: udfyld **Fragt og afsenderadresse** under Mine shows, og tryk **Lav fragtlabel** på ordren. Labelen er mærket
     "SANDBOX" og kan ikke bruges.

**Før rigtige labels:** tilknyt et betalingskort i din rigtige Shipmondo-konto (labels betales løbende), lav nye API-nøgler
dér, skift `SHIPMONDO_API_USER` og `SHIPMONDO_API_KEY` i Vercel, og slet `SHIPMONDO_SANDBOX`.

## Tryghed: moderation og "Meld et problem"

- **Moderation:** sælgeren kan fjerne beskeder i chatten og blokere brugere (menuen ⋯ ved hver besked i studiet eller på sin
  egen showside). En blokeret bruger kan hverken skrive eller snuppe i sælgerens shows. Blokeringer kan fjernes under Mine shows.
  Alle kan fjerne deres egne beskeder.
- **Meld et problem:** køberen kan melde et problem på en ordre under Mine snup, så længe den ikke er afsluttet. Så holdes
  pengene tilbage (ordren afsluttes ikke automatisk), sælgeren kan se det, og du får en mail. Du afgør sagen på
  [snuplive.dk/admin/sager](https://snuplive.dk/admin/sager): refundér køberen, send pengene til sælgeren, eller luk sagen.

1. **Supabase → SQL Editor:** kør [`supabase/migrations/0005_tryghed.sql`](supabase/migrations/0005_tryghed.sql).
2. **Vercel → Environment Variables** (typen **Secret**):

   | Navn | Værdi |
   | --- | --- |
   | `ADMIN_EMAILS` | Den e-mail, du logger ind på SnupLive med (flere adskilt med komma) |
   | `RESEND_API_KEY` | Valgfri. Resend → **API Keys → Create API key** med *Sending access* til snuplive.dk. Uden den bliver der ikke sendt mails om nye sager, men de står stadig på /admin |

3. **Deploy**, log ind med din admin-e-mail, og gå til **Min konto**. Der står, hvor mange sager der venter.

## Ting, kategorier, "Husk mig" og "Køb nu"

1. **Supabase → SQL Editor:** kør [`supabase/migrations/0007_varer.sql`](supabase/migrations/0007_varer.sql), **før** den nye
   version kommer på Vercel. Ellers kan show- og studiesiderne ikke hentes. Har du ikke kørt 0005 og 0006 endnu, så kør dem først.
   Filen kan køres igen uden at gøre skade.
2. Der er ikke nogen nye nøgler. Mails om "Husk mig" bruger den samme `RESEND_API_KEY` som sagerne. Uden den bliver der ikke
   sendt mails, men alt andet virker.

Sådan virker det:

- **Kategorier:** Dametøj, sko og tasker · Herretøj og sneakers · Børnetøj og legetøj · Bolig og design · Samleobjekter · Andet. I databasen hedder Samleobjekter stadig `samlerting`, og /kategori/samlerting sendes videre til /kategori/samleobjekter.
  Gamle shows bliver flyttet over automatisk (tøj og overtøj til dametøj, denim til herretøj, vinyl til samlerting, design til bolig).
- **Før showet:** sælgeren kan give hver ting op til 4 billeder, en beskrivelse og en anden kategori end showets
  (under "+ Billeder, beskrivelse og kategori" i studiet). Tingene kan ses på forsiden, i kategorien og på deres egen side.
  Køberne kan trykke **Husk mig** på en ting eller et show. Når sælgeren går live, får de én mail.
- **Under showet** tager studiet selv et billede fra kameraet, når en ting bliver vist, og lægger det på tingen.
- **Efter showet** kommer alt, der ikke blev snuppet, til salg til den samme pris. Køberen trykker **Køb nu**, og tingen lander under
  Mine snup. Sælgeren kan rette prisen eller tage en ting af salg under **Mine shows → Til salg**. Bliver et snup ikke betalt, eller
  annullerer sælgeren det, kommer tingen til salg igen. Refunderede ting skal sælgeren selv sætte til salg igen.
- **Én pakke pr. sælger:** alt, køberen har købt hos samme sælger, betales og sendes samlet, også når det er fra flere shows.

## Budsalg

1. **Supabase → SQL Editor:** kør [`supabase/migrations/0008_budsalg.sql`](supabase/migrations/0008_budsalg.sql), **før** den nye
   version kommer på Vercel (0007 skal være kørt først). Filen kan køres igen uden at gøre skade. Der er ingen nye nøgler.

Sådan virker det:

- **I studiet** vælger sælgeren *Fast pris* eller *Budsalg* på hver ting. Ved budsalg er prisen startprisen.
- **Live:** sælgeren viser tingen frem og trykker **Start budsalg 30 s**. Køberne trykker **Byd**, som altid byder næste trin:
  5 kr under 100 kr, 10 kr op til 500 kr, 25 kr op til 1.000 kr og 50 kr derover. Man kan ikke byde over sig selv.
  Kommer der et bud i de sidste 10 sekunder, står uret på 10 igen. Næste ting kan først vises, når budsalget er slut.
- **Når uret står på 0**, lukker studiet budsalget. Det højeste bud bliver til et snup i køberens Mine snup til buddets pris,
  og vinderen står i chatten. Afslutter sælgeren showet midt i et budsalg, vinder det højeste bud.
- **Ingen bud:** tingen kommer til salg til startprisen med Køb nu, når showet slutter.
- Alt det, der afgør et budsalg (tid, trin, vinder), sker i databasen, så det er det samme for alle, og ingen kan snyde.
  Alle bud gemmes i tabellen `bids`.

## Backoffice

På [snuplive.dk/admin](https://snuplive.dk/admin) (kun for e-mails i `ADMIN_EMAILS`) er der:

- **Overblik:** omsætning, din indtjening (køberbeskyttelse og fragt minus labels, før Stripes gebyrer og moms), udbetalt til
  sælgere, penge der holdes tilbage, refunderinger, medlemmer, sælgere, shows og solgte ting for 7 dage, 30 dage, 90 dage, i år
  eller altid, plus en graf pr. dag, uge eller måned, de sælgere der har solgt mest, nyeste medlemmer og seneste ordrer.
- **Sager**, **Ordrer** (med filtre), **Medlemmer** (søg på brugernavn, navn eller e-mail, og se køb, salg og shows for hver)
  og **Shows**.

Kør [`supabase/migrations/0006_backoffice.sql`](supabase/migrations/0006_backoffice.sql) i Supabase først. Filen retter også en
fejl, så en ting, der er blevet annulleret eller refunderet, kan snuppes igen.

## Klar til lancering: vilkår, sælgertype, anmeldelser, bedømmelser og Skat

1. **Supabase → SQL Editor:** kør [`supabase/migrations/0009_lancering.sql`](supabase/migrations/0009_lancering.sql), **før** den
   nye version kommer på Vercel (0008 skal være kørt først). Ellers virker Mine snup og Bliv sælger ikke. Filen kan køres igen.
2. **Når selskabet har et CVR-nummer**, så opret tre variabler i Vercel med typen **Config**, og tryk **Redeploy**:

   | Navn | Værdi |
   | --- | --- |
   | `NEXT_PUBLIC_COMPANY_NAME` | `SnupLive ApS` |
   | `NEXT_PUBLIC_COMPANY_CVR` | CVR-nummeret (8 cifre) |
   | `NEXT_PUBLIC_COMPANY_ADDRESS` | Selskabets adresse |

   Indtil da står der *SnupLive ApS (under stiftelse)* på siden og i vilkårene.

Det er nyt:

- **Handelsbetingelser, vilkår og Om SnupLive** på `/handelsbetingelser`, `/vilkaar` og `/om-snuplive`, linket fra bunden af
  alle sider, fra login og fra betalingen.
- **Privat eller erhverv:** man vælger, når man bliver sælger, og kan skifte under Min konto. En erhvervssælger skriver
  firmanavn og CVR. Køberne ser det ved hver ting og hvert show sammen med, om fortrydelsesretten gælder. Køb fra en
  erhvervssælger kan fortrydes med *Meld et problem*. Sælgere fra før skal bekræfte under Min konto.
- **Anmeld** på ting, shows og profiler, også uden login. Du får en mail, og afgør dem under **Backoffice → Anmeldelser**:
  fjern tingen, fjern showet, luk sælgerkontoen eller afvis. Sælgeren får begrundelsen på mail, og den, der anmeldte, får
  besked om afgørelsen.
- **Bedømmelser:** når en ordre er afsluttet, kan køberen give sælgeren 1–5 stjerner under Mine snup. Gennemsnittet står ved
  sælgeren, og de nyeste bedømmelser står på sælgerens side.
- **Backoffice → Skat:** salg pr. sælger og kvartal til indberetningen til Skattestyrelsen (DAC7). Sælgere med mindst 30
  salg eller salg for mindst 2.000 euro er markeret. Hent listen som CSV-fil. Indberetningen skal ind senest 31. januar.
- **Sådan sorterer vi** står på `/saadan-virker-det#sortering` og er linket fra listerne og fra bunden af siden.

---

## Udvikling på din egen computer

```bash
npm install
cp .env.example .env.local   # udfyld med dine egne nøgler
npm run dev                  # http://localhost:3000
```

Kameraet virker kun på `localhost` eller over HTTPS.

## Test af databasen

Adgangsreglerne og live-funktionerne har deres egne tests i `supabase/tests`. De kræver en lokal Postgres:

```bash
PGHOST=localhost PGPORT=5432 ./supabase/tests/run.sh
```

Testene tjekker blandt andet, at kun sælgeren kan styre sit show, at ingen kan skrive i andres navn i chatten,
at man ikke kan snuppe sine egne ting, at en lynrunde lukker til tiden, at kun én får tingen, når to trykker samtidig,
og at kun ét bud går igennem, når to byder det samme på samme tid.

## Sådan hænger det sammen

```
Browser ──► Vercel (Next.js 16)
   │           ├─ sider og SEO (server-renderet)
   │           └─ /api/livekit-token: giver videoadgang (sælger må sende, seere må se)
   │
   ├──► Supabase: login, database (Postgres + RLS) og realtid (chat, snup, "vises nu")
   └──► LiveKit: video fra sælgerens kamera til seerne
```

- `app/` sider og API. `app/live/[handle]` er seersiden, `app/studio/[id]` er studiet.
- `components/` fælles dele (chat, video, header, realtid).
- `supabase/migrations/0001_init.sql` hele databasen: tabeller, adgangsregler og funktionerne
  `set_show_status`, `present_item`, `start_rush` og `snup`. De senere filer bygger videre (billeder, betaling, fragt,
  tryghed, backoffice, `0007_varer.sql` med `buy_now`, `items_feed` og påmindelser, og `0008_budsalg.sql` med
  `start_auction`, `place_bid` og `close_auction`).

Al logik, der skal være til at stole på (hvem der fik tingen, om lynrunden er slut, hvem der må styre et show),
ligger i databasen. Browseren kan ikke snyde sig udenom.

## Næste trin

1. **Forhåndsbud og maks-bud, følg sælgere og lukkede shows** (kun med et hemmeligt link).
2. **MitID** for sælgere via Idura (kræver CVR). Siden lover, at det er slået til inden lanceringen.
3. **Shipmondo**, Stripe med rigtige penge og Vercel Pro, når CVR-nummeret er på plads.
4. **PostNord** som tredje fragtfirma, hvis køberne efterspørger det.

Husk også at oprette mailadressen `kontakt@snuplive.dk`, som privatlivspolitikken henviser til. 
