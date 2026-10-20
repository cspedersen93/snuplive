-- SnupLive · fragt: pakkeshop, fragtlabels via Shipmondo og sporing
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0001, 0002 og 0003).
-- Filen kan køres flere gange uden fejl.
--
-- Køberen vælger en DAO- eller GLS-pakkeshop i kurven. Sælgeren laver en fragtlabel med ét tryk,
-- og SnupLive betaler labelen med de penge, køberen har betalt i fragt. Sporingen opdaterer ordren selv.

-- ─────────────────────────────────────────────────────────────────────────────
-- Sælgerens afsenderadresse (står på fragtlabelen). Kun sælgeren selv og serveren kan se den.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.seller_addresses (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 2 and 80),
  address1   text not null check (char_length(btrim(address1)) between 3 and 120),
  address2   text check (char_length(address2) <= 120),
  zipcode    text not null check (zipcode ~ '^[0-9]{4}$'),
  city       text not null check (char_length(btrim(city)) between 2 and 60),
  phone      text check (phone ~ '^\+?[0-9 ]{8,16}$'),
  updated_at timestamptz not null default now()
);
alter table public.seller_addresses enable row level security;
drop policy if exists "seller_addresses_read_own" on public.seller_addresses;
drop policy if exists "seller_addresses_insert_own" on public.seller_addresses;
drop policy if exists "seller_addresses_update_own" on public.seller_addresses;
create policy "seller_addresses_read_own" on public.seller_addresses for select
  to authenticated using (user_id = (select auth.uid()));
create policy "seller_addresses_insert_own" on public.seller_addresses for insert
  to authenticated with check (user_id = (select auth.uid()));
create policy "seller_addresses_update_own" on public.seller_addresses for update
  to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.seller_addresses from anon, authenticated;
grant select, insert, update on public.seller_addresses to authenticated;
grant all on public.seller_addresses to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Ordrer: pakkeshop, fragtlabel og sporing
-- En ordre med sp_id (pakkeshop) sendes med SnupLives label, og fragten bliver hos SnupLive.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.orders add column if not exists sp_carrier            text check (sp_carrier in ('dao', 'gls'));
alter table public.orders add column if not exists sp_id                 text check (char_length(sp_id) <= 40);
alter table public.orders add column if not exists sp_name               text check (char_length(sp_name) <= 120);
alter table public.orders add column if not exists sp_address            text check (char_length(sp_address) <= 160);
alter table public.orders add column if not exists sp_zipcode            text check (char_length(sp_zipcode) <= 10);
alter table public.orders add column if not exists sp_city               text check (char_length(sp_city) <= 80);
alter table public.orders add column if not exists shipmondo_shipment_id bigint unique;
alter table public.orders add column if not exists label_weight          int check (label_weight > 0);
alter table public.orders add column if not exists labelless_code        text check (char_length(labelless_code) <= 40);
alter table public.orders add column if not exists label_created_at      timestamptz;
alter table public.orders add column if not exists label_lock            timestamptz;
alter table public.orders add column if not exists tracking_status       text check (char_length(tracking_status) <= 40);
alter table public.orders add column if not exists tracking_at           timestamptz;
alter table public.orders add column if not exists delivered_at          timestamptz;

-- Hvad SnupLive har betalt for hver label (til regnskabet). Kun serveren kan se tabellen.
create table if not exists public.shipping_labels (
  order_id     uuid primary key references public.orders (id) on delete cascade,
  shipment_id  bigint not null unique,
  carrier      text not null,
  product_code text not null,
  weight       int not null,
  price        numeric(10, 2),
  created_at   timestamptz not null default now()
);
alter table public.shipping_labels enable row level security;
revoke all on public.shipping_labels from anon, authenticated;
grant all on public.shipping_labels to service_role;

-- Markér en pakke som afleveret. Ordrer til pakkeshop kræver, at labelen er lavet, og beholder
-- fragtfirma og sporingsnummer fra labelen. Sporingen opdaterer ordren af sig selv bagefter.
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
         carrier = coalesce(nullif(btrim(left(coalesce(p_carrier, ''), 40)), ''), o.carrier),
         tracking = coalesce(nullif(btrim(left(coalesce(p_tracking, ''), 80)), ''), o.tracking)
   where o.id = p_order and o.seller_id = auth.uid() and o.status = 'paid' and o.delivery = 'ship'
     and (o.sp_id is null or o.shipmondo_shipment_id is not null)
  returning * into v_order;
  if v_order.id is null then
    raise exception 'Ordren kan ikke markeres som sendt';
  end if;
  update public.sales set status = 'shipped' where order_id = p_order and status = 'paid';
  return v_order;
end;
$$;
revoke execute on function public.mark_shipped(uuid, text, text) from public, anon;
grant  execute on function public.mark_shipped(uuid, text, text) to authenticated;
