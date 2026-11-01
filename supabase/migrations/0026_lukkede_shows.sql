-- Relived · Lukkede shows (kun for inviterede).
-- Sælgeren kan gøre et show lukket: det er ikke med i lister, søgning, søgeagenter og morgenmails, og kun inviterede
-- (med linket), sælgeren og gæsterne kan se videoen, skrive i chatten, byde og købe, mens showet kører. Når showet er slut,
-- kommer det usolgte til salg for alle som normalt.
-- Invitationskoden ligger i sin egen tabel, som kun sælgeren kan se (shows kan læses af alle).
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0025). Filen kan køres flere gange uden fejl.

alter table public.shows add column if not exists visibility text not null default 'public';
alter table public.shows drop constraint if exists shows_visibility_check;
alter table public.shows add constraint shows_visibility_check check (visibility in ('public', 'invite'));
-- Sælgeren vælger det, når showet oprettes, og kan skifte bagefter (som titlen; kun mens showet ikke er slut).
grant insert (visibility) on public.shows to authenticated;
grant update (visibility) on public.shows to authenticated;
create index if not exists shows_visibility_idx on public.shows (visibility, status) where visibility <> 'public';

create table if not exists public.show_invites (
  show_id    uuid primary key references public.shows(id) on delete cascade,
  code       text not null unique check (code ~ '^[a-z0-9]{10,32}$'),
  created_at timestamptz not null default now()
);
alter table public.show_invites enable row level security;
revoke all on public.show_invites from anon, authenticated;

create table if not exists public.show_members (
  show_id   uuid not null references public.shows(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (show_id, user_id)
);
create index if not exists show_members_user_idx on public.show_members (user_id);
alter table public.show_members enable row level security;
drop policy if exists "show_members_select_own" on public.show_members;
create policy "show_members_select_own" on public.show_members for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.show_members from anon, authenticated;
grant select on public.show_members to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Må brugeren se showet? Åbne og afsluttede shows: alle. Lukkede: sælgeren, gæsterne og de inviterede.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._can_view_show(p_show uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select s.visibility = 'public' or s.status = 'ended'
        or (p_user is not null and (
              s.seller_id = p_user
           or exists (select 1 from public.show_guests g where g.show_id = s.id and g.guest_id = p_user and g.left_at is null)
           or exists (select 1 from public.show_members m where m.show_id = s.id and m.user_id = p_user)))
      from public.shows s where s.id = p_show
  ), false);
$$;
revoke execute on function public._can_view_show(uuid, uuid) from public, anon, authenticated;

