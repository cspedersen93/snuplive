# Relived

Køb brugt live: sælgeren viser varerne frem på video, køberne chatter med og køber med ét tryk.
Det, der ikke bliver solgt, kan købes bagefter til fast pris. Det hele kører i browseren på relived.dk.

## Hvad virker nu?

- Login med e-mail (link eller kode, ingen adgangskode)
- Profil med brugernavn og en fast side pr. sælger: `relived.dk/live/brugernavn`
- Sælgere opretter shows, lægger varer i køen og går live med kamera og mikrofon fra studiet
- Seerne ser videoen live, chatter og køber. Den første, der trykker, får varen
- Lynrunder på 10 sekunder
- "Live nu" med alle live-shows og et program over kommende shows
- "Mine køb" for købere og en salgsoversigt for sælgere
- SEO-sider: forside, Sælg live, Sådan virker det, FAQ (med FAQ-schema), sitemap og robots.txt
- Profilbilleder og live-billeder fra kameraet på kortene under Live nu
- Betaling med MobilePay og kort via Stripe. Pengene holdes tilbage, til køberen har fået sine varer, og går derefter til sælgerens bankkonto
- Fragt til DAO- og GLS-pakkeshops med fragtlabels og sporing via Shipmondo
- Moderation i chatten (fjern beskeder, blokér brugere) og "Meld et problem" på ordrer med en admin-side til sager
- Backoffice på /admin med tal, ordrer, medlemmer og shows
- En forside til købere, ni kategorier (`/kategori/...`) og en side for hver vare (`/ting/...`) med billeder, beskrivelse og pris
- "Husk mig" på varer og shows før showet (mail, når showet starter) og "Køb nu" til fast pris for det, der ikke blev solgt
- Budsalg live: 30 sekunder, faste budtrin og 10 sekunder ekstra ved sene bud. "Kommende budsalg" på forsiden
- Samlerabat, som sælgeren selv vælger, og bud på varer til fast pris (se *Samlerabat* og *Bud på varer til fast pris*)
- Kategorien Cykler og barnevogne med afhentning hos sælgeren (se *Kategorien Cykler og barnevogne*)
- Én side med det hele for køberne: `/saadan-virker-det` (køb, priser med regneeksempel, fragt, rabat og bud, tryg handel, sælg og sortering). Tallene kommer fra `lib/pricing.ts`, og samlerabat og bud står der først, når 0027 og 0028 er kørt (siden opdateres hvert minut)

MitID er sat på pause, fordi Iduras abonnement er dyrt i starten. Koden er klar (se nederst), og siden lover det ikke længere: Sådan virker det, FAQ, guiden og den engelske side siger i stedet, at sælgerne bekræfter deres identitet hos Stripe, før de får penge udbetalt. Slår I MitID til igen, så ret de tekster tilbage.

## Det skal du bruge

| Tjeneste | Til | Pris i beta |
| --- | --- | --- |
| GitHub | Koden (dette repo) | Gratis |
| Supabase | Database, login og realtid | Gratis plan |
| LiveKit Cloud | Video | Gratis plan |
| Stripe | Betaling og udbetaling til sælgere | Gratis at oprette. Gebyr pr. betaling |
| Shipmondo | Pakkeshops, fragtlabels og sporing | Gratis plan. Du betaler pr. label |
| Resend | Login-mails fra relived.dk | Gratis op til 3.000 mails om måneden |
| Vercel | Hosting af siden | Hobby er gratis, men kun til ikke-kommerciel brug. Skift til Pro, før I tager penge |
| Simply | Domænet relived.dk | Har du allerede |

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
   - Site URL: `https://relived.dk`
   - Redirect URLs (tilføj alle tre):
     - `https://relived.dk/**`
     - `https://*.vercel.app/**` (så test-versioner fra Vercel også kan logge ind)
     - `http://localhost:3000/**` (til udvikling på din egen computer)
