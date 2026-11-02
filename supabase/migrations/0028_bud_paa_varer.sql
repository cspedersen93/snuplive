-- Relived · Bud på varer til fast pris.
-- En køber kan give ét bud på en vare, der er til salg efter showet (Køb nu): mindst 70 % af prisen og under prisen.
-- Sælgeren siger ja eller nej med ét tryk. Siger hun ja, bliver varen reserveret til køberen til budet og lander i kurven,
-- præcis som ved Køb nu (betal inden 3 dage). Et bud gælder i 48 timer. Bliver varen solgt, taget af salg eller sat ned
-- til budet eller derunder, lukker de åbne bud. Ingen andre end køberen og sælgeren kan se buddet.
-- Beskeder om nye bud og svar sendes fra serveren (app/api/offers).
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0027). Filen kan køres flere gange uden fejl.

create table if not exists public.offers (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.items (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  seller_id   uuid not null references public.profiles (id) on delete cascade,
  amount      int not null check (amount between 1 and 1000000),
  price       int not null check (price > 0),
  status      text not null default 'pending'
              check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'expired', 'closed')),
  sale_id     uuid references public.sales (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '48 hours',
  answered_at timestamptz
);
-- Ét åbent bud pr. køber pr. vare.
create unique index if not exists offers_one_open on public.offers (item_id, user_id) where status = 'pending';
create index if not exists offers_seller_idx on public.offers (seller_id, status, created_at desc);
create index if not exists offers_user_idx   on public.offers (user_id, created_at desc);
create index if not exists offers_item_idx   on public.offers (item_id) where status = 'pending';

alter table public.offers enable row level security;
drop policy if exists "offers_read_own" on public.offers;
create policy "offers_read_own" on public.offers for select to authenticated
  using (user_id = (select auth.uid()) or seller_id = (select auth.uid()));
revoke all on public.offers from anon, authenticated;
grant select on public.offers to authenticated;

-- Lukkede shows (0026): kun de inviterede kan byde, mens showet ikke er slut.
do $$
begin
  if to_regprocedure('public._invite_guard()') is not null then
    execute 'drop trigger if exists offers_invite_guard on public.offers';
    execute 'create trigger offers_invite_guard before insert on public.offers for each row execute function public._invite_guard()';
  end if;
end;
$$;

