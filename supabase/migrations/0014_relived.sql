-- Relived · nyt navn: SnupLive hedder nu Relived, og "Snup" hedder "Køb".
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0013).
-- Filen kan køres flere gange uden fejl. Funktionerne virker som før; kun teksterne er nye.

-- ─────────────────────────────────────────────────────────────────────────────
-- Beskeder fra siden selv i chatten (fx "Showet er startet") skrives af "Relived".
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._relived_system_messages()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.user_id is null and new.handle = 'SnupLive' then
    new.handle := 'Relived';
  end if;
  return new;
end;
$$;
drop trigger if exists messages_relived on public.messages;
create trigger messages_relived before insert on public.messages
  for each row execute function public._relived_system_messages();

update public.messages set handle = 'Relived' where user_id is null and handle = 'SnupLive';
update public.messages set body = replace(body, ' snuppede ', ' købte ')
 where user_id is null and kind = 'event' and body like '% snuppede %';

-- ─────────────────────────────────────────────────────────────────────────────
-- Køb i et live-show (funktionen hedder stadig snup). Som i 0008, men med de nye tekster.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.snup(p_item uuid)
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
    raise exception 'Log ind for at købe';
  end if;
  if exists (
    select 1 from public.items i
    join public.seller_blocks b on b.seller_id = i.seller_id
    where i.id = p_item and b.user_id = v_uid
  ) then
    raise exception 'Sælgeren har blokeret dig, så du kan ikke købe i showet';
  end if;
  if exists (select 1 from public.items i where i.id = p_item and i.sale_type = 'auction') then
    raise exception 'Tingen er på budsalg. Byd i stedet';
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
      raise exception 'Du kan ikke købe dine egne ting';
    elsif v_item.status = 'sold' then
      raise exception 'Øv, en anden nåede at købe den';
    elsif v_item.rush_ends_at is not null and v_item.rush_ends_at <= now() then
      raise exception 'Lynrunden er slut';
    else
      raise exception 'Tingen kan ikke købes lige nu';
    end if;
  end if;

  insert into public.sales (item_id, show_id, seller_id, buyer_id, price)
    values (v_item.id, v_item.show_id, v_item.seller_id, v_uid, v_item.price);

  select p.handle into v_handle from public.profiles p where p.id = v_uid;
  insert into public.messages (show_id, user_id, handle, body, kind)
    values (v_item.show_id, null, 'Relived',
            v_handle || ' købte ' || v_item.name || ' for ' || v_item.price || ' kr', 'event');
  return v_item;
end;
$$;
revoke execute on function public.snup(uuid) from public, anon;
grant  execute on function public.snup(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Sælgeren annullerer et ubetalt køb. Som i 0007, men med de nye tekster.
-- ─────────────────────────────────────────────────────────────────────────────
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
  update public.sales set status = 'cancelled', order_id = null where id = p_sale;
  update public.items set status = 'unsold', sold_at = null, for_sale = true, listed_at = now()
   where id = v_sale.item_id and status = 'sold';
end;
$$;
revoke execute on function public.cancel_reservation(uuid) from public, anon;
grant  execute on function public.cancel_reservation(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Nye brugere med en meget kort e-mail får brugernavnet "bruger" i stedet for "snupper".
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
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
    base := 'bruger';
  end if;
  candidate := base;
  while exists (select 1 from public.profiles p where p.handle = candidate) loop
    tries := tries + 1;
    candidate := base || (floor(random() * 9000) + 1000)::int::text;
    if tries > 20 then
      candidate := 'bruger' || substr(replace(new.id::text, '-', ''), 1, 12);
      exit;
    end if;
  end loop;
  insert into public.profiles (id, handle) values (new.id, candidate);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
