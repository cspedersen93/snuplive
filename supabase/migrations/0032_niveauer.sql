-- Relived · niveauer og mærker for sælgere og købere.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0031). Filen kan køres flere gange uden fejl.
--
-- Niveauerne regnes ud fra handler, der er helt afsluttet (betalt, sendt og modtaget). Intet gemmes som tal:
-- alt regnes ud, når der bliver spurgt, så de passer altid med ordrerne.
--
--   Sælger  Ny → Bronze (5 solgte varer) → Sølv (25 solgte og mindst 4,5 stjerner)
--           → Guld (100 solgte, mindst 4,7 stjerner og 9 ud af 10 pakker sendt til tiden) → VIP (250 solgte og kravene
--           til Guld, eller udvalgt af Relived i Backoffice)
--   Køber   Ny → Bronze (3 købte varer) → Sølv (10) → Guld (25) → VIP (50, eller udvalgt af Relived)
--
-- Stjernekravet gælder kun, når sælgeren har fået bedømmelser. "Til tiden" er sendt senest 5 dage efter betalingen
-- (vilkårene siger 3 hverdage). Afhentninger tæller ikke med i forsendelserne.
--
-- Alle kan se sælgerens niveau og mærker. Købere kan skjule deres niveau og købermærker på Min konto. Antal køb og
-- salg bliver aldrig vist for andre, kun niveauet.

alter table public.profiles add column if not exists hide_buyer_level boolean not null default false;
alter table public.profiles add column if not exists vip_seller_at   timestamptz;
alter table public.profiles add column if not exists vip_buyer_at    timestamptz;

-- Køberen må selv skjule sit niveau. VIP sættes kun af Relived (serveren).
grant update (hide_buyer_level) on public.profiles to authenticated;

