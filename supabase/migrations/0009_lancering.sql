-- SnupLive · klar til lancering: privat eller erhvervssælger, anmeldelser, bedømmelser og listen til Skattestyrelsen.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0001–0008).
-- Filen kan køres flere gange uden fejl.

-- ─────────────────────────────────────────────────────────────────────────────
-- Sælgeren er privat eller erhverv (forbrugeraftaleloven § 8 a). Køberen skal kunne se det.
-- En erhvervssælger oplyser firmanavn og CVR-nummer. Sælgeren accepterer sælgervilkårene.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists seller_type      text;
alter table public.profiles add column if not exists business_name    text;
alter table public.profiles add column if not exists business_cvr     text;
alter table public.profiles add column if not exists seller_terms_at  timestamptz;
alter table public.profiles add column if not exists rating_avg       numeric(2, 1);
alter table public.profiles add column if not exists rating_count     int not null default 0;

alter table public.profiles drop constraint if exists profiles_seller_type_check;
alter table public.profiles add constraint profiles_seller_type_check check (seller_type in ('private', 'business'));
alter table public.profiles drop constraint if exists profiles_business_check;
alter table public.profiles add constraint profiles_business_check check (
  (business_name is null or char_length(business_name) between 2 and 80)
  and (business_cvr is null or business_cvr ~ '^[0-9]{8}$')
  and (seller_type is distinct from 'business' or (business_name is not null and business_cvr is not null))
);

-- Sælgere, der blev sælgere før denne fil, regnes som private, til de selv vælger andet.
update public.profiles set seller_type = 'private' where is_seller and seller_type is null;

-- Man bliver nu sælger gennem become_seller, så vilkår og sælgertype altid kommer med.
revoke update (is_seller) on public.profiles from authenticated;

create or replace function public.become_seller(p_type text, p_business_name text default null, p_cvr text default null)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_name text := nullif(btrim(coalesce(p_business_name, '')), '');
  v_cvr  text := nullif(regexp_replace(coalesce(p_cvr, ''), '[^0-9]', '', 'g'), '');
  v_prof public.profiles;
begin
  if v_uid is null then
    raise exception 'Log ind først';
  end if;
  if p_type not in ('private', 'business') then
    raise exception 'Vælg, om du sælger som privatperson eller virksomhed';
  end if;
  if p_type = 'business' and (v_name is null or v_cvr is null or v_cvr !~ '^[0-9]{8}$') then
    raise exception 'Skriv firmanavn og et CVR-nummer på 8 cifre';
  end if;
  update public.profiles
     set is_seller = true,
         seller_type = p_type,
         business_name = case when p_type = 'business' then v_name end,
         business_cvr = case when p_type = 'business' then v_cvr end,
         seller_terms_at = coalesce(seller_terms_at, now())
   where id = v_uid
  returning * into v_prof;
  return v_prof;
end;
$$;
revoke execute on function public.become_seller(text, text, text) from public, anon;
grant  execute on function public.become_seller(text, text, text) to authenticated;

