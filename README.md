# Relived

Køb brugt live: sælgeren viser tingene frem på video, køberne chatter med og køber med ét tryk.
Det, der ikke bliver solgt, kan købes bagefter til fast pris. Det hele kører i browseren på relived.dk.

## Hvad virker nu?

- Login med e-mail (link eller kode, ingen adgangskode)
- Profil med brugernavn og en fast side pr. sælger: `relived.dk/live/brugernavn`
- Sælgere opretter shows, lægger ting i køen og går live med kamera og mikrofon fra studiet
- Seerne ser videoen live, chatter og køber. Den første, der trykker, får tingen
- Lynrunder på 10 sekunder
- "Live nu" med alle live-shows og et program over kommende shows
- "Mine køb" for købere og en salgsoversigt for sælgere
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
3. Opret et show, og læg 3–4 ting i køen.
4. Tryk **Tænd kameraet** i studiet, og giv browseren lov til kamera og mikrofon. Tryk **Gå live**.
5. Åbn `relived.dk/live/dit-brugernavn` på telefonen (eller bed en ven om det). Videoen skal vise dig.
6. Tryk **Vis næste** i studiet, og køb tingen fra telefonen. Prøv chatten og en lynrunde.
7. Tryk **Afslut show**. Salget står nu under **Mine shows** og hos køberen under **Mine køb**.

---

## Betaling med Stripe

Køberen betaler alt i kurven på én gang med MobilePay, kort, Apple Pay eller Google Pay. Pengene står hos Relived,
indtil køberen trykker "Jeg har fået mine ting" (eller automatisk 7 dage efter, at sælgeren har markeret pakken som sendt).
Så sendes beløbet for tingene til sælgerens Stripe-konto (og fragten, hvis sælgeren selv har sendt pakken uden Reliveds label).
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
   - Som sælger: markér pakken som sendt. Som køber: tryk **Jeg har fået mine ting**. Overførslen kan ses i Stripe under **Connect → Transfers**.

**Før rigtige penge:** aktivér Stripe-kontoen med virksomhedsoplysninger (CVR og bankkonto), skift til de rigtige nøgler
(`sk_live_…` og nye webhook-secrets), tjek at **Accounts v1 support** også er slået til uden for testmiljøet, opgrader Vercel til Pro, og få en revisor til at se på moms af køberbeskyttelsen.

## Fragt med Shipmondo

Køberen vælger en **DAO- eller GLS-pakkeshop** i kurven og betaler 49 kr i fragt pr. pakke (op til 5 kg). Sælgeren trykker
**Lav fragtlabel** under Mine shows, printer labelen og afleverer pakken. Relived betaler labelen hos Shipmondo med de penge,
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
- **Efter showet** kommer alt, der ikke blev solgt, til salg til den samme pris. Køberen trykker **Køb nu**, og tingen lander under
  Mine køb. Sælgeren kan rette prisen eller tage en ting af salg under **Mine shows → Til salg**. Bliver et køb ikke betalt, eller
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
- **Når uret står på 0**, lukker studiet budsalget. Det højeste bud bliver til et køb i køberens Mine køb til buddets pris,
  og vinderen står i chatten. Afslutter sælgeren showet midt i et budsalg, vinder det højeste bud.
- **Ingen bud:** tingen kommer til salg til startprisen med Køb nu, når showet slutter.
- Alt det, der afgør et budsalg (tid, trin, vinder), sker i databasen, så det er det samme for alle, og ingen kan snyde.
  Alle bud gemmes i tabellen `bids`.

## Backoffice

