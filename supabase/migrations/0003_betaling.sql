-- SnupLive · betaling: ordrer, udbetalingskonti og handlinger for sælgere
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0001 og 0002).
-- Filen kan køres flere gange uden fejl.
--
-- Pengene: køberen betaler SnupLive via Stripe. Når køberen har fået sine ting,
-- sender SnupLive beløbet for tingene og fragten videre til sælgerens Stripe-konto.
-- Al skrivning til ordrer og udbetalingskonti sker på serveren (med den hemmelige nøgle)
-- eller via funktionerne nederst, så ingen kan ændre en betaling fra browseren.

-- ─────────────────────────────────────────────────────────────────────────────
-- Udbetalingskonti (sælgerens Stripe-konto)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.payout_accounts (
  user_id           uuid primary key references public.profiles (id) on delete cascade,
  stripe_account_id text not null unique,
  payouts_enabled   boolean not null default false,
  details_submitted boolean not null default false,
  updated_at        timestamptz not null default now()
);
alter table public.payout_accounts enable row level security;
drop policy if exists "payout_accounts_read_own" on public.payout_accounts;
create policy "payout_accounts_read_own" on public.payout_accounts for select
  to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.payout_accounts from anon, authenticated;
grant select on public.payout_accounts to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Ordrer: én pr. sælger og show i en betaling (alt sendes i én pakke)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),
  checkout_id           uuid not null,
  buyer_id              uuid not null references public.profiles (id) on delete restrict,
  seller_id             uuid not null references public.profiles (id) on delete restrict,
  show_id               uuid not null references public.shows (id) on delete restrict,
  status                text not null default 'pending'
                        check (status in ('pending', 'paid', 'shipped', 'completed', 'cancelled', 'refunded')),
  delivery              text not null check (delivery in ('ship', 'pickup')),
  items_amount          int not null check (items_amount >= 0),
  shipping_amount       int not null check (shipping_amount >= 0),
  fee_amount            int not null check (fee_amount >= 0),
  total_amount          int not null check (total_amount > 0),
  ship_name             text,
  ship_line1            text,
  ship_line2            text,
  ship_postal_code      text,
  ship_city             text,
  buyer_phone           text,
  carrier               text check (char_length(carrier) <= 40),
  tracking              text check (char_length(tracking) <= 80),
  stripe_session_id     text,
  stripe_payment_intent text,
  stripe_charge         text,
  stripe_transfer       text,
  transfer_status       text not null default 'none' check (transfer_status in ('none', 'pending', 'done', 'failed')),
  paid_at               timestamptz,
  shipped_at            timestamptz,
  completed_at          timestamptz,
  cancelled_at          timestamptz,
  created_at            timestamptz not null default now()
);
create index if not exists orders_buyer_idx    on public.orders (buyer_id, created_at desc);
create index if not exists orders_seller_idx   on public.orders (seller_id, created_at desc);
create index if not exists orders_checkout_idx on public.orders (checkout_id);
create index if not exists orders_session_idx  on public.orders (stripe_session_id);

alter table public.orders enable row level security;
drop policy if exists "orders_read_own" on public.orders;
create policy "orders_read_own" on public.orders for select
  to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));
revoke all on public.orders from anon, authenticated;
grant select on public.orders to authenticated;

-- Hvert snup hører til højst én ordre ad gangen.
alter table public.sales add column if not exists order_id uuid references public.orders (id) on delete set null;
create index if not exists sales_order_idx on public.sales (order_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Funktioner for sælgeren
-- ─────────────────────────────────────────────────────────────────────────────

-- Markér en pakke som sendt (med eventuelt fragtfirma og sporingsnummer).
create or replace function public.mark_shipped(p_order uuid, p_carrier text default null, p_tracking text default null)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  update public.orders o
     set status = 'shipped',
         shipped_at = now(),
         carrier = nullif(btrim(left(coalesce(p_carrier, ''), 40)), ''),
         tracking = nullif(btrim(left(coalesce(p_tracking, ''), 80)), '')
   where o.id = p_order and o.seller_id = auth.uid() and o.status = 'paid' and o.delivery = 'ship'
  returning * into v_order;
  if v_order.id is null then
    raise exception 'Ordren kan ikke markeres som sendt';
  end if;
  update public.sales set status = 'shipped' where order_id = p_order and status = 'paid';
  return v_order;
end;
$$;

-- Annullér et snup, der ikke er betalt (fx hvis køberen ikke betaler). Tingen kan sælges igen.
create or replace function public.cancel_reservation(p_sale uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.sales;
begin
  select * into v_sale from public.sales where id = p_sale for update;
  if v_sale.id is null or v_sale.seller_id is distinct from auth.uid() then
    raise exception 'Snuppet findes ikke';
  end if;
  if v_sale.status <> 'reserved'
     or exists (select 1 from public.orders o where o.id = v_sale.order_id and o.status in ('paid', 'shipped', 'completed')) then
    raise exception 'Snuppet er betalt og kan ikke annulleres her';
  end if;
  update public.sales set status = 'cancelled', order_id = null where id = p_sale;
  update public.items set status = 'unsold', sold_at = null where id = v_sale.item_id and status = 'sold';
end;
$$;

revoke execute on function public.mark_shipped(uuid, text, text) from public, anon;
revoke execute on function public.cancel_reservation(uuid)        from public, anon;
grant  execute on function public.mark_shipped(uuid, text, text) to authenticated;
grant  execute on function public.cancel_reservation(uuid)        to authenticated;

-- Når en ordre er refunderet, kan tingene sælges igen. Bruges af serveren.
create or replace function public.release_items_for_order(p_order uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.items i set status = 'unsold', sold_at = null
    from public.sales s
   where s.order_id = p_order and s.item_id = i.id and i.status = 'sold';
$$;
revoke execute on function public.release_items_for_order(uuid) from public, anon, authenticated;
grant execute on function public.release_items_for_order(uuid) to service_role;

-- Serveren (med den hemmelige nøgle) skal kunne skrive ordrer og opdatere snup og ting.
grant all on public.orders, public.payout_accounts to service_role;
grant select, update on public.sales, public.items to service_role;
grant select on public.profiles, public.shows to service_role;
