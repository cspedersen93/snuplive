# SnupLive

Live shopping med brugte ting: sælgeren går live på video, seerne chatter med og snupper med ét tryk.
Det hele kører i browseren på snuplive.dk.

## Hvad virker i trin 1?

- Login med e-mail (link eller kode, ingen adgangskode)
- Profil med brugernavn og en fast side pr. sælger: `snuplive.dk/live/brugernavn`
- Sælgere opretter shows, lægger ting i køen og går live med kamera og mikrofon fra studiet
- Seerne ser videoen live, chatter og snupper. Den første, der trykker, får tingen
- Lynrunder på 10 sekunder
- "Live nu" med alle live-shows og et program over kommende shows
- "Mine snup" for købere og en salgsoversigt for sælgere
- SEO-sider: forside, Sælg live, Sådan virker det, FAQ (med FAQ-schema), sitemap og robots.txt

Betaling, fragt og MitID kommer i de næste trin (se nederst). Indtil da er et snup en reservation, og der bliver ikke trukket penge.

## Det skal du bruge

| Tjeneste | Til | Pris i beta |
| --- | --- | --- |
| GitHub | Koden (dette repo) | Gratis |
| Supabase | Database, login og realtid | Gratis plan |
| LiveKit Cloud | Video | Gratis plan |
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
   Der skal stå *Success. No rows returned*.
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
at man ikke kan snuppe sine egne ting, at en lynrunde lukker til tiden, og at kun én får tingen, når to trykker samtidig.

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
  `set_show_status`, `present_item`, `start_rush` og `snup`.

Al logik, der skal være til at stole på (hvem der fik tingen, om lynrunden er slut, hvem der må styre et show),
ligger i databasen. Browseren kan ikke snyde sig udenom.

## Næste trin

1. **Betaling**: Stripe Connect med MobilePay og kort, så pengene holdes tilbage, til køberen har fået sine ting.
2. **Fragt**: labels og pakkeshops via Shipmondo, samlet fragt pr. sælger og show.
3. **MitID** for sælgere via Idura.
4. **Moderation**: slet beskeder og bloker brugere i chatten.
5. **Følg sælgere** og besked, når de går live.
6. Opgrader Vercel til Pro, før SnupLive tager imod penge.

Husk også at oprette mailadressen `kontakt@snuplive.dk`, som privatlivspolitikken henviser til. 
