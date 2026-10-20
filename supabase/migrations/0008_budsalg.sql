-- SnupLive · budsalg live: sælgeren starter et budsalg på 30 sekunder, køberne byder i faste trin,
-- og et bud i de sidste 10 sekunder giver 10 sekunder ekstra. Det højeste bud vinder.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0001–0007).
-- Filen kan køres flere gange uden fejl.
--
-- En ting på budsalg har sale_type = 'auction', og price er startprisen (det mindste bud).
-- Bliver der ikke budt, kommer tingen til salg til startprisen, når showet slutter (Køb nu).

-- ─────────────────────────────────────────────────────────────────────────────
-- Budsalgets tilstand på tingen (så alle seere får den med det samme via realtid)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.items add column if not exists auction_ends_at timestamptz;
alter table public.items add column if not exists high_bid       int;
alter table public.items add column if not exists high_bidder    uuid references public.profiles (id) on delete set null;
alter table public.items add column if not exists high_handle    text;
alter table public.items add column if not exists bid_count      int not null default 0;

-- Sælgeren vælger fast pris eller budsalg på sine ting (mens de står i køen).
grant insert (sale_type) on public.items to authenticated;
grant update (sale_type) on public.items to authenticated;

-- Alle bud gemmes. Køberen kan se sine egne bud, sælgeren buddene på sine ting.
create table if not exists public.bids (
  id         bigint generated always as identity primary key,
  item_id    uuid not null references public.items (id) on delete cascade,
  show_id    uuid not null references public.shows (id) on delete cascade,
  bidder_id  uuid not null references public.profiles (id) on delete cascade,
  amount     int not null check (amount between 1 and 100000),
  created_at timestamptz not null default now()
);
create index if not exists bids_item_idx on public.bids (item_id, amount desc);
create index if not exists bids_bidder_idx on public.bids (bidder_id, created_at desc);
alter table public.bids enable row level security;
drop policy if exists bids_read on public.bids;
create policy bids_read on public.bids for select using (
  bidder_id = (select auth.uid())
  or exists (select 1 from public.items i where i.id = item_id and i.seller_id = (select auth.uid()))
);
revoke all on public.bids from anon, authenticated;
grant select on public.bids to authenticated;
grant select on public.bids to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Budtrin: 5 kr under 100 kr, 10 kr op til 500 kr, 25 kr op til 1.000 kr og 50 kr derover.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.bid_step(p_amount int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case when p_amount < 100 then 5 when p_amount < 500 then 10 when p_amount < 1000 then 25 else 50 end;
$$;

-- Det mindste bud lige nu: startprisen, eller det højeste bud plus ét trin.
create or replace function public.next_bid(p_price int, p_high int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case when p_high is null then p_price else p_high + public.bid_step(p_high) end;
$$;
grant execute on function public.bid_step(int) to anon, authenticated, service_role;
grant execute on function public.next_bid(int, int) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Luk et budsalg. Det højeste bud bliver til et snup i køberens kurv. Ingen bud: tingen er usolgt.
-- p_force lukker, selv om tiden ikke er gået (bruges, når sælgeren afslutter showet).
-- Bruges kun inde i databasen.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._close_auction(p_item uuid, p_force boolean default false)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.items;
begin
  select * into v_item from public.items where id = p_item for update;
  if v_item.id is null or v_item.sale_type <> 'auction' or v_item.status <> 'live' or v_item.auction_ends_at is null then
    return v_item;
  end if;
  if v_item.auction_ends_at > now() and not p_force then
    return v_item;
  end if;

  if v_item.high_bidder is not null then
    update public.items
       set status = 'sold', sold_at = now(), auction_ends_at = least(auction_ends_at, now())
     where id = p_item
    returning * into v_item;
    insert into public.sales (item_id, show_id, seller_id, buyer_id, price)
      values (v_item.id, v_item.show_id, v_item.seller_id, v_item.high_bidder, v_item.high_bid);
    insert into public.messages (show_id, user_id, handle, body, kind)
      values (v_item.show_id, null, 'SnupLive',
              coalesce(v_item.high_handle, 'En køber') || ' vandt ' || v_item.name || ' for ' || v_item.high_bid || ' kr', 'event');
  else
    update public.items
       set status = 'unsold', auction_ends_at = least(auction_ends_at, now())
     where id = p_item
    returning * into v_item;
    insert into public.messages (show_id, user_id, handle, body, kind)
      values (v_item.show_id, null, 'SnupLive', 'Ingen bød på ' || v_item.name || '. Den kan købes efter showet.', 'event');
  end if;
  return v_item;
end;
$$;
revoke execute on function public._close_auction(uuid, boolean) from public, anon, authenticated;

-- Alle må bede om at lukke et budsalg, når tiden er gået (studiet og seerne gør det, når uret står på 0).
create or replace function public.close_auction(p_item uuid)
returns public.items
language sql
security definer
set search_path = ''
as $$
  select * from public._close_auction(p_item, false);
$$;
revoke execute on function public.close_auction(uuid) from public;
grant  execute on function public.close_auction(uuid) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Sælgeren starter budsalget på den ting, der bliver vist.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.start_auction(p_item uuid, p_seconds int default 30)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_item public.items;
  v_secs int := least(greatest(coalesce(p_seconds, 30), 10), 120);
begin
  select * into v_item from public.items where id = p_item for update;
  if v_item.id is null or v_item.seller_id is distinct from v_uid then
    raise exception 'Tingen findes ikke';
  end if;
  if v_item.sale_type <> 'auction' then
    raise exception 'Tingen er ikke sat til budsalg';
  end if;
  if v_item.status <> 'live' or not exists (
    select 1 from public.shows s where s.id = v_item.show_id and s.status = 'live' and s.current_item_id = v_item.id
  ) then
    raise exception 'Vis tingen frem, før du starter budsalget';
  end if;
  if v_item.auction_ends_at is not null then
    raise exception 'Budsalget er allerede startet';
  end if;

  update public.items
     set auction_ends_at = now() + make_interval(secs => v_secs), rush_ends_at = null,
         high_bid = null, high_bidder = null, high_handle = null, bid_count = 0
   where id = p_item
  returning * into v_item;
  insert into public.messages (show_id, user_id, handle, body, kind)
    values (v_item.show_id, null, 'SnupLive',
            'Budsalg! ' || v_item.name || ' starter ved ' || v_item.price || ' kr. Du har ' || v_secs || ' sekunder.', 'event');
  return v_item;
end;
$$;
revoke execute on function public.start_auction(uuid, int) from public, anon;
grant  execute on function public.start_auction(uuid, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Byd. Buddet skal mindst være startprisen eller det højeste bud plus ét trin.
-- Et bud i de sidste 10 sekunder sætter uret op til 10 sekunder igen.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.place_bid(p_item uuid, p_amount int)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_item   public.items;
  v_min    int;
  v_handle text;
begin
  if v_uid is null then
    raise exception 'Log ind for at byde';
  end if;
  if exists (
    select 1 from public.items i
    join public.seller_blocks b on b.seller_id = i.seller_id
    where i.id = p_item and b.user_id = v_uid
  ) then
    raise exception 'Sælgeren har blokeret dig, så du kan ikke byde i showet';
  end if;

  select * into v_item from public.items where id = p_item for update;
  if v_item.id is null then
    raise exception 'Tingen findes ikke';
  end if;
  if v_item.seller_id = v_uid then
    raise exception 'Du kan ikke byde på dine egne ting';
  end if;
  if v_item.sale_type <> 'auction' or v_item.status <> 'live' or v_item.auction_ends_at is null
     or not exists (select 1 from public.shows s where s.id = v_item.show_id and s.status = 'live' and s.current_item_id = v_item.id) then
    raise exception 'Budsalget er ikke startet';
  end if;
  if v_item.auction_ends_at <= now() then
    raise exception 'Budsalget er slut';
  end if;
  if v_item.high_bidder = v_uid then
    raise exception 'Du har allerede det højeste bud';
  end if;

  v_min := public.next_bid(v_item.price, v_item.high_bid);
  if p_amount is null or p_amount < v_min then
    raise exception 'Der er kommet et nyt bud. Det mindste bud er nu % kr', v_min;
  end if;
  if p_amount > 100000 then
    raise exception 'Buddet er for højt';
  end if;

  select p.handle into v_handle from public.profiles p where p.id = v_uid;
  update public.items
     set high_bid = p_amount, high_bidder = v_uid, high_handle = v_handle, bid_count = bid_count + 1,
         auction_ends_at = greatest(auction_ends_at, now() + interval '10 seconds')
   where id = p_item
  returning * into v_item;
  insert into public.bids (item_id, show_id, bidder_id, amount) values (v_item.id, v_item.show_id, v_uid, p_amount);
  return v_item;
end;
$$;
revoke execute on function public.place_bid(uuid, int) from public, anon;
grant  execute on function public.place_bid(uuid, int) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Vis en ting frem: som før, men et budsalg skal være slut, før næste ting kan vises.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.present_item(p_item uuid)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_show uuid;
  v_item public.items;
  v_live record;
begin
  select i.show_id into v_show from public.items i where i.id = p_item and i.seller_id = v_uid;
  if v_show is null then
    raise exception 'Tingen findes ikke';
  end if;
  -- Lås showet først (samme rækkefølge som set_show_status), så to kald ikke låser hinanden.
  perform 1 from public.shows s where s.id = v_show and s.status = 'live' for update;
  if not found then
    raise exception 'Gå live, før du viser ting frem';
  end if;

  for v_live in select id, auction_ends_at from public.items where show_id = v_show and status = 'live' and auction_ends_at is not null loop
    if v_live.auction_ends_at > now() then
      raise exception 'Vent, til budsalget er slut';
    end if;
    perform public._close_auction(v_live.id, false);
  end loop;

  select * into v_item from public.items where id = p_item for update;
  if v_item.status = 'sold' then
    raise exception 'Tingen er allerede solgt';
  end if;

  update public.items set status = 'unsold', rush_ends_at = null
    where show_id = v_show and status = 'live' and id <> p_item;
  update public.items
     set status = 'live', rush_ends_at = null,
         auction_ends_at = null, high_bid = null, high_bidder = null, high_handle = null, bid_count = 0
   where id = p_item
  returning * into v_item;
  update public.shows set current_item_id = p_item where id = v_show;
  return v_item;
end;
$$;
revoke execute on function public.present_item(uuid) from public, anon;
grant  execute on function public.present_item(uuid) to authenticated;

-- Lynrunder er til ting med fast pris. Budsalg har sin egen nedtælling.
create or replace function public.start_rush(p_item uuid, p_seconds int default 10)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_item public.items;
  v_secs int := least(greatest(coalesce(p_seconds, 10), 5), 60);
begin
  if exists (select 1 from public.items i where i.id = p_item and i.seller_id = v_uid and i.sale_type = 'auction') then
    raise exception 'Budsalg har sin egen nedtælling. Tryk Start budsalg';
  end if;
  update public.items i
     set rush_ends_at = now() + make_interval(secs => v_secs)
   where i.id = p_item and i.seller_id = v_uid and i.status = 'live'
  returning * into v_item;
  if v_item.id is null then
    raise exception 'Vis tingen frem, før du starter en lynrunde';
  end if;
  insert into public.messages (show_id, user_id, handle, body, kind)
    values (v_item.show_id, null, 'SnupLive', 'Lynrunde! ' || v_secs || ' sekunder på ' || v_item.name, 'event');
  return v_item;
end;
$$;
revoke execute on function public.start_rush(uuid, int) from public, anon;
grant  execute on function public.start_rush(uuid, int) to authenticated;

-- Snup: som før, men en ting på budsalg skal man byde på.
create or replace function public.snup(p_item uuid)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_item   public.items;
  v_handle text;
begin
  if v_uid is null then
    raise exception 'Log ind for at snuppe';
  end if;
  if exists (
    select 1 from public.items i
    join public.seller_blocks b on b.seller_id = i.seller_id
    where i.id = p_item and b.user_id = v_uid
  ) then
    raise exception 'Sælgeren har blokeret dig, så du kan ikke snuppe i showet';
  end if;
  if exists (select 1 from public.items i where i.id = p_item and i.sale_type = 'auction') then
    raise exception 'Tingen er på budsalg. Byd i stedet';
  end if;

  update public.items i
     set status = 'sold', sold_at = now(), rush_ends_at = null
   where i.id = p_item
     and i.status = 'live'
     and i.seller_id <> v_uid
     and (i.rush_ends_at is null or i.rush_ends_at > now())
     and exists (
       select 1 from public.shows s
       where s.id = i.show_id and s.status = 'live' and s.current_item_id = i.id
     )
  returning * into v_item;

  if v_item.id is null then
    select * into v_item from public.items where id = p_item;
    if v_item.id is null then
      raise exception 'Tingen findes ikke';
    elsif v_item.seller_id = v_uid then
      raise exception 'Du kan ikke snuppe dine egne ting';
    elsif v_item.status = 'sold' then
      raise exception 'Øv, en anden nåede at snuppe den';
    elsif v_item.rush_ends_at is not null and v_item.rush_ends_at <= now() then
      raise exception 'Lynrunden er slut';
    else
      raise exception 'Tingen kan ikke snuppes lige nu';
    end if;
  end if;

  insert into public.sales (item_id, show_id, seller_id, buyer_id, price)
    values (v_item.id, v_item.show_id, v_item.seller_id, v_uid, v_item.price);

  select p.handle into v_handle from public.profiles p where p.id = v_uid;
  insert into public.messages (show_id, user_id, handle, body, kind)
    values (v_item.show_id, null, 'SnupLive',
            v_handle || ' snuppede ' || v_item.name || ' for ' || v_item.price || ' kr', 'event');
  return v_item;
end;
$$;
revoke execute on function public.snup(uuid) from public, anon;
grant  execute on function public.snup(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Når showet slutter: et budsalg, der stadig kører, lukkes, og det højeste bud vinder.
-- Resten kommer til salg til fast pris (ting på budsalg til startprisen).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_show_status(p_show uuid, p_status text)
returns public.shows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_show public.shows;
  v_live record;
begin
  select * into v_show from public.shows where id = p_show for update;
  if v_show.id is null or v_show.seller_id is distinct from v_uid then
    raise exception 'Showet findes ikke';
  end if;

  if p_status = 'live' then
    if v_show.status <> 'planned' then
      raise exception 'Showet er allerede startet eller slut';
    end if;
    if exists (select 1 from public.shows s where s.seller_id = v_uid and s.status = 'live') then
      raise exception 'Du er allerede live i et andet show';
    end if;
    update public.shows set status = 'live', started_at = now() where id = p_show returning * into v_show;
    insert into public.messages (show_id, user_id, handle, body, kind)
      values (p_show, null, 'SnupLive', 'Showet er startet. Velkommen!', 'event');

  elsif p_status = 'ended' then
    if v_show.status <> 'live' then
      raise exception 'Showet er ikke live';
    end if;
    for v_live in select id from public.items where show_id = p_show and status = 'live' and auction_ends_at is not null loop
      perform public._close_auction(v_live.id, true);
    end loop;
    update public.items
       set status = 'unsold', rush_ends_at = null, for_sale = true, listed_at = now()
     where show_id = p_show and status in ('live', 'queued', 'unsold');
    update public.shows set status = 'ended', ended_at = now(), current_item_id = null
      where id = p_show returning * into v_show;
    insert into public.messages (show_id, user_id, handle, body, kind)
      values (p_show, null, 'SnupLive', 'Showet er slut. Tak fordi du så med!', 'event');

  else
    raise exception 'Ukendt status';
  end if;

  return v_show;
end;
$$;
revoke execute on function public.set_show_status(uuid, text) from public, anon;
grant  execute on function public.set_show_status(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Listen med ting (forside, kategorier, Til salg) får budsalget med, og en ny slags:
--   auctions: ting på budsalg i kommende og igangværende shows
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.items_feed(text, text, int, int, uuid, uuid);
create function public.items_feed(
  p_kind text,
  p_category text default null,
  p_limit int default 24,
  p_offset int default 0,
  p_seller uuid default null,
  p_exclude uuid default null
)
returns table (
  id uuid, name text, size text, condition text, price int, images text[], category text, status text,
  for_sale boolean, sale_type text, description text, show_id uuid, show_title text, show_status text,
  starts_at timestamptz, listed_at timestamptz, seller_id uuid, handle text, avatar_path text, area text,
  high_bid int, bid_count int, total bigint
)
language sql
stable
set search_path = ''
as $$
  select i.id, i.name, i.size, i.condition, i.price, i.images, coalesce(i.category, s.category), i.status,
         i.for_sale, i.sale_type, i.description, s.id, s.title, s.status, s.starts_at, i.listed_at,
         p.id, p.handle, p.avatar_path, p.area, i.high_bid, i.bid_count, count(*) over ()
    from public.items i
    join public.shows s on s.id = i.show_id
    join public.profiles p on p.id = i.seller_id
   where (p_category is null or coalesce(i.category, s.category) = p_category)
     and (p_seller is null or i.seller_id = p_seller)
     and (p_exclude is null or i.id <> p_exclude)
     and case p_kind
           when 'upcoming' then s.status = 'planned' and i.status = 'queued' and s.starts_at >= now() - interval '2 hours'
           when 'live'     then s.status = 'live' and i.status in ('queued', 'live', 'unsold')
           when 'for_sale' then s.status = 'ended' and i.status = 'unsold' and i.for_sale
           when 'auctions' then i.sale_type = 'auction' and i.status in ('queued', 'live')
                                and (s.status = 'live' or (s.status = 'planned' and s.starts_at >= now() - interval '2 hours'))
           else false
         end
   order by
     case when p_kind = 'auctions' then case s.status when 'live' then 0 else 1 end end asc,
     case when p_kind in ('upcoming', 'auctions') then s.starts_at end asc,
     case when p_kind not in ('upcoming', 'auctions') then coalesce(i.listed_at, i.created_at) end desc,
     i.position
   limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
grant execute on function public.items_feed(text, text, int, int, uuid, uuid) to anon, authenticated, service_role;
