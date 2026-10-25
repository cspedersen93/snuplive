-- Relived · Gæst i showet: værten inviterer op til 2 andre sælgere med i sit show.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0019). Filen kan køres flere gange uden fejl.
--
-- Værten sender et link. En sælger, der åbner det, kommer med som gæst: gæsten er på kameraet sammen med værten,
-- lægger sine egne ting i køen, og pengene for gæstens ting går til gæsten (som i dag går de til den, der ejer tingen).
-- Værten styrer showet: hvad der vises, budsalg, lynrunder og chatten.

-- ─────────────────────────────────────────────────────────────────────────────
-- Gæster og invitationer
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.show_guests (
  show_id    uuid not null references public.shows (id) on delete cascade,
  guest_id   uuid not null references public.profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  left_at    timestamptz,
  removed_at timestamptz,
  primary key (show_id, guest_id)
);
create index if not exists show_guests_guest_idx on public.show_guests (guest_id) where left_at is null;
alter table public.show_guests enable row level security;
-- Hvem der er med i et show, er offentligt (det står på showet).
drop policy if exists "show_guests_read" on public.show_guests;
create policy "show_guests_read" on public.show_guests for select to anon, authenticated using (true);
revoke insert, update, delete on public.show_guests from anon, authenticated;
grant select on public.show_guests to anon, authenticated;

-- Invitationslinket. Kun værten kan se det (via guest_invite).
create table if not exists public.show_invites (
  show_id    uuid primary key references public.shows (id) on delete cascade,
  code       text not null unique,
  created_at timestamptz not null default now()
);
alter table public.show_invites enable row level security;
revoke all on public.show_invites from anon, authenticated;

create or replace function public.is_show_guest(p_show uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.show_guests g where g.show_id = p_show and g.guest_id = p_user and g.left_at is null
  );
$$;
grant execute on function public.is_show_guest(uuid, uuid) to anon, authenticated, service_role;

