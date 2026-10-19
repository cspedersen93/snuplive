-- SnupLive · trin 1 · database
-- Kør hele filen i Supabase → SQL Editor → New query → Run.
-- Den opretter tabellerne, adgangsreglerne (RLS) og de funktioner, der styrer
-- et live-show: gå live, vis en ting, lynrunde og snup.

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiler: én pr. bruger, oprettes automatisk ved første login
-- ─────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  handle       text not null unique check (handle ~ '^[a-z0-9._]{3,24}$'),
  display_name text check (char_length(display_name) <= 40),
  area         text check (char_length(area) <= 40),
  is_seller    boolean not null default false,
  created_at   timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  base      text;
  candidate text;
  tries     int := 0;
begin
  base := left(regexp_replace(lower(split_part(coalesce(new.email, ''), '@', 1)), '[^a-z0-9._]', '', 'g'), 18);
  if char_length(base) < 3 then
    base := 'snupper';
  end if;
  candidate := base;
  while exists (select 1 from public.profiles p where p.handle = candidate) loop
    tries := tries + 1;
    candidate := base || (floor(random() * 9000) + 1000)::int::text;
    if tries > 20 then
      candidate := 'snup' || substr(replace(new.id::text, '-', ''), 1, 12);
      exit;
    end if;
  end loop;
  insert into public.profiles (id, handle) values (new.id, candidate);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Shows
-- ─────────────────────────────────────────────────────────────────────────────
create table public.shows (
  id              uuid primary key default gen_random_uuid(),
  seller_id       uuid not null references public.profiles (id) on delete cascade,
  title           text not null check (char_length(title) between 3 and 80),
  category        text not null default 'toej'
                  check (category in ('toej', 'overtoej', 'denim', 'vinyl', 'design', 'andet')),
  status          text not null default 'planned' check (status in ('planned', 'live', 'ended')),
  starts_at       timestamptz,
  started_at      timestamptz,
  ended_at        timestamptz,
  current_item_id uuid,
  created_at      timestamptz not null default now()
);
create index shows_status_idx on public.shows (status, starts_at);
create index shows_seller_idx on public.shows (seller_id, created_at desc);
-- En sælger kan kun være live i ét show ad gangen.
create unique index shows_one_live_per_seller on public.shows (seller_id) where status = 'live';

