-- SnupLive · tryghed: moderation i chatten og "Meld et problem" på ordrer
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0001–0004).
-- Filen kan køres flere gange uden fejl.

-- ─────────────────────────────────────────────────────────────────────────────
-- Moderation: sælgeren kan fjerne beskeder og blokere brugere i sine shows
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.messages add column if not exists removed_at timestamptz;

-- En blokeret bruger kan hverken skrive eller snuppe i sælgerens shows.
create table if not exists public.seller_blocks (
  seller_id  uuid not null references public.profiles (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (seller_id, user_id),
  check (seller_id <> user_id)
);
alter table public.seller_blocks enable row level security;
drop policy if exists "seller_blocks_read_own" on public.seller_blocks;
create policy "seller_blocks_read_own" on public.seller_blocks for select
  to authenticated using (seller_id = (select auth.uid()));
revoke all on public.seller_blocks from anon, authenticated;
grant select on public.seller_blocks to authenticated;
grant all on public.seller_blocks to service_role;

-- Chatten: samme regler som før, plus at blokerede brugere ikke kan skrive.
create or replace function public.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'chat' then
    if new.user_id is null then
      raise exception 'Log ind for at skrive i chatten';
    end if;
    if exists (
      select 1 from public.seller_blocks b
      join public.shows s on s.seller_id = b.seller_id
      where s.id = new.show_id and b.user_id = new.user_id
    ) then
      raise exception 'Sælgeren har blokeret dig i chatten';
    end if;
    if exists (
      select 1 from public.messages m
      where m.user_id = new.user_id and m.kind = 'chat' and m.created_at > now() - interval '1 second'
    ) then
      raise exception 'Du skriver lidt for hurtigt. Prøv igen om et øjeblik.';
    end if;
    new.body := btrim(new.body);
  end if;
  if new.user_id is not null then
    select p.handle into new.handle from public.profiles p where p.id = new.user_id;
    select (s.seller_id = new.user_id) into new.from_seller from public.shows s where s.id = new.show_id;
  end if;
  new.from_seller := coalesce(new.from_seller, false);
  new.removed_at := null;
  new.created_at := now();
  return new;
end;
$$;
revoke execute on function public.messages_before_insert() from public, anon, authenticated;

-- Fjern en besked. Sælgeren kan fjerne alle beskeder i sine shows, andre kun deres egne.
-- Teksten bliver slettet, så den heller ikke kan læses bagefter.
create or replace function public.remove_message(p_message bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.messages m
     set body = 'Beskeden er fjernet', removed_at = now()
   where m.id = p_message
     and m.kind = 'chat'
     and m.removed_at is null
     and (m.user_id = auth.uid()
          or exists (select 1 from public.shows s where s.id = m.show_id and s.seller_id = auth.uid()));
  if not found then
    raise exception 'Beskeden kan ikke fjernes';
  end if;
end;
$$;

-- Blokér en bruger i alle dine shows. Brugerens beskeder i dine shows, der ikke er slut, bliver fjernet.
create or replace function public.block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.profiles p where p.id = v_uid and p.is_seller) then
    raise exception 'Kun sælgere kan blokere brugere';
  end if;
  if p_user is null or p_user = v_uid then
    raise exception 'Du kan ikke blokere dig selv';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user) then
    raise exception 'Brugeren findes ikke';
  end if;
  insert into public.seller_blocks (seller_id, user_id) values (v_uid, p_user) on conflict do nothing;
  update public.messages m
     set body = 'Beskeden er fjernet', removed_at = now()
    from public.shows s
   where s.id = m.show_id and s.seller_id = v_uid and s.status <> 'ended'
     and m.user_id = p_user and m.kind = 'chat' and m.removed_at is null;
end;
$$;

create or replace function public.unblock_user(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.seller_blocks where seller_id = auth.uid() and user_id = p_user;
$$;

revoke execute on function public.remove_message(bigint) from public, anon;
revoke execute on function public.block_user(uuid)       from public, anon;
revoke execute on function public.unblock_user(uuid)     from public, anon;
grant  execute on function public.remove_message(bigint) to authenticated;
grant  execute on function public.block_user(uuid)       to authenticated;
grant  execute on function public.unblock_user(uuid)     to authenticated;

-- Snup: som før, men en blokeret bruger kan ikke snuppe hos sælgeren.
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

  -- Købet bliver annonceret i chatten med køberens brugernavn (som på et loppemarked).
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
-- "Meld et problem": køberen melder et problem, og pengene holdes tilbage
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.orders add column if not exists issue_open boolean not null default false;

create table if not exists public.order_issues (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  buyer_id    uuid not null references public.profiles (id) on delete restrict,
  reason      text not null check (reason in ('not_received', 'not_as_shown', 'damaged', 'other')),
  message     text not null check (char_length(btrim(message)) between 10 and 1000),
  status      text not null default 'open' check (status in ('open', 'resolved')),
  resolution  text check (resolution in ('refunded', 'released', 'closed', 'buyer_confirmed')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists order_issues_order_idx on public.order_issues (order_id, created_at desc);
create unique index if not exists order_issues_one_open on public.order_issues (order_id) where status = 'open';

alter table public.order_issues enable row level security;
drop policy if exists "order_issues_read_parties" on public.order_issues;
create policy "order_issues_read_parties" on public.order_issues for select
  to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and (o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid()))
  ));
revoke all on public.order_issues from anon, authenticated;
grant select on public.order_issues to authenticated;
grant all on public.order_issues to service_role;
