-- SnupLive · varer: kategorier, billeder og beskrivelse på ting, "Køb nu" efter showet og "Husk mig"
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0001–0006).
-- Filen kan køres flere gange uden fejl.

-- ─────────────────────────────────────────────────────────────────────────────
-- De fem kategorier (+ andet). De gamle kategorier flyttes over.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.shows drop constraint if exists shows_category_check;
update public.shows
   set category = case category
     when 'toej' then 'dametoej'
     when 'overtoej' then 'dametoej'
     when 'denim' then 'herretoej'
     when 'vinyl' then 'samlerting'
     when 'design' then 'bolig'
     else category end
 where category in ('toej', 'overtoej', 'denim', 'vinyl', 'design');
update public.shows set category = 'andet'
 where category not in ('dametoej', 'herretoej', 'boernetoej', 'bolig', 'samlerting', 'andet');
alter table public.shows alter column category set default 'dametoej';
alter table public.shows add constraint shows_category_check
  check (category in ('dametoej', 'herretoej', 'boernetoej', 'bolig', 'samlerting', 'andet'));

-- Hvornår der er sendt besked til dem, der har trykket "Husk mig".
alter table public.shows add column if not exists notified_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- Ting: kategori, beskrivelse, billeder, til salg efter showet og salgsform
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.items add column if not exists category    text;
alter table public.items add column if not exists description text;
alter table public.items add column if not exists images      text[] not null default '{}';
alter table public.items add column if not exists for_sale    boolean not null default false;
alter table public.items add column if not exists listed_at   timestamptz;
-- Budsalg kommer i næste fase. Feltet er her allerede, så tingene ikke skal laves om.
alter table public.items add column if not exists sale_type   text not null default 'fixed';

-- Billeder ligger i mappen "items/<sælger>/<ting>/…" og der må højst være 6.
create or replace function public.item_images_ok(p_seller uuid, p_item uuid, p_images text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(p_images), 0) <= 6
     and coalesce(bool_and(p ~ ('^' || p_seller::text || '/' || p_item::text || '/[a-z0-9._-]{1,80}\.(jpg|jpeg|png|webp)$')), true)
    from unnest(coalesce(p_images, '{}'::text[])) as p;
$$;

alter table public.items drop constraint if exists items_category_check;
alter table public.items add constraint items_category_check
  check (category in ('dametoej', 'herretoej', 'boernetoej', 'bolig', 'samlerting', 'andet'));
alter table public.items drop constraint if exists items_description_check;
alter table public.items add constraint items_description_check check (char_length(description) <= 1000);
alter table public.items drop constraint if exists items_images_check;
alter table public.items add constraint items_images_check check (public.item_images_ok(seller_id, id, images));
alter table public.items drop constraint if exists items_sale_type_check;
alter table public.items add constraint items_sale_type_check check (sale_type in ('fixed', 'auction'));

create index if not exists items_for_sale_idx on public.items (listed_at desc) where for_sale and status = 'unsold';
create index if not exists items_seller_idx on public.items (seller_id, created_at desc);

grant insert (category, description, images) on public.items to authenticated;
grant update (category, description, images, for_sale) on public.items to authenticated;

