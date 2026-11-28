-- 0042: rettelser efter gennemgangen 27. november 2026 (punkt 1, 2, 3, 4 og 6).
-- Kør hele filen i Supabase → SQL Editor → New query → Run. Filen kan køres flere gange uden fejl.
--   1. En refunderet vare kommer ikke til salg igen af sig selv. Sælgeren sætter den selv til salg.
--   2. Sælgeren kan ikke annullere et køb, mens køberen står i betalingen.
--   3. En sælger, Relived har lukket, kan ikke åbne sig selv igen med "Bliv sælger".
--   4. Gæstelinket og invitationen til et lukket show får hver sin kode.
--   6. En pakke med Reliveds label er først "sendt", når fragtfirmaet har scannet den.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Refunderede varer
-- Før stod varen bare som usolgt igen, og var den lagt til salg til fast pris, kunne en ny køber købe den med det
-- samme, også når den var refunderet, fordi den var falsk eller ikke som vist. Nu bliver den taget af salg, og
-- sælgeren sætter den selv til salg igen under "Til salg" i studiet.
-- ─────────────────────────────────────────────────────────────────────
create or replace function public.release_items_for_order(p_order uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.items i set status = 'unsold', sold_at = null, for_sale = false
    from public.sales s
   where s.order_id = p_order and s.item_id = i.id and i.status = 'sold';
$$;
revoke execute on function public.release_items_for_order(uuid) from public, anon, authenticated;
grant execute on function public.release_items_for_order(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Annullering, mens køberen betaler
-- Betalingen hos Stripe er åben i 35 minutter. Annullerede sælgeren købet i den tid, kunne køberen stadig betale,
-- og varen kunne være solgt til en anden. Nu må købet først annulleres, når betalingen er lukket.
-- ─────────────────────────────────────────────────────────────────────
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
    raise exception 'Købet findes ikke';
  end if;
  if v_sale.status <> 'reserved'
     or exists (select 1 from public.orders o where o.id = v_sale.order_id and o.status in ('paid', 'shipped', 'completed')) then
    raise exception 'Købet er betalt og kan ikke annulleres her';
  end if;
  if exists (select 1 from public.orders o
              where o.id = v_sale.order_id and o.status = 'pending' and o.created_at > now() - interval '40 minutes') then
    raise exception 'Køberen er ved at betale lige nu. Prøv igen om lidt.';
  end if;
  update public.sales set status = 'cancelled', order_id = null where id = p_sale;
  update public.items set status = 'unsold', sold_at = null, for_sale = true, listed_at = now()
   where id = v_sale.item_id and status = 'sold';
end;
$$;
revoke execute on function public.cancel_reservation(uuid) from public, anon;
grant  execute on function public.cancel_reservation(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Lukkede sælgere
-- Lukker Relived en sælger (Backoffice → Anmeldelser), huskes det her. Tabellen er lukket for alle andre end
-- serveren, så ingen kan se, hvem der er lukket. Relived kan åbne sælgeren igen på medlemmets side i backoffice.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.seller_closures (
  user_id   uuid primary key references public.profiles (id) on delete cascade,
  closed_at timestamptz not null default now()
);
alter table public.seller_closures enable row level security;
revoke all on public.seller_closures from anon, authenticated;
grant all on public.seller_closures to service_role;

-- Sælgere, der allerede er lukket efter en anmeldelse og ikke har åbnet sig selv igen.
insert into public.seller_closures (user_id, closed_at)
  select p.id, max(coalesce(r.decided_at, now()))
    from public.reports r join public.profiles p on p.id = r.target_id
   where r.target_type = 'profile' and r.status = 'removed' and not p.is_seller
   group by p.id
on conflict (user_id) do nothing;

-- Afgør en anmeldelse. Som i 0009, men når en profil lukkes, huskes lukningen i seller_closures.
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
        -- Husk lukningen, så sælgeren ikke kan åbne sig selv igen med Bliv sælger.
        insert into public.seller_closures (user_id) values (v_owner)
          on conflict (user_id) do update set closed_at = now();
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

-- Som i 0009, men en lukket sælger bliver afvist.
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
  if exists (select 1 from public.seller_closures c where c.user_id = v_uid) then
    raise exception 'Relived har lukket din sælgerprofil. Skriv til kontakt@relived.dk, hvis du mener, det er en fejl.';
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

-- ─────────────────────────────────────────────────────────────────────
-- 4. Gæstelink og invitation til lukkede shows
-- Begge lå i show_invites med én kode pr. show (0020 og 0026). I et lukket show virkede gæstelinket derfor ikke,
-- en inviteret seer kunne bruge sin kode til at blive gæst, og et nyt link det ene sted slog det andet ihjel.
-- Nu har gæstelinket sin egen tabel. show_invites er kun invitationen til seerne.
-- ─────────────────────────────────────────────────────────────────────
create table if not exists public.show_guest_invites (
  show_id    uuid primary key references public.shows (id) on delete cascade,
  code       text not null unique check (code ~ '^[a-f0-9]{32}$'),
  created_at timestamptz not null default now()
);
alter table public.show_guest_invites enable row level security;
revoke all on public.show_guest_invites from anon, authenticated;
grant all on public.show_guest_invites to service_role;

-- Koder på 32 tegn er lavet som gæstelinks (seernes invitation er på 12). De flyttes, så gamle gæstelinks stadig virker.
insert into public.show_guest_invites (show_id, code, created_at)
  select i.show_id, i.code, i.created_at from public.show_invites i where i.code ~ '^[a-f0-9]{32}$'
on conflict do nothing;
delete from public.show_invites i where i.code ~ '^[a-f0-9]{32}$';

-- Værten henter (eller laver) gæstelinket til sit show.
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
    delete from public.show_guest_invites where show_id = p_show;
  end if;
  select code into v_code from public.show_guest_invites where show_id = p_show;
  if v_code is null then
    insert into public.show_guest_invites (show_id, code)
      values (p_show, replace(gen_random_uuid()::text, '-', ''))
      on conflict (show_id) do update set code = public.show_guest_invites.code
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
    from public.show_guest_invites i
    join public.shows s on s.id = i.show_id
    join public.profiles p on p.id = s.seller_id
   where i.code = p_code and s.removed_at is null;
$$;
revoke execute on function public.guest_invite_info(text) from public, anon;
grant  execute on function public.guest_invite_info(text) to authenticated;

-- En sælger siger ja til at være med. Giver showets id. Som i 0020, men koden slås op blandt gæstelinks.
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
  select s.* into v_show from public.show_guest_invites i join public.shows s on s.id = i.show_id where i.code = p_code for update of s;
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

-- ─────────────────────────────────────────────────────────────────────
-- 6. Kun fragtfirmaets scanning tæller som sendt
-- En ordre til en pakkeshop sendes med Reliveds label. Før kunne sælgeren selv markere den som afleveret og fik
-- pengene 7 dage senere, også hvis pakken aldrig blev afleveret. Nu skifter ordren først til "sendt", når sporingen
-- fra Shipmondo viser, at fragtfirmaet har scannet pakken (applyTracking på serveren). Ordrer uden pakkeshop,
-- som sælgeren selv sender, markeres stadig af sælgeren.
-- scan_flagged_at husker, at Relived har fået besked om en pakke, der ikke er scannet (så beskeden kun sendes én gang).
-- ─────────────────────────────────────────────────────────────────────
alter table public.orders add column if not exists scan_flagged_at timestamptz;

create or replace function public.mark_shipped(p_order uuid, p_carrier text default null, p_tracking text default null)
returns public.orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if exists (select 1 from public.orders o
              where o.id = p_order and o.seller_id = auth.uid() and o.status = 'paid' and o.delivery = 'ship' and o.sp_id is not null) then
    raise exception 'Pakken bliver markeret som sendt, når fragtfirmaet har scannet den.';
  end if;
  update public.orders o
     set status = 'shipped',
         shipped_at = now(),
         carrier = coalesce(nullif(btrim(left(coalesce(p_carrier, ''), 40)), ''), o.carrier),
         tracking = coalesce(nullif(btrim(left(coalesce(p_tracking, ''), 80)), ''), o.tracking)
   where o.id = p_order and o.seller_id = auth.uid() and o.status = 'paid' and o.delivery = 'ship' and o.sp_id is null
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

notify pgrst, 'reload schema';