-- Tal, niveauer og mærker for ét medlem. Kun til serveren og de to funktioner nedenfor (tallene er private).
create or replace function public.member_progress(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p            record;
  v_sold       int := 0;
  v_bought     int := 0;
  v_won        int := 0;
  v_shipped    int := 0;
  v_on_time    int := 0;
  v_fast       int := 0;
  v_repeat     int := 0;
  v_shows      int := 0;
  v_night      boolean := false;
  v_first_sale timestamptz;
  v_first_buy  timestamptz;
  v_rank       int;
  v_ship_ok    boolean;
  v_seller     text;
  v_buyer      text;
  v_badges     text[] := '{}';
begin
  select pr.id, pr.is_seller, pr.rating_avg, coalesce(pr.rating_count, 0) as rating_count,
         pr.vip_seller_at, pr.vip_buyer_at, pr.hide_buyer_level
    into p
    from public.profiles pr
   where pr.id = p_id;
  if not found then
    return null;
  end if;

  -- Solgte og købte varer i afsluttede ordrer.
  select count(*) into v_sold
    from public.sales sa join public.orders o on o.id = sa.order_id
   where sa.seller_id = p_id and o.status = 'completed';
  select count(*), count(*) filter (where i.sale_type = 'auction')
    into v_bought, v_won
    from public.sales sa
    join public.orders o on o.id = sa.order_id
    join public.items  i on i.id = sa.item_id
   where sa.buyer_id = p_id and o.status = 'completed';

  -- Forsendelser: til tiden (5 dage) og lynhurtigt (24 timer).
  select count(*),
         count(*) filter (where o.shipped_at <= o.paid_at + interval '5 days'),
         count(*) filter (where o.shipped_at <= o.paid_at + interval '24 hours')
    into v_shipped, v_on_time, v_fast
    from public.orders o
   where o.seller_id = p_id and o.status in ('shipped', 'completed')
     and o.shipped_at is not null and o.paid_at is not null;

  -- Flest afsluttede ordrer hos den samme sælger.
  select coalesce(max(n), 0) into v_repeat
    from (select count(*) as n from public.orders o
           where o.buyer_id = p_id and o.status = 'completed' group by o.seller_id) t;

  -- Shows, der rigtig er gået live (ikke videoannoncerne).
  select count(*),
         coalesce(bool_or(extract(hour from s.started_at at time zone 'Europe/Copenhagen') >= 22), false)
    into v_shows, v_night
    from public.shows s
   where s.seller_id = p_id and s.kind = 'show' and s.started_at is not null
     and s.status in ('live', 'ended') and s.removed_at is null;

  -- Niveauer.
  v_ship_ok := v_shipped = 0 or v_on_time * 10 >= v_shipped * 9;
  if p.is_seller then
    v_seller := case
      when p.vip_seller_at is not null then 'vip'
      when v_sold >= 250 and (p.rating_count = 0 or p.rating_avg >= 4.7) and v_ship_ok then 'vip'
      when v_sold >= 100 and (p.rating_count = 0 or p.rating_avg >= 4.7) and v_ship_ok then 'guld'
      when v_sold >= 25  and (p.rating_count = 0 or p.rating_avg >= 4.5) then 'soelv'
      when v_sold >= 5 then 'bronze'
      else 'ny'
    end;
  end if;
  v_buyer := case
    when p.vip_buyer_at is not null or v_bought >= 50 then 'vip'
    when v_bought >= 25 then 'guld'
    when v_bought >= 10 then 'soelv'
    when v_bought >= 3  then 'bronze'
    else 'ny'
  end;

  -- Mærker for sælgere.
  if p.is_seller then
    select min(o.completed_at) into v_first_sale
      from public.orders o where o.seller_id = p_id and o.status = 'completed';
    if v_first_sale is not null then
      -- De første 100 sælgere, der har gennemført et salg.
      select count(distinct o.seller_id) into v_rank
        from public.orders o where o.status = 'completed' and o.completed_at < v_first_sale;
      if v_rank < 100 then v_badges := array_append(v_badges, 'stiftende_saelger'); end if;
    end if;
    if v_shows >= 1  then v_badges := array_append(v_badges, 'foerste_show'); end if;
    if v_fast >= 10  then v_badges := array_append(v_badges, 'lynafsender'); end if;
    if v_night       then v_badges := array_append(v_badges, 'natteravn'); end if;
  end if;

  -- Mærker for købere.
  if v_bought >= 1 then
    select min(o.completed_at) into v_first_buy
      from public.orders o where o.buyer_id = p_id and o.status = 'completed';
    -- De første 250 købere, der har fået en vare.
    select count(distinct o.buyer_id) into v_rank
      from public.orders o where o.status = 'completed' and o.completed_at < v_first_buy;
    if v_rank < 250 then v_badges := array_append(v_badges, 'stiftende_koeber'); end if;
    v_badges := array_append(v_badges, 'foerste_koeb');
  end if;
  if v_won >= 10    then v_badges := array_append(v_badges, 'budkonge'); end if;
  if v_repeat >= 3  then v_badges := array_append(v_badges, 'stamkunde'); end if;

  return jsonb_build_object(
    'seller_level', v_seller,
    'buyer_level', v_buyer,
    'badges', to_jsonb(v_badges),
    'hide_buyer_level', p.hide_buyer_level,
    'vip_seller', p.vip_seller_at is not null,
    'vip_buyer', p.vip_buyer_at is not null,
    'sold', v_sold,
    'bought', v_bought,
    'auctions_won', v_won,
    'shipped', v_shipped,
    'on_time', v_on_time,
    'fast_shipped', v_fast,
    'best_repeat', v_repeat,
    'shows', v_shows,
    'rating_avg', p.rating_avg,
    'rating_count', p.rating_count
  );
end;
$$;
revoke execute on function public.member_progress(uuid) from public, anon, authenticated;
grant  execute on function public.member_progress(uuid) to service_role;

-- Niveauer og mærker for flere medlemmer på én gang (chatten, sælgersiden, varerne). Ingen tal, kun niveauer.
-- Har køberen skjult sit niveau, kommer køberniveauet og købermærkerne ikke med (undtagen til køberen selv).
create or replace function public.member_levels(p_ids uuid[])
returns table (id uuid, seller_level text, buyer_level text, badges text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v      jsonb;
  v_me   uuid := auth.uid();
  v_hide boolean;
begin
  for v_id in
    select distinct u from unnest((coalesce(p_ids, '{}'::uuid[]))[1:100]) as u where u is not null
  loop
    v := public.member_progress(v_id);
    continue when v is null;
    v_hide := coalesce((v->>'hide_buyer_level')::boolean, false) and v_id is distinct from v_me;
    id := v_id;
    seller_level := v->>'seller_level';
    buyer_level := case when v_hide then null else v->>'buyer_level' end;
    select coalesce(array_agg(b), '{}'::text[]) into badges
      from jsonb_array_elements_text(v->'badges') as b
     where not (v_hide and b in ('stiftende_koeber', 'foerste_koeb', 'budkonge', 'stamkunde'));
    return next;
  end loop;
end;
$$;
revoke execute on function public.member_levels(uuid[]) from public;
grant  execute on function public.member_levels(uuid[]) to anon, authenticated, service_role;

-- Ens egne tal, så Min konto kan vise, hvor langt der er til næste niveau.
create or replace function public.my_level_progress()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when auth.uid() is null then null else public.member_progress(auth.uid()) end;
$$;
revoke execute on function public.my_level_progress() from public, anon;
grant  execute on function public.my_level_progress() to authenticated, service_role;

notify pgrst, 'reload schema';