-- Mindste bud: 70 % af prisen, rundet op til hele kroner.
create or replace function public.offer_min(p_price int)
returns int
language sql
immutable
set search_path = ''
as $$ select ceil(p_price * 0.7)::int $$;
grant execute on function public.offer_min(int) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Køberen giver et bud (eller ændrer sit åbne bud).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.make_offer(p_item uuid, p_amount int)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_item  public.items;
  v_offer public.offers;
  v_min   int;
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
    raise exception 'Sælgeren har blokeret dig, så du kan ikke købe hos sælgeren';
  end if;
  if v_item.status <> 'unsold' or not v_item.for_sale
     or not exists (select 1 from public.shows s where s.id = v_item.show_id and s.status = 'ended') then
    raise exception 'Varen kan ikke købes til fast pris lige nu';
  end if;
  if v_item.auth_required and v_item.auth_status is distinct from 'approved' then
    raise exception 'Varen venter på ægthedstjek. Du kan byde, når Relived har tjekket den';
  end if;
  v_min := public.offer_min(v_item.price);
  if p_amount is null or p_amount < v_min then
    raise exception 'Buddet skal være mindst % kr', v_min;
  end if;
  if p_amount >= v_item.price then
    raise exception 'Byd under prisen, eller køb varen med Køb nu';
  end if;
  if (select count(*) from public.offers o
       where o.item_id = p_item and o.user_id = v_uid and o.created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Du har budt 3 gange på varen i dag. Prøv igen i morgen';
  end if;
  if (select count(*) from public.offers o
       where o.user_id = v_uid and o.status = 'pending' and o.expires_at > now()) >= 20 then
    raise exception 'Du har 20 åbne bud. Vent på svar, før du byder på mere';
  end if;

  -- Et nyt bud erstatter køberens åbne bud på varen.
  update public.offers set status = 'withdrawn', answered_at = now()
   where item_id = p_item and user_id = v_uid and status = 'pending';
  insert into public.offers (item_id, user_id, seller_id, amount, price)
    values (p_item, v_uid, v_item.seller_id, p_amount, v_item.price)
  returning * into v_offer;
  return v_offer;
end;
$$;
revoke execute on function public.make_offer(uuid, int) from public, anon;
grant  execute on function public.make_offer(uuid, int) to authenticated;

-- Køberen trækker sit bud tilbage.
create or replace function public.withdraw_offer(p_offer uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.offers set status = 'withdrawn', answered_at = now()
   where id = p_offer and user_id = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Buddet er ikke åbent længere';
  end if;
end;
$$;
revoke execute on function public.withdraw_offer(uuid) from public, anon;
grant  execute on function public.withdraw_offer(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Sælgeren svarer. Ja = varen reserveres til køberen til budet og lander i kurven (som Køb nu).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.answer_offer(p_offer uuid, p_accept boolean)
returns public.offers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_offer public.offers;
  v_item  public.items;
  v_sale  uuid;
begin
  select * into v_offer from public.offers where id = p_offer for update;
  if v_offer.id is null or v_offer.seller_id is distinct from v_uid then
    raise exception 'Buddet findes ikke';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'Buddet er ikke åbent længere';
  end if;
  if v_offer.expires_at <= now() then
    raise exception 'Buddet er udløbet';
  end if;

  if not coalesce(p_accept, false) then
    update public.offers set status = 'declined', answered_at = now() where id = p_offer returning * into v_offer;
    return v_offer;
  end if;

  if exists (select 1 from public.seller_blocks b where b.seller_id = v_uid and b.user_id = v_offer.user_id) then
    raise exception 'Du har blokeret køberen';
  end if;
  update public.items i
     set status = 'sold', sold_at = now()
   where i.id = v_offer.item_id
     and i.status = 'unsold'
     and i.for_sale
     and i.removed_at is null
     and exists (select 1 from public.shows s where s.id = i.show_id and s.status = 'ended')
  returning * into v_item;
  if v_item.id is null then
    raise exception 'Varen er ikke til salg længere';
  end if;

  -- (Varen er solgt, så triggeren herunder har lukket de andre åbne bud på den.)
  insert into public.sales (item_id, show_id, seller_id, buyer_id, price)
    values (v_item.id, v_item.show_id, v_item.seller_id, v_offer.user_id, v_offer.amount)
  returning id into v_sale;
  update public.offers set status = 'accepted', answered_at = now(), sale_id = v_sale where id = p_offer returning * into v_offer;
  return v_offer;
end;
$$;
revoke execute on function public.answer_offer(uuid, boolean) from public, anon;
grant  execute on function public.answer_offer(uuid, boolean) to authenticated;

-- Åbne bud lukker, når varen bliver solgt (fx med Køb nu), taget af salg, fjernet eller sat ned til budet eller derunder.
create or replace function public._close_offers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'unsold' or not new.for_sale or new.removed_at is not null then
    update public.offers set status = 'closed', answered_at = now() where item_id = new.id and status = 'pending';
  elsif new.price < old.price then
    update public.offers set status = 'closed', answered_at = now()
     where item_id = new.id and status = 'pending' and amount >= new.price;
  end if;
  return new;
end;
$$;
revoke execute on function public._close_offers() from public, anon, authenticated;
drop trigger if exists items_close_offers on public.items;
create trigger items_close_offers after update of status, for_sale, removed_at, price on public.items
  for each row
  when (old.status is distinct from new.status or old.for_sale is distinct from new.for_sale
        or old.removed_at is distinct from new.removed_at or old.price is distinct from new.price)
  execute function public._close_offers();

-- Udløbne bud (det daglige job). Kun serveren.
create or replace function public.expire_offers()
returns int
language sql
security definer
set search_path = ''
as $$
  with x as (
    update public.offers set status = 'expired' where status = 'pending' and expires_at <= now() returning 1
  )
  select count(*)::int from x;
$$;
revoke execute on function public.expire_offers() from public, anon, authenticated;
grant  execute on function public.expire_offers() to service_role;