-- Køb fra en erhvervssælger kan fortrydes inden 14 dage. Det meldes som et problem på ordren.
alter table public.order_issues drop constraint if exists order_issues_reason_check;
alter table public.order_issues add constraint order_issues_reason_check
  check (reason in ('not_received', 'not_as_shown', 'damaged', 'withdrawal', 'other'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Anmeldelser: alle kan anmelde en ting, et show eller en profil (EU's regler for platforme).
-- Kun serveren skriver og læser dem. Afgøres på /admin/anmeldelser.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id             uuid primary key default gen_random_uuid(),
  target_type    text not null check (target_type in ('item', 'show', 'profile')),
  target_id      uuid not null,
  reason         text not null check (reason in ('ulovlig', 'falsk', 'stjaalet', 'farlig', 'kraenkende', 'andet')),
  message        text check (char_length(message) <= 1000),
  reporter_id    uuid references public.profiles (id) on delete set null,
  reporter_email text check (char_length(reporter_email) <= 200),
  status         text not null default 'open' check (status in ('open', 'removed', 'rejected')),
  decision       text check (char_length(decision) <= 1000),
  decided_at     timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists reports_open_idx on public.reports (created_at desc) where status = 'open';
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select, insert, update on public.reports to service_role;

-- En ting eller et show, der er fjernet efter en anmeldelse, vises ikke længere.
alter table public.items add column if not exists removed_at timestamptz;
alter table public.shows add column if not exists removed_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- Bedømmelser: køberen giver sælgeren 1–5 stjerner, når ordren er afsluttet. Én pr. ordre.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.ratings (
  order_id   uuid primary key references public.orders (id) on delete cascade,
  seller_id  uuid not null references public.profiles (id) on delete cascade,
  buyer_id   uuid not null references public.profiles (id) on delete cascade,
  stars      int not null check (stars between 1 and 5),
  comment    text check (char_length(comment) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists ratings_seller_idx on public.ratings (seller_id, created_at desc);
alter table public.ratings enable row level security;
drop policy if exists ratings_read on public.ratings;
create policy ratings_read on public.ratings for select using (true);
revoke all on public.ratings from anon, authenticated;
grant select on public.ratings to anon, authenticated;
grant select, delete on public.ratings to service_role;

-- Gennemsnit og antal ligger på sælgerens profil, så de kan vises overalt uden ekstra opslag.
create or replace function public.ratings_refresh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller uuid := coalesce(new.seller_id, old.seller_id);
begin
  update public.profiles p
     set rating_count = r.n, rating_avg = r.avg
    from (select count(*)::int as n, round(avg(stars)::numeric, 1) as avg from public.ratings where seller_id = v_seller) r
   where p.id = v_seller;
  return null;
end;
$$;
revoke execute on function public.ratings_refresh() from public, anon, authenticated;
drop trigger if exists ratings_refresh on public.ratings;
create trigger ratings_refresh after insert or update or delete on public.ratings
  for each row execute function public.ratings_refresh();

create or replace function public.rate_seller(p_order uuid, p_stars int, p_comment text default null)
returns public.ratings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_order  public.orders;
  v_rating public.ratings;
begin
  select * into v_order from public.orders where id = p_order;
  if v_order.id is null or v_order.buyer_id is distinct from v_uid then
    raise exception 'Ordren findes ikke';
  end if;
  if v_order.status <> 'completed' then
    raise exception 'Du kan bedømme sælgeren, når du har fået dine ting';
  end if;
  if p_stars is null or p_stars not between 1 and 5 then
    raise exception 'Vælg mellem 1 og 5 stjerner';
  end if;
  if exists (select 1 from public.ratings where order_id = p_order) then
    raise exception 'Du har allerede bedømt den her handel';
  end if;
  insert into public.ratings (order_id, seller_id, buyer_id, stars, comment)
    values (p_order, v_order.seller_id, v_uid, p_stars, nullif(btrim(left(coalesce(p_comment, ''), 300)), ''))
  returning * into v_rating;
  return v_rating;
end;
$$;
revoke execute on function public.rate_seller(uuid, int, text) from public, anon;
grant  execute on function public.rate_seller(uuid, int, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Listen til Skattestyrelsen (DAC7): salg og beløb pr. sælger og kvartal for et kalenderår.
-- Kun serveren kan kalde den (på /admin/indberetning).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_dac7(p_year int)
returns table (
  seller_id uuid, handle text, display_name text, email text, area text, seller_type text,
  business_name text, business_cvr text, stripe_account_id text,
  sales bigint, amount bigint, q1 bigint, q2 bigint, q3 bigint, q4 bigint, fees bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with o as (
    select o.*, extract(quarter from (o.paid_at at time zone 'Europe/Copenhagen'))::int as q,
           (select count(*) from public.sales s where s.order_id = o.id) as n
      from public.orders o
     where o.status in ('paid', 'shipped', 'completed')
       and o.paid_at >= make_timestamptz(p_year, 1, 1, 0, 0, 0, 'Europe/Copenhagen')
       and o.paid_at <  make_timestamptz(p_year + 1, 1, 1, 0, 0, 0, 'Europe/Copenhagen')
  )
  select p.id, p.handle, p.display_name, u.email::text, p.area, p.seller_type, p.business_name, p.business_cvr,
         a.stripe_account_id,
         sum(o.n)::bigint,
         sum(o.items_amount)::bigint,
         coalesce(sum(o.items_amount) filter (where o.q = 1), 0)::bigint,
         coalesce(sum(o.items_amount) filter (where o.q = 2), 0)::bigint,
         coalesce(sum(o.items_amount) filter (where o.q = 3), 0)::bigint,
         coalesce(sum(o.items_amount) filter (where o.q = 4), 0)::bigint,
         sum(o.fee_amount)::bigint
    from o
    join public.profiles p on p.id = o.seller_id
    join auth.users u on u.id = p.id
    left join public.payout_accounts a on a.user_id = p.id
   group by p.id, p.handle, p.display_name, u.email, p.area, p.seller_type, p.business_name, p.business_cvr, a.stripe_account_id
   order by sum(o.items_amount) desc;
$$;
revoke execute on function public.admin_dac7(int) from public, anon, authenticated;
grant  execute on function public.admin_dac7(int) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Fjernede ting er ikke med i listerne (forside, kategorier, Til salg) og kan ikke købes.
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
   where i.removed_at is null
     and s.removed_at is null
     and (p_category is null or coalesce(i.category, s.category) = p_category)
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

-- Køb nu: som før, men ikke en ting, der er fjernet.
create or replace function public.buy_now_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'sold' and old.status <> 'sold' and new.removed_at is not null then
    raise exception 'Tingen er ikke til salg lige nu';
  end if;
  return new;
end;
$$;
drop trigger if exists items_removed_guard on public.items;
create trigger items_removed_guard before update on public.items
  for each row execute function public.buy_now_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- Afgør en anmeldelse (kun serveren, fra /admin/anmeldelser).
--   remove: ting → fjernes. Show → fjernes og stoppes. Profil → er ikke længere sælger, og shows og ting fjernes.
--   reject: intet fjernes.
-- Returnerer, hvem der ejer det anmeldte, så serveren kan sende en begrundelse på mail.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_moderate(p_report uuid, p_action text, p_decision text default null)
returns table (target_type text, target_id uuid, owner_id uuid, reporter_id uuid, reporter_email text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r          public.reports;
  v_owner    uuid;
  v_decision text := nullif(btrim(coalesce(p_decision, '')), '');
  v_shows    uuid[];
begin
  select * into r from public.reports where id = p_report for update;
  if r.id is null then
    raise exception 'Anmeldelsen findes ikke';
  end if;
  if r.status <> 'open' then
    raise exception 'Anmeldelsen er allerede afgjort';
  end if;
  if p_action not in ('remove', 'reject') then
    raise exception 'Ukendt handling';
  end if;
  if p_action = 'remove' and v_decision is null then
    raise exception 'Skriv, hvorfor det bliver fjernet. Begrundelsen bliver sendt til sælgeren';
  end if;

  if r.target_type = 'item' then
    select i.seller_id into v_owner from public.items i where i.id = r.target_id;
  elsif r.target_type = 'show' then
    select s.seller_id into v_owner from public.shows s where s.id = r.target_id;
  else
    select p.id into v_owner from public.profiles p where p.id = r.target_id;
  end if;

  if p_action = 'remove' then
    if v_owner is null then
      raise exception 'Det anmeldte findes ikke længere';
    end if;
    if r.target_type = 'item' then
      update public.items i
         set removed_at = coalesce(i.removed_at, now()), for_sale = false,
             status = case when i.status = 'live' then 'unsold' else i.status end, rush_ends_at = null
       where i.id = r.target_id;
      update public.shows s set current_item_id = null where s.current_item_id = r.target_id;
    else
      if r.target_type = 'show' then
        v_shows := array[r.target_id];
      else
        update public.profiles p set is_seller = false where p.id = v_owner;
        select coalesce(array_agg(s.id), '{}') into v_shows
          from public.shows s where s.seller_id = v_owner and s.status in ('planned', 'live');
      end if;
      update public.items i
         set removed_at = coalesce(i.removed_at, now()), for_sale = false,
             status = case when i.status in ('live', 'queued') then 'unsold' else i.status end, rush_ends_at = null
       where i.show_id = any (v_shows) and i.status <> 'sold';
      update public.shows s
         set removed_at = coalesce(s.removed_at, now()),
             ended_at = case when s.status <> 'ended' then now() else s.ended_at end,
             status = 'ended', current_item_id = null
       where s.id = any (v_shows);
    end if;
  end if;

  update public.reports
     set status = case when p_action = 'remove' then 'removed' else 'rejected' end,
         decision = v_decision, decided_at = now()
   where id = r.id;
  -- Andre åbne anmeldelser af det samme bliver afgjort på samme måde.
  update public.reports o
     set status = case when p_action = 'remove' then 'removed' else 'rejected' end,
         decision = v_decision, decided_at = now()
   where o.target_type = r.target_type and o.target_id = r.target_id and o.status = 'open';

  return query select r.target_type, r.target_id, v_owner, r.reporter_id, r.reporter_email;
end;
$$;
revoke execute on function public.admin_moderate(uuid, text, text) from public, anon, authenticated;
grant  execute on function public.admin_moderate(uuid, text, text) to service_role;
