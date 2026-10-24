-- SnupLive · supportchat: "Skriv til os" nederst på siden, svar fra Backoffice → Support.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0012).
-- Filen kan køres flere gange uden fejl.
--
-- Kun serveren læser og skriver (med den hemmelige nøgle). Den, der skriver, får en hemmelig nøgle i en
-- cookie, så kun de selv kan se deres samtale. Er de logget ind, hører samtalen også til deres konto.

-- ─────────────────────────────────────────────────────────────────────────────
-- Samtaler
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.support_threads (
  id                uuid primary key default gen_random_uuid(),
  token             uuid not null default gen_random_uuid(),
  user_id           uuid references public.profiles (id) on delete cascade,
  email             text check (email is null or (char_length(email) between 5 and 200 and email = lower(email))),
  name              text check (char_length(name) <= 100),
  status            text not null default 'open' check (status in ('open', 'closed')),
  page              text check (char_length(page) <= 300),
  user_agent        text check (char_length(user_agent) <= 300),
  -- Kun til at stoppe spam (højst 5 nye samtaler i timen fra samme sted). Slettes efter to døgn.
  ip_hash           text check (char_length(ip_hash) <= 64),
  admin_unread      boolean not null default false,
  -- Starten af den seneste besked og hvem der skrev den, til listen i Backoffice.
  preview           text check (char_length(preview) <= 160),
  last_sender       text check (last_sender in ('user', 'admin')),
  created_at        timestamptz not null default now(),
  last_message_at   timestamptz not null default now(),
  last_user_at      timestamptz,
  last_admin_at     timestamptz,
  user_seen_at      timestamptz,
  admin_seen_at     timestamptz,
  admin_notified_at timestamptz,
  user_notified_at  timestamptz,
  closed_at         timestamptz
);
create unique index if not exists support_threads_token_idx on public.support_threads (token);
create index if not exists support_threads_user_idx on public.support_threads (user_id, last_message_at desc);
create index if not exists support_threads_list_idx on public.support_threads (status, last_message_at desc);
create index if not exists support_threads_ip_idx on public.support_threads (ip_hash, created_at) where ip_hash is not null;
alter table public.support_threads enable row level security;
revoke all on public.support_threads from anon, authenticated;
grant select, insert, update, delete on public.support_threads to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Beskeder
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.support_messages (
  id          bigint generated always as identity primary key,
  thread_id   uuid not null references public.support_threads (id) on delete cascade,
  sender      text not null check (sender in ('user', 'admin')),
  author_id   uuid references public.profiles (id) on delete set null,
  author_name text check (char_length(author_name) <= 60),
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists support_messages_thread_idx on public.support_messages (thread_id, id);
alter table public.support_messages enable row level security;
revoke all on public.support_messages from anon, authenticated;
grant select, insert, update, delete on public.support_messages to service_role;
grant usage on sequence public.support_messages_id_seq to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Skriv en besked. Returnerer { message, notify }: notify er true, når admins skal have en mail
-- (første ulæste besked, siden de sidst kiggede, eller en påmindelse efter 6 timer).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.support_add(p_thread uuid, p_sender text, p_author uuid, p_author_name text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t      public.support_threads;
  v_m      public.support_messages;
  v_notify boolean := false;
  v_body   text := btrim(coalesce(p_body, ''));
begin
  select * into v_t from public.support_threads where id = p_thread for update;
  if v_t.id is null then
    raise exception 'Samtalen findes ikke';
  end if;
  if v_body = '' then
    raise exception 'Skriv en besked';
  end if;
  if char_length(v_body) > 2000 then
    raise exception 'Beskeden er for lang (højst 2000 tegn)';
  end if;

  if p_sender = 'user' then
    if (select count(*) from public.support_messages m
         where m.thread_id = p_thread and m.sender = 'user' and m.created_at > now() - interval '5 minutes') >= 15 then
      raise exception 'Du har skrevet mange beskeder på kort tid. Vent lidt, så svarer vi.';
    end if;
    v_notify := not v_t.admin_unread
             or v_t.admin_notified_at is null
             or v_t.admin_notified_at < now() - interval '6 hours';
  elsif p_sender <> 'admin' then
    raise exception 'Ukendt afsender';
  end if;

  insert into public.support_messages (thread_id, sender, author_id, author_name, body)
    values (p_thread, p_sender, p_author, left(p_author_name, 60), v_body)
    returning * into v_m;

  if p_sender = 'user' then
    update public.support_threads
       set last_message_at = now(), last_user_at = now(), user_seen_at = now(),
           admin_unread = true, status = 'open', closed_at = null,
           preview = left(v_body, 160), last_sender = 'user',
           admin_notified_at = case when v_notify then now() else admin_notified_at end
     where id = p_thread;
  else
    update public.support_threads
       set last_message_at = now(), last_admin_at = now(), admin_seen_at = now(), admin_unread = false,
           preview = left(v_body, 160), last_sender = 'admin'
     where id = p_thread;
  end if;

  return jsonb_build_object('message', to_jsonb(v_m), 'notify', v_notify);
end;
$$;
revoke execute on function public.support_add(uuid, text, uuid, text, text) from public, anon, authenticated;
grant  execute on function public.support_add(uuid, text, uuid, text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Start en samtale med den første besked. Højst 5 nye samtaler i timen fra samme sted
-- og 100 i alt, så ingen kan fylde indbakken.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.support_start(
  p_user uuid, p_email text, p_name text, p_page text, p_ua text, p_ip_hash text, p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.support_threads;
begin
  if p_ip_hash is not null and (
    select count(*) from public.support_threads t
     where t.ip_hash = p_ip_hash and t.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'For mange nye samtaler på kort tid. Prøv igen om lidt.';
  end if;
  if (select count(*) from public.support_threads t where t.created_at > now() - interval '1 hour') >= 100 then
    raise exception 'Supporten har travlt lige nu. Skriv til kontakt@snuplive.dk.';
  end if;
  if btrim(coalesce(p_body, '')) = '' then
    raise exception 'Skriv en besked';
  end if;

  insert into public.support_threads (user_id, email, name, page, user_agent, ip_hash)
    values (p_user, lower(nullif(btrim(p_email), '')), left(p_name, 100), left(p_page, 300), left(p_ua, 300), p_ip_hash)
    returning * into v_t;

  return jsonb_build_object('thread_id', v_t.id, 'token', v_t.token)
      || public.support_add(v_t.id, 'user', p_user, left(p_name, 60), p_body);
end;
$$;
revoke execute on function public.support_start(uuid, text, text, text, text, text, text) from public, anon, authenticated;
grant  execute on function public.support_start(uuid, text, text, text, text, text, text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Hvem skal have svaret på mail? Samtaler med svar fra SnupLive, som brugeren ikke har set,
-- og højst én mail hvert 5. minut pr. samtale. Med p_thread: lige efter et svar, hvis brugeren
-- ikke har chatten åben (en åben chat henter nyt hvert 4. sekund). Uden: alle, hvor svaret er mere end
-- 2 minutter gammelt.
-- since = beskeder efter dette tidspunkt skal med i mailen.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.support_user_notices(p_thread uuid default null)
returns table (id uuid, token uuid, email text, since timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  return query
  with due as (
    select t.id, t.user_notified_at as prev
      from public.support_threads t
     where (p_thread is null or t.id = p_thread)
       and t.email is not null
       and t.last_admin_at is not null
       and t.last_admin_at > coalesce(t.user_seen_at, '-infinity'::timestamptz)
       and t.last_admin_at > coalesce(t.user_notified_at, '-infinity'::timestamptz)
       and coalesce(t.user_notified_at, '-infinity'::timestamptz) < now() - interval '5 minutes'
       and (case when p_thread is null
                 then t.last_admin_at < now() - interval '2 minutes'
                 else coalesce(t.user_seen_at, '-infinity'::timestamptz) < now() - interval '12 seconds' end)
     for update skip locked
  )
  update public.support_threads t
     set user_notified_at = now()
    from due
   where t.id = due.id
  returning t.id, t.token, t.email,
            greatest(coalesce(due.prev, '-infinity'::timestamptz), coalesce(t.user_seen_at, '-infinity'::timestamptz));
end;
$$;
revoke execute on function public.support_user_notices(uuid) from public, anon, authenticated;
grant  execute on function public.support_user_notices(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Oprydning (det daglige job): samtaler slettes 12 måneder efter sidste besked,
-- og spam-stemplet slettes efter to døgn.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.support_cleanup()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  update public.support_threads set ip_hash = null where ip_hash is not null and created_at < now() - interval '2 days';
  delete from public.support_threads where last_message_at < now() - interval '12 months';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke execute on function public.support_cleanup() from public, anon, authenticated;
grant  execute on function public.support_cleanup() to service_role;
