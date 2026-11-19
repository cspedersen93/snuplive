-- Relived · retur i en sag, returfragt som gæld hos sælgeren, og "Relived dækker".
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0038).
-- Filen kan køres flere gange uden fejl.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Retur: når køberen får medhold, sender køberen varen tilbage, før pengene refunderes.
--    Relived køber returlabelen (pakken går til en pakkeshop tæt på sælgeren), eller køberen sender selv (manual).
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.order_returns (
  order_id        uuid primary key references public.orders (id) on delete cascade,
  manual          boolean not null default false,
  shipment_id     bigint,
  carrier         text,
  tracking        text,
  labelless_code  text,
  sp_name         text,
  sp_address      text,
  sp_zipcode      text,
  sp_city         text,
  price           int not null default 0 check (price >= 0),
  tracking_status text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);
create unique index if not exists order_returns_shipment_idx on public.order_returns (shipment_id) where shipment_id is not null;

alter table public.order_returns enable row level security;
drop policy if exists "order_returns_read_parties" on public.order_returns;
create policy "order_returns_read_parties" on public.order_returns for select
  to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and (o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid()))
  ));
revoke all on public.order_returns from anon, authenticated;
grant select on public.order_returns to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Sælgerens gæld til Relived (returfragt). Den trækkes fra sælgerens næste udbetalinger.
--    seller_debt_payments viser, hvilken udbetaling der har betalt hvor meget af gælden.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.seller_debts (
  id         uuid primary key default gen_random_uuid(),
  seller_id  uuid not null references public.profiles (id) on delete restrict,
  order_id   uuid not null references public.orders (id) on delete restrict,
  reason     text not null default 'return_shipping' check (reason in ('return_shipping')),
  amount     int not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (order_id, reason)
);
create index if not exists seller_debts_seller_idx on public.seller_debts (seller_id, created_at);

create table if not exists public.seller_debt_payments (
  id         uuid primary key default gen_random_uuid(),
  debt_id    uuid not null references public.seller_debts (id) on delete restrict,
  order_id   uuid not null references public.orders (id) on delete restrict,
  amount     int not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (debt_id, order_id)
);
create index if not exists seller_debt_payments_order_idx on public.seller_debt_payments (order_id);

alter table public.seller_debts enable row level security;
drop policy if exists "seller_debts_read_own" on public.seller_debts;
create policy "seller_debts_read_own" on public.seller_debts for select
  to authenticated using (seller_id = (select auth.uid()));
revoke all on public.seller_debts from anon, authenticated;
grant select on public.seller_debts to authenticated;

alter table public.seller_debt_payments enable row level security;
drop policy if exists "seller_debt_payments_read_own" on public.seller_debt_payments;
create policy "seller_debt_payments_read_own" on public.seller_debt_payments for select
  to authenticated
  using (exists (select 1 from public.seller_debts d where d.id = debt_id and d.seller_id = (select auth.uid())));
revoke all on public.seller_debt_payments from anon, authenticated;
grant select on public.seller_debt_payments to authenticated;

-- Træk sælgerens gæld fra udbetalingen for en ordre. Returnerer, hvor meget der trækkes (0 = ingen gæld).
-- Kan kaldes flere gange for samme ordre: beløbet er det samme hver gang, så overførslen hos Stripe ikke ændrer sig.
create or replace function public.reserve_debt_for_order(p_order uuid, p_max int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller uuid;
  v_done   int;
  v_left   int := greatest(coalesce(p_max, 0), 0);
  v_take   int;
  v_total  int := 0;
  d        record;
begin
  select o.seller_id into v_seller from public.orders o where o.id = p_order for update;
  if v_seller is null then
    return 0;
  end if;
  select coalesce(sum(p.amount), 0) into v_done from public.seller_debt_payments p where p.order_id = p_order;
  if v_done > 0 then
    return v_done;
  end if;
  for d in
    select sd.id, sd.amount - coalesce((select sum(p.amount) from public.seller_debt_payments p where p.debt_id = sd.id), 0) as remaining
      from public.seller_debts sd
     where sd.seller_id = v_seller and sd.order_id <> p_order
     order by sd.created_at
     for update of sd
  loop
    exit when v_left <= 0;
    continue when d.remaining <= 0;
    v_take := least(d.remaining, v_left);
    insert into public.seller_debt_payments (debt_id, order_id, amount) values (d.id, p_order, v_take);
    v_left := v_left - v_take;
    v_total := v_total + v_take;
  end loop;
  return v_total;
end;
$$;
revoke execute on function public.reserve_debt_for_order(uuid, int) from public, anon, authenticated;
grant  execute on function public.reserve_debt_for_order(uuid, int) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. "Relived dækker": i en tvivlssag får køberen pengene tilbage, og sælgeren får sin udbetaling alligevel.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.order_covers (
  order_id    uuid primary key references public.orders (id) on delete cascade,
  amount      int not null check (amount > 0),
  started_at  timestamptz not null default now(),
  refunded_at timestamptz
);
alter table public.order_covers enable row level security;
drop policy if exists "order_covers_read_parties" on public.order_covers;
create policy "order_covers_read_parties" on public.order_covers for select
  to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id and (o.buyer_id = (select auth.uid()) or o.seller_id = (select auth.uid()))
  ));
revoke all on public.order_covers from anon, authenticated;
grant select on public.order_covers to authenticated;

alter table public.order_issues drop constraint if exists order_issues_resolution_check;
alter table public.order_issues add constraint order_issues_resolution_check
  check (resolution in ('refunded', 'released', 'closed', 'buyer_confirmed', 'covered'));

notify pgrst, 'reload schema';
