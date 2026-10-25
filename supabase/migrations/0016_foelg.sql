-- Relived · følg sælgere, og få besked, når de går live (mail eller besked på telefonen),
-- og om morgenen, hvis de har et show samme dag.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0015). Filen kan køres flere gange uden fejl.

-- ─────────────────────────────────────────────────────────────────────────────
-- Hvem følger hvem. Man kan kun se sine egne. Antallet af følgere står på sælgerens profil.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  seller_id   uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, seller_id),
  check (follower_id <> seller_id)
);
create index if not exists follows_seller_idx on public.follows (seller_id);

alter table public.follows enable row level security;
drop policy if exists "follows_read_own" on public.follows;
drop policy if exists "follows_insert_own" on public.follows;
drop policy if exists "follows_delete_own" on public.follows;
create policy "follows_read_own" on public.follows for select
  to authenticated using (follower_id = (select auth.uid()));
create policy "follows_insert_own" on public.follows for insert
  to authenticated
  with check (
    follower_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = seller_id and p.is_seller)
  );
create policy "follows_delete_own" on public.follows for delete
  to authenticated using (follower_id = (select auth.uid()));
revoke all on public.follows from anon, authenticated;
grant select, delete on public.follows to authenticated;
grant insert (follower_id, seller_id) on public.follows to authenticated;
grant all on public.follows to service_role;

-- En bruger, som sælgeren har blokeret, kan ikke følge sælgeren (blokeringerne kan brugeren ikke selv se).
create or replace function public.follows_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.seller_blocks b where b.seller_id = new.seller_id and b.user_id = new.follower_id) then
    raise exception 'Sælgeren har blokeret dig';
  end if;
  return new;
end;
$$;
drop trigger if exists follows_before_insert on public.follows;
create trigger follows_before_insert before insert on public.follows
  for each row execute function public.follows_before_insert();

alter table public.profiles add column if not exists follower_count int not null default 0;

create or replace function public.follows_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set follower_count = follower_count + 1 where id = new.seller_id;
    return new;
  end if;
  update public.profiles set follower_count = greatest(follower_count - 1, 0) where id = old.seller_id;
  return old;
end;
$$;
drop trigger if exists follows_count on public.follows;
create trigger follows_count after insert or delete on public.follows
  for each row execute function public.follows_count();

-- Blokerer en sælger en bruger, følger brugeren ikke længere sælgeren.
create or replace function public.follows_on_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows where seller_id = new.seller_id and follower_id = new.user_id;
  return new;
end;
$$;
drop trigger if exists follows_on_block on public.seller_blocks;
create trigger follows_on_block after insert on public.seller_blocks
  for each row execute function public.follows_on_block();

-- Tæl op igen (hvis filen køres igen).
update public.profiles p
   set follower_count = c.n
  from (select pr.id, (select count(*) from public.follows f where f.seller_id = pr.id)::int as n from public.profiles pr) c
 where c.id = p.id and p.follower_count is distinct from c.n;

-- ─────────────────────────────────────────────────────────────────────────────
-- Besked på telefonen (web push). Adressen kommer fra brugerens browser. Kun serveren skriver her.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique check (length(endpoint) between 10 and 1000),
  p256dh     text not null check (length(p256dh) between 20 and 200),
  auth       text not null check (length(auth) between 8 and 100),
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_read_own" on public.push_subscriptions;
create policy "push_read_own" on public.push_subscriptions for select
  to authenticated using (user_id = (select auth.uid()));
revoke all on public.push_subscriptions from anon, authenticated;
grant select on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;

-- Hemmeligheder, som kun serveren må se (nøglen til besked på telefonen bliver lavet automatisk første gang).
create table if not exists public.app_secrets (
  key        text primary key,
  value      text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
revoke all on public.app_secrets from anon, authenticated;
grant all on public.app_secrets to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Hvem skal have besked? (kun serveren)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.shows add column if not exists planned_notified_at timestamptz;

-- Følgerne af en sælger, der går live (ikke dem, sælgeren har blokeret).
create or replace function public.follower_recipients(p_seller uuid)
returns table (user_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select f.follower_id, u.email::text
    from public.follows f
    join auth.users u on u.id = f.follower_id
   where f.seller_id = p_seller
     and not exists (select 1 from public.seller_blocks b where b.seller_id = p_seller and b.user_id = f.follower_id);
$$;
revoke execute on function public.follower_recipients(uuid) from public, anon, authenticated;
grant  execute on function public.follower_recipients(uuid) to service_role;

-- Morgenmailen (det daglige job): shows, der starter inden for et døgn, hos sælgere man følger.
-- Hvert show kommer kun med én gang. Én række pr. følger og show.
create or replace function public.follow_digest()
returns table (user_id uuid, email text, show_id uuid, title text, starts_at timestamptz, handle text, item_count int)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with due as (
    select s.id
      from public.shows s
     where s.status = 'planned'
       and s.removed_at is null
       and s.planned_notified_at is null
       and s.starts_at between now() and now() + interval '24 hours'
     for update skip locked
  ),
  marked as (
    update public.shows s set planned_notified_at = now()
      from due where s.id = due.id
    returning s.id, s.title, s.starts_at, s.seller_id
  )
  select f.follower_id, u.email::text, m.id, m.title, m.starts_at, p.handle,
         (select count(*) from public.items i where i.show_id = m.id and i.removed_at is null)::int
    from marked m
    join public.profiles p on p.id = m.seller_id
    join public.follows f on f.seller_id = m.seller_id
    join auth.users u on u.id = f.follower_id
   where not exists (select 1 from public.seller_blocks b where b.seller_id = m.seller_id and b.user_id = f.follower_id)
   order by f.follower_id, m.starts_at;
end;
$$;
revoke execute on function public.follow_digest() from public, anon, authenticated;
grant  execute on function public.follow_digest() to service_role;