-- ─────────────────────────────────────────────────────────────────────────────
-- Ting i et show
-- ─────────────────────────────────────────────────────────────────────────────
create table public.items (
  id           uuid primary key default gen_random_uuid(),
  show_id      uuid not null references public.shows (id) on delete cascade,
  seller_id    uuid not null references public.profiles (id) on delete cascade,
  name         text not null check (char_length(name) between 2 and 80),
  size         text check (char_length(size) <= 20),
  condition    text check (char_length(condition) <= 40),
  price        int not null check (price between 1 and 100000),
  position     int not null default 0,
  status       text not null default 'queued' check (status in ('queued', 'live', 'sold', 'unsold')),
  rush_ends_at timestamptz,
  sold_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index items_show_idx on public.items (show_id, position);

alter table public.shows
  add constraint shows_current_item_fkey
  foreign key (current_item_id) references public.items (id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Snup (salg): hvem der snuppede hvad. Kun køber og sælger kan se dem.
-- I trin 2 bliver de til ordrer med betaling og fragt.
-- ─────────────────────────────────────────────────────────────────────────────
create table public.sales (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null unique references public.items (id) on delete cascade,
  show_id    uuid not null references public.shows (id) on delete cascade,
  seller_id  uuid not null references public.profiles (id) on delete cascade,
  buyer_id   uuid not null references public.profiles (id) on delete cascade,
  price      int not null check (price > 0),
  status     text not null default 'reserved' check (status in ('reserved', 'paid', 'shipped', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);
create index sales_buyer_idx on public.sales (buyer_id, created_at desc);
create index sales_seller_idx on public.sales (seller_id, created_at desc);
create index sales_show_idx on public.sales (show_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Chat og hændelser i et show
-- ─────────────────────────────────────────────────────────────────────────────
create table public.messages (
  id          bigint generated always as identity primary key,
  show_id     uuid not null references public.shows (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null,
  handle      text not null,
  body        text not null check (char_length(body) between 1 and 300),
  kind        text not null default 'chat' check (kind in ('chat', 'event')),
  from_seller boolean not null default false,
  created_at  timestamptz not null default now()
);
create index messages_show_idx on public.messages (show_id, id desc);
create index messages_user_idx on public.messages (user_id, created_at desc);

-- Navn og sælger-mærke sættes af databasen, så ingen kan skrive i andres navn.
create function public.messages_before_insert()
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
  new.created_at := now();
  return new;
end;
$$;

create trigger messages_before_insert
  before insert on public.messages
  for each row execute function public.messages_before_insert();

-- ─────────────────────────────────────────────────────────────────────────────
-- Adgangsregler (Row Level Security)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.shows    enable row level security;
alter table public.items    enable row level security;
alter table public.messages enable row level security;
alter table public.sales    enable row level security;

-- Alle må se profiler, shows, ting og chat (det er et offentligt marked).
create policy "profiles_read" on public.profiles for select using (true);
create policy "shows_read"    on public.shows    for select using (true);
create policy "items_read"    on public.items    for select using (true);
create policy "messages_read" on public.messages for select using (true);

-- Snup: kun køberen og sælgeren kan se et salg.
create policy "sales_read_own" on public.sales for select
  to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

-- Profil: kun ejeren kan rette den.
create policy "profiles_update_own" on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Shows: kun sælgere kan oprette, kun ejeren kan rette og slette planlagte shows.
create policy "shows_insert_seller" on public.shows for insert
  to authenticated
  with check (
    seller_id = (select auth.uid())
    and status = 'planned'
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_seller)
  );
create policy "shows_update_own" on public.shows for update
  to authenticated
  using (seller_id = (select auth.uid()) and status <> 'ended')
  with check (seller_id = (select auth.uid()));
create policy "shows_delete_planned" on public.shows for delete
  to authenticated
  using (seller_id = (select auth.uid()) and status = 'planned');

-- Ting: ejeren lægger ting i sine egne shows og retter dem, mens de står i køen.
create policy "items_insert_own" on public.items for insert
  to authenticated
  with check (
    seller_id = (select auth.uid())
    and status = 'queued'
    and exists (
      select 1 from public.shows s
      where s.id = show_id and s.seller_id = (select auth.uid()) and s.status <> 'ended'
    )
  );
create policy "items_update_queued" on public.items for update
  to authenticated
  using (seller_id = (select auth.uid()) and status in ('queued', 'unsold'))
  with check (seller_id = (select auth.uid()));
create policy "items_delete_queued" on public.items for delete
  to authenticated
  using (seller_id = (select auth.uid()) and status in ('queued', 'unsold'));

-- Chat: indloggede brugere skriver i eget navn, kun mens showet er live.
create policy "messages_insert_own" on public.messages for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and kind = 'chat'
    and exists (select 1 from public.shows s where s.id = show_id and s.status = 'live')
  );

-- Grundrettigheder (sættes eksplicit, så det virker, selv om projektet ikke giver dem automatisk).
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.shows, public.items, public.messages to anon, authenticated;
grant select on public.sales to authenticated;
grant delete on public.shows, public.items to authenticated;

-- Kolonne-rettigheder: status, køber og tider kan kun ændres via funktionerne nedenfor.
revoke insert, update on public.profiles from anon, authenticated;
grant update (handle, display_name, area, is_seller) on public.profiles to authenticated;

revoke insert, update on public.shows from anon, authenticated;
grant insert (id, seller_id, title, category, starts_at) on public.shows to authenticated;
grant update (title, category, starts_at) on public.shows to authenticated;

revoke insert, update on public.items from anon, authenticated;
grant insert (id, show_id, seller_id, name, size, condition, price, position) on public.items to authenticated;
grant update (name, size, condition, price, position) on public.items to authenticated;

revoke insert, update, delete on public.messages from anon, authenticated;
grant insert (show_id, user_id, body) on public.messages to authenticated;

revoke insert, update, delete on public.sales from anon, authenticated;
revoke select on public.sales from anon;

revoke delete on public.profiles from anon, authenticated;
revoke delete on public.shows, public.items from anon;
revoke truncate, references, trigger
  on public.profiles, public.shows, public.items, public.messages, public.sales
  from anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Funktioner til live-showet (kaldes fra appen med supabase.rpc)
-- ─────────────────────────────────────────────────────────────────────────────

-- Start eller afslut et show.
create function public.set_show_status(p_show uuid, p_status text)
returns public.shows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_show public.shows;
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
    update public.items set status = 'unsold', rush_ends_at = null where show_id = p_show and status = 'live';
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

-- Vis en ting frem. Den ting, der blev vist før, og som ikke blev solgt, bliver "usolgt".
create function public.present_item(p_item uuid)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_show uuid;
  v_item public.items;
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
  select * into v_item from public.items where id = p_item for update;
  if v_item.status = 'sold' then
    raise exception 'Tingen er allerede solgt';
  end if;

  update public.items set status = 'unsold', rush_ends_at = null
    where show_id = v_show and status = 'live' and id <> p_item;
  update public.items set status = 'live', rush_ends_at = null where id = p_item returning * into v_item;
  update public.shows set current_item_id = p_item where id = v_show;
  return v_item;
end;
$$;

-- Lynrunde: tingen kan kun snuppes i de næste p_seconds sekunder.
create function public.start_rush(p_item uuid, p_seconds int default 10)
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

-- Snup: den første, der trykker, får tingen. Sker i én atomisk opdatering.
create function public.snup(p_item uuid)
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

revoke execute on function public.set_show_status(uuid, text) from public, anon;
revoke execute on function public.present_item(uuid)           from public, anon;
revoke execute on function public.start_rush(uuid, int)         from public, anon;
revoke execute on function public.snup(uuid)                    from public, anon;
grant  execute on function public.set_show_status(uuid, text) to authenticated;
grant  execute on function public.present_item(uuid)           to authenticated;
grant  execute on function public.start_rush(uuid, int)         to authenticated;
grant  execute on function public.snup(uuid)                    to authenticated;
revoke execute on function public.handle_new_user()        from public, anon, authenticated;
revoke execute on function public.messages_before_insert() from public, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime: appen lytter på ændringer i shows, ting og chat
-- ─────────────────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.shows, public.items, public.messages, public.sales;
