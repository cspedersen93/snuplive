-- Relived · Maks-bud på budsalg.
-- Køberen sætter sit højeste bud (før eller under budsalget). Når andre byder, byder siden automatisk for køberen i de
-- faste trin, op til maks-buddet. Vinderen betaler kun ét trin over det næsthøjeste maks-bud (eller sit maks, hvis det er
-- lavere). Ingen kan se andres maks-bud. Ved samme maks-bud vinder den, der satte det først.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0024). Filen kan køres flere gange uden fejl.

create table if not exists public.max_bids (
  item_id    uuid not null references public.items(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  amount     int not null check (amount between 1 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, user_id)
);
create index if not exists max_bids_item_idx on public.max_bids (item_id, amount desc, created_at);
alter table public.max_bids enable row level security;
drop policy if exists "max_bids_select_own" on public.max_bids;
create policy "max_bids_select_own" on public.max_bids for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.max_bids from anon, authenticated;
grant select on public.max_bids to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Byd automatisk for maks-buddene på et budsalg, der kører. Bruges kun inde i databasen.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._apply_max_bids(p_item uuid)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item   public.items;
  v_need   int;
  v_ch     uuid;
  v_ch_max int;
  v_def    int;
  v_new    int;
  v_handle text;
  v_rounds int := 0;
begin
  select * into v_item from public.items where id = p_item for update;
  if v_item.id is null or v_item.sale_type <> 'auction' or v_item.status <> 'live'
     or v_item.auction_ends_at is null or v_item.auction_ends_at <= now() then
    return v_item;
  end if;

  loop
    v_rounds := v_rounds + 1;
    exit when v_rounds > 50;
    v_need := public.next_bid(v_item.price, v_item.high_bid);
    -- Den største udfordrer: et maks-bud fra en anden end den førende, som er stort nok til næste bud.
    select m.user_id, m.amount into v_ch, v_ch_max
      from public.max_bids m
     where m.item_id = p_item
       and m.user_id is distinct from v_item.high_bidder
       and m.user_id <> v_item.seller_id
       and m.amount >= v_need
       and not exists (select 1 from public.seller_blocks b where b.seller_id = v_item.seller_id and b.user_id = m.user_id)
     order by m.amount desc, m.created_at asc
     limit 1;
    exit when not found;

    if v_item.high_bidder is null then
      -- Første bud: startprisen.
      v_new := v_need;
    else
      -- Den førendes maks: maks-buddet eller det bud, den førende allerede har.
      select greatest(coalesce(v_item.high_bid, 0), coalesce((select m.amount from public.max_bids m where m.item_id = p_item and m.user_id = v_item.high_bidder), 0))
        into v_def;
      if v_ch_max <= v_def then
        -- Den førende holder: udfordreren byder sit maks, den førende svarer med ét trin mere (højst sit maks).
        insert into public.bids (item_id, show_id, bidder_id, amount) values (v_item.id, v_item.show_id, v_ch, v_ch_max);
        v_new := least(v_def, public.next_bid(v_item.price, v_ch_max));
        update public.items
           set high_bid = v_new, bid_count = bid_count + 2,
               auction_ends_at = greatest(auction_ends_at, now() + interval '10 seconds')
         where id = p_item
        returning * into v_item;
        insert into public.bids (item_id, show_id, bidder_id, amount) values (v_item.id, v_item.show_id, v_item.high_bidder, v_new);
        continue;
      end if;
      -- Udfordreren overtager: ét trin over den førendes maks (mindst næste bud, højst udfordrerens maks).
      if v_def > coalesce(v_item.high_bid, 0) then
        insert into public.bids (item_id, show_id, bidder_id, amount) values (v_item.id, v_item.show_id, v_item.high_bidder, v_def);
      end if;
      v_new := least(v_ch_max, greatest(v_need, public.next_bid(v_item.price, v_def)));
    end if;

    select p.handle into v_handle from public.profiles p where p.id = v_ch;
    update public.items
       set high_bid = v_new, high_bidder = v_ch, high_handle = v_handle, bid_count = bid_count + 1,
           auction_ends_at = greatest(auction_ends_at, now() + interval '10 seconds')
     where id = p_item
    returning * into v_item;
    insert into public.bids (item_id, show_id, bidder_id, amount) values (v_item.id, v_item.show_id, v_ch, v_new);
  end loop;
  return v_item;
end;
$$;
revoke execute on function public._apply_max_bids(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Sæt eller ret dit maks-bud. Før budsalget: mindst startprisen. Under budsalget: mindst næste bud (eller dit eget bud,
-- hvis du fører). Kører budsalget, byder siden med det samme.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_max_bid(p_item uuid, p_amount int)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_item public.items;
  v_show public.shows;
  v_min  int;
begin
  if v_uid is null then
    raise exception 'Log ind for at byde';
  end if;
  select * into v_item from public.items where id = p_item for update;
  if v_item.id is null or v_item.removed_at is not null then
    raise exception 'Varen findes ikke';
  end if;
  if v_item.seller_id = v_uid then
    raise exception 'Du kan ikke byde på dine egne varer';
  end if;
  if exists (select 1 from public.seller_blocks b where b.seller_id = v_item.seller_id and b.user_id = v_uid) then
    raise exception 'Sælgeren har blokeret dig, så du kan ikke byde i showet';
  end if;
  select * into v_show from public.shows where id = v_item.show_id;
  if v_item.sale_type <> 'auction' or v_item.status not in ('queued', 'live') or v_show.status not in ('planned', 'live')
     or (v_item.auction_ends_at is not null and v_item.auction_ends_at <= now()) then
    raise exception 'Budsalget er slut eller ikke sat op';
  end if;
  v_min := case
    when v_item.high_bidder = v_uid then v_item.high_bid
    when v_item.auction_ends_at is not null then public.next_bid(v_item.price, v_item.high_bid)
    else v_item.price
  end;
  if p_amount is null or p_amount < v_min then
    raise exception 'Dit maks-bud skal være mindst % kr', v_min;
  end if;
  if p_amount > 100000 then
    raise exception 'Buddet er for højt';
  end if;

  insert into public.max_bids (item_id, user_id, amount) values (p_item, v_uid, p_amount)
  on conflict (item_id, user_id) do update set amount = excluded.amount, updated_at = now();
  return public._apply_max_bids(p_item);
end;
$$;
revoke execute on function public.set_max_bid(uuid, int) from public, anon;
grant  execute on function public.set_max_bid(uuid, int) to authenticated;

-- Fjern dit maks-bud. Bud, der allerede er givet, står ved magt.
create or replace function public.clear_max_bid(p_item uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.max_bids where item_id = p_item and user_id = auth.uid();
$$;
revoke execute on function public.clear_max_bid(uuid) from public, anon;
grant  execute on function public.clear_max_bid(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Budsalget starter: som i 0020_gaester.sql (samme tekster; siden viser "ting" som "vare"), og maks-buddene byder med det samme.
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
  if v_item.id is null or not exists (select 1 from public.shows s where s.id = v_item.show_id and s.seller_id = v_uid) then
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
    values (v_item.show_id, null, 'Relived',
            'Budsalg! ' || v_item.name || ' starter ved ' || v_item.price || ' kr. Du har ' || v_secs || ' sekunder.', 'event');
  -- Maks-bud, der er sat før budsalget, byder med det samme.
  return public._apply_max_bids(p_item);
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Byd: som i 0008_budsalg.sql. Bagefter byder maks-buddene for de andre købere.
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
  -- Har en anden et større maks-bud, byder det automatisk over.
  return public._apply_max_bids(p_item);
end;
$$;
revoke execute on function public.place_bid(uuid, int) from public, anon;
grant  execute on function public.place_bid(uuid, int) to authenticated;