4. **Login-mails kan vente.** Med Supabase' egen mail kan du allerede logge ind selv: tryk på linket i mailen
   i den samme browser, som du bad om det i. Mailen er på engelsk og har ingen kode, men det er fint til at teste.
   Før andre skal logge ind, skal du sætte din egen mailafsender op (Supabase sender kun til dit eget team og kun få mails i timen):
   1. Opret en gratis konto hos [Resend](https://resend.com). Gratis-planen giver 3.000 mails om måneden (100 om dagen).
   2. Tilføj domænet `relived.dk` i Resend, og opret de DNS-poster, Resend viser, hos Simply. Vent, til Resend skriver *Verified*.
   3. Lav en API-nøgle i Resend.
   4. I Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
      - Sender email: `kontakt@relived.dk`, Sender name: `Relived`
      - Host: `smtp.resend.com`, Port: `465`, Username: `resend`, Password: API-nøglen fra Resend
   5. Sæt grænsen under **Authentication → Rate Limits** op, fx 30 mails i timen.
5. **Authentication → Emails → Templates** (kan først rettes, når custom SMTP er slået til). Ret både **Confirm signup**
   og **Magic Link**, så mailen er på dansk og indeholder både en kode og et link, der virker på alle enheder:

   Emne: `Log ind på Relived`

   ```html
   <h2>Log ind på Relived</h2>
   <p>Din kode er: <strong style="font-size:22px;letter-spacing:2px">{{ .Token }}</strong></p>
   <p>Eller tryk her for at logge ind:</p>
   <p><a href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email">Log ind på Relived</a></p>
   <p>Har du ikke bedt om at logge ind, kan du se bort fra mailen.</p>
   ```
6. **Project Settings → API Keys**: her finder du **Project URL** og **Publishable key**.
   Dem skal du bruge i trin 3. Brug aldrig *secret*- eller *service_role*-nøglen i Relived.

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
   | `NEXT_PUBLIC_SITE_URL` | `https://relived.dk` |

   **Vigtigt om typen:** de tre, der starter med `NEXT_PUBLIC_`, skal have typen **Config**. De skal bruges i browseren,
   og Vercel bygger ikke værdier af typen *Secret* ind i siden. De tre `LIVEKIT_`-variabler skal være **Secret**.
   En gemt Secret kan ikke laves om til Config, så slet den og opret den igen, hvis typen er forkert.

4. Tryk **Deploy**. Efter et par minutter får du en adresse som `snuplive.vercel.app`.
5. Under **Settings → Functions → Function Region** vælger du den region, der ligger tættest på databasen:
   **Dublin (dub1)**, hvis Supabase ligger i Irland (Stockholm (arn1) til Stockholm, Frankfurt (fra1) til Frankfurt).
   Det gør siden hurtigere, fordi serveren og databasen taler sammen mange gange pr. side.

Retter du en nøgle senere, skal du trykke **Redeploy**, før ændringen virker.

## Trin 4: Peg relived.dk på Vercel

1. I Vercel: **Settings → Domains → Add**, skriv `relived.dk`, og tilføj også `www.relived.dk`
   (vælg, at www sender videre til relived.dk).
2. Vercel viser nu de DNS-poster, der skal oprettes (typisk en **A-post** for `relived.dk` og en **CNAME-post** for `www`).
3. Log ind hos Simply, åbn DNS-indstillingerne for relived.dk, og opret præcis de poster, Vercel viser.
   Slet eventuelle gamle A-poster for `@`, der peger andre steder hen.
4. Når Vercel viser **Valid Configuration**, er siden live på relived.dk med HTTPS. Det tager typisk fra få minutter til et par timer.

## Trin 5: Test det hele

1. Åbn relived.dk på computeren, tryk **Log ind**, og skriv din e-mail. Log ind med koden eller linket.
2. Gå til **Min konto**, ret dit brugernavn, og tryk **Bliv sælger**.
3. Opret et show, og læg 3–4 varer i køen.
4. Tryk **Tænd kameraet** i studiet, og giv browseren lov til kamera og mikrofon. Tryk **Gå live**.
5. Åbn `relived.dk/live/dit-brugernavn` på telefonen (eller bed en ven om det). Videoen skal vise dig.
6. Tryk **Vis næste** i studiet, og køb varen fra telefonen. Prøv chatten og en lynrunde.
7. Tryk **Afslut show**. Salget står nu under **Mine shows** og hos køberen under **Mine køb**.

---

## Betaling med Stripe

Køberen betaler alt i kurven på én gang med MobilePay, kort, Apple Pay eller Google Pay. Pengene står hos Relived,
indtil køberen trykker "Jeg har fået mine varer" (eller automatisk 7 dage efter, at sælgeren har markeret pakken som sendt).
Så sendes beløbet for varerne til sælgerens Stripe-konto (og fragten, hvis sælgeren selv har sendt pakken uden Reliveds label).
Relived beholder køberbeskyttelsen (5 % + 5 kr pr. pakke).

Start i Stripes **testmiljø**. Det kræver hverken CVR eller bankkonto, og der bliver ikke flyttet rigtige penge.

1. **Supabase → SQL Editor:** kør [`supabase/migrations/0003_betaling.sql`](supabase/migrations/0003_betaling.sql).
2. **Stripe (testmiljø):**
   - **Connect → Get started:** vælg platform/marketplace, hvor sælgere får udbetalt.
   - **Settings → Developers → API policies:** slå **Accounts v1 support** til. Relived opretter sælgernes
     udbetalingskonti med den version af Stripes API, og nye Stripe-konti har den slået fra.
   - **Settings → Payment methods:** slå **MobilePay** til (kort, Apple Pay og Google Pay er slået til i forvejen).
   - **Settings → Payouts:** sæt Reliveds egne udbetalinger til **manuelt** eller **ugentligt**, så der altid er penge til at betale sælgerne.
   - **Developers → API keys:** kopiér **Secret key** (`sk_test_…`).
   - **Developers → Webhooks → Add destination:**
     - *Events from:* **Your account**. Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
       `checkout.session.async_payment_failed`, `checkout.session.expired`.
     - *Endpoint URL:* `https://relived.dk/api/stripe/webhook`. Kopiér **Signing secret** (`whsec_…`).
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
   gamle ordrer, sender ventende udbetalinger og annullerer køb, der ikke er betalt efter 3 dage.
5. **Test:**
   - Som sælger: gå til **Mine shows → Tilknyt udbetaling**. I testmiljøet har Stripe knapper til at udfylde med testdata.
   - Som køber (en anden konto): køb noget, gå til **Mine køb**, og betal med kortnummer `4242 4242 4242 4242`.
   - Som sælger: markér pakken som sendt. Som køber: tryk **Jeg har fået mine varer**. Overførslen kan ses i Stripe under **Connect → Transfers**.

**Før rigtige penge:** aktivér Stripe-kontoen med virksomhedsoplysninger (CVR og bankkonto), skift til de rigtige nøgler
(`sk_live_…` og nye webhook-secrets), tjek at **Accounts v1 support** også er slået til uden for testmiljøet, opgrader Vercel til Pro, og få en revisor til at se på moms af køberbeskyttelsen.

## Fragt med Shipmondo

Køberen vælger en **DAO- eller GLS-pakkeshop** i kurven og betaler fragt efter pakkens størrelse (se *Fragt efter vægt*). Sælgeren trykker
**Lav fragtlabel** under Mine shows, printer labelen og afleverer pakken. Relived betaler labelen hos Shipmondo med de penge,
køberen har betalt i fragt, og sælgeren får beløbet for varerne. Sporingen kommer fra Shipmondo, så ordren skifter selv til
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

4. **Deploy** en ny version af `main`. Første gang en sælger laver en label, opretter Relived selv webhooken til sporing hos
   Shipmondo (du kan se den under Indstillinger → Webhooks som "Relived sporing").
5. **Test:**
   - Som køber: køb noget, gå til **Mine køb**, skriv dit postnummer, vælg DAO eller GLS og en pakkeshop, og betal.
   - Som sælger: udfyld **Fragt og afsenderadresse** under Mine shows, og tryk **Lav fragtlabel** på ordren. Labelen er mærket
     "SANDBOX" og kan ikke bruges.

**Før rigtige labels:** tilknyt et betalingskort i din rigtige Shipmondo-konto (labels betales løbende), lav nye API-nøgler
dér, skift `SHIPMONDO_API_USER` og `SHIPMONDO_API_KEY` i Vercel, og slet `SHIPMONDO_SANDBOX`.

## Tryghed: moderation og "Meld et problem"

- **Moderation:** sælgeren kan fjerne beskeder i chatten og blokere brugere (menuen ⋯ ved hver besked i studiet eller på sin
  egen showside). En blokeret bruger kan hverken skrive eller købe i sælgerens shows. Blokeringer kan fjernes under Mine shows.
  Alle kan fjerne deres egne beskeder.
- **Meld et problem:** køberen kan melde et problem på en ordre under Mine køb, så længe den ikke er afsluttet. Så holdes
  pengene tilbage (ordren afsluttes ikke automatisk), sælgeren kan se det, og du får en mail. Du afgør sagen på
  [relived.dk/admin/sager](https://relived.dk/admin/sager): refundér køberen, send pengene til sælgeren, eller luk sagen.

1. **Supabase → SQL Editor:** kør [`supabase/migrations/0005_tryghed.sql`](supabase/migrations/0005_tryghed.sql).
2. **Vercel → Environment Variables** (typen **Secret**):

   | Navn | Værdi |
   | --- | --- |
   | `ADMIN_EMAILS` | Den e-mail, du logger ind på Relived med (flere adskilt med komma) |
   | `RESEND_API_KEY` | Valgfri. Resend → **API Keys → Create API key** med *Sending access* til relived.dk. Uden den bliver der ikke sendt mails om nye sager, men de står stadig på /admin |

3. **Deploy**, log ind med din admin-e-mail, og gå til **Min konto**. Der står, hvor mange sager der venter.

## Varer, kategorier, "Husk mig" og "Køb nu"

1. **Supabase → SQL Editor:** kør [`supabase/migrations/0007_varer.sql`](supabase/migrations/0007_varer.sql), **før** den nye
   version kommer på Vercel. Ellers kan show- og studiesiderne ikke hentes. Har du ikke kørt 0005 og 0006 endnu, så kør dem først.
   Filen kan køres igen uden at gøre skade.
2. Der er ikke nogen nye nøgler. Mails om "Husk mig" bruger den samme `RESEND_API_KEY` som sagerne. Uden den bliver der ikke
   sendt mails, men alt andet virker.

Sådan virker det:

- **Kategorier:** Dametøj, sko og tasker · Herretøj og sneakers · Børnetøj og legetøj · Bolig og design · Samleobjekter · Andet. I databasen hedder Samleobjekter stadig `samlerting`, og /kategori/samlerting sendes videre til /kategori/samleobjekter.
  Gamle shows bliver flyttet over automatisk (tøj og overtøj til dametøj, denim til herretøj, vinyl til samlerting, design til bolig).
- **Før showet:** sælgeren kan give hver vare op til 4 billeder, en beskrivelse og en anden kategori end showets
  (under "+ Billeder, beskrivelse og kategori" i studiet). Varerne kan ses på forsiden, i kategorien og på deres egen side.
  Køberne kan trykke **Husk mig** på en vare eller et show. Når sælgeren går live, får de én mail.
- **Under showet** tager studiet selv et billede fra kameraet, når en vare bliver vist, og lægger det på varen.
- **Efter showet** kommer alt, der ikke blev solgt, til salg til den samme pris. Køberen trykker **Køb nu**, og varen lander under
  Mine køb. Sælgeren kan rette prisen eller tage en vare af salg under **Mine shows → Til salg**. Bliver et køb ikke betalt, eller
  annullerer sælgeren det, kommer varen til salg igen. Refunderede varer skal sælgeren selv sætte til salg igen.
- **Én pakke pr. sælger:** alt, køberen har købt hos samme sælger, betales og sendes samlet, også når det er fra flere shows.

## Budsalg

1. **Supabase → SQL Editor:** kør [`supabase/migrations/0008_budsalg.sql`](supabase/migrations/0008_budsalg.sql), **før** den nye
   version kommer på Vercel (0007 skal være kørt først). Filen kan køres igen uden at gøre skade. Der er ingen nye nøgler.

Sådan virker det:

- **I studiet** vælger sælgeren *Fast pris* eller *Budsalg* på hver vare. Ved budsalg er prisen startprisen.
- **Live:** sælgeren viser varen frem og trykker **Start budsalg 30 s**. Køberne trykker **Byd**, som altid byder næste trin:
  5 kr under 100 kr, 10 kr op til 500 kr, 25 kr op til 1.000 kr og 50 kr derover. Man kan ikke byde over sig selv.
  Kommer der et bud i de sidste 10 sekunder, står uret på 10 igen. Næste vare kan først vises, når budsalget er slut.
- **Når uret står på 0**, lukker studiet budsalget. Det højeste bud bliver til et køb i køberens Mine køb til buddets pris,
  og vinderen står i chatten. Afslutter sælgeren showet midt i et budsalg, vinder det højeste bud.
- **Ingen bud:** varen kommer til salg til startprisen med Køb nu, når showet slutter.
- Alt det, der afgør et budsalg (tid, trin, vinder), sker i databasen, så det er det samme for alle, og ingen kan snyde.
  Alle bud gemmes i tabellen `bids`.

## Backoffice

På [relived.dk/admin](https://relived.dk/admin) (kun for e-mails i `ADMIN_EMAILS`) er der:

- **Overblik:** omsætning, din indtjening (køberbeskyttelse og fragt minus labels, før Stripes gebyrer og moms), udbetalt til
  sælgere, penge der holdes tilbage, refunderinger, medlemmer, sælgere, shows og solgte varer for 7 dage, 30 dage, 90 dage, i år
  eller altid, plus en graf pr. dag, uge eller måned, de sælgere der har solgt mest, nyeste medlemmer og seneste ordrer.
- **Sager**, **Ordrer** (med filtre), **Medlemmer** (søg på brugernavn, navn eller e-mail, og se køb, salg og shows for hver)
  og **Shows**.

Kør [`supabase/migrations/0006_backoffice.sql`](supabase/migrations/0006_backoffice.sql) i Supabase først. Filen retter også en
fejl, så en vare, der er blevet annulleret eller refunderet, kan købes igen.

## Klar til lancering: vilkår, sælgertype, anmeldelser, bedømmelser og Skat

1. **Supabase → SQL Editor:** kør [`supabase/migrations/0009_lancering.sql`](supabase/migrations/0009_lancering.sql), **før** den
   nye version kommer på Vercel (0008 skal være kørt først). Ellers virker Mine køb og Bliv sælger ikke. Filen kan køres igen.
2. **Når selskabet har et CVR-nummer**, så opret tre variabler i Vercel med typen **Config**, og tryk **Redeploy**:

   | Navn | Værdi |
   | --- | --- |
   | `NEXT_PUBLIC_COMPANY_NAME` | `Relived ApS` |
   | `NEXT_PUBLIC_COMPANY_CVR` | CVR-nummeret (8 cifre) |
   | `NEXT_PUBLIC_COMPANY_ADDRESS` | Selskabets adresse |

   Relived ApS er stiftet (CVR 46902297, Bymuren 107, 3. th., 2650 Hvidovre). Navn, CVR-nummer og adresse står som
   standard i `lib/company.ts`, så variablerne kun skal sættes, hvis noget skal ændres.

Det er nyt:

- **Handelsbetingelser, vilkår og Om Relived** på `/handelsbetingelser`, `/vilkaar` og `/om-relived`, linket fra bunden af
  alle sider, fra login og fra betalingen.
- **Privat eller erhverv:** man vælger, når man bliver sælger, og kan skifte under Min konto. En erhvervssælger skriver
  firmanavn og CVR. Køberne ser det ved hver vare og hvert show sammen med, om fortrydelsesretten gælder. Køb fra en
  erhvervssælger kan fortrydes med *Meld et problem*. Sælgere fra før skal bekræfte under Min konto.
- **Anmeld** på varer, shows og profiler, også uden login. Du får en mail, og afgør dem under **Backoffice → Anmeldelser**:
  fjern varen, fjern showet, luk sælgerkontoen eller afvis. Sælgeren får begrundelsen på mail, og den, der anmeldte, får
  besked om afgørelsen.
- **Bedømmelser:** når en ordre er afsluttet, kan køberen give sælgeren 1–5 stjerner under Mine køb. Gennemsnittet står ved
  sælgeren, og de nyeste bedømmelser står på sælgerens side.
- **Backoffice → Skat:** salg pr. sælger og kvartal til indberetningen til Skattestyrelsen (DAC7). Sælgere med mindst 30
  salg eller salg for mindst 2.000 euro er markeret. Hent listen som CSV-fil. Indberetningen skal ind senest 31. januar.
- **Sådan sorterer vi** står på `/saadan-virker-det#sortering` og er linket fra listerne og fra bunden af siden.

## Inaktive shows lukker af sig selv

1. **Supabase → SQL Editor:** kør [`supabase/migrations/0010_inaktive_shows.sql`](supabase/migrations/0010_inaktive_shows.sql), **før**
   den nye version kommer på Vercel. Filen lukker også de shows, der allerede hænger som live. Den kan køres igen.

Studiet sender et livstegn hvert minut, mens showet er live og kameraet er tændt. Har et show ikke fået et livstegn i
15 minutter (studiet er lukket, telefonen er gået i dvale, kameraet er slukket eller nettet er væk), slutter showet, som
hvis sælgeren havde trykket **Afslut show**: et budsalg, der kører, går til det højeste bud, resten kommer til salg til
fast pris, og der står i chatten, hvorfor showet sluttede. Lukningen sker, når nogen åbner forsiden, Live nu, en
kategori eller et show, og ved det daglige job, så det kræver ikke et ekstra cron-job.

## MitID for sælgere (Idura)

1. **Supabase → SQL Editor:** kør [`supabase/migrations/0011_mitid.sql`](supabase/migrations/0011_mitid.sql) (efter 0010). Filen kan køres igen.
2. **Idura:** opret en konto på idura.eu. Under **Applications** opretter du en app med
   - *Callback URL / redirect URI:* `https://relived.dk/api/mitid/callback`
   - *eID:* Danish MitID
   - *OAuth2 code flow* slået til, så appen får en client secret.
3. **Vercel → Environment Variables** (alle tre som Secret), og tryk **Redeploy**:

   | Navn | Værdi |
   | --- | --- |
   | `IDURA_DOMAIN` | Domænet fra Idura, fx `snuplive-test.idura.broker` |
   | `IDURA_CLIENT_ID` | Client ID fra appen |
   | `IDURA_CLIENT_SECRET` | Client secret fra appen |

4. **Test:** opret en testbruger i MitID's testværktøj (pp.mitid.dk/test-tool), og bekræft dig under Min konto →
   Sælgeroplysninger. I test virker kun MitID-testbrugere.
5. **Produktion** (kræver CVR og momsnummer): skift Idura til Production, lad en med MitID Erhverv indsende firmaets
   oplysninger under eID providers → DK MitID, opret produktionsappen, og skift de tre variabler i Vercel.
6. **Backoffice → Indstillinger:** slå *Sælgere skal bekræfte sig med MitID, før de kan gå live* til, når rigtigt MitID virker.

Sådan virker det: sælgeren trykker **Bekræft med MitID** (under Min konto eller i studiet), logger ind med MitID hos Idura og
kommer tilbage. Vi gemmer navn, fødselsdato og et fingeraftryk af MitID-id'et (ikke CPR), så det samme MitID ikke kan bruges på
flere konti, og sælgeren skal være fyldt 18. Køberne ser mærket **MitID-bekræftet** ved sælgerens varer og shows. Når kravet er
slået til, kan man ikke gå live uden MitID; det tjekkes også i databasen.

## Kommer snart og lukket side

1. **Supabase → SQL Editor:** kør [`supabase/migrations/0012_kommer_snart.sql`](supabase/migrations/0012_kommer_snart.sql) (efter 0011).
   **Når filen er kørt, er siden lukket** for alle andre end admins og testere.
2. Der er ingen nye nøgler. Bekræftelsesmails og mails til ventelisten bruger `RESEND_API_KEY`, så den skal være sat, og
   domænet relived.dk skal være bekræftet hos Resend.

Sådan virker det:

- **Besøgende** ser kun *Kommer snart* på relived.dk og kan skrive sig op med e-mail, om de vil købe, sælge eller begge dele,
  og et flueben for samtykke. De får en mail og er først med, når de har trykket på linket (dobbelt tilmelding). Alle andre
  sider sender videre til forsiden. Privatlivspolitik, vilkår, handelsbetingelser og Om Relived kan stadig ses.
- **Admins** (`ADMIN_EMAILS`) og **testere** ser hele siden, når de er logget ind på relived.dk/login.
  Testere tilføjes under **Backoffice → Indstillinger**.
- **Backoffice → Venteliste:** tal, listen, CSV-fil og *Send en mail til ventelisten* (send en test til dig selv først).
  Hver mail får et afmeldingslink. Resends gratisplan sender højst 100 mails om dagen.
- **Ved lanceringen:** Backoffice → Indstillinger → *Siden er åben for alle*. Det virker inden for et minut, uden redeploy.
- Google ser kun forsiden og de faste sider, mens siden er lukket (robots.txt og sitemap.xml følger med).

---

## Supportchat ("Hjælp")

Kør `supabase/migrations/0013_support.sql` i Supabase → SQL Editor (efter 0012). Der skal ikke nye nøgler i Vercel.

- **Besøgende** trykker **Hjælp** nederst til højre (eller *Skriv til os* i bunden af siden) og skriver til jer. Gæster skriver
  deres e-mail første gang. Er de logget ind, hører samtalen til deres konto. Knappen er skjult i et show og i studiet,
  så den ikke dækker for knapperne, men *Skriv til os* i bunden virker stadig. Den virker også på *Kommer snart*.
- **I svarer** under **Backoffice → Support**. Alle i `ADMIN_EMAILS` får en mail ved en ny samtale, og igen hvis brugeren
  skriver, efter I har kigget. Fanen viser, hvor mange samtaler der er ulæste.
- **Har brugeren chatten åben**, ser de svaret med det samme. Ellers får de svaret på mail fra `MAIL_FROM` med et link, der
  åbner samtalen igen (også på en anden telefon). Svarer de på mailen, lander den i kontakt@relived.dk.
- Brugeren ser jeres fornavn ved svaret, hvis I har skrevet jeres navn under **Min konto**. Ellers står der bare *Relived*.
- Spam: højst 5 nye samtaler i timen fra samme sted og 15 beskeder på 5 minutter pr. samtale. Samtaler slettes 12 måneder
  efter sidste besked (det daglige job).

---

## Nyt navn: Relived (fra SnupLive)

Koden hedder nu Relived overalt: logo, tekster, mails, vilkår og "Køb" i stedet for "Snup". Hovedadressen er relived.dk,
og snuplive.dk sender videre. Gør det her i rækkefølge:

1. **Supabase → SQL Editor:** kør `0013_support.sql` (igen, hvis du allerede har kørt den) og derefter `0014_relived.sql`.
2. **Simply (relived.dk):** opret mailen `kontakt@relived.dk`. Tilføj domænet `relived.dk` i **Resend → Domains**, og opret
   de DNS-poster, Resend viser, under DNS for relived.dk hos Simply. Vent, til Resend skriver *Verified*.
   Er jeres Resend-nøgle kun til snuplive.dk, så lav en ny med adgang til relived.dk.
3. **Vercel → Settings → Domains:** tilføj `relived.dk` og `www.relived.dk`, og opret de DNS-poster, Vercel viser, hos Simply.
   Gør relived.dk til hovedadresse, og sæt `snuplive.dk` og `www.snuplive.dk` til at sende videre (*Redirect to relived.dk*).
4. **Vercel → Settings → Environment Variables:** `NEXT_PUBLIC_SITE_URL` = `https://relived.dk`,
   `MAIL_FROM` = `Relived <kontakt@relived.dk>`, og `NEXT_PUBLIC_COMPANY_NAME` = `Relived ApS`, hvis den er sat. Ny nøgle fra
   Resend? Ret også `RESEND_API_KEY`. Lav derefter en **Redeploy**.
5. **Supabase → Authentication:** *URL Configuration* → Site URL `https://relived.dk`, og tilføj `https://relived.dk/**` under
   Redirect URLs (lad snuplive.dk stå et stykke tid). *SMTP Settings* → afsender `kontakt@relived.dk`, navn `Relived`.
   *Email Templates* → skriv Relived i stedet for SnupLive i emnet og teksten.
6. **Stripe:** *Settings → Business → Public details*: navn `Relived`, kontoudtog `RELIVED`, hjemmeside `https://relived.dk`.
   *Developers → Webhooks*: ret adressen til `https://relived.dk/api/stripe/webhook` (nøglen forbliver den samme).
7. **Idura:** tilføj `https://relived.dk/api/mitid/callback` som callback-adresse i jeres app.
8. **Shipmondo:** intet. Næste gang en sælger laver en label, opretter siden selv sporingen til relived.dk. Den gamle
   "SnupLive sporing" under Indstillinger → Webhooks kan slettes bagefter.

---

## Guides (/guides) til Google

Artikler om at købe og sælge brugt, så flere finder Relived, når de søger. De er åbne for alle, også før lanceringen,
og står i sitemap.xml.

- **Oversigt:** `/guides`. **Guides nu (11):** sælg brugt tøj, pris på brugt tøj, skat ved salg af brugt tøj, sælg live
  første gang, sælg brugt børnetøj, sælg samleobjekter, sælg din designertaske, er designertasken ægte, hvad er live
  shopping, køb brugt tøj online og køb brugt design.
- **Teksterne** står i `lib/guides.tsx`. Hver guide har ét søgeord, som står i titlen (højst 60 tegn), beskrivelsen
  (højst 155 tegn) og H1. H2'erne svarer på de spørgsmål, folk stiller. Siden laver selv indholdsfortegnelse, læsetid,
  "Læs også" og data til Google (Article, brødkrummer og spørgsmål og svar).
- **Ny guide:** kopiér en af dem i `lib/guides.tsx`, giv den en ny `slug`, og skriv teksten. Den kommer automatisk med i
  oversigten og sitemap. Skriv "vare" om det, der sælges, og nævn ikke konkurrenter ved navn.
- **Links ind til guiderne:** footeren (Hjælp → Guides), Spørgsmål og svar, /saelg, Sådan virker det og
  kategorisiderne (en guide til at sælge og en til at købe, hvor der findes en; se `SELL_GUIDE` og `BUY_GUIDE`).
- **Skatteguiden** bygger på Skattestyrelsens sider (opdateret februar 2026). Tjek dem en gang om året, og ret `updated`.

---

## Ordet "vare"

Siden siger **vare/varen/varer/varerne** om det, der bliver solgt (før stod der "ting"). Adresserne er de samme
(`/ting/<navn>-<id>` og `/klip?ting=<id>`), så links og Googles sider virker som før.

- **Beskeder fra databasen** (fx "Tingen er allerede solgt") står stadig med "ting" i migrationerne. De bliver lavet om
  til "vare", når de vises (`vareTekst` i `lib/format.ts`, brugt i `errorText` og `fail`). Der skal ikke køres noget i
  Supabase.
- **Antal:** "1 vare", "3 varer" (`vareOrd`).
- **Vilkår, handelsbetingelser og privatlivspolitik** siger også vare (kun ordet er skiftet, indholdet er det samme).

---

## Videoklip af varerne fra showet

Kør `supabase/migrations/0015_klip.sql` i Supabase → SQL Editor (efter 0014). Der skal ikke nye nøgler i Vercel.

- **Når sælgeren viser en vare frem**, optager studiet de første 15 sekunder (med lyd) i sælgerens browser og lægger klippet
  i mappen `clips` i Supabase Storage. Viser sælgeren den næste vare før tid, gemmes det, der er nået (mindst 4 sekunder).
  Viser sælgeren samme vare igen, erstatter det nye klip det gamle.
- **Bliver varen ikke solgt**, vises klippet først på varens side (uden lyd, i loop, med knap til lyd), og kortet under
  *Til salg* får mærket *Video*. Har man slået *reducer bevægelse* til på sin enhed, starter klippet ikke af sig selv.
- **Sælgeren kan slette klippet** under **Studie → Til salg** (*Slet video*).
- **Oprydning:** det daglige job sletter klip 14 dage efter, at varen er solgt, og klip af varer, der er fjernet.
- Klip fylder ca. 2-3 MB stykket (højst 15 MB). Supabase Free har 1 GB lagerplads, så hold øje med *Storage* i Supabase, når
  der kommer mange sælgere.
- Er 0015 ikke kørt, sker der ingenting: studiet springer klippet over, og siderne virker som før.

---

## Luksus, Skønhed og ægthedstjek

Kør `supabase/migrations/0017_aegthed.sql` i Supabase → SQL Editor (efter 0016). Der skal ikke nye nøgler i Vercel.

- **Nye kategorier:** *Luksus* (tasker, ure og smykker) og *Skønhed* (kun ny og uåbnet). Ved Skønhed er standen altid
  "Ny og uåbnet", og sælgeren skal sætte flueben ved, at produktet er uåbnet.
- **Hvad skal tjekkes:** varer i Luksus til 1.000 kr eller mere, og alle varer, hvor navnet eller beskrivelsen nævner et
  kendt mærke (Louis Vuitton, Gucci, Chanel, Hermès, Prada, Dior, Fendi, Balenciaga, Rolex, Cartier, Moncler m.fl.).
  Listen står i `lib/luxury.ts` og i databasen (`luxury_brand`), og de skal ændres sammen.
- **Sælgeren:** i studiet står der "Skal ægthedstjekkes" ved varen. *Send billeder* åbner et panel med 4 krævede
  nærbilleder (logo, serie-/datokode, foer, syninger og metaldele) og 2 valgfrie (kvittering, andet). Indtil varen er
  godkendt, kan den ikke vises live, bydes på eller købes (databasen stopper det). Skifter sælgeren navn eller kategori
  efter godkendelsen, skal den tjekkes igen.
- **I (Backoffice → Ægthed):** alle varer, der venter, med billederne i stor størrelse. *Godkend* eller *Afvis* (med en kort
  begrundelse). Sælgeren får en mail. Admins får en mail, når en vare bliver sendt til tjek. Er I i tvivl, så kør billederne
  gennem en ægthedstjeneste (fx LegitApp) først.
- **Køberen:** godkendte varer har mærket *Ægthed tjekket* på varens side og i live-showet. Under *Meld et problem* kan
  køberen vælge *Varen er falsk (en kopi)*. Giv pengene tilbage under Backoffice → Sager, og luk sælgeren.

---

## Mine shows: slet og skjul

Kør `supabase/migrations/0018_skjul.sql` i Supabase → SQL Editor (efter 0017). Der skal ikke nye nøgler i Vercel.

Hvert show under *Mine shows* har en **⋯**-knap:

- **Planlagt show:** *Slet show*. Siden spørger først ("Det kan ikke fortrydes"). Varerne i køen bliver slettet med.
- **Afsluttet show:** *Skjul fra listen*. Showet forsvinder fra listen, men salg, ordrer og varer, der stadig er til salg,
  bliver liggende. Afsluttede shows kan ikke slettes, fordi der hænger salg og ordrer på dem.
- **Skjulte shows** står under *Vis skjulte shows (N)* nederst i listen. Der kan de vises igen med *Vis i listen igen*.
- **Live-shows** har ingen ⋯.

Indtil 0018 er kørt, kan man kun slette planlagte shows (afsluttede shows har ingen ⋯).

---

## Statistik over besøg (Vercel Web Analytics)

Siden tæller besøg med Vercel Web Analytics. Det sker uden cookies, og der gemmes intet i browseren, så der skal ikke
spørges om lov. Cookies-siden og privatlivspolitikken fortæller om det.

- **Slå det til:** Vercel → projektet → **Analytics** → **Enable** (Web Analytics). Lav så en ny deployment. Statistikken
  kommer kun med på Vercel, ikke lokalt eller i test.
- **Det kan I se:** besøg pr. side, hvor de besøgende kommer fra (fx Google eller Facebook), land og type enhed.
  Adressens ?-del bliver ikke sendt med, og sider med login, Min konto, Mine køb, studiet og backoffice tælles ikke.
- **Hændelser:** Køb, Bud, Gik live, Følg, Venteliste og Delte klip bliver også talt (uden personlige oplysninger). De
  vises først i Vercel med Pro-abonnementet.

## Del klip på TikTok og Instagram

Under **Mine shows → Til salg** står **Lav video til TikTok og Instagram** ved hver vare med et klip. Browseren laver en
lodret video (720 × 1280) af klippet med Relived-logo, varens navn og pris og "Køb den på relived.dk", og til sidst et
slutbillede på 2 sekunder med logoet og relived.dk. Det tager lige så lang tid som klippet, og siden skal være åben imens.

Bagefter kan sælgeren **dele videoen** direkte fra telefonen (TikTok, Instagram, Facebook og andre apps, hvor telefonen
kan), **hente den** eller **kopiere linket** til varen til teksten. Videoen bliver ikke gemt hos os. Lyden kommer med, hvor
browseren kan læse den. Koden ligger i `lib/shareClip.ts` og `components/ShareClipButton.tsx`.

## Show på engelsk og siden Relived in English

Kør `supabase/migrations/0023_engelsk.sql` i Supabase → SQL Editor (efter 0022). Der skal ikke nye nøgler i Vercel.
Uden den virker alt som før; man kan bare ikke vælge sprog, og listen på /en er tom.

- **Sælgeren** sætter flueben i *Showet er på engelsk*, når showet oprettes under Mine shows, eller trykker **English**
  øverst i studiet (kun værten, og kun indtil showet er slut).
- **Mærket English** står ved showet på forsiden, under Live nu, i programmet og ved titlen på showets side.
- **/en (Relived in English):** én side på engelsk til engelsktalende i Danmark: shows på engelsk, sådan virker det, de
  danske ord, man møder på siden, tryg handel og godt at vide (kroner, levering i Danmark, at de danske vilkår gælder).
  Resten af siden er på dansk, og browseren kan oversætte den. Linket står i bunden af siden.

## Hjerter og effekter i live-shows

Seerne kan sende reaktioner, mens showet er live. De ses af alle: seerne, værten og gæsterne i studiet.

- **Hjerter og emojis** (❤️ 🔥 😍 👏 😂 😮): hjerteknappen i højre side af videoen, dobbelttryk på videoen, eller smileyen for flere. De svæver op langs højre side. Alle kan sende dem, også uden login.
- **Store effekter** (🎉 Konfetti, 💖 Hjerteregn, 🌠 Stjerneskud): fylder hele billedet i et par sekunder, og der står "@navn sendte konfetti" øverst. De kræver login, og hver seer kan sende én hvert 30. sekund.

Sådan virker det: reaktionerne sendes over videoforbindelsen (LiveKit), ikke gennem databasen, så de ikke kan forsinke chat og bud. Seerne sender kun til værten. Værtens studie bremser (højst 6 i sekundet pr. seer og 40 pr. halve sekund i alt), samler dem og sender én opsamling til alle hvert halve sekund. Store effekter vises én ad gangen, højst tre i kø. Intet bliver gemt. Er værten ikke forbundet, ser seerne kun deres egne tryk.

Koden ligger i `lib/reactions.ts` (logikken) og `components/Reactions.tsx` (visningen). Der skal ikke køres noget i databasen.

## Sælg med video (videoannoncer)

Kør `supabase/migrations/0019_videoannoncer.sql` i Supabase → SQL Editor (efter 0018). Der skal ikke nye nøgler i Vercel.

For sælgere, der ikke har lyst til at gå live:

- **Mine shows → Sælg med video → Film nu:** telefonens bagkamera åbner, og sælgeren filmer varen i 5-45 sekunder (uden selv
  at være med). Har sælgeren allerede filmet, kan hun trykke **Vælg en video**. Så bliver videoen lavet om på telefonen, så den
  kan ses på alle telefoner (det tager lige så lang tid som videoen).
- **Billederne:** mens der filmes, tages der billeder. Claude vælger op til 4 (det bedste bliver forsidebilledet), og sælgeren
  kan vælge til og fra eller lægge sine egne billeder på. Uden `ANTHROPIC_API_KEY` vælger telefonen de skarpeste.
- **Annoncen:** navn, kategori, str., pris, stand og beskrivelse. Tryk **Sæt til salg**, så kan varen købes med det samme med
  Køb nu. Videoen vises først på varens side og i Klip. Betaling, fragt og ordrer virker som for varer fra et show.
- **Mærkevarer** skal stadig ægthedstjekkes, før de kan købes. Sælgeren sender billederne lige efter, eller under
  **Mine shows → Til salg → Send billeder**.
- **Bag kulissen:** varerne ligger i et skjult "show" pr. sælger (`kind = 'video'`). Det vises aldrig som et show (ikke under
  Mine shows, ikke på sælgerens side og uden studie). I Backoffice → Shows står det som *Videoannoncer*.
- **Lukker I en sælger** (Backoffice → Anmeldelser → fjern profilen), bliver alt, sælgeren har til salg, nu også taget af salg.
- Højst 40 videoannoncer pr. sælger pr. døgn. Videoerne fylder ca. 5-9 MB stykket i Supabase Storage (mappen `clips`).
- Er 0019 ikke kørt, er der ingen knap til videoannoncer, og resten af siden virker som før.

---

## Nulstil testsalg (før lanceringen)

Kør `supabase/migrations/0021_nulstil_testsalg.sql` i Supabase → SQL Editor (efter 0020).

**Backoffice → Indstillinger → Nulstil testsalg** sletter alle køb, ordrer, bud, sager, bedømmelser og fragtlabels, så
omsætningen (og indberetningen til Skat) starter forfra. Solgte varer bliver *Ikke til salg* (sælgeren kan sætte dem til salg
igen). Shows, varer, sælgere, købere og følgere bliver liggende. Man skal skrive NULSTIL for at bekræfte.

Knappen findes kun, mens Stripe kører med testnøgler (`sk_test_…`). Med rigtige nøgler forsvinder den, og databasen nægter
også, hvis der er en rigtig betaling. Fragtlabels, der er købt hos Shipmondo, bliver ikke annulleret der.

---

## Lanceringsdagen: teksterne skifter af sig selv

Relived regnes for åbnet, når Stripe kører med rigtige nøgler (`lib/launch.ts`). Når de rigtige nøgler ligger i Vercel, og
der er trykket **Redeploy**, skifter siden af sig selv:

- "Gratis at sælge i beta" og lignende bliver til "Gratis at sælge" på forsiden, Sælg, Sådan virker det, FAQ, guiderne,
  studiet, den engelske side og Vilkår.
- Det store kort på forsiden taler til sælgerne indtil da ("Vær med fra starten") og til køberne bagefter ("Vi går snart
  live" med tilmelding til nyhedsbrevet). Kassen "Snart live" gør det samme.
- TESTFASE-bjælken forsvinder, og der kommer ingen beta-bjælke i stedet.

Tomme sider (Live nu, Til salg, Budsalg, Klip og kategorierne) har en lille tilmelding til nyhedsbrevet
(`components/EmptyNext.tsx`). Kilden står i Backoffice → Nyhedsbrev som "Tom side: …". Studiet har en tjekliste for nye
sælgere (`app/(site)/studio/SellerChecklist.tsx`), som forsvinder, når alt er gjort.

---

## Slet alle testshows (før lanceringen)

Kør `supabase/migrations/0031_slet_testshows.sql` i Supabase → SQL Editor (efter 0030).

**Backoffice → Indstillinger → Slet alle testshows** nulstiller testsalget og sletter alle shows med deres varer, chat,
bud, påmindelser, gæster og invitationer, og anmeldelser af shows og varer. Sælgersiderne forsvinder fra sitemap.xml, fordi
den kun tager sælgere med shows. Brugere, sælgerprofiler, følgere, nyhedsbrevet og indstillinger bliver liggende. Billeder
og klip bliver liggende i Supabase Storage, men vises ingen steder. Man skal skrive SLET for at bekræfte.

Knappen findes kun, mens Stripe kører med testnøgler, og databasen nægter, hvis der er en rigtig betaling.

---

## Rundvisning i studiet

Første gang en sælger åbner et studie (før showet går live), spørger siden: *Vil du se, hvordan studiet virker?* med
**Ja, vis mig** og **Nej tak**. Siger sælgeren ja, bliver én ting ad gangen fremhævet med en kort forklaring og **OK**:
køen, hvordan man sætter en vare til salg, kameraet og knapperne på det, Vises nu og swipe, Vis næste / lynrunde /
budsalg, tallene, chatten, gæster, deling og hvad der sker efter showet. Gæster i et show får deres egen, kortere udgave.

- *Nej tak*, *Spring resten over* og *Færdig* gør, at den ikke kommer igen af sig selv (husket i browseren, se `/cookies`).
- Knappen **Rundvisning** øverst i studiet starter den forfra.
- Et show, der er live, bliver ikke forstyrret af spørgsmålet.
- Teksterne står i `app/(site)/studio/[id]/StudioTour.tsx`. Det, der fremhæves, er markeret med `data-tour="…"` i studiet.

---

## TESTFASE-bjælken øverst

Indtil Relived åbner, står der en gul **TESTFASE**-bjælke øverst på alle sider: "Relived er ikke åbnet endnu. Alt, der
købes og sælges her, er en test …". Under **Backoffice → Indstillinger → TESTFASE øverst på siden** vælger I:

- **Automatisk** (standard): bjælken vises, så længe Stripe kører med testnøgler, og forsvinder, når I skifter til rigtige.
- **Vis** eller **Skjul**: uanset betalingen. Vælger I Vis, mens betalingen er rigtig, får I en advarsel.
- Når betalingen er rigtig, og bjælken ikke er tvunget frem, er der ingen bjælke.

Det slår igennem på siden inden for et minut. Der skal ikke køres noget i Supabase (det gemmes i `settings`).

---

## Cookies

Relived bruger kun nødvendige cookies (login, MitID og supportchatten) og gemmer et par valg i browseren (fx pakkeshop).
Der er ingen statistik, reklame eller sporing. Derfor skal der ikke spørges om lov, men vi fortæller om det:

- **Siden `/cookies`** viser alle cookies og alt, der gemmes i browseren, og har knappen *Glem mine valg på denne enhed*.
  Listen står i `lib/cookies.ts`. Lægger I en ny cookie ind, så skriv den på listen.
- **En lille besked første gang** (nederst til venstre, med *OK*). Den kommer ikke igen på samme enhed. Den vises ikke på
  `/klip` og ikke for automatiske browsere.
- Links til Cookies i bunden af siden, på "Kommer snart" og i privatlivspolitikken. Siden kan ses, mens Relived er lukket.
- **Kommer der statistik eller annoncer** (fx Google Analytics eller en Meta-pixel), skal beskeden laves om, så man kan
  sige ja eller nej, før de bliver slået til.

---

## Gæst i showet (flere sælgere i samme show)

Kør `supabase/migrations/0020_gaester.sql` i Supabase → SQL Editor (efter 0019). Der skal ikke nye nøgler i Vercel.

- **Værten inviterer:** i studiet står boksen *Gæster i showet*. *Inviter en sælger* laver et link (`/gaest/…`), som værten
  sender. Op til 2 gæster. *Lav et nyt link* gør det gamle ugyldigt.
- **Gæsten siger ja:** gæsten skal være sælger (og MitID-bekræftet, når det er slået til). Gæsten lander i værtens studie,
  kan tænde sit kamera før showet og lægger sine egne varer i køen. Under Mine shows står *Du er gæst i*.
- **Under showet:** værten og gæsterne ser og hører hinanden. Ved varerne står *fra @gæst* og *Sælges af @gæst*.
- **Side om side eller fokus:** værten vælger i boksen *Gæster i showet*, hvordan seerne ser jer: *Side om side* (alle
  kameraer lige store; den, hvis vare vises, får en rød kant og "Viser nu") eller *Fokus* (den, der viser, er stor, de
  andre små). Det skifter med det samme hos alle. Kræver `supabase/migrations/0022_side_om_side.sql` (efter 0021); uden
  den er det altid side om side.
- **Værten styrer** hvad der vises, budsalg, lynrunder og chatten. Gæsten kan ikke gå live, vise varer eller afslutte showet.
- **Pengene** for en gæsts varer går til gæsten, og gæsten sender selv varerne (som altid går salget til den, der ejer varen).
  Billedet og klippet af en gæsts varer tages med gæstens kamera. Køberen får en pakke fra hver sælger.
- **Besked:** når showet går live, får følgerne af gæsterne også besked ("@lise er live hos @maja").
- **Tag en gæst ud:** *Fjern* i boksen. Gæsten forsvinder fra videoen med det samme og kan ikke komme med igen med samme
  link. Gæsten kan selv trykke *Forlad showet*. Gæstens varer i køen kommer til salg, når showet slutter.
- Er 0020 ikke kørt, er der ingen gæste-boks, og resten virker som før.

---

## Studiet: swipe for at skifte vare

Kortet nederst på kameraet i studiet ("Vises nu") kan swipes: **til venstre** viser den næste vare i køen, **til højre**
den forrige vare, der ikke er solgt (fx hvis en seer spørger til den). Der er også pile i begge sider af kortet, og på
computeren virker piletasterne venstre/højre (ikke mens man skriver). Knappen **Vis næste** under kameraet virker som før.
Første gang står der "Swipe for at skifte vare" over kortet. Under et budsalg kan man ikke skifte.

---

## Klip: "Swipe og køb"

Siden `/klip` (menupunktet **Klip**) viser klippene af de usolgte varer som et feed i fuld skærm, ét klip ad gangen. Der skal
ikke køres noget nyt i Supabase (det bruger klippene fra 0015).

- Swipe op/ned på telefonen (pil op/ned, rullehjul eller knapperne til højre på computeren). Klippet på skærmen afspilles
  uden lyd; lyden slås til én gang for alle klip. Tryk på videoen for pause.
- Under hvert klip: sælgeren med **Følg**, navn, pris, **Køb nu** og **Se varen**. Del-knappen deler varens side.
- De nyeste klip kommer først, og sælgerne blandes, så én sælger ikke fylder hele feedet. Feedet henter 12 ad gangen.
- Kun de nærmeste klip hentes, så det ikke bruger unødig data. Har man slået *reducer bevægelse* til, starter intet af sig selv.
- Et delt link kan starte med en bestemt vare: `/klip?ting=<id>`. Forsiden og *Til salg* har en knap *Swipe gennem klip*,
  når der er klip.

---

## Følg sælgere og besked på telefonen

Kør `supabase/migrations/0016_foelg.sql` i Supabase → SQL Editor (efter 0015). Der skal ikke nye nøgler i Vercel.

- **Følg:** knappen står ved showet, på sælgerens side og ved hver vare. Er man ikke logget ind, kommer man til login og
  følger sælgeren med det samme bagefter. Antallet af følgere står ved knappen. Sælgeren kan ikke se, hvem der følger.
  Mens showet er live, står der også en lille **Følg** på selve videoen ved sælgerens navn. Den forsvinder, når man
  følger sælgeren, og de to knapper følger hinanden.
- **Når sælgeren går live**, får følgerne (og dem, der har trykket *Husk mig*) besked. Har de slået *besked på telefonen*
  til, kommer den dér. Ellers får de en mail. Går en sælger live flere gange inden for 2 timer, får følgerne kun besked
  første gang.
- **Morgenmail:** det daglige job sender én mail til hver følger med de shows, der starter inden for et døgn hos de
  sælgere, de følger.
- **Besked på telefonen:** efter *Følg* spørger siden, om man vil have besked på telefonen. Det virker i Chrome, Edge og
  Firefox og på Android. På iPhone skal Relived først lægges på hjemmeskærmen (Del → Føj til hjemmeskærm). Under
  **Min konto → Du følger** kan man slå det til og fra. Nøglerne til beskederne laves automatisk første gang og gemmes i
  databasen, hvor kun serveren kan se dem.
- Blokerer en sælger en bruger, følger brugeren ikke længere sælgeren.

---

## Billedet af varerne (Claude vælger)

Når sælgeren trykker **Vis**, tager studiet 6 billeder i løbet af de næste 15 sekunder (efter 1, 3, 5, 7½, 10 og 13 sekunder).
Viser sælgeren den næste vare før tid, bruges de billeder, der er nået. Bagefter sendes små udgaver til Claude (Haiku 5.5)
sammen med varens navn, og Claude vælger det billede, hvor varen ses bedst. Ses varen ikke på nogen af dem, gemmes der
intet billede. Det koster ca. 0,2 øre pr. vare.

**Sådan sætter du det op (du skal ikke sende nøglen til nogen):**
1. Gå til **console.anthropic.com**, og opret en konto (samme e-mail som jeres Claude-konto er fin). API'et har sin egen
   regning, uafhængigt af et Pro-abonnement.
2. **Billing:** køb kredit, fx 5 dollar (rækker til ca. 15.000 varer). Sæt gerne en månedlig grænse under *Limits*.
3. **API Keys → Create Key:** kald den `relived-billeder`, og kopiér nøglen (den vises kun én gang).
4. **Vercel → Settings → Environment Variables:** tilføj `ANTHROPIC_API_KEY` med nøglen (Production), og lav en **Redeploy**.

Uden nøglen (eller hvis Claude ikke svarer) vælger telefonen selv det skarpeste billede. Valgfrit: `ANTHROPIC_MODEL`
skifter model (standard `claude-haiku-5-5`).

---

## Søgning og søgeagenter

**Kør `0024_soegning.sql` i Supabase → SQL Editor** (efter 0023). Indtil da viser /soeg "Søgningen er ved at blive sat
op", og resten af siden virker som før.

- **Søg (/soeg):** luppen i menuen og søgefeltet under Til salg. Søger i navn, beskrivelse, størrelse og stand på varer, der
  er til salg nu, live nu eller i kommende shows (live først). Dele af ord tæller ("frakke" finder "uldfrakke"), og
  "kjole str. M" søger på kjole i størrelse M. Kategori, størrelse og maks pris kan vælges. Søgesiden er ikke i Google.
- **Søgeagent:** **Giv mig besked om nye** gemmer søgningen (højst 10 pr. bruger). Når en ny vare passer (sat til salg,
  lagt i et kommende show, eller showet går live), får køberen besked på telefonen, hvis det er slået til, ellers en mail
  med links. Hver vare giver kun besked én gang pr. søgning, og sælgerens egne varer og sælgere, der har blokeret
  køberen, er ikke med.
- **Hvornår:** når et show går live, med det samme. Når en sælger lægger en vare i køen, laver en videoannonce eller
  afslutter et show, inden for få sekunder. Ellers efter sidevisninger (højst hvert 3. minut) og i det daglige job.
- **Min konto → Dine søgeagenter:** se og slet dem. Mailen har et link dertil.

---

## Maks-bud på budsalg

**Kør `0025_maksbud.sql` i Supabase → SQL Editor** (efter 0024). Indtil da vises maks-bud ikke.

- **Køberen** trykker **Sæt maks-bud** på varesiden (før showet) eller under budsalget i showet og skriver sit højeste bud.
  Når andre byder, byder siden automatisk i de faste trin, op til maks-buddet. Vinderen betaler ét trin over det
  næsthøjeste bud (eller sit maks, hvis det er lavere). Ved samme maks-bud vinder den, der satte det først.
- **Ingen kan se andres maks-bud.** Køberen kan rette eller fjerne sit eget. Bud, der allerede er givet, står ved magt.
- **Når budsalget starter,** byder de maks-bud, der er sat på forhånd, med det samme. Hvert automatisk bud giver (som et
  almindeligt bud) 10 sekunder ekstra, hvis tiden er ved at løbe ud.
- Koden: `_apply_max_bids`, `set_max_bid` og `clear_max_bid` i databasen; `place_bid` og `start_auction` er de samme som før,
  men lader maks-buddene byde bagefter. Siden: `components/MaxBid.tsx`.

---

## Lukkede shows (kun for inviterede)

**Kør `0026_lukkede_shows.sql` i Supabase → SQL Editor** (efter 0025). Indtil da kan man ikke vælge et lukket show.

- **Sælgeren** sætter flueben i **Lukket show, kun for inviterede**, når showet oprettes, eller trykker **Lukket** i studiet.
  I studiet står invitationslinket med **Kopiér link**, **Del** og **Lav et nyt link** (det gamle holder op med at virke) og
  hvor mange der er inviteret.
- **Skjult:** showet og dets varer står ikke i listerne, på forsiden, i kategorierne, i søgningen, i søgeagenterne eller i
  morgenmailen, og siderne er ikke i Google.
- **Adgang:** kun sælgeren, gæsterne og dem, der har åbnet linket og er logget ind, kan se videoen, skrive i chatten, byde,
  sætte maks-bud og købe. Det tjekker databasen selv. Alle andre ser "Det her show er kun for inviterede".
- **Besked:** når showet går live, får kun de inviterede besked (ikke alle følgere).
- **Når showet er slut,** kommer det usolgte til salg for alle som normalt.

---

## AI skriver annoncen

Bruger samme nøgle som billedvalget (`ANTHROPIC_API_KEY`). Der skal ikke køres noget i Supabase.

- **I køen (studiet):** knappen **Udfyld med AI** øverst i "Læg en vare i køen". Uden billeder åbner den kameraet eller
  billedvalget. Claude ser billederne (gjort små) og udfylder navn, størrelse, stand, kategori og beskrivelse (med mærke og
  materiale, hvis de kan læses på mærkatet) og giver et prisforslag. Prisen sættes aldrig af sig selv: sælgeren trykker
  **Brug 500 kr** eller skriver sin egen.
- **Sælg med video:** når billederne fra videoen er valgt, udfylder Claude annoncen af sig selv. Knappen kan bruges igen.
- **Kun forslag:** felter, sælgeren allerede har skrevet i, bliver ikke ændret. Beskeden siger, hvad sælgeren skal tjekke
  (fx størrelse, mærke og altid mål). Claude må ikke gætte mærke, størrelse eller materiale, og sætninger om "ægte" eller
  "original" bliver fjernet (det klarer ægthedstjekket).
- **Fejl:** svarer Claude ikke, eller ser den ingen vare, får sælgeren en besked og udfylder selv. Uden nøglen er knappen væk.
- **Bremse:** højst 30 forslag pr. sælger på 10 minutter. Kun sælgere kan bruge den. Det koster et par øre pr. vare.
- Koden: `lib/aiListing.ts` (reglerne til Claude og tjek af svaret), `app/api/studio/ai-listing`, `lib/claude.ts` (fælles
  med billedvalget).

---

## Kamerafiltre i studiet

Ved kameraet i studiet er der to knapper under *Skift kamera*. Der skal ikke køres noget i Supabase eller sættes nøgler i Vercel.

- **Solen (Lys op)** gør billedet lysere i dårligt lys uden at ændre farverne, så varerne ser ud, som de er.
- **Personen (Slør baggrund)** slører alt bag sælgeren. Første gang henter browseren en model på ca. 10 MB fra
  `relived.dk/mediapipe`. Den kopieres fra `node_modules` ved hver build (`scripts/mediapipe.mjs`), så intet hentes fra
  fremmede servere.
- Filtrene kører på sælgerens egen enhed. Seerne ser billedet med filter, og det kommer med på billedet og klippet af varen.
- Valget huskes i browseren til næste show. Kan enheden ikke sløre baggrunden, får sælgeren besked, og knappen slår fra igen.
  Knapperne vises ikke i browsere, der slet ikke kan bruge filtre.

---

## Samlerabat

**Kør `0027_samlerabat.sql` i Supabase → SQL Editor** (efter 0026). Indtil da er der ingen samlerabat, og kurven og
betalingen virker som før.

- **Sælgeren** vælger under **Mine shows → Samlerabat** en rabat ved 2 varer og ved 3 eller flere (0–30 %). Rabatten
  ved 3 eller flere er mindst den samme som ved 2.
- **Køberen** ser rabatten ved sælgerens oplysninger på varesiden, på sælgerens side og i showet. I kurven bliver den
  trukket automatisk for alt, køberen betaler hos sælgeren på én gang (også fra flere shows), og der står fx
  "Køb 1 vare mere hos …, og få 15 % i samlerabat".
- **Betalingen** regner rabatten ud igen på serveren (`app/api/checkout/route.ts`) og fordeler den på varerne hos Stripe.
  Ordrens `items_amount` er beløbet efter rabatten: det, sælgeren får, og det, der indberettes. Køberbeskyttelsen
  (5 % + 5 kr) regnes af beløbet efter rabatten.
- Koden: `bundleDiscount`, `bundlePct`, `nextBundle` og `spreadDiscount` i `lib/pricing.ts`, `lib/bundles.ts`,
  `app/(site)/studio/BundleDiscount.tsx` og `set_bundle_discount` i databasen.

---

## Bud på varer til fast pris

**Kør `0028_bud_paa_varer.sql` i Supabase → SQL Editor** (efter 0027). Indtil da vises knappen **Giv et bud** ikke.

- **Køberen** trykker **Giv et bud** på en vare, der er til salg efter showet. Buddet skal være mindst 70 % af prisen og
  under prisen. Der er forslag på 90 % og 80 %. Køberen kan skifte sit bud eller trække det tilbage, og højst byde 3
  gange om dagen på samme vare (og have 20 åbne bud i alt). De åbne bud står også under **Mine køb → Dine bud**.
- **Sælgeren** får besked på telefonen eller mail og svarer under **Mine shows → Bud på dine varer** med **Sig ja** eller
  **Nej tak**. Ja: varen bliver reserveret til køberen til budet og lander i kurven, præcis som ved Køb nu (betal inden
  3 dage). Køberen får besked om svaret.
- **Et bud gælder i 48 timer.** Det lukker af sig selv, hvis varen bliver solgt, taget af salg, fjernet eller sat ned til
  budet eller derunder. Det daglige job markerer de udløbne.
- Ingen andre end køberen og sælgeren kan se buddet. Blokerede købere og varer, der venter på ægthedstjek, kan ikke få bud.
- Koden: `make_offer`, `answer_offer`, `withdraw_offer` og `expire_offers` i databasen, `app/api/offers` (beskederne),
  `lib/offers.ts`, `app/(site)/ting/[slug]/MakeOffer.tsx` og `app/(site)/studio/Offers.tsx`.

---

## Kategorien Cykler og barnevogne

**Kør `0029_cykler.sql` i Supabase → SQL Editor** (efter 0028). Indtil da kan kategorien ikke vælges, når man opretter et
show, en vare eller en videoannonce. Kategorisiden findes alligevel, men er tom.

- Adressen er `/kategori/cykler-og-barnevogne`, og nøglen i databasen er `cykler`. Den dækker cykler, børnecykler,
  ladcykler, elcykler, løbehjul, barnevogne og klapvogne.
- **Afhentning:** cykler og barnevogne er for store til en pakkeshop. I kurven er **Afhent hos sælgeren** valgt på
  forhånd, og varesiden siger, at varen hentes gratis. Pengene går først til sælgeren, når køberen har bekræftet, at
  varen er hentet.
- **Stjålne cykler:** kategorisiden beder køberen tjekke stelnummeret i politiets cykelregister på politi.dk.
- AI-annoncen kan foreslå kategorien. Søgning og søgeagenter kan bruge den.
- Koden: `lib/format.ts` (kategorien), `lib/categoryPages.tsx` (teksterne), `lib/categories.ts` (skjuler kategorien,
  indtil filen er kørt), `PICKUP_CATEGORIES` i `lib/pricing.ts` og billedet `public/img/cover-cykler.jpg` (Pexels).
- 0017 og 0024 kender også den nye kategori, så de stadig kan køres igen uden fejl.

## Fragt efter vægt

**Kør `0030_pakkestoerrelse.sql` i Supabase → SQL Editor** (efter 0029). Indtil da bruger alle varer kategoriens
pakkestørrelse, og feltet *Pakke* vises ikke i studiet. Alt andet virker.

- **To priser:** 39 kr for en lille pakke op til 1 kg og 49 kr for en stor pakke på 1–5 kg (`PARCELS` i `lib/pricing.ts`).
  Labelen koster ca. 34,80 kr og 39,80 kr uden moms hos Shipmondo (oktober 2026), så begge priser dækker labelen.
- **Pakken på varen:** bolig og cykler er store pakker, resten små. Sælgeren kan ændre det under *Pakke*, når varen lægges
  i køen eller rettes (`items.package_size`, tom = kategoriens standard).
- **Pakken i kurven:** en lille vare tæller som et halvt kilo og en stor som to (`parcelFor`). To kjoler er altså stadig
  39 kr, mens tre varer eller én stor vare er 49 kr. Kurven og betalingen på serveren bruger samme regel.
- **Labelen:** den vægtklasse, køberen har betalt for, er valgt på forhånd, og sælgeren ser, hvad køberen har betalt.
  Vælger sælgeren en tungere label, betaler Relived forskellen.
- Test: `qa_vaegt.py` (med filen) og `qa_vaegt.py uden0030` (efter `SKIP=0030 bash restart_qa.sh`).

## Designsystem

Forslaget ligger som et designlærred ("Relived designsystem"). Det er ført over i `app/globals.css` (sidst i filen):

- **Farver med ét job hver:** rød (`--red`) kun til at købe, betale, oprette og gå live. Messing (`--brass`) er kvalitet:
  ægthedstjek og det lille mærke over forsidens overskrift. Mint (`--mint`) er tryghed. Resten er koksgrå og elfenben.
- **`.btn-ivory`:** den lyse knap til den næstvigtigste handling ("Se med", "Se varer til salg"), så der kun er én rød knap pr. skærm.
- **Bevægelse:** knapper løfter sig og trykkes sammen, varekort løfter sig 4 px, live-prikken har en rolig ring.
  Alt slås fra ved "reducer bevægelse".
- **Felter** har en messingring, når de er i fokus. Kort og varebilleder har hjørner på 20.
- Skriften er uændret (Familjen Grotesk og Geist Mono).

## Gratis-kampagnen (0 kr i køberbeskyttelse)

Startes og stoppes i **Backoffice → Indstillinger → Gratis-kampagne**. Der skal ikke køres nogen fil i Supabase.

- **Start:** vælg sidste dag (forslaget er seks måneder frem), og tryk *Start kampagnen*. Så koster køberbeskyttelsen 0 kr for alle.
  Selve beskyttelsen gælder stadig: pengene holdes tilbage, til køberen har fået varen.
- **Stop:** *Stop kampagnen nu*, eller automatisk på slutdatoen, eller når den anslåede udgift rammer loftet på 30.000 kr
  (`FEE_FREE_CAP` i `lib/feeFree.ts`). Ved loftet får admins en mail. Loftet og tallene står kun i koden og i Backoffice.
- **Tallene i Backoffice:** betalte ordrer uden gebyr, hvad der er købt for, det gebyr, vi har givet afkald på, og "Brugt":
  et skøn over Stripes pris pr. betaling og udbetaling (`PAY_COST` i `lib/feeFree.ts`). Ret satserne, når de rigtige priser er kendt.
- **På siden**, mens kampagnen er i gang: noten "0 kr i gebyr for køber og sælger til og med …" på forsiden og Sælg
  (`components/FreeNote.tsx`), 0 kr i kurven, og nye tekster på Sådan virker det, Spørgsmål og svar, den engelske side,
  handelsbetingelserne (§ 3) og vilkårene (§ 8). Siderne skifter inden for fem minutter.
- **Betalingen** (`app/api/checkout/route.ts`) læser kampagnen frisk. Har prisen ændret sig, siden kurven blev åbnet, bliver
  køberen bedt om at opdatere siden, så ingen betaler et andet beløb end det, de så.
- Indstillingen ligger i `settings` under `fee_free`: `{ from, until }` og, når den er stoppet, `{ ended, reason }`.
- Test: `qa_gratis.py`.

## Video overalt

- **Programmet på forsiden** (`components/feed/Program.tsx`): "I aften på Relived" med de shows, der er live eller i programmet.
  Live-showet har rød kant og *Se med*, de andre klokkeslæt og *Husk mig*. Det har afløst de runde sælgerbilleder.
- **Klip på varekortene** (`components/ClipPreview.tsx`): varer til salg med et klip har mærket *Set på video*. Klippet afspilles
  uden lyd, når musen holdes over kortet, eller når kortet står midt på skærmen på telefonen. Kun ét ad gangen, og videoen hentes
  først, når den skal afspilles. Ingen afspilning ved "reducer bevægelse" eller datasparer.
- **De tre løfter på varesiden** (`.trust3`): video, beskyttet betaling og levering (eller ægthedstjek) lige under købsknappen.
- Test: `qa_video_overalt.py`.
## Kun afhentning

**Kør `0036_kun_afhentning.sql` i Supabase → SQL Editor.** Indtil da kan køberen vælge pakkeshop eller afhentning til alle
varer som før, og valget *Kun afhentning* vises ikke.

- **Sælgeren** vælger under **Levering** (i køen i studiet, når en vare rettes, og ved videoannoncer): lille pakke, stor pakke
  eller **Kun afhentning (for store varer)**. Det er til sofaer, kommoder og andet over 5 kg.
- **Køberen** ser på varesiden "Skal hentes hos … i …". I kurven kan pakken fra den sælger kun hentes, og der står hvorfor.
- **Betalingen** (`app/api/checkout/route.ts`) laver afhentning, hvis bare én af varerne fra sælgeren er sat til kun
  afhentning, også selvom browseren sender pakkeshop.
- Cykler og barnevogne har stadig afhentning valgt på forhånd (`PICKUP_CATEGORIES`), men kan sendes, hvis køberen vælger det.
- Koden: `items.pickup_only`, `fetchPickupOnly` og `pickupOnlyReady` i `lib/parcels.ts`, `components/DeliveryField.tsx`.
- Test: `qa_afhentning.py` (med filen) og `qa_afhentning.py uden0036` (efter `SKIP=0036 bash restart_qa.sh`).

## Nyhedsbrev, Green Friday og julekalender

Der skal ikke køres noget i Supabase. Tilmeldingerne bruger samme liste som ventelisten (tabellen `waitlist`).

- **Forsiden** har et felt under feedet med kort for Green Friday (27. november kl. 20) og julekalenderen (1.–24. december
  kl. 20) og tilmelding til nyhedsbrevet. Der er en nedtælling på kortene. I december lyser dagens låge rødt, og de
  åbnede låger er nedtonede. Kortene forsvinder af sig selv, når kampagnen er slut, og så står der kun "Få ugens shows i
  din indbakke".
- **`/nyhedsbrev`** er en side til at dele på sociale medier og i annoncer. Den står i bunden af siden og i sitemap.xml.
- **Tilmelding:** e-mail, flueben for samtykke og et frivilligt flueben "Jeg vil også gerne sælge". Man får en mail og
  bekræfter (dobbelt tilmelding). Mailen nævner kun de kampagner, der ikke er overstået.
- **Backoffice → Nyhedsbrev** (før Venteliste) viser alle tilmeldte. Kolonnen *Hvor* viser, hvor de skrev sig op, og
  *Vil sælge* tæller dem med fluebenet.
- **Kontakterne under *På siden*** (Backoffice → Nyhedsbrev) er slået fra, til I slår dem til: tilmeldingen på forsiden,
  Green Friday og julekalenderen. De gemmes i `settings` og virker inden for et minut. `/nyhedsbrev` virker altid, men
  viser kun de kampagner, der er slået til. Bekræftelsesmailen nævner også kun dem.
- **Skriv med Claude:** skriv et par stikord, vælg længde, og tryk *Skriv udkast*. Claude kender dagens dato, kampagnerne,
  der er slået til, og de næste 8 offentlige shows i programmet. *Ret udkastet* retter det nuværende udkast efter nye
  stikord, fx "gør den kortere". Det er kun et udkast: læs det, ret det, og send en test til dig selv først. Kræver
  `ANTHROPIC_API_KEY` i Vercel (den samme som til billedvalget). Skrivningen bruger `claude-sonnet-5-5`, som kan ændres
  med `ANTHROPIC_WRITER_MODEL`. Højst 20 udkast pr. admin på 10 minutter.
- **Datoerne** står i `lib/campaigns.ts`.

## Niveauer og mærker

**Kør `0032_niveauer.sql` i Supabase → SQL Editor** (efter 0031). Indtil da vises der ingen niveauer, og resten af siden
virker som før.

- **Niveauerne** regnes ud fra handler, der er helt afsluttet (betalt, sendt og modtaget). Intet gemmes som tal, så de
  passer altid med ordrerne. Annullerede og refunderede køb tæller ikke.
  - Sælger: Ny → Bronze (5 solgte varer) → Sølv (25 og mindst 4,5 stjerner) → Guld (100, mindst 4,7 stjerner og 9 ud
    af 10 pakker sendt senest 5 dage efter betalingen) → VIP (250 og kravene til Guld).
  - Køber: Ny → Bronze (3 købte varer) → Sølv (10) → Guld (25) → VIP (50).
  - Stjernekravet gælder kun, når sælgeren har fået bedømmelser. Afhentninger tæller ikke med i forsendelserne.
- **Mærker:** Stiftende sælger (de første 100 sælgere med et salg), Stiftende køber (de første 250 købere), Første køb,
  Første show, Budkonge (10 vundne budsalg), Lynafsender (10 pakker sendt inden for et døgn), Stamkunde (3 ordrer hos samme
  sælger) og Natteravn (show startet efter kl. 22).
- **Hvor de vises:** ved navnet i chatten (sælgerens niveau på sælgerens beskeder, ellers køberniveauet), i
  sælgeroplysningerne ved showet, på sælgerens side og ved varerne, og på købernes side. "Ny" vises kun på Min konto.
- **Min konto → Dit niveau** viser, hvor langt man er til næste niveau, og hvilke mærker man mangler. Køberen kan skjule
  sit køberniveau og sine købermærker. Andre ser aldrig antal køb eller salg, kun niveauet.
- **VIP udvalgt af jer:** Backoffice → Medlemmer → medlemmet → *VIP-sælger* / *VIP-køber*. Det virker med det samme.
- **`/niveauer`** forklarer det hele for brugerne og står i sitemap.xml. Kravene står i `lib/levels.ts` og i
  `0032_niveauer.sql` (begge steder skal rettes, hvis kravene ændres).
- Der er ingen fordele knyttet til niveauerne endnu. Skal VIP fx give bedre placering i listerne, skal siden *Sådan
  sorterer vi* og vilkårene opdateres først.

## Filtre i søgningen

**Kør `0033_filtre.sql` i Supabase → SQL Editor** (efter 0032). Indtil da virker søgningen som før, og vælger man et
af de nye filtre, står der, at de bliver sat op.

- **Filtrene på `/soeg`:** kategori, størrelse (kun ved tøj og sko), pris fra–til, stand (ny, som ny eller bedre, god
  stand eller bedre, ikke slidt), hvornår (til salg nu, live nu, kommer snart), købsform (Køb nu eller budsalg), sælger
  (privat eller virksomhed), ægthed tjekket, med video og sortering (anbefalet, nyeste, billigste, dyreste, live og snart
  live). Lister og afkrydsninger søger med det samme. Pris og størrelse søger, når man trykker Enter eller *Vis varer*.
  På mobilen ligger filtrene bag knappen *Filtre*, som viser, hvor mange der er valgt.
- **Adressen** har kun de valgte filtre med, fx `/soeg?q=kjole&stand=god&type=budsalg&sorter=billigst`, så en søgning
  kan deles.
- **Budsalg** er varer på budsalg i shows, der er live eller kommer snart. Får en vare ingen bud, kan den bagefter købes
  til startprisen og tæller så som *Køb nu*.
- **Søgeagenter** ("Giv mig besked om nye") gemmer filtrene med (sorteringen tæller ikke), og beskederne følger dem.
  Min konto viser filtrene ved hver søgeagent.
- **Stand:** sælgerne vælger nu mellem fem faste muligheder (Ny med prismærke, Som ny, God stand, Brugt, med lidt slid,
  Slidt) i stedet for at skrive selv, så filteret virker. Varer med en gammel, fritskrevet stand beholder den. Den tæller
  med i filteret, hvis den begynder med et af ordene (fx "God stand, lidt fnuller").

## Appen på hjemmeskærmen

Relived kan lægges på hjemmeskærmen som en app (en PWA). Der skal ikke køres noget i Supabase, og der er ingen
App Store eller Google Play.

- **`/app`** forklarer, hvordan man henter appen, med faner for iPhone og iPad, Android og computer (den, man bruger,
  vises først). Kan browseren installere med ét tryk (Chrome og Edge), står knappen *Hent appen* øverst. Åbnet i appen
  står der, at man allerede bruger den. Siden er linket fra menuen på telefonen, bunden af siden og beskeden om
  iPhone-beskeder. Linkene er skjult i selve appen.
- **Tilbuddet nederst på telefonen** ("Hent Relived som app"): kommer kun på telefoner, ikke i appen, først på side
  nummer to, når cookiebeskeden er væk, og kun på sider, hvor man kigger rundt (ikke i shows, studiet, klip, kurven og
  login). På Android installerer *Hent* med det samme, på iPhone fører *Se hvordan* til `/app`. Lukker man det, kommer
  det ikke igen i 30 dage (`relived-app-banner` i browseren). Koden: `components/app/InstallBanner.tsx`.
- **I appen** er der en tilbage-knap øverst til venstre på telefonen (der er ingen tilbage-knap fra browseren).
  `<html>` får klassen `is-app`, og alt med klassen `only-web` er skjult.
- **Genveje:** holder man fingeren på ikonet (Android og computer), står Live nu, Budsalg, Søg og Sælg (`app/manifest.ts`).
- **iPhone og iPad:** navnet under ikonet er Relived, statuslinjen er sort, og der er en startskærm med logoet i stedet
  for en hvid skærm (`public/splash/`, lavet ud fra `public/img/logo.svg`, listen står i `lib/splash.ts`).
- **Uden net:** åbner man en side uden forbindelse, viser appen `public/offline.html` (alt i én fil) med *Prøv igen*.
  Den prøver selv igen, når nettet kommer tilbage. Ellers gemmer service workeren (`public/sw.js`) intet, så siderne
  er aldrig gamle.
- **Tal på ikonet:** kommer der en besked på telefonen, står antallet af ulæste beskeder på app-ikonet (hvor telefonen
  kan det). Det forsvinder, når appen åbnes.
- Service workeren bliver nu registreret for alle (ikke kun dem, der slår beskeder til), lidt efter at siden er vist.

## Chatten på afstand (sælgeren på en stander)

Der skal ikke køres noget i Supabase.

- **Chat i videoen:** mens sælgeren er live, står de nyeste beskeder med stor skrift oven på sælgerens eget billede i
  studiet (seerne ser den ikke). Kun seernes beskeder og køb/bud, ikke sælgerens egne og ikke "Showet er startet",
  lynrunder og budsalg, som sælgeren selv starter. Spørgsmål (der slutter med ?) får et gult mærke, køb står i rødt,
  og den nyeste blinker kort. Under videoen vælges *Fra, Normal, Stor* eller *Ekstra stor* (4, 4 eller 3 beskeder).
  Valget huskes (`relived-studiechat`). Som udgangspunkt *Stor* på telefonen og *Fra* på computeren, hvor chatten står
  ved siden af. Koden: `components/BigChat.tsx`.
- **Skærmen slukker ikke**, mens kameraet er tændt i studiet (`components/useWakeLock.ts`). Ellers kan telefonen gå i
  dvale midt i showet, når ingen rører den.
- **Chatten på en anden skærm:** `/studio/[id]/chat` (linket *Vis chatten på en anden skærm* under videoen) viser
  chatten med stor skrift på fx en computer, tablet eller et fjernsyn ved siden af. Til sælgere, der filmer med
  bagkameraet, så telefonens skærm vender væk. Øverst står live-tiden, showet og den vare, der vises nu, med pris eller
  højeste bud. Skriften gøres større og mindre med A+ og A− (huskes, `relived-chatskaerm`), spørgsmål er gule, og man
  kan svare i chatten. Skærmen slukker ikke. Kun værten og gæsterne i showet kan åbne siden (andre får 404).
  Siden har ingen menu og bund (`app/(skaerm)/`).
- **I studiets almindelige chat** er spørgsmål også gule.

## Nedtælling til live

**Kør `0034_nedtaelling.sql` i Supabase → SQL Editor** (efter 0033). Indtil da er der kun *Gå live nu* i studiet.

- **I studiet:** når kameraet er tændt, står der *Gå live nu* og *Start en nedtælling i stedet* med 1, 3, 5 eller 10
  minutter. Under nedtællingen ser sælgeren *Live om 4:59* over sit eget billede (ingen seere kan se kameraet endnu)
  og kan trykke *Gå live nu* eller *Stop nedtælling*. Når tiden er gået, kommer 3-2-1, og studiet går selv live. Det
  kræver, at studiet er åbent, og kameraet virker.
- **Seerne** ser *Live om 4:32* på showets side, og chatten er åben, mens der tælles ned (og et kvarter efter, hvis
  sælgeren ikke når at gå live). Siden skifter selv til video. Chatskærmen (`/studio/[id]/chat`) viser også nedtællingen.
- **Beskeden** til følgerne og dem, der har trykket *Husk mig*, kommer, når nedtællingen starter: "@maja går live om
  5 minutter". Der kommer ikke en ekstra besked, når showet går live.
- Showets starttidspunkt flyttes til nedtællingens slut, så showet står øverst under *Snart live*. Nedtællingen ryddes
  af sig selv, når showet går live eller slutter.
- **Ventemusik:** sælgeren vælger et nummer (eller *Ingen musik*), før minutterne vælges, og kan trykke *Lyt* for at
  høre 20 sekunder fra den mest livlige del. Valget huskes til næste gang. Seerne får knappen *Tryk for ventemusik*
  (browsere spiller ikke lyd, før man har trykket) og hører nummeret fra starten og i ring. Musikken tones ud, når showet
  går live, eller nedtællingen stoppes. Har seeren slået musikken til før, prøver siden selv næste gang. Studiet spiller
  ikke musikken, mens der tælles ned.
- **Numrene** er Svanekjærs egne og ligger i `public/musik/` (mp3, 128 kbit/s, lige høje, 3-4 MB). Et nyt nummer: læg
  filen der, og skriv det på listen i `lib/music.ts` med titel og hvor smagsprøven starter.
- Koden: `lib/countdown.ts`, `lib/music.ts`, `components/WaitMusic.tsx`, studiet (`StudioClient.tsx`), showets side
  (`ShowClient.tsx`) og `app/api/shows/[id]/notify/route.ts`.

## App-rammen og forsiden som feed

Siden er stadig en hjemmeside på relived.dk, men bygget op som en app. Der skal ikke køres noget i Supabase.

- **Computer:** menuen står i venstre side (For dig, Live nu, Budsalg, Til salg, Klip, Kategorier, dem man følger og
  Sælg). Toppen har søgefeltet, kurven og kontoen. Under 1360 px bredde, og altid i live-shows og studiet, er menuen
  smal med kun ikoner, så videoen får pladsen.
- **Telefon:** toppen har logo, søg og en knap med hele menuen. I bunden er en fast menulinje: Forside, Live, Sælg, Kurv
  og Mig. Den er skjult i live-shows, studiet, klip og gæstekameraet.
- **Forsiden:** faner, runde billeder af dem, der er live eller går live snart, og et feed med det store live-kort og
  blandede kort (shows, varer til salg, budsalg, varer i kommende shows). I højre side: dine bud, et skub når én vare mere
  giver samlerabat, Snart live, "Ny på Relived?" (kun logget ud) og Tryg handel. Under feedet står budsalg, flere varer
  til salg, kategorierne og teksterne om, hvordan det virker (de samme overskrifter som før, af hensyn til Google).
- `/api/live-now` siger, hvor mange der er live (gemmes i 30 sekunder). Tallet står ved Live nu i menuen.
- **Når ingen er live**, viser det store kort på forsiden en video uden lyd i ring (`public/video/welcome-live-v2.mp4` og
  `.webm`, billedet før den starter: `public/img/welcome-live-poster-v2.jpg`). Den hentes først, når kortet kan ses, har en
  knap til at stoppe den og spiller ikke for folk, der har bedt om mindre bevægelse eller sparer data. Er der få shows og
  varer, fylder kortet hele bredden. Koden: `components/feed/WelcomeVideo.tsx`.
- **Logoet "Søgeren"** (november 2026): bogstaverne fra Caspers logo-fil (med pilen i e og play-tegn) uden den røde flade,
  inde i fire røde hjørner som på en kamerasøger, med "live" i rødt og et lille "● LIVE" i hjørnet. `public/img/logo.svg` er
  til mørk baggrund (hvid tekst), `public/img/logo-dark.svg` til lys (sort tekst), og `public/img/logo-mark.svg` er "re" i
  hjørnerne til den smalle menu. Ikonerne (`app/icon.png`, `app/apple-icon.png`, `public/icon-192.png`, `public/icon-512.png`)
  er samme "re" på mørk flade, og `public/img/logo.png` er den lyse udgave. Det gamle logo (hvidt på rød flade) ligger i Git.
  Delingsbilledet er `public/img/og-v2.jpg`.
- **Designregler** (november 2026): skriftstørrelser følger en fast skala (12, 13, 14, 15, 16, 18, 20, 24, 28 og 32 px,
  skrevet i rem); kun overskrifterne skalerer med skærmen (clamp). Mærker og små etiketter er mindst 12 px. Knapper og
  links til `/saelg` hedder "Sælg dine varer" (bundmenuen bare "Sælg"). Tomme sider bruger `components/EmptyNext.tsx`
  med ikon, kort overskrift og tilmelding. Kategorierne står kun i venstremenuen inde under Kategorier.
- **Mørk koksgrå** (november 2026): baggrunden er `#141316` (før næsten-sort `#0B0A0C`), og kasserne (`--bg-2`,
  `--surface`, `--surface-2`) er tydeligt lysere med en tynd lys kant foroven og en blød skygge, så siden ikke flader ud.
  `--side` er venstremenuen. Samme farve i `app/manifest.ts`, `themeColor` i
  `app/layout.tsx`, `public/offline.html` og startskærmene i `public/splash/`. Mørke skygger oven på billeder er stadig
  næsten-sorte, så teksten kan læses.
- **Knapper og rødt** (november 2026): rød betyder "live" eller "tryk her", og hver skærm har én rød hovedknap. Efter
  lanceringen er "Sælg dine varer" i menuen og + i bundmenuen neutrale for købere (røde for sælgere), styret af
  `launched()` via `AppShell`. På telefonen: varesiden har en fast Køb-bjælke (`components/StickyCta.tsx`), når sidens
  egen knap er ude af syne; forsidens "1 sælger er live nu" er en rød knap; videoen i et show er aldrig højere end
  skærmen, så Køb/Byd altid kan ses; og "Tryk for lyd" er hvid, så Køb/Byd er den eneste røde knap i videoen.
- **Skiltet på væggen** i stuebillederne (`sell-phone-v2.jpg`, `how-live-v2.jpg`, `saelg-stue-v2.jpg`) og i
  velkomstvideoen viser det nye logo (november 2026). Videoen slutter nu, før det gamle logo kom til sidst.
- **Kategorikortene** bruger Caspers egne billeder, `public/img/kat-*.jpg` (feltet `card` i `lib/format.ts`). De er skåret
  ud af ét samlet billede og forstørret 4 gange. `cover` (`public/img/cover-*.jpg`) bruges stadig til guiderne,
  reservebilledet til shows uden profilbillede og kategorisidernes delingsbillede. Bunden af siden nævner ikke, hvor
  billederne kommer fra.
- **Størrelse følger kategorien.** I studiet og under Sælg med video hedder feltet *Str.* for tøj, *Mål* for tasker, bolig og
  andet, *Indhold* for skønhed og *Størrelse* for cykler. Samleobjekter har intet felt. Det gemmes i `items.size`.
  Køberne ser "Str. M" for tøj og sko, mens mål og indhold står, som de er ("40 × 60 cm", "50 ml"). Koden: `sizeField`,
  `nameExample` og `sizeText` i `lib/format.ts`.
- Koden: `components/shell/` (rammen, venstremenuen, bundmenuen og det, de skal vide om brugeren),
  `components/Header.tsx`, `components/feed/` (kortene og højre side) og `app/(site)/page.tsx`.

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
at man ikke kan købe sine egne varer, at en lynrunde lukker til tiden, at kun én får varen, når to trykker samtidig,
og at kun ét bud går igennem, når to byder det samme på samme tid.

## Sådan hænger det sammen

```
Browser ──► Vercel (Next.js 16)
   │           ├─ sider og SEO (server-renderet)
   │           └─ /api/livekit-token: giver videoadgang (sælger må sende, seere må se)
   │
   ├──► Supabase: login, database (Postgres + RLS) og realtid (chat, køb, "vises nu")
   └──► LiveKit: video fra sælgerens kamera til seerne
```

- `app/` sider og API. `app/live/[handle]` er seersiden, `app/studio/[id]` er studiet.
- `components/` fælles dele (chat, video, header, realtid).
- `supabase/migrations/0001_init.sql` hele databasen: tabeller, adgangsregler og funktionerne
  `set_show_status`, `present_item`, `start_rush` og `snup`. De senere filer bygger videre (billeder, betaling, fragt,
  tryghed, backoffice, `0007_varer.sql` med `buy_now`, `items_feed` og påmindelser, og `0008_budsalg.sql` med
  `start_auction`, `place_bid` og `close_auction`).

Al logik, der skal være til at stole på (hvem der fik varen, om lynrunden er slut, hvem der må styre et show),
ligger i databasen. Browseren kan ikke snyde sig udenom.

## Næste trin

1. **AI skriver annoncen** ud fra billeder eller video (navn, kategori, stand, beskrivelse og evt. et prisforslag).
2. **Forhåndsbud og maks-bud** og **lukkede shows** (kun med et hemmeligt link).
3. **MitID i produktion** via Idura, når CVR-nummeret er på plads (koden er klar, se *MitID for sælgere*).
4. **Shipmondo**, Stripe med rigtige penge og Vercel Pro, når CVR-nummeret er på plads.
5. **PostNord** som tredje fragtfirma, hvis køberne efterspørger det.

Husk også at oprette mailadressen `kontakt@relived.dk`, som privatlivspolitikken henviser til. 

## Genbrugstælleren

**Kør `0035_genbrug.sql` i Supabase → SQL Editor** (efter 0034). Indtil da vises tælleren ikke.

- **Forsiden og Om Relived:** "1.248 varer har fået et liv mere via Relived" (varer, der er solgt og betalt). Linjen
  vises først, når tallet er mindst 25 (`REUSE_MIN` i `lib/reuse.ts`).
- **Min konto:** "Du har givet 12 varer et liv mere" (købt eller solgt og betalt), når man har mindst én.
- **Grøn markedsføring:** siden 27. september 2026 må man ikke bruge generelle ord som "bæredygtig", "grøn" eller
  "miljøvenlig" uden dokumentation, og CO2-påstande skal kunne bevises. Tælleren bruger Relivids egne tal og lover intet
  om CO2. Skriv ikke de generelle ord om Relived i teksterne uden at tjekke reglerne først.
- Koden: `supabase/migrations/0035_genbrug.sql`, `lib/reuse.ts`, `components/ReuseCounter.tsx` og `app/(site)/konto/page.tsx`.

## Forsidens top (HomeHero)

`components/feed/HomeHero.tsx` er toppen af forsiden: overskrift og knapper til venstre og et **eksempel på et show** i en
telefon til højre (video, chat, hjerter og "Køb nu"). Det er en demonstration og mærket "Eksempel på et show": chatnavnene,
tasken og prisen er opdigtede, og "Køb nu" køber ikke noget. Kun kortet "Næste show" og linjen "X sælgere er live nu" er
rigtige data. På telefoner vises showet som et kort øverst uden telefonramme.

- Stillbilledet (`/img/welcome-live-poster-960.webp`) hentes først, og videoen starter, når siden er klar.
- Hjælp-knappen viger på telefoner, mens knapperne i toppen er i billedet (`body.hh-cta-in`).
- "0 kr i gebyr" vises kun, når gratis-kampagnen kører (`feeFreeCopy()`); ellers står der "Gratis at sælge i beta".
- Det store videokort (WelcomeTile) og kassen "Tryg handel" er fjernet fra forsiden, fordi toppen og sektionen
  "Er det trygt at handle her?" dækker det samme.
