# Testmiljø til Relived (kun til test, aldrig til main)

En lokal kopi af siden med en rigtig Postgres og falske udgaver af Supabase, Stripe, Shipmondo og Resend.
Alle nøgler herinde er opdigtede testværdier.

Genopbyg på en ny maskine:
1. Læg mappen i `/home/claude/qa` og repoet i `/home/claude/snuplive` (`npm ci`).
2. Hent PostgREST (v12.2.3, `postgrest-v12.2.3-linux-static-x64.tar.xz` fra github.com/PostgREST/postgrest/releases) til `bin/postgrest`.
3. `bash restart_qa.sh build` og derefter `bash restart_qa.sh reset`.
4. `python3 qa_retur.py` og (efter en ny reset) `python3 qa_fragtskade.py`.

Alle tests kører på en frisk database (`bash restart_qa.sh reset` før hver):
- `qa_retur.py` (73 tjek), `qa_fragtskade.py` (22) og `qa_mails.py` (36).
- `qa_afhentning_bekraeft.py` (80): afhentning bekræftes af både køber og sælger (0041). `qa_afhentning_bekraeft.py uden` (9):
  som om filen ikke er kørt.
- `qa_rettelser.py` (75): rettelserne efter gennemgangen (0042). `qa_rettelser.py sandbox` (7) efter
  `SHIPMONDO_SANDBOX=1 bash restart_qa.sh reset`. `qa_rettelser.py uden` (13) på en database bygget uden 0042: flyt filen
  væk fra `supabase/migrations`, kør `bash restart_qa.sh reset`, og læg den tilbage.

- `db.sh`: egen Postgres-klynge på port 54329, database `snupqa` = repoets stub + alle migrationer + `seed.sql`.
- `fakesb/server.mjs` (54400): /rest → PostgREST (54401), /auth (engangskode 123456), /storage (filer på disk, RLS via PostgREST).
- `fakes/server.mjs`: Stripe (12111), Shipmondo (12112), Resend (12113). `/__state`, `/__fail`, `/__track`.
- Login i testene: maja@mail.dk (sælger), liva.k@gmail.com og ole@firma.dk (købere), admin@snuplive.dk (admin).
