-- Relived · Gæst i showet: værten vælger, hvordan seerne ser kameraerne.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0021). Filen kan køres flere gange uden fejl.
--
--   split: side om side (alle kameraer lige store)
--   focus: den, hvis ting vises nu, er stor, og de andre er små i hjørnet

alter table public.shows add column if not exists cam_layout text not null default 'split';
alter table public.shows drop constraint if exists shows_cam_layout_check;
alter table public.shows add constraint shows_cam_layout_check check (cam_layout in ('split', 'focus'));
-- Værten skifter selv (som titlen; kun mens showet ikke er slut, jf. shows_update_own).
grant update (cam_layout) on public.shows to authenticated;
