-- Relived · flere filtre i søgningen og i søgeagenterne: pris fra, stand, hvornår (til salg nu, live nu, kommer snart),
-- købsform (Køb nu eller budsalg), ægthed tjekket, med video, privat eller erhverv, og sortering.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0032). Filen kan køres flere gange uden fejl.
-- Kræver 0024_soegning.sql (søgningen). Indtil filen er kørt, virker søgningen som før, uden de nye filtre.
--
-- Filtrene gemmes samlet i ét felt (jsonb), fx {"min": 100, "stand": "god", "hvornaar": "live", "type": "budsalg",
-- "aegthed": true, "video": true, "saelger": "privat"}. Ukendte nøgler og værdier bliver smidt væk.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Hjælpere
-- ─────────────────────────────────────────────────────────────────────────────

-- Kun de kendte filtre med gyldige værdier. Tomt: '{}'.
create or replace function public.clean_search_filters(p jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p) is distinct from 'object' then '{}'::jsonb else jsonb_strip_nulls(jsonb_build_object(
    'min', case when jsonb_typeof(p->'min') = 'number' and (p->>'min')::numeric between 1 and 100000
                then to_jsonb(floor((p->>'min')::numeric)::int) end,
    'stand', case when p->>'stand' in ('ny', 'somny', 'god', 'brugt') then to_jsonb(p->>'stand') end,
    'hvornaar', case when p->>'hvornaar' in ('nu', 'live', 'snart') then to_jsonb(p->>'hvornaar') end,
    'type', case when p->>'type' in ('fast', 'budsalg') then to_jsonb(p->>'type') end,
    'aegthed', case when p->'aegthed' = 'true'::jsonb then 'true'::jsonb end,
    'video', case when p->'video' = 'true'::jsonb then 'true'::jsonb end,
    'saelger', case when p->>'saelger' in ('privat', 'erhverv') then to_jsonb(p->>'saelger') end
  )) end;
$$;
grant execute on function public.clean_search_filters(jsonb) to anon, authenticated, service_role;

