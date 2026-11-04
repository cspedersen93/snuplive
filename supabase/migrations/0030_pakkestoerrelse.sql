-- Relived · pakkestørrelse på varerne, så fragten følger vægten: lille (op til 1 kg, 39 kr) eller stor (1–5 kg, 49 kr).
-- Tom betyder kategoriens standard: bolig og cykler er store pakker, resten små (lib/pricing.ts).
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0029). Filen kan køres flere gange uden fejl.

alter table public.items add column if not exists package_size text;
alter table public.items drop constraint if exists items_package_size_check;
alter table public.items add constraint items_package_size_check check (package_size is null or package_size in ('small', 'large'));

-- Sælgeren må selv sætte størrelsen, når hun lægger varen i køen eller retter den.
grant insert (package_size) on public.items to authenticated;
grant update (package_size) on public.items to authenticated;

notify pgrst, 'reload schema';