create or replace function public.can_view_show(p_show uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public._can_view_show(p_show, auth.uid());
$$;
grant execute on function public.can_view_show(uuid) to anon, authenticated, service_role;

-- Sælgerens invitationslink (laves første gang). p_new = true laver et nyt link (det gamle holder op med at virke).
create or replace function public.show_invite_code(p_show uuid, p_new boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not exists (select 1 from public.shows s where s.id = p_show and s.seller_id = auth.uid()) then
    raise exception 'Showet findes ikke';
  end if;
  v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  if p_new then
    insert into public.show_invites (show_id, code) values (p_show, v_code)
    on conflict (show_id) do update set code = excluded.code, created_at = now();
    return v_code;
  end if;
  insert into public.show_invites (show_id, code) values (p_show, v_code) on conflict (show_id) do nothing;
  select i.code into v_code from public.show_invites i where i.show_id = p_show;
  return v_code;
end;
$$;
revoke execute on function public.show_invite_code(uuid, boolean) from public, anon;
grant  execute on function public.show_invite_code(uuid, boolean) to authenticated;

-- Hvor mange er inviteret (har åbnet linket)? Kun sælgeren.
create or replace function public.show_member_count(p_show uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case when exists (select 1 from public.shows s where s.id = p_show and s.seller_id = auth.uid())
              then (select count(*)::int from public.show_members m where m.show_id = p_show) end;
$$;
revoke execute on function public.show_member_count(uuid) from public, anon;
grant  execute on function public.show_member_count(uuid) to authenticated;

-- De inviterede med e-mail (til beskeden, når showet går live). Kun serveren.
create or replace function public.show_member_recipients(p_show uuid)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.user_id, u.email::text from public.show_members m join auth.users u on u.id = m.user_id where m.show_id = p_show;
$$;
revoke execute on function public.show_member_recipients(uuid) from public, anon, authenticated;
grant  execute on function public.show_member_recipients(uuid) to service_role;

-- Køberen åbner invitationslinket: bliver inviteret til showet. Giver showets id, eller null, hvis linket ikke virker.
create or replace function public.join_show(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_show uuid;
begin
  if v_uid is null then
    raise exception 'Log ind for at komme ind i showet';
  end if;
  select i.show_id into v_show
    from public.show_invites i join public.shows s on s.id = i.show_id
   where i.code = lower(trim(coalesce(p_code, ''))) and s.removed_at is null and s.status <> 'ended';
  if v_show is null then
    return null;
  end if;
  insert into public.show_members (show_id, user_id) values (v_show, v_uid) on conflict do nothing;
  return v_show;
end;
$$;
revoke execute on function public.join_show(text) from public, anon;
grant  execute on function public.join_show(text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Vagt: i et lukket show, der kører, kan kun de inviterede skrive, byde, sætte maks-bud og købe.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._invite_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_show uuid;
  v_user uuid;
begin
  if tg_table_name = 'messages' then
    if new.kind <> 'chat' or new.user_id is null then
      return new;
    end if;
    v_show := new.show_id;
    v_user := new.user_id;
  elsif tg_table_name = 'sales' then
    v_show := new.show_id;
    v_user := new.buyer_id;
  elsif tg_table_name = 'bids' then
    v_show := new.show_id;
    v_user := new.bidder_id;
  else
    select i.show_id into v_show from public.items i where i.id = new.item_id;
    v_user := new.user_id;
  end if;
  if not public._can_view_show(v_show, v_user) then
    raise exception 'Showet er kun for inviterede';
  end if;
  return new;
end;
$$;
revoke execute on function public._invite_guard() from public, anon, authenticated;

drop trigger if exists messages_invite_guard on public.messages;
create trigger messages_invite_guard before insert on public.messages for each row execute function public._invite_guard();
drop trigger if exists sales_invite_guard on public.sales;
create trigger sales_invite_guard before insert on public.sales for each row execute function public._invite_guard();
drop trigger if exists bids_invite_guard on public.bids;
create trigger bids_invite_guard before insert on public.bids for each row execute function public._invite_guard();
do $$
begin
  if to_regclass('public.max_bids') is not null then
    execute 'drop trigger if exists max_bids_invite_guard on public.max_bids';
    execute 'create trigger max_bids_invite_guard before insert or update on public.max_bids for each row execute function public._invite_guard()';
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Lister, søgning og søgeagenter: som i 0015 og 0024, men uden lukkede shows (før de er slut).
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
  high_bid int, bid_count int, clip_path text, total bigint
)
language sql
stable
set search_path = ''
as $$
  select i.id, i.name, i.size, i.condition, i.price, i.images, coalesce(i.category, s.category), i.status,
         i.for_sale, i.sale_type, i.description, s.id, s.title, s.status, s.starts_at, i.listed_at,
         p.id, p.handle, p.avatar_path, p.area, i.high_bid, i.bid_count, i.clip_path, count(*) over ()
    from public.items i
    join public.shows s on s.id = i.show_id
    join public.profiles p on p.id = i.seller_id
   where i.removed_at is null
     and s.removed_at is null
     and (p_category is null or coalesce(i.category, s.category) = p_category)
     and (p_seller is null or i.seller_id = p_seller)
     and (p_exclude is null or i.id <> p_exclude)
     -- Lukkede shows (kun for inviterede) er ikke med, før de er slut.
     and (s.visibility = 'public' or s.status = 'ended')
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

drop function if exists public.search_items(text, text, int, text, int, int);
create function public.search_items(
  p_q text default null,
  p_category text default null,
  p_max_price int default null,
  p_size text default null,
  p_limit int default 24,
  p_offset int default 0
)
returns table (
  id uuid, name text, size text, condition text, price int, images text[], category text, status text,
  for_sale boolean, sale_type text, description text, show_id uuid, show_title text, show_status text,
  starts_at timestamptz, listed_at timestamptz, seller_id uuid, handle text, avatar_path text, area text,
  high_bid int, bid_count int, clip_path text, total bigint
)
language sql
stable
set search_path = ''
as $$
  select i.id, i.name, i.size, i.condition, i.price, i.images, coalesce(i.category, s.category), i.status,
         i.for_sale, i.sale_type, i.description, s.id, s.title, s.status, s.starts_at, i.listed_at,
         p.id, p.handle, p.avatar_path, p.area, i.high_bid, i.bid_count, i.clip_path, count(*) over ()
    from public.items i
    join public.shows s on s.id = i.show_id
    join public.profiles p on p.id = i.seller_id
   where i.removed_at is null
     and s.removed_at is null
     -- Lukkede shows (kun for inviterede) er ikke med, før de er slut.
     and (s.visibility = 'public' or s.status = 'ended')
     and ((s.status = 'ended' and i.status = 'unsold' and i.for_sale)
          or (s.status = 'live' and i.status in ('queued', 'live'))
          or (s.status = 'planned' and i.status = 'queued' and s.starts_at >= now() - interval '2 hours'))
     and public.item_matches(public.search_words(p_q), p_category, p_max_price, nullif(trim(p_size), ''),
                             i.name, i.description, i.size, i.condition, coalesce(i.category, s.category), i.price)
     -- En tom søgning (ingen ord og ingen kategori) giver ingen resultater.
     and (cardinality(public.search_words(p_q)) > 0 or p_category is not null)
   order by case s.status when 'live' then 0 when 'ended' then 1 else 2 end,
            case when s.status = 'planned' then s.starts_at end asc,
            coalesce(i.listed_at, i.created_at) desc
   limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
grant execute on function public.search_items(text, text, int, text, int, int) to anon, authenticated, service_role;

create or replace function public.claim_search_alerts()
returns table (
  user_id uuid, email text, search_id uuid, query text, category text,
  item_id uuid, item_name text, price int, size text, kind text, starts_at timestamptz, handle text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with cand as (
    select ss.id as sid, ss.user_id as uid, ss.query as q, ss.category as cat, x.*
      from public.saved_searches ss
      cross join lateral (
        select i.id as iid, i.name as iname, coalesce(i.high_bid, i.price) as iprice, i.size as isize,
               case s.status when 'ended' then 'for_sale' when 'live' then 'live' else 'upcoming' end as ikind,
               s.starts_at as istarts, p.handle as ihandle
          from public.items i
          join public.shows s on s.id = i.show_id
          join public.profiles p on p.id = i.seller_id
         where i.removed_at is null
           and s.removed_at is null
           -- Lukkede shows giver kun besked, når de er slut, og varerne er til salg for alle.
           and (s.visibility = 'public' or s.status = 'ended')
           and i.seller_id <> ss.user_id
           and not exists (select 1 from public.seller_blocks b where b.seller_id = i.seller_id and b.user_id = ss.user_id)
           and ((s.status = 'ended' and i.status = 'unsold' and i.for_sale
                 and coalesce(i.listed_at, s.ended_at, i.created_at) > ss.created_at)
                or (s.status = 'live' and i.status in ('queued', 'live')
                    and greatest(i.created_at, coalesce(s.started_at, i.created_at)) > ss.created_at)
                or (s.status = 'planned' and i.status = 'queued' and s.starts_at >= now()
                    and i.created_at > ss.created_at))
           and greatest(i.created_at, coalesce(i.listed_at, i.created_at), coalesce(s.started_at, i.created_at)) > now() - interval '14 days'
           and public.item_matches(public.search_words(ss.query), ss.category, ss.max_price, ss.size,
                                   i.name, i.description, i.size, i.condition, coalesce(i.category, s.category), i.price)
           and not exists (select 1 from public.saved_search_hits h where h.search_id = ss.id and h.item_id = i.id)
         order by case s.status when 'live' then 0 when 'ended' then 1 else 2 end, i.created_at desc
         limit 5
      ) x
  ),
  ins as (
    insert into public.saved_search_hits (search_id, item_id)
    select c.sid, c.iid from cand c
    on conflict do nothing
    returning saved_search_hits.search_id, saved_search_hits.item_id
  )
  select c.uid, u.email::text, c.sid, c.q, c.cat, c.iid, c.iname, c.iprice, c.isize, c.ikind, c.istarts, c.ihandle
    from ins
    join cand c on c.sid = ins.search_id and c.iid = ins.item_id
    join auth.users u on u.id = c.uid;
end;
$$;
revoke execute on function public.claim_search_alerts() from public, anon, authenticated;
grant  execute on function public.claim_search_alerts() to service_role;