-- Værten henter (eller laver) invitationslinket til sit show.
create or replace function public.guest_invite(p_show uuid, p_renew boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_show public.shows;
  v_code text;
begin
  select * into v_show from public.shows where id = p_show and seller_id = auth.uid();
  if v_show.id is null or v_show.kind <> 'show' or v_show.removed_at is not null then
    raise exception 'Showet findes ikke';
  end if;
  if v_show.status = 'ended' then
    raise exception 'Showet er slut';
  end if;
  if p_renew then
    delete from public.show_invites where show_id = p_show;
  end if;
  select code into v_code from public.show_invites where show_id = p_show;
  if v_code is null then
    insert into public.show_invites (show_id, code)
      values (p_show, replace(gen_random_uuid()::text, '-', ''))
      on conflict (show_id) do update set code = public.show_invites.code
      returning code into v_code;
  end if;
  return v_code;
end;
$$;
revoke execute on function public.guest_invite(uuid, boolean) from public, anon;
grant  execute on function public.guest_invite(uuid, boolean) to authenticated;

-- Hvad invitationen gælder (siden /gaest/<kode>, før man siger ja).
create or replace function public.guest_invite_info(p_code text)
returns table (show_id uuid, title text, starts_at timestamptz, status text, host_id uuid, host_handle text,
               host_avatar text, guests int, joined boolean, removed boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, s.starts_at, s.status, s.seller_id, p.handle, p.avatar_path,
         (select count(*)::int from public.show_guests g where g.show_id = s.id and g.left_at is null),
         exists (select 1 from public.show_guests g where g.show_id = s.id and g.guest_id = auth.uid() and g.left_at is null),
         exists (select 1 from public.show_guests g where g.show_id = s.id and g.guest_id = auth.uid() and g.removed_at is not null)
    from public.show_invites i
    join public.shows s on s.id = i.show_id
    join public.profiles p on p.id = s.seller_id
   where i.code = p_code and s.removed_at is null;
$$;
revoke execute on function public.guest_invite_info(text) from public, anon;
grant  execute on function public.guest_invite_info(text) to authenticated;

-- En sælger siger ja til at være med. Giver showets id.
create or replace function public.guest_join(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_show public.shows;
  v_g    public.show_guests;
begin
  if v_uid is null then
    raise exception 'Log ind først';
  end if;
  select s.* into v_show from public.show_invites i join public.shows s on s.id = i.show_id where i.code = p_code for update of s;
  if v_show.id is null or v_show.removed_at is not null then
    raise exception 'Invitationen gælder ikke længere. Bed værten om et nyt link.';
  end if;
  if v_show.status = 'ended' then
    raise exception 'Showet er slut';
  end if;
  if v_show.seller_id = v_uid then
    raise exception 'Det er dit eget show';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.is_seller) then
    raise exception 'Bliv sælger først (under Mine shows)';
  end if;
  if public.mitid_required()
     and not exists (select 1 from public.profiles p where p.id = v_uid and p.mitid_verified_at is not null) then
    raise exception 'Bekræft, hvem du er, med MitID, før du er med i et show';
  end if;
  if exists (select 1 from public.seller_blocks b where b.seller_id = v_show.seller_id and b.user_id = v_uid) then
    raise exception 'Du kan ikke være med i det her show';
  end if;
  select * into v_g from public.show_guests where show_id = v_show.id and guest_id = v_uid;
  if v_g.removed_at is not null then
    raise exception 'Værten har taget dig ud af showet';
  end if;
  if v_g.guest_id is not null and v_g.left_at is null then
    return v_show.id;
  end if;
  if (select count(*) from public.show_guests g where g.show_id = v_show.id and g.left_at is null) >= 2 then
    raise exception 'Der er allerede 2 gæster i showet';
  end if;
  insert into public.show_guests (show_id, guest_id) values (v_show.id, v_uid)
    on conflict (show_id, guest_id) do update set left_at = null, joined_at = now();
  if v_show.status = 'live' then
    insert into public.messages (show_id, user_id, handle, body, kind)
      select v_show.id, null, 'Relived', p.handle || ' er med i showet som gæst', 'event' from public.profiles p where p.id = v_uid;
  end if;
  return v_show.id;
end;
$$;
revoke execute on function public.guest_join(text) from public, anon;
grant  execute on function public.guest_join(text) to authenticated;

-- Gæsten forlader showet (tingene i køen bliver liggende og kommer til salg, når showet slutter).
create or replace function public.guest_leave(p_show uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.show_guests set left_at = now() where show_id = p_show and guest_id = v_uid and left_at is null;
  if not found then
    raise exception 'Du er ikke med i showet';
  end if;
  if exists (select 1 from public.shows s where s.id = p_show and s.status = 'live') then
    insert into public.messages (show_id, user_id, handle, body, kind)
      select p_show, null, 'Relived', p.handle || ' har forladt showet', 'event' from public.profiles p where p.id = v_uid;
  end if;
end;
$$;
revoke execute on function public.guest_leave(uuid) from public, anon;
grant  execute on function public.guest_leave(uuid) to authenticated;

-- Værten tager en gæst ud af showet. Gæsten kan ikke komme med igen med samme link.
create or replace function public.guest_remove(p_show uuid, p_guest uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.shows s where s.id = p_show and s.seller_id = auth.uid()) then
    raise exception 'Showet findes ikke';
  end if;
  update public.show_guests set left_at = coalesce(left_at, now()), removed_at = now()
   where show_id = p_show and guest_id = p_guest;
  if not found then
    raise exception 'Gæsten er ikke med i showet';
  end if;
end;
$$;
revoke execute on function public.guest_remove(uuid, uuid) from public, anon;
grant  execute on function public.guest_remove(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Gæster lægger deres egne ting i værtens kø (og retter og fjerner kun deres egne, som før).
-- ─────────────────────────────────────────────────────────────────────────────
drop policy if exists "items_insert_own" on public.items;
create policy "items_insert_own" on public.items for insert
  to authenticated
  with check (
    seller_id = (select auth.uid())
    and status = 'queued'
    and exists (
      select 1 from public.shows s
      where s.id = show_id and s.status <> 'ended'
        and (s.seller_id = (select auth.uid()) or public.is_show_guest(s.id, (select auth.uid())))
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Værten styrer showet: viser værtens og gæsternes ting frem og starter budsalg og lynrunder.
-- (Før var det den, der ejede tingen. Uden gæster er det den samme.)
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
  select i.show_id into v_show
    from public.items i join public.shows s on s.id = i.show_id
   where i.id = p_item and s.seller_id = v_uid
     and (i.seller_id = v_uid or public.is_show_guest(s.id, i.seller_id));
  if v_show is null then
    if exists (select 1 from public.items i join public.shows s on s.id = i.show_id where i.id = p_item and s.seller_id = v_uid) then
      raise exception 'Gæsten er ikke med i showet længere';
    end if;
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
  return v_item;
end;
$$;

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
  if exists (
    select 1 from public.items i join public.shows s on s.id = i.show_id
     where i.id = p_item and s.seller_id = v_uid and i.sale_type = 'auction'
  ) then
    raise exception 'Budsalg har sin egen nedtælling. Tryk Start budsalg';
  end if;
  update public.items i
     set rush_ends_at = now() + make_interval(secs => v_secs)
   where i.id = p_item and i.status = 'live'
     and exists (select 1 from public.shows s where s.id = i.show_id and s.seller_id = v_uid)
  returning * into v_item;
  if v_item.id is null then
    raise exception 'Vis tingen frem, før du starter en lynrunde';
  end if;
  insert into public.messages (show_id, user_id, handle, body, kind)
    values (v_item.show_id, null, 'Relived', 'Lynrunde! ' || v_secs || ' sekunder på ' || v_item.name, 'event');
  return v_item;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Chat: gæsternes beskeder står som sælgerens (fremhævet), og en bruger, værten har blokeret, kan ikke skrive.
-- ─────────────────────────────────────────────────────────────────────────────
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
    select (s.seller_id = new.user_id or public.is_show_guest(s.id, new.user_id)) into new.from_seller
      from public.shows s where s.id = new.show_id;
  end if;
  new.from_seller := coalesce(new.from_seller, false);
  new.removed_at := null;
  new.created_at := now();
  return new;
end;
$$;

-- Følgerne af gæsterne får også besked, når showet går live (serveren, /api/shows/<id>/notify).
create or replace function public.show_guest_ids(p_show uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.guest_id from public.show_guests g where g.show_id = p_show and g.left_at is null;
$$;
grant execute on function public.show_guest_ids(uuid) to anon, authenticated, service_role;
