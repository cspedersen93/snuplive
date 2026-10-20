-- SnupLive · backoffice: nøgletal, medlemmer og shows til /admin
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0001–0005).
-- Filen kan køres flere gange uden fejl.
--
-- Funktionerne kan kun kaldes af serveren (med den hemmelige nøgle), og /admin kræver,
-- at man er logget ind med en e-mail fra ADMIN_EMAILS.

-- ─────────────────────────────────────────────────────────────────────────────
-- Rettelse: en ting, hvis snup er annulleret eller refunderet, skal kunne sælges igen.
-- Før måtte en ting kun have ét snup nogensinde. Nu må den kun have ét aktivt snup.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.sales drop constraint if exists sales_item_id_key;
create unique index if not exists sales_item_active on public.sales (item_id) where status <> 'cancelled';
create index if not exists sales_item_idx on public.sales (item_id);

create index if not exists orders_paid_idx on public.orders (paid_at);
create index if not exists profiles_created_idx on public.profiles (created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Overblik: nøgletal fra p_from og frem (plus et par tal "lige nu")
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_overview(p_from timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with paid as (
    select * from public.orders
     where paid_at >= p_from and status in ('paid', 'shipped', 'completed')
  )
  select jsonb_build_object(
    'members_total',        (select count(*) from public.profiles),
    'members_new',          (select count(*) from public.profiles where created_at >= p_from),
    'sellers_total',        (select count(*) from public.profiles where is_seller),
    'sellers_payout_ready', (select count(*) from public.payout_accounts where payouts_enabled),
    'shows_held',           (select count(*) from public.shows where status <> 'planned' and coalesce(started_at, created_at) >= p_from),
    'shows_live',           (select count(*) from public.shows where status = 'live'),
    'shows_planned',        (select count(*) from public.shows where status = 'planned' and (starts_at is null or starts_at >= now() - interval '1 hour')),
    'items_sold',           (select count(*) from public.sales where created_at >= p_from and status <> 'cancelled'),
    'orders',               (select count(*) from paid),
    'buyers',               (select count(distinct buyer_id) from paid),
    'gmv',                  (select coalesce(sum(total_amount), 0) from paid),
    'items_value',          (select coalesce(sum(items_amount), 0) from paid),
    'fees',                 (select coalesce(sum(fee_amount), 0) from paid),
    'shipping_labels_paid', (select coalesce(sum(shipping_amount), 0) from paid where sp_id is not null),
    'label_cost',           (select coalesce(sum(price), 0) from public.shipping_labels where created_at >= p_from),
    'labels',               (select count(*) from public.shipping_labels where created_at >= p_from),
    'refunded',             (select coalesce(sum(total_amount), 0) from public.orders where status = 'refunded' and cancelled_at >= p_from),
    'refunded_count',       (select count(*) from public.orders where status = 'refunded' and cancelled_at >= p_from),
    'paid_out',             (select coalesce(sum(items_amount + case when sp_id is null then shipping_amount else 0 end), 0)
                               from public.orders where status = 'completed' and transfer_status = 'done' and completed_at >= p_from),
    'held_now',             (select coalesce(sum(total_amount), 0) from public.orders where status in ('paid', 'shipped')),
    'held_orders',          (select count(*) from public.orders where status in ('paid', 'shipped')),
    'awaiting_payout',      (select coalesce(sum(items_amount + case when sp_id is null then shipping_amount else 0 end), 0)
                               from public.orders where status = 'completed' and transfer_status in ('pending', 'failed')),
    'open_issues',          (select count(*) from public.order_issues where status = 'open'),
    'unpaid_snups',         (select count(*) from public.sales where status = 'reserved'),
    'unpaid_value',         (select coalesce(sum(price), 0) from public.sales where status = 'reserved')
  );
$$;

-- Én række pr. dag (dansk tid) fra p_from til i dag: ordrer, omsætning, køberbeskyttelse og nye medlemmer.
create or replace function public.admin_daily(p_from timestamptz)
returns table (day date, orders bigint, gmv bigint, fees bigint, signups bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select generate_series(
      (p_from at time zone 'Europe/Copenhagen')::date,
      (now() at time zone 'Europe/Copenhagen')::date,
      interval '1 day'
    )::date as day
  ),
  o as (
    select (paid_at at time zone 'Europe/Copenhagen')::date as d,
           count(*) as n, sum(total_amount) as gmv, sum(fee_amount) as fees
      from public.orders
     where paid_at >= p_from and status in ('paid', 'shipped', 'completed')
     group by 1
  ),
  p as (
    select (created_at at time zone 'Europe/Copenhagen')::date as d, count(*) as n
      from public.profiles
     where created_at >= p_from
     group by 1
  )
  select days.day,
         coalesce(o.n, 0)::bigint,
         coalesce(o.gmv, 0)::bigint,
         coalesce(o.fees, 0)::bigint,
         coalesce(p.n, 0)::bigint
    from days
    left join o on o.d = days.day
    left join p on p.d = days.day
   order by days.day;
$$;

-- De sælgere, der har solgt mest fra p_from og frem.
create or replace function public.admin_top_sellers(p_from timestamptz, p_limit int default 5)
returns table (seller_id uuid, handle text, avatar_path text, orders bigint, items bigint, items_value bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select o.seller_id, p.handle, p.avatar_path,
         count(*)::bigint,
         (select count(*) from public.sales s
            join public.orders o2 on o2.id = s.order_id
           where o2.seller_id = o.seller_id and o2.paid_at >= p_from and o2.status in ('paid', 'shipped', 'completed'))::bigint,
         sum(o.items_amount)::bigint
    from public.orders o
    join public.profiles p on p.id = o.seller_id
   where o.paid_at >= p_from and o.status in ('paid', 'shipped', 'completed')
   group by o.seller_id, p.handle, p.avatar_path
   order by sum(o.items_amount) desc
   limit least(greatest(coalesce(p_limit, 5), 1), 50);
$$;

-- Medlemmer med e-mail og tal. Søg i brugernavn, navn og e-mail. p_id henter ét bestemt medlem.
create or replace function public.admin_members(p_query text default null, p_limit int default 50, p_offset int default 0, p_id uuid default null)
returns table (
  id uuid, handle text, display_name text, area text, avatar_path text, is_seller boolean, created_at timestamptz,
  email text, purchases bigint, spent bigint, items_sold bigint, earned bigint, payout_ready boolean,
  shows bigint, open_issues bigint, blocked_by bigint, total bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select nullif(btrim(coalesce(p_query, '')), '') as v
  ),
  m as (
    select p.*, u.email::text as email
      from public.profiles p
      join auth.users u on u.id = p.id
     cross join q
     where (p_id is null or p.id = p_id)
       and (q.v is null
            or p.handle ilike '%' || replace(replace(q.v, '%', '\%'), '_', '\_') || '%'
            or p.display_name ilike '%' || replace(replace(q.v, '%', '\%'), '_', '\_') || '%'
            or u.email ilike '%' || replace(replace(q.v, '%', '\%'), '_', '\_') || '%')
  )
  select m.id, m.handle, m.display_name, m.area, m.avatar_path, m.is_seller, m.created_at, m.email,
         (select count(*) from public.orders o where o.buyer_id = m.id and o.status in ('paid', 'shipped', 'completed'))::bigint,
         (select coalesce(sum(o.total_amount), 0) from public.orders o where o.buyer_id = m.id and o.status in ('paid', 'shipped', 'completed'))::bigint,
         (select count(*) from public.sales s where s.seller_id = m.id and s.status in ('paid', 'shipped', 'done'))::bigint,
         (select coalesce(sum(o.items_amount + case when o.sp_id is null then o.shipping_amount else 0 end), 0)
            from public.orders o where o.seller_id = m.id and o.status in ('paid', 'shipped', 'completed'))::bigint,
         coalesce((select a.payouts_enabled from public.payout_accounts a where a.user_id = m.id), false),
         (select count(*) from public.shows s where s.seller_id = m.id)::bigint,
         (select count(*) from public.order_issues i join public.orders o on o.id = i.order_id
           where i.status = 'open' and (o.buyer_id = m.id or o.seller_id = m.id))::bigint,
         (select count(*) from public.seller_blocks b where b.user_id = m.id)::bigint,
         count(*) over ()
    from m
   order by m.created_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

-- Shows med antal ting, solgte ting og omsætning. Live først, så kommende, så afsluttede.
create or replace function public.admin_shows(p_limit int default 50, p_offset int default 0, p_seller uuid default null)
returns table (
  id uuid, title text, status text, category text, starts_at timestamptz, started_at timestamptz, ended_at timestamptz,
  seller_id uuid, handle text, items bigint, sold bigint, revenue bigint, total bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.title, s.status, s.category, s.starts_at, s.started_at, s.ended_at, s.seller_id, p.handle,
         (select count(*) from public.items i where i.show_id = s.id)::bigint,
         (select count(*) from public.sales x where x.show_id = s.id and x.status <> 'cancelled')::bigint,
         (select coalesce(sum(x.price), 0) from public.sales x where x.show_id = s.id and x.status <> 'cancelled')::bigint,
         count(*) over ()
    from public.shows s
    join public.profiles p on p.id = s.seller_id
   where p_seller is null or s.seller_id = p_seller
   order by case s.status when 'live' then 0 when 'planned' then 1 else 2 end,
            coalesce(s.started_at, s.starts_at, s.created_at) desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200)
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke execute on function public.admin_overview(timestamptz)                 from public, anon, authenticated;
revoke execute on function public.admin_daily(timestamptz)                    from public, anon, authenticated;
revoke execute on function public.admin_top_sellers(timestamptz, int)         from public, anon, authenticated;
revoke execute on function public.admin_members(text, int, int, uuid)         from public, anon, authenticated;
revoke execute on function public.admin_shows(int, int, uuid)                 from public, anon, authenticated;
grant  execute on function public.admin_overview(timestamptz)                 to service_role;
grant  execute on function public.admin_daily(timestamptz)                    to service_role;
grant  execute on function public.admin_top_sellers(timestamptz, int)         to service_role;
grant  execute on function public.admin_members(text, int, int, uuid)         to service_role;
grant  execute on function public.admin_shows(int, int, uuid)                 to service_role;
grant select on public.order_issues, public.seller_blocks, public.shipping_labels to service_role;
