-- SnupLive · sælgere bekræfter, hvem de er, med MitID (via Idura).
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0001–0010).
-- Filen kan køres flere gange uden fejl.
--
-- Kravet er slået fra, til du slår det til under Backoffice → Indstillinger. Så længe det er fra,
-- kan sælgere bekræfte sig frivilligt, og de får mærket "MitID-bekræftet" ved deres ting og shows.

-- ─────────────────────────────────────────────────────────────────────────────
-- Hvem har bekræftet sig. Kun sælgeren selv kan se sin egen række; serveren skriver den.
-- Vi gemmer ikke CPR-nummeret, kun navn, fødselsdato og et hash af MitID-id'et,
-- så det samme MitID ikke kan bruges på flere konti.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.identity_verifications (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  provider    text not null default 'dk:mitid',
  sub_hash    text not null unique,
  name        text check (char_length(name) <= 200),
  birthdate   date,
  verified_at timestamptz not null default now()
);
alter table public.identity_verifications enable row level security;
drop policy if exists identity_read_own on public.identity_verifications;
create policy identity_read_own on public.identity_verifications for select using (user_id = (select auth.uid()));
revoke all on public.identity_verifications from anon, authenticated;
grant select on public.identity_verifications to authenticated;
grant select, insert, update, delete on public.identity_verifications to service_role;

-- Offentligt mærke på profilen: bare tidspunktet, ikke navnet.
alter table public.profiles add column if not exists mitid_verified_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- Indstillinger, som admin kan slå til og fra.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
revoke all on public.settings from anon, authenticated;
grant select on public.settings to anon, authenticated;
grant select, insert, update on public.settings to service_role;
insert into public.settings (key, value) values ('mitid_required', 'false') on conflict (key) do nothing;

create or replace function public.mitid_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.value = 'true'::jsonb from public.settings s where s.key = 'mitid_required'), false);
$$;
grant execute on function public.mitid_required() to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Serveren gemmer en bekræftelse efter MitID-login. Returnerer 'ok' eller 'taken'
-- (det samme MitID er allerede brugt på en anden konto).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.admin_set_mitid(p_user uuid, p_sub_hash text, p_name text, p_birthdate date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.identity_verifications v where v.sub_hash = p_sub_hash and v.user_id <> p_user) then
    return 'taken';
  end if;
  insert into public.identity_verifications (user_id, sub_hash, name, birthdate, verified_at)
    values (p_user, p_sub_hash, left(p_name, 200), p_birthdate, now())
  on conflict (user_id) do update
    set sub_hash = excluded.sub_hash, name = excluded.name, birthdate = excluded.birthdate, verified_at = now();
  update public.profiles set mitid_verified_at = now() where id = p_user;
  return 'ok';
exception when unique_violation then
  return 'taken';
end;
$$;
revoke execute on function public.admin_set_mitid(uuid, text, text, date) from public, anon, authenticated;
grant  execute on function public.admin_set_mitid(uuid, text, text, date) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Som i 0010, men når kravet er slået til, skal sælgeren have bekræftet sig med MitID for at gå live.
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
    if public.mitid_required()
       and not exists (select 1 from public.profiles p where p.id = v_uid and p.mitid_verified_at is not null) then
      raise exception 'Bekræft, hvem du er, med MitID, før du går live';
    end if;
    if exists (select 1 from public.shows s where s.seller_id = v_uid and s.status = 'live') then
      raise exception 'Du er allerede live i et andet show';
    end if;
    update public.shows set status = 'live', started_at = now(), heartbeat_at = now() where id = p_show returning * into v_show;
    insert into public.messages (show_id, user_id, handle, body, kind)
      values (p_show, null, 'SnupLive', 'Showet er startet. Velkommen!', 'event');

  elsif p_status = 'ended' then
    if v_show.status <> 'live' then
      raise exception 'Showet er ikke live';
    end if;
    v_show := public._end_show(p_show, 'Showet er slut. Tak fordi du så med!');

  else
    raise exception 'Ukendt status';
  end if;

  return v_show;
end;
$$;
revoke execute on function public.set_show_status(uuid, text) from public, anon;
grant  execute on function public.set_show_status(uuid, text) to authenticated;
