-- Relived · beviser i en sag: billeder fra køberen, og videoklippet bliver liggende, mens sagen kører.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0037).
-- Filen kan køres flere gange uden fejl.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Køberen kan lægge op til fire billeder på en sag ("Meld et problem").
--    Stien er altid <køberens id>/sag-<tilfældigt>.jpg, så ingen kan pege på andres filer.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.order_issues add column if not exists photos text[] not null default '{}';
alter table public.order_issues drop constraint if exists order_issues_photos_max;
alter table public.order_issues add constraint order_issues_photos_max check (cardinality(photos) <= 4);

create or replace function public.order_issues_check_photos()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p text;
begin
  foreach p in array new.photos loop
    if p !~ ('^' || new.buyer_id::text || '/sag-[a-z0-9-]{4,40}\.jpg$') then
      raise exception 'Ugyldig sti til billede';
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists order_issues_photos_check on public.order_issues;
create trigger order_issues_photos_check before insert or update of photos on public.order_issues
  for each row execute function public.order_issues_check_photos();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Lager: en LUKKET mappe til billederne. Køberen må kun lægge billeder i sin egen undermappe og se sine egne.
--    Sælgeren og Relived ser dem via tidsbegrænsede links, som serveren laver. Højst 8 MB, kun JPEG.
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('issues', 'issues', false, 8388608, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sag_read_own" on storage.objects;
create policy "sag_read_own" on storage.objects for select
  to authenticated
  using (bucket_id = 'issues' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "sag_insert_own" on storage.objects;
create policy "sag_insert_own" on storage.objects for insert
  to authenticated
  with check (bucket_id = 'issues' and (storage.foldername(name))[1] = (select auth.uid())::text);
-- Ingen update og ingen delete: et billede, der er lagt på en sag, kan ikke byttes ud bagefter.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Videoklippet fra showet er beviset på, hvad der blev vist. Det slettes stadig 14 dage efter salget,
--    men IKKE mens ordren er undervejs (betalt eller sendt), og ikke før 30 dage efter, at en sag er afgjort.
--    Det gælder også, hvis sælgeren fjerner varen.
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
       and (i.removed_at is not null or (i.status = 'sold' and i.sold_at < now() - interval '14 days'))
       and not exists (
         select 1
           from public.sales s
           join public.orders o on o.id = s.order_id
          where s.item_id = i.id
            and (
              o.status in ('paid', 'shipped')
              or o.issue_open
              or exists (
                select 1 from public.order_issues oi
                 where oi.order_id = o.id
                   and (oi.status = 'open' or oi.resolved_at > now() - interval '30 days')
              )
            )
       )
     for update of i skip locked
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
-- 4. Sælgeren kan ikke slette eller bytte klippet, når varen er solgt. Før kunne klippet fjernes fra studiet
--    eller direkte i lageret, også efter et salg, og så var beviset væk.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_item_clip(p_item uuid, p_path text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old    text;
  v_id     uuid;
  v_status text;
begin
  select i.id, i.clip_path, i.status into v_id, v_old, v_status
    from public.items i
   where i.id = p_item and i.seller_id = auth.uid() and i.removed_at is null
   for update;
  if v_id is null then
    raise exception 'Tingen findes ikke';
  end if;
  -- Bliver varen købt, mens de 15 sekunder optages, skal det første klip stadig gemmes. Et klip, der findes, kan ikke byttes.
  if v_status = 'sold' and v_old is not null then
    raise exception 'Varen er solgt, så videoen kan ikke ændres';
  end if;
  update public.items set clip_path = p_path, clip_at = now() where id = p_item;
  return v_old;
end;
$$;
revoke execute on function public.set_item_clip(uuid, text) from public, anon;
grant  execute on function public.set_item_clip(uuid, text) to authenticated;

create or replace function public.clear_item_clip(p_item uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old    text;
  v_id     uuid;
  v_status text;
begin
  select i.id, i.clip_path, i.status into v_id, v_old, v_status
    from public.items i
   where i.id = p_item and i.seller_id = auth.uid()
   for update;
  if v_id is null then
    raise exception 'Tingen findes ikke';
  end if;
  if v_status = 'sold' then
    raise exception 'Varen er solgt, så videoen kan ikke slettes. Den slettes af sig selv senere.';
  end if;
  update public.items set clip_path = null, clip_at = null where id = p_item;
  return v_old;
end;
$$;
revoke execute on function public.clear_item_clip(uuid) from public, anon;
grant  execute on function public.clear_item_clip(uuid) to authenticated;

-- Samme regel direkte i lageret: filen til en solgt vare kan hverken slettes eller overskrives af sælgeren.
create or replace function public.clip_is_locked(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.items i where i.clip_path = p_path and i.status = 'sold');
$$;
revoke execute on function public.clip_is_locked(text) from public, anon;
grant  execute on function public.clip_is_locked(text) to authenticated, service_role;

drop policy if exists "klip_update_own" on storage.objects;
create policy "klip_update_own" on storage.objects for update
  to authenticated
  using (bucket_id = 'clips' and (storage.foldername(name))[1] = (select auth.uid())::text and not public.clip_is_locked(name))
  with check (bucket_id = 'clips' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "klip_delete_own" on storage.objects;
create policy "klip_delete_own" on storage.objects for delete
  to authenticated
  using (bucket_id = 'clips' and (storage.foldername(name))[1] = (select auth.uid())::text and not public.clip_is_locked(name));

notify pgrst, 'reload schema';
