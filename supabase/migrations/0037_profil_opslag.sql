-- Relived · sælgerprofiler med forsidebillede, en kort tekst og opslag.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0036). Filen kan køres flere gange uden fejl.
-- Siden virker også, før filen er kørt: så vises profilen uden tekst, forsidebillede og opslag.

-- ───────────────────────────────────────────────────────────
-- Profilen: en kort tekst om sælgeren og et forsidebillede (ligger i lageret "covers" under sælgerens egen mappe).
-- ───────────────────────────────────────────────────────────
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists cover_path text;
alter table public.profiles drop constraint if exists profiles_bio_len;
alter table public.profiles add constraint profiles_bio_len check (bio is null or char_length(bio) <= 300);
grant update (bio, cover_path) on public.profiles to authenticated;

-- ───────────────────────────────────────────────────────────
-- Opslag: korte beskeder fra en sælger, med op til fire billeder, og gerne knyttet til et af sælgerens shows.
-- Alle kan læse dem. Kun sælgeren selv kan skrive og slette sine egne.
-- ───────────────────────────────────────────────────────────
create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  seller_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 600),
  images     text[] not null default '{}' check (coalesce(array_length(images, 1), 0) <= 4),
  show_id    uuid references public.shows (id) on delete set null,
  created_at timestamptz not null default now(),
  removed_at timestamptz
);
create index if not exists posts_seller_idx on public.posts (seller_id, created_at desc);
create index if not exists posts_created_idx on public.posts (created_at desc);

alter table public.posts enable row level security;
drop policy if exists posts_read on public.posts;
drop policy if exists posts_insert_own on public.posts;
drop policy if exists posts_delete_own on public.posts;
create policy posts_read on public.posts for select using (removed_at is null);
create policy posts_insert_own on public.posts for insert
  to authenticated
  with check (
    seller_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = seller_id and p.is_seller)
    and (show_id is null or exists (select 1 from public.shows s where s.id = show_id and s.seller_id = seller_id and s.removed_at is null))
  );
create policy posts_delete_own on public.posts for delete
  to authenticated using (seller_id = (select auth.uid()));
revoke all on public.posts from anon, authenticated;
grant select on public.posts to anon, authenticated;
grant insert (seller_id, body, images, show_id) on public.posts to authenticated;
grant delete on public.posts to authenticated;
grant all on public.posts to service_role;

-- Billederne skal ligge i sælgerens egen mappe, og en sælger kan højst skrive 10 opslag i døgnet.
create or replace function public.posts_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p text;
begin
  new.body := btrim(new.body);
  new.created_at := now();
  new.removed_at := null;
  foreach p in array new.images loop
    if p !~ ('^' || new.seller_id::text || '/opslag-[a-z0-9-]+\.jpg$') then
      raise exception 'Billedet kunne ikke bruges';
    end if;
  end loop;
  if (select count(*) from public.posts o where o.seller_id = new.seller_id and o.created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Du kan højst skrive 10 opslag i døgnet';
  end if;
  return new;
end;
$$;
drop trigger if exists posts_before_insert on public.posts;
create trigger posts_before_insert before insert on public.posts
  for each row execute function public.posts_before_insert();

-- ───────────────────────────────────────────────────────────
-- Opslag kan anmeldes ligesom varer, shows og profiler.
-- ───────────────────────────────────────────────────────────
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('item', 'show', 'profile', 'post'));

notify pgrst, 'reload schema';
