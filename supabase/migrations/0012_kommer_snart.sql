-- SnupLive · "Kommer snart": venteliste og lukket side før lanceringen.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0011).
-- Filen kan køres flere gange uden fejl.
--
-- OBS: Når filen er kørt, er siden lukket. Besøgende ser kun "Kommer snart" og kan skrive sig op.
-- Admins (ADMIN_EMAILS i Vercel) og testere fra Backoffice → Indstillinger ser hele siden, når de er logget ind.
-- Åbn siden for alle under Backoffice → Indstillinger, når I lancerer.

insert into public.settings (key, value) values ('site_open', 'false') on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Ventelisten. Kun serveren læser og skriver. Dobbelt tilmelding: man får en mail og bekræfter.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.waitlist (
  id              uuid primary key default gen_random_uuid(),
  email           text not null check (char_length(email) between 5 and 200 and email = lower(email)),
  role            text not null check (role in ('buyer', 'seller', 'both')),
  consent_at      timestamptz not null default now(),
  confirm_token   uuid not null default gen_random_uuid(),
  confirm_sent_at timestamptz,
  confirmed_at    timestamptz,
  unsub_token     uuid not null default gen_random_uuid(),
  unsubscribed_at timestamptz,
  source          text check (char_length(source) <= 100),
  created_at      timestamptz not null default now()
);
create unique index if not exists waitlist_email_idx on public.waitlist (email);
create unique index if not exists waitlist_confirm_idx on public.waitlist (confirm_token);
create unique index if not exists waitlist_unsub_idx on public.waitlist (unsub_token);
alter table public.waitlist enable row level security;
revoke all on public.waitlist from anon, authenticated;
grant select, insert, update, delete on public.waitlist to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Testere, der må se hele siden, før den åbner (ud over admins). Kun serveren.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.beta_access (
  email    text primary key check (char_length(email) between 5 and 200 and email = lower(email)),
  note     text check (char_length(note) <= 200),
  added_at timestamptz not null default now()
);
alter table public.beta_access enable row level security;
revoke all on public.beta_access from anon, authenticated;
grant select, insert, update, delete on public.beta_access to service_role;