-- Standen som tal, så "god stand eller bedre" kan søges: ny 4, som ny 3, god 2, brugt 1, slidt 0. Ukendt: null.
create or replace function public.condition_rank(p text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when p is null or trim(p) = '' then null
    when lower(trim(p)) like 'ny%' then 4
    when lower(trim(p)) like 'som ny%' then 3
    when lower(trim(p)) like 'god%' or lower(trim(p)) like 'meget god%' or lower(trim(p)) like 'rigtig god%' then 2
    when lower(trim(p)) like 'brugt%' then 1
    when lower(trim(p)) like 'slidt%' then 0
    else null
  end;
$$;
grant execute on function public.condition_rank(text) to anon, authenticated, service_role;

-- Passer en vare til de ekstra filtre?
create or replace function public.item_filters_match(
  p_filters jsonb, p_price int, p_condition text, p_show_status text, p_sale_type text,
  p_auth_ok boolean, p_has_video boolean, p_seller_type text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (p_filters->>'min' is null or p_price >= (p_filters->>'min')::int)
     and (p_filters->>'stand' is null or coalesce(public.condition_rank(p_condition), -1) >=
          case p_filters->>'stand' when 'ny' then 4 when 'somny' then 3 when 'god' then 2 else 1 end)
     and (p_filters->>'hvornaar' is null or p_show_status =
          case p_filters->>'hvornaar' when 'nu' then 'ended' when 'live' then 'live' else 'planned' end)
     -- Budsalg: kun mens showet ikke er slut. Bagefter kan varen købes til startprisen (Køb nu).
     and (p_filters->>'type' is null
          or (p_filters->>'type' = 'budsalg' and p_sale_type = 'auction' and p_show_status <> 'ended')
          or (p_filters->>'type' = 'fast' and (p_sale_type <> 'auction' or p_show_status = 'ended')))
     and (p_filters->'aegthed' is null or coalesce(p_auth_ok, false))
     and (p_filters->'video' is null or coalesce(p_has_video, false))
     and (p_filters->>'saelger' is null
          or (p_filters->>'saelger' = 'erhverv' and p_seller_type = 'business')
          or (p_filters->>'saelger' = 'privat' and coalesce(p_seller_type, 'private') <> 'business'));
$$;
grant execute on function public.item_filters_match(jsonb, int, text, text, text, boolean, boolean, text) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Søgningen: samme kolonner som før, med filtre og sortering.
-- Den gamle udgave fjernes, så siden altid finder den nye (de gamle argumenter virker stadig).
-- ─────────────────────────────────────────────────────────────────────────────
drop function if exists public.search_items(text, text, int, text, int, int);
drop function if exists public.search_items(text, text, int, text, jsonb, text, int, int);
create function public.search_items(
  p_q text default null,
  p_category text default null,
  p_max_price int default null,
  p_size text default null,
  p_filters jsonb default '{}'::jsonb,
  -- 'anbefalet' (live først), 'nyeste', 'billigst', 'dyrest' eller 'snart' (live nu og snart live først).
  p_sort text default null,
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
  with f as (select public.clean_search_filters(p_filters) as filters, public.search_words(p_q) as words)
  select i.id, i.name, i.size, i.condition, i.price, i.images, coalesce(i.category, s.category), i.status,
         i.for_sale, i.sale_type, i.description, s.id, s.title, s.status, s.starts_at, i.listed_at,
         p.id, p.handle, p.avatar_path, p.area, i.high_bid, i.bid_count, i.clip_path, count(*) over ()
    from f, public.items i
    join public.shows s on s.id = i.show_id
    join public.profiles p on p.id = i.seller_id
   where i.removed_at is null
     and s.removed_at is null
     -- Lukkede shows (kun for inviterede) er ikke med, før de er slut.
     and (s.visibility = 'public' or s.status = 'ended')
     and ((s.status = 'ended' and i.status = 'unsold' and i.for_sale)
          or (s.status = 'live' and i.status in ('queued', 'live'))
          or (s.status = 'planned' and i.status = 'queued' and s.starts_at >= now() - interval '2 hours'))
     and public.item_matches(f.words, p_category, p_max_price, nullif(trim(p_size), ''),
                             i.name, i.description, i.size, i.condition, coalesce(i.category, s.category), i.price)
     and public.item_filters_match(f.filters, i.price, i.condition, s.status, i.sale_type,
                                   i.auth_required and i.auth_status = 'approved', i.clip_path is not null, p.seller_type)
     -- En helt tom søgning (ingen ord, ingen kategori og ingen filtre) giver ingen resultater.
     and (cardinality(f.words) > 0 or p_category is not null or p_max_price is not null or f.filters <> '{}'::jsonb)
   order by
     case when p_sort = 'billigst' then coalesce(i.high_bid, i.price) end asc nulls last,
     case when p_sort = 'dyrest' then coalesce(i.high_bid, i.price) end desc nulls last,
     case when p_sort = 'nyeste' then coalesce(i.listed_at, i.created_at) end desc nulls last,
     case when p_sort = 'snart' then case s.status when 'live' then 0 when 'planned' then 1 else 2 end end asc,
     case when p_sort = 'snart' and s.status = 'planned' then s.starts_at end asc,
     -- Anbefalet: live først, så til salg, så kommende. Varer med ordene i navnet før dem med ordene i beskrivelsen.
     case s.status when 'live' then 0 when 'ended' then 1 else 2 end,
     case when s.status = 'planned' then s.starts_at end asc,
     case when cardinality(f.words) > 0 and not exists (
            select 1 from unnest(f.words) w where strpos(lower(i.name), w) = 0) then 0 else 1 end,
     coalesce(i.listed_at, i.created_at) desc
   limit least(greatest(coalesce(p_limit, 24), 1), 60)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
grant execute on function public.search_items(text, text, int, text, jsonb, text, int, int) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Søgeagenter med filtre
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.saved_searches add column if not exists filters jsonb not null default '{}'::jsonb;
alter table public.saved_searches drop constraint if exists saved_searches_not_empty;
alter table public.saved_searches add constraint saved_searches_not_empty
  check (char_length(trim(query)) >= 2 or category is not null or max_price is not null or filters <> '{}'::jsonb);
drop index if exists public.saved_searches_unique;
create unique index if not exists saved_searches_unique
  on public.saved_searches (user_id, lower(query), coalesce(category, ''), coalesce(max_price, 0), lower(coalesce(size, '')), filters);

drop function if exists public.save_search(text, text, int, text);
drop function if exists public.save_search(text, text, int, text, jsonb);
create function public.save_search(
  p_query text, p_category text default null, p_max_price int default null, p_size text default null,
  p_filters jsonb default '{}'::jsonb
)
returns public.saved_searches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_q       text := left(regexp_replace(trim(coalesce(p_query, '')), '\s+', ' ', 'g'), 60);
  v_size    text := nullif(left(trim(coalesce(p_size, '')), 20), '');
  v_filters jsonb := public.clean_search_filters(p_filters);
  v_row     public.saved_searches;
begin
  if v_uid is null then
    raise exception 'Log ind for at gemme søgningen';
  end if;
  if char_length(v_q) < 2 and p_category is null and p_max_price is null and v_filters = '{}'::jsonb then
    raise exception 'Skriv, hvad du leder efter, eller vælg en kategori eller et filter';
  end if;
  if p_category is not null and p_category not in ('dametoej', 'herretoej', 'luksus', 'skoenhed', 'boernetoej', 'cykler', 'bolig', 'samlerting', 'andet') then
    raise exception 'Ukendt kategori';
  end if;
  if p_max_price is not null and (p_max_price < 1 or p_max_price > 100000) then
    raise exception 'Maks pris skal være mellem 1 og 100.000 kr';
  end if;
  select * into v_row from public.saved_searches s
   where s.user_id = v_uid and lower(s.query) = lower(v_q) and coalesce(s.category, '') = coalesce(p_category, '')
     and coalesce(s.max_price, 0) = coalesce(p_max_price, 0) and lower(coalesce(s.size, '')) = lower(coalesce(v_size, ''))
     and s.filters = v_filters;
  if v_row.id is not null then
    return v_row;
  end if;
  if (select count(*) from public.saved_searches s where s.user_id = v_uid) >= 10 then
    raise exception 'Du kan have 10 søgeagenter. Slet en af de andre under Min konto først';
  end if;
  insert into public.saved_searches (user_id, query, category, max_price, size, filters)
    values (v_uid, v_q, p_category, p_max_price, v_size, v_filters)
  returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public.save_search(text, text, int, text, jsonb) from public, anon;
grant  execute on function public.save_search(text, text, int, text, jsonb) to authenticated;

-- Besked om nye varer: som i 0026, nu også med filtrene.
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
           and public.item_filters_match(ss.filters, i.price, i.condition, s.status, i.sale_type,
                                         i.auth_required and i.auth_status = 'approved', i.clip_path is not null, p.seller_type)
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

notify pgrst, 'reload schema';