-- Billeder af ting (offentlige, men kun sælgeren kan lægge dem i sin egen mappe).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('items', 'items', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "varer_read_own" on storage.objects;
create policy "varer_read_own" on storage.objects for select
  to authenticated
  using (bucket_id = 'items' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "varer_insert_own" on storage.objects;
create policy "varer_insert_own" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'items' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "varer_update_own" on storage.objects;
create policy "varer_update_own" on storage.objects for update
  to authenticated
  using (bucket_id = 'items' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'items' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "varer_delete_own" on storage.objects;
create policy "varer_delete_own" on storage.objects for delete
  to authenticated
  using (bucket_id = 'items' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Et billede fra kameraet, i det øjeblik tingen bliver vist live (også mens tingen er "live").
create or replace function public.add_item_photo(p_item uuid, p_path text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.items i
     set images = array_append(i.images, p_path)
   where i.id = p_item
     and i.seller_id = auth.uid()
     and coalesce(cardinality(i.images), 0) < 6
     and not (p_path = any(i.images));
  if not found then
    raise exception 'Billedet kunne ikke gemmes på tingen';
  end if;
end;
$$;
revoke execute on function public.add_item_photo(uuid, text) from public, anon;
grant  execute on function public.add_item_photo(uuid, text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Når showet slutter, bliver alt, der ikke er solgt, sat til salg til fast pris.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_show_status(p_show uuid, p_status text)
returns public.shows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_show public.shows;
begin
  select * into v_show from public.shows where id = p_show for update;
  if v_show.id is null or v_show.seller_id is distinct from v_uid then
    raise exception 'Showet findes ikke';
  end if;

  if p_status = 'live' then
    if v_show.status <> 'planned' then
      raise exception 'Showet er allerede startet eller slut';
    end if;
    if exists (select 1 from public.shows s where s.seller_id = v_uid and s.status = 'live') then
      raise exception 'Du er allerede live i et andet show';
    end if;
    update public.shows set status = 'live', started_at = now() where id = p_show returning * into v_show;
    insert into public.messages (show_id, user_id, handle, body, kind)
      values (p_show, null, 'SnupLive', 'Showet er startet. Velkommen!', 'event');

  elsif p_status = 'ended' then
    if v_show.status <> 'live' then
      raise exception 'Showet er ikke live';
    end if;
    update public.items
       set status = 'unsold', rush_ends_at = null, for_sale = true, listed_at = now()
     where show_id = p_show and status in ('live', 'queued', 'unsold');
    update public.shows set status = 'ended', ended_at = now(), current_item_id = null
      where id = p_show returning * into v_show;
    insert into public.messages (show_id, user_id, handle, body, kind)
      values (p_show, null, 'SnupLive', 'Showet er slut. Tak fordi du så med!', 'event');

  else
    raise exception 'Ukendt status';
  end if;

  return v_show;
end;
$$;
revoke execute on function public.set_show_status(uuid, text) from public, anon;
grant  execute on function public.set_show_status(uuid, text) to authenticated;

-- Ting fra shows, der sluttede før denne fil blev kørt, sættes også til salg (kun én gang).
update public.items i
   set status = 'unsold', rush_ends_at = null, for_sale = true, listed_at = now()
  from public.shows s
 where s.id = i.show_id and s.status = 'ended'
   and i.status in ('live', 'queued', 'unsold') and i.listed_at is null;

-- Køb nu: en ting, der er til salg efter showet, til den faste pris. Lander i "Mine snup".
create or replace function public.buy_now(p_item uuid)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_item public.items;
begin
  if v_uid is null then
    raise exception 'Log ind for at købe';
  end if;
  if exists (
    select 1 from public.items i
    join public.seller_blocks b on b.seller_id = i.seller_id
    where i.id = p_item and b.user_id = v_uid
  ) then
    raise exception 'Sælgeren har blokeret dig, så du kan ikke købe hos sælgeren';
  end if;

  update public.items i
     set status = 'sold', sold_at = now()
   where i.id = p_item
     and i.status = 'unsold'
     and i.for_sale
     and i.seller_id <> v_uid
     and exists (select 1 from public.shows s where s.id = i.show_id and s.status = 'ended')
  returning * into v_item;

  if v_item.id is null then
    select * into v_item from public.items where id = p_item;
    if v_item.id is null then
      raise exception 'Tingen findes ikke';
    elsif v_item.seller_id = v_uid then
      raise exception 'Du kan ikke købe dine egne ting';
    elsif v_item.status = 'sold' then
      raise exception 'Øv, en anden nåede at købe den';
    else
      raise exception 'Tingen er ikke til salg lige nu';
    end if;
  end if;

  insert into public.sales (item_id, show_id, seller_id, buyer_id, price)
    values (v_item.id, v_item.show_id, v_item.seller_id, v_uid, v_item.price);
  return v_item;
end;
$$;
revoke execute on function public.buy_now(uuid) from public, anon;
grant  execute on function public.buy_now(uuid) to authenticated;

-- Annullerer sælgeren et ubetalt snup, kommer tingen til salg igen (når showet er slut, kan den købes med Køb nu).
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
  update public.items set status = 'unsold', sold_at = null, for_sale = true, listed_at = now()
   where id = v_sale.item_id and status = 'sold';
end;
$$;
revoke execute on function public.cancel_reservation(uuid) from public, anon;
grant  execute on function public.cancel_reservation(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- "Husk mig": besked, når et show starter (for hele showet eller én ting i det)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.reminders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  show_id    uuid not null references public.shows (id) on delete cascade,
  item_id    uuid references public.items (id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists reminders_unique on public.reminders (user_id, show_id, item_id) nulls not distinct;
create index if not exists reminders_show_idx on public.reminders (show_id);

alter table public.reminders enable row level security;
drop policy if exists "reminders_read_own" on public.reminders;
drop policy if exists "reminders_insert_own" on public.reminders;
drop policy if exists "reminders_delete_own" on public.reminders;
create policy "reminders_read_own" on public.reminders for select
  to authenticated using (user_id = (select auth.uid()));
create policy "reminders_insert_own" on public.reminders for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.shows s where s.id = show_id and s.status = 'planned')
    and (item_id is null or exists (select 1 from public.items i where i.id = item_id and i.show_id = reminders.show_id))
  );
create policy "reminders_delete_own" on public.reminders for delete
  to authenticated using (user_id = (select auth.uid()));
revoke all on public.reminders from anon, authenticated;
grant select, delete on public.reminders to authenticated;
grant insert (user_id, show_id, item_id) on public.reminders to authenticated;
grant all on public.reminders to service_role;

-- Hvem skal have besked, når showet starter? (Kun serveren.)
create or replace function public.reminder_recipients(p_show uuid)
returns table (user_id uuid, email text, items text[])
language sql
stable
security definer
set search_path = ''
as $$
  select r.user_id, u.email::text,
         coalesce(array_agg(i.name order by i.position) filter (where i.id is not null), '{}')
    from public.reminders r
    join auth.users u on u.id = r.user_id
    left join public.items i on i.id = r.item_id
   where r.show_id = p_show
     and not exists (
       select 1 from public.shows s join public.seller_blocks b on b.seller_id = s.seller_id
        where s.id = p_show and b.user_id = r.user_id)
   group by r.user_id, u.email;
$$;
revoke execute on function public.reminder_recipients(uuid) from public, anon, authenticated;
grant  execute on function public.reminder_recipients(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Ting til forsiden, kategorierne og "Til salg" (offentlige data)
--   upcoming: i et kommende show · live: i et show, der er live · for_sale: til salg efter showet
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.items_feed(
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
  starts_at timestamptz, listed_at timestamptz, seller_id uuid, handle text, avatar_path text, area text, total bigint
)
language sql
stable
set search_path = ''
as $$
  select i.id, i.name, i.size, i.condition, i.price, i.images, coalesce(i.category, s.category), i.status,
         i.for_sale, i.sale_type, i.description, s.id, s.title, s.status, s.starts_at, i.listed_at,
         p.id, p.handle, p.avatar_path, p.area, count(*) over ()
    from public.items i
    join public.shows s on s.id = i.show_id
    join public.profiles p on p.id = i.seller_id
   where (p_category is null or coalesce(i.category, s.category) = p_category)
     and (p_seller is null or i.seller_id = p_seller)
     and (p_exclude is null or i.id <> p_exclude)
     and case p_kind
           when 'upcoming' then s.status = 'planned' and i.status = 'queued' and s.starts_at >= now() - interval '2 hours'
           when 'live'     then s.status = 'live' and i.status in ('queued', 'live', 'unsold')
           when 'for_sale' then s.status = 'ended' and i.status = 'unsold' and i.for_sale
           else false
         end
   order by
     case when p_kind = 'upcoming' then s.starts_at end asc,
     case when p_kind <> 'upcoming' then coalesce(i.listed_at, i.created_at) end desc,
     i.position
   limit least(greatest(coalesce(p_limit, 24), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
grant execute on function public.items_feed(text, text, int, int, uuid, uuid) to anon, authenticated, service_role;
