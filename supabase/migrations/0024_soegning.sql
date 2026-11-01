-- Relived · Søgning og søgeagenter.
--   1) search_items: søgefeltet på /soeg (varer til salg nu, live nu og i kommende shows).
--   2) saved_searches: køberen gemmer en søgning ("Giv mig besked om nye") og får besked, når en ny vare passer.
--   3) claim_search_alerts: finder nye varer til søgeagenterne (kun serveren). Hver vare giver kun besked én gang pr. søgning.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0023). Filen kan køres flere gange uden fejl.

-- ─────────────────────────────────────────────────────────────────────────────
-- Fælles: passer en vare til en søgning? Alle ord skal stå i navn, beskrivelse, størrelse eller stand
-- (dele af ord tæller, så "frakke" finder "uldfrakke"). Kategori, maks pris og størrelse er valgfrie.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.search_words(p_q text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array(
    select distinct w from unnest(regexp_split_to_array(lower(trim(coalesce(p_q, ''))), '[^[:alnum:]æøåéü+-]+')) w
     where char_length(w) >= 2
       -- Små fyldord og "str." tæller ikke (størrelsen søges for sig).
       and w not in ('og', 'i', 'med', 'til', 'fra', 'en', 'et', 'af', 'på', 'str', 'størrelse', 'stoerrelse', 'brugt', 'brugte')
     limit 8
  ), '{}');
$$;
grant execute on function public.search_words(text) to anon, authenticated, service_role;

create or replace function public.item_matches(
  p_words text[], p_category text, p_max_price int, p_size text,
  p_name text, p_description text, p_item_size text, p_condition text, p_item_category text, p_price int
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_category is null or p_item_category = p_category)
     and (p_max_price is null or p_price <= p_max_price)
     and (p_size is null or lower(trim(coalesce(p_item_size, ''))) = lower(trim(p_size)))
     and not exists (
       select 1 from unnest(coalesce(p_words, '{}')) w
        where strpos(lower(coalesce(p_name, '') || ' ' || coalesce(p_description, '') || ' ' || coalesce(p_item_size, '') || ' ' || coalesce(p_condition, '')), w) = 0
     );
$$;
grant execute on function public.item_matches(text[], text, int, text, text, text, text, text, text, int) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Søgningen. Samme kolonner som items_feed, så siden kan vise de samme kort.
-- ─────────────────────────────────────────────────────────────────────────────
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Søgeagenter. Køberen ser og sletter sine egne. Oprettes med save_search (højst 10 pr. bruger).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.saved_searches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  query      text not null default '' check (char_length(query) <= 60),
  category   text check (category is null or category in ('dametoej', 'herretoej', 'luksus', 'skoenhed', 'boernetoej', 'bolig', 'samlerting', 'andet')),
  max_price  int check (max_price is null or max_price between 1 and 100000),
  size       text check (size is null or char_length(size) between 1 and 20),
  created_at timestamptz not null default now(),
  constraint saved_searches_not_empty check (char_length(trim(query)) >= 2 or category is not null)
);
create unique index if not exists saved_searches_unique
  on public.saved_searches (user_id, lower(query), coalesce(category, ''), coalesce(max_price, 0), lower(coalesce(size, '')));
create index if not exists saved_searches_user_idx on public.saved_searches (user_id, created_at desc);

alter table public.saved_searches enable row level security;
drop policy if exists "saved_searches_select_own" on public.saved_searches;
create policy "saved_searches_select_own" on public.saved_searches for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "saved_searches_delete_own" on public.saved_searches;
create policy "saved_searches_delete_own" on public.saved_searches for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.saved_searches from anon, authenticated;
grant select, delete on public.saved_searches to authenticated;

create or replace function public.save_search(p_query text, p_category text default null, p_max_price int default null, p_size text default null)
returns public.saved_searches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_q    text := left(regexp_replace(trim(coalesce(p_query, '')), '\s+', ' ', 'g'), 60);
  v_size text := nullif(left(trim(coalesce(p_size, '')), 20), '');
  v_row  public.saved_searches;
begin
  if v_uid is null then
    raise exception 'Log ind for at gemme søgningen';
  end if;
  if char_length(v_q) < 2 and p_category is null then
    raise exception 'Skriv, hvad du leder efter, eller vælg en kategori';
  end if;
  if p_category is not null and p_category not in ('dametoej', 'herretoej', 'luksus', 'skoenhed', 'boernetoej', 'bolig', 'samlerting', 'andet') then
    raise exception 'Ukendt kategori';
  end if;
  if p_max_price is not null and (p_max_price < 1 or p_max_price > 100000) then
    raise exception 'Maks pris skal være mellem 1 og 100.000 kr';
  end if;
  select * into v_row from public.saved_searches s
   where s.user_id = v_uid and lower(s.query) = lower(v_q) and coalesce(s.category, '') = coalesce(p_category, '')
     and coalesce(s.max_price, 0) = coalesce(p_max_price, 0) and lower(coalesce(s.size, '')) = lower(coalesce(v_size, ''));
  if v_row.id is not null then
    return v_row;
  end if;
  if (select count(*) from public.saved_searches s where s.user_id = v_uid) >= 10 then
    raise exception 'Du kan have 10 søgeagenter. Slet en af de andre under Min konto først';
  end if;
  insert into public.saved_searches (user_id, query, category, max_price, size)
    values (v_uid, v_q, p_category, p_max_price, v_size)
  returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.save_search(text, text, int, text) from public, anon;
grant  execute on function public.save_search(text, text, int, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Besked om nye varer. Kun serveren (service_role) kalder den. En vare tæller som ny til en søgning, når den er blevet
-- synlig efter, at søgningen blev gemt: lagt i et kommende show, sat til salg, eller showet er gået live.
-- Hver vare giver kun besked én gang pr. søgning (saved_search_hits). Højst 5 varer pr. søgning pr. gang.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.saved_search_hits (
  search_id  uuid not null references public.saved_searches(id) on delete cascade,
  item_id    uuid not null references public.items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (search_id, item_id)
);
alter table public.saved_search_hits enable row level security;
revoke all on public.saved_search_hits from anon, authenticated;

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
