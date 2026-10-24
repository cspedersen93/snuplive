-- Relived · korte videoklip af tingene fra live-showet.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0014).
-- Filen kan køres flere gange uden fejl.
--
-- Når sælgeren viser en ting frem, optager studiet de første 15 sekunder i sælgerens browser og lægger
-- klippet op. Bliver tingen ikke solgt, vises klippet på annoncen. Klip af solgte ting slettes efter 14 dage,
-- og klip af fjernede ting ved næste oprydning (det daglige job).

alter table public.items add column if not exists clip_path text;
alter table public.items add column if not exists clip_at timestamptz;
alter table public.items drop constraint if exists items_clip_path_check;
alter table public.items add constraint items_clip_path_check
  check (clip_path is null or clip_path ~ ('^' || seller_id::text || '/' || id::text || '/clip-[a-z0-9]{1,20}\.(mp4|webm)$'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage: en offentlig mappe til klip. Hver sælger må kun skrive i sin egen undermappe. Højst 15 MB.
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clips', 'clips', true, 15728640, array['video/mp4', 'video/webm'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "klip_read_own" on storage.objects;
create policy "klip_read_own" on storage.objects for select
  to authenticated
  using (bucket_id = 'clips' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "klip_insert_own" on storage.objects;
create policy "klip_insert_own" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'clips' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "klip_update_own" on storage.objects;
create policy "klip_update_own" on storage.objects for update
  to authenticated
  using (bucket_id = 'clips' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'clips' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "klip_delete_own" on storage.objects;
create policy "klip_delete_own" on storage.objects for delete
  to authenticated
  using (bucket_id = 'clips' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ─────────────────────────────────────────────────────────────────────────────
-- Sælgeren gemmer et nyt klip på sin ting. Returnerer det gamle klip, så studiet kan slette filen.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_item_clip(p_item uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
  v_id  uuid;
begin
  select i.id, i.clip_path into v_id, v_old
    from public.items i
   where i.id = p_item and i.seller_id = auth.uid() and i.removed_at is null
   for update;
  if v_id is null then
    raise exception 'Tingen findes ikke';
  end if;
  update public.items set clip_path = p_path, clip_at = now() where id = p_item;
  return v_old;
end;
$$;
revoke execute on function public.set_item_clip(uuid, text) from public, anon;
grant  execute on function public.set_item_clip(uuid, text) to authenticated;

-- Sælgeren fjerner klippet fra sin ting. Returnerer stien, så filen kan slettes.
create or replace function public.clear_item_clip(p_item uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
  v_id  uuid;
begin
  select i.id, i.clip_path into v_id, v_old
    from public.items i
   where i.id = p_item and i.seller_id = auth.uid()
   for update;
  if v_id is null then
    raise exception 'Tingen findes ikke';
  end if;
  update public.items set clip_path = null, clip_at = null where id = p_item;
  return v_old;
end;
$$;
revoke execute on function public.clear_item_clip(uuid) from public, anon;
grant  execute on function public.clear_item_clip(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Oprydning (det daglige job): klip af ting, der blev solgt for mere end 14 dage siden, eller som er
-- fjernet. Nulstiller klippet på tingen og returnerer stierne, så serveren kan slette filerne.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.clips_to_clean()
returns setof text
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select i.id, i.clip_path as path
      from public.items i
     where i.clip_path is not null
       and ((i.status = 'sold' and i.sold_at < now() - interval '14 days') or i.removed_at is not null)
     for update skip locked
  )
  update public.items i
     set clip_path = null, clip_at = null
    from due
   where i.id = due.id
  returning due.path;
end;
$$;
revoke execute on function public.clips_to_clean() from public, anon, authenticated;
grant  execute on function public.clips_to_clean() to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Listerne (forside, kategorier, Til salg) viser, om en ting har et klip. Som i 0009, plus clip_path.
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
