-- Relived · "Kun afhentning" på varer. Sælgeren kan sætte en vare, der er for stor til en pakkeshop (fx en sofa eller en
-- kommode), til kun afhentning. Køberen kan så kun vælge afhentning i kurven, og betalingen på serveren tvinger det
-- (app/api/checkout/route.ts). Cykler og barnevogne har afhentning valgt på forhånd uanset (lib/pricing.ts).
-- Kør hele filen i Supabase → SQL Editor → New query → Run. Filen kan køres flere gange uden fejl.

alter table public.items add column if not exists pickup_only boolean not null default false;

-- Sælgeren må selv sætte det, når hun lægger varen i køen, laver en videoannonce eller retter varen.
grant insert (pickup_only) on public.items to authenticated;
grant update (pickup_only) on public.items to authenticated;

notify pgrst, 'reload schema';