På [relived.dk/admin](https://relived.dk/admin) (kun for e-mails i `ADMIN_EMAILS`) er der:

- **Overblik:** omsætning, din indtjening (køberbeskyttelse og fragt minus labels, før Stripes gebyrer og moms), udbetalt til
  sælgere, penge der holdes tilbage, refunderinger, medlemmer, sælgere, shows og solgte ting for 7 dage, 30 dage, 90 dage, i år
  eller altid, plus en graf pr. dag, uge eller måned, de sælgere der har solgt mest, nyeste medlemmer og seneste ordrer.
- **Sager**, **Ordrer** (med filtre), **Medlemmer** (søg på brugernavn, navn eller e-mail, og se køb, salg og shows for hver)
  og **Shows**.

Kør [`supabase/migrations/0006_backoffice.sql`](supabase/migrations/0006_backoffice.sql) i Supabase først. Filen retter også en
fejl, så en ting, der er blevet annulleret eller refunderet, kan købes igen.

## Klar til lancering: vilkår, sælgertype, anmeldelser, bedømmelser og Skat

1. **Supabase → SQL Editor:** kør [`supabase/migrations/0009_lancering.sql`](supabase/migrations/0009_lancering.sql), **før** den
   nye version kommer på Vercel (0008 skal være kørt først). Ellers virker Mine køb og Bliv sælger ikke. Filen kan køres igen.
2. **Når selskabet har et CVR-nummer**, så opret tre variabler i Vercel med typen **Config**, og tryk **Redeploy**:

   | Navn | Værdi |
   | --- | --- |
   | `NEXT_PUBLIC_COMPANY_NAME` | `Relived ApS` |
   | `NEXT_PUBLIC_COMPANY_CVR` | CVR-nummeret (8 cifre) |
   | `NEXT_PUBLIC_COMPANY_ADDRESS` | Selskabets adresse |

   Indtil da står der *Relived ApS (under stiftelse)* på siden og i vilkårene.

Det er nyt:

- **Handelsbetingelser, vilkår og Om Relived** på `/handelsbetingelser`, `/vilkaar` og `/om-relived`, linket fra bunden af
  alle sider, fra login og fra betalingen.
- **Privat eller erhverv:** man vælger, når man bliver sælger, og kan skifte under Min konto. En erhvervssælger skriver
  firmanavn og CVR. Køberne ser det ved hver ting og hvert show sammen med, om fortrydelsesretten gælder. Køb fra en
  erhvervssælger kan fortrydes med *Meld et problem*. Sælgere fra før skal bekræfte under Min konto.
- **Anmeld** på ting, shows og profiler, også uden login. Du får en mail, og afgør dem under **Backoffice → Anmeldelser**:
  fjern tingen, fjern showet, luk sælgerkontoen eller afvis. Sælgeren får begrundelsen på mail, og den, der anmeldte, får
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
flere konti, og sælgeren skal være fyldt 18. Køberne ser mærket **MitID-bekræftet** ved sælgerens ting og shows. Når kravet er
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

## Videoklip af tingene fra showet

Kør `supabase/migrations/0015_klip.sql` i Supabase → SQL Editor (efter 0014). Der skal ikke nye nøgler i Vercel.

- **Når sælgeren viser en ting frem**, optager studiet de første 15 sekunder (med lyd) i sælgerens browser og lægger klippet
  i mappen `clips` i Supabase Storage. Viser sælgeren den næste ting før tid, gemmes det, der er nået (mindst 4 sekunder).
  Viser sælgeren samme ting igen, erstatter det nye klip det gamle.
- **Bliver tingen ikke solgt**, vises klippet først på tingens side (uden lyd, i loop, med knap til lyd), og kortet under
  *Til salg* får mærket *Video*. Har man slået *reducer bevægelse* til på sin enhed, starter klippet ikke af sig selv.
- **Sælgeren kan slette klippet** under **Studie → Til salg** (*Slet video*).
- **Oprydning:** det daglige job sletter klip 14 dage efter, at tingen er solgt, og klip af ting, der er fjernet.
- Klip fylder ca. 2-3 MB stykket (højst 15 MB). Supabase Free har 1 GB lagerplads, så hold øje med *Storage* i Supabase, når
  der kommer mange sælgere.
- Er 0015 ikke kørt, sker der ingenting: studiet springer klippet over, og siderne virker som før.

---

## Kamerafiltre i studiet

Ved kameraet i studiet er der to knapper under *Skift kamera*. Der skal ikke køres noget i Supabase eller sættes nøgler i Vercel.

- **Solen (Lys op)** gør billedet lysere i dårligt lys uden at ændre farverne, så tingene ser ud, som de er.
- **Personen (Slør baggrund)** slører alt bag sælgeren. Første gang henter browseren en model på ca. 10 MB fra
  `relived.dk/mediapipe`. Den kopieres fra `node_modules` ved hver build (`scripts/mediapipe.mjs`), så intet hentes fra
  fremmede servere.
- Filtrene kører på sælgerens egen enhed. Seerne ser billedet med filter, og det kommer med på billedet og klippet af tingen.
- Valget huskes i browseren til næste show. Kan enheden ikke sløre baggrunden, får sælgeren besked, og knappen slår fra igen.
  Knapperne vises ikke i browsere, der slet ikke kan bruge filtre.

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
at man ikke kan købe sine egne ting, at en lynrunde lukker til tiden, at kun én får tingen, når to trykker samtidig,
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

Al logik, der skal være til at stole på (hvem der fik tingen, om lynrunden er slut, hvem der må styre et show),
ligger i databasen. Browseren kan ikke snyde sig udenom.

## Næste trin

1. **Forhåndsbud og maks-bud, følg sælgere og lukkede shows** (kun med et hemmeligt link).
2. **MitID i produktion** via Idura, når CVR-nummeret er på plads (koden er klar, se *MitID for sælgere*).
3. **Shipmondo**, Stripe med rigtige penge og Vercel Pro, når CVR-nummeret er på plads.
4. **PostNord** som tredje fragtfirma, hvis køberne efterspørger det.

Husk også at oprette mailadressen `kontakt@relived.dk`, som privatlivspolitikken henviser til. 
