-- Relived · Samlerabat.
-- Sælgeren vælger en rabat, når køberen køber flere varer hos hende: fx 10 % ved 2 varer og 15 % ved 3 eller flere.
-- Varerne sendes alligevel i én pakke. Rabatten bliver trukket automatisk i kurven og ved betalingen
-- (app/api/checkout/route.ts), og den gælder alt, køberen betaler hos sælgeren på én gang, også fra flere shows.
-- Ordrens items_amount er beløbet for varerne efter rabatten. Det er det, sælgeren får, og det, der indberettes.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0026). Filen kan køres flere gange uden fejl.

create table if not exists public.bundle_discounts (
  seller_id  uuid primary key references public.profiles (id) on delete cascade,
  pct2       int not null default 0 check (pct2 between 0 and 50),
  pct3       int not null default 0 check (pct3 between 0 and 50),
  updated_at timestamptz not null default now(),
  constraint bundle_discounts_order check (pct3 >= pct2)
);
alter table public.bundle_discounts enable row level security;
-- Alle må se sælgerens samlerabat (den står ved varerne og i showet).
drop policy if exists "bundle_discounts_read" on public.bundle_discounts;
create policy "bundle_discounts_read" on public.bundle_discounts for select to anon, authenticated using (true);
revoke all on public.bundle_discounts from anon, authenticated;
grant select on public.bundle_discounts to anon, authenticated;

-- Sælgeren sætter sin samlerabat (0 = ingen). Rabatten ved 3 eller flere er mindst den samme som ved 2.
create or replace function public.set_bundle_discount(p_pct2 int, p_pct3 int)
returns public.bundle_discounts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_row  public.bundle_discounts;
  v_pct2 int := coalesce(p_pct2, 0);
  v_pct3 int := coalesce(p_pct3, 0);
begin
  if v_uid is null then
    raise exception 'Log ind igen';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.is_seller) then
    raise exception 'Kun sælgere kan give samlerabat';
  end if;
  if v_pct2 not between 0 and 50 or v_pct3 not between 0 and 50 then
    raise exception 'Rabatten skal være mellem 0 og 50 %%';
  end if;
  v_pct3 := greatest(v_pct3, v_pct2);
  insert into public.bundle_discounts (seller_id, pct2, pct3, updated_at)
    values (v_uid, v_pct2, v_pct3, now())
  on conflict (seller_id) do update set pct2 = excluded.pct2, pct3 = excluded.pct3, updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.set_bundle_discount(int, int) from public, anon;
grant  execute on function public.set_bundle_discount(int, int) to authenticated;
