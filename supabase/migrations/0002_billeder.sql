-- SnupLive · billeder: profilbilleder og live-billeder af shows
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0001_init.sql).

-- ─────────────────────────────────────────────────────────────────────────────
-- Kolonner. Vi gemmer kun stien i Storage, så ingen kan pege på billeder andre steder.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column avatar_path text
  check (avatar_path ~ ('^' || id::text || '/[a-z0-9._-]{1,80}\.(jpg|jpeg|png|webp)$'));

alter table public.shows
  add column cover_path text
  check (cover_path ~ ('^' || seller_id::text || '/' || id::text || '/[a-z0-9._-]{1,80}\.(jpg|jpeg|png|webp)$')),
  add column cover_at timestamptz;

grant update (avatar_path) on public.profiles to authenticated;
grant update (cover_path, cover_at) on public.shows to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage: to offentlige mapper. Hver bruger må kun skrive i sin egen undermappe.
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('covers',  'covers',  true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "billeder_read_own" on storage.objects for select
  to authenticated
  using (bucket_id in ('avatars', 'covers') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "billeder_insert_own" on storage.objects for insert
  to authenticated
  with check (bucket_id in ('avatars', 'covers') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "billeder_update_own" on storage.objects for update
  to authenticated
  using (bucket_id in ('avatars', 'covers') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('avatars', 'covers') and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "billeder_delete_own" on storage.objects for delete
  to authenticated
  using (bucket_id in ('avatars', 'covers') and (storage.foldername(name))[1] = (select auth.uid())::text);
