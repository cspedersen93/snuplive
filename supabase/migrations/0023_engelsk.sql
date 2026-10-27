-- Relived · Show på engelsk: sælgeren kan markere, at showet foregår på engelsk, så engelsktalende købere kan finde det
-- (mærket "English" ved showet og listen på /en).
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0022). Filen kan køres flere gange uden fejl.
--
--   da: dansk (standard)
--   en: engelsk

alter table public.shows add column if not exists language text not null default 'da';
alter table public.shows drop constraint if exists shows_language_check;
alter table public.shows add constraint shows_language_check check (language in ('da', 'en'));
-- Sælgeren vælger det, når showet oprettes, og kan skifte det bagefter (som titlen; kun mens showet ikke er slut,
-- jf. shows_update_own).
grant insert (language) on public.shows to authenticated;
grant update (language) on public.shows to authenticated;
-- Listen over shows på engelsk (/en).
create index if not exists shows_language_idx on public.shows (language, status) where language <> 'da';
