-- SnupLive · inaktive shows lukker af sig selv.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0001–0009).
-- Filen kan køres flere gange uden fejl. Den lukker også shows, der allerede hænger som "live".
--
-- Studiet sender et livstegn hvert minut, mens showet er live. Har et show ikke fået et livstegn
-- i 15 minutter (sælgeren har lukket studiet, telefonen er gået i dvale, nettet er væk), slutter
-- showet, præcis som hvis sælgeren havde trykket Afslut show: et budsalg, der kører, går til det
-- højeste bud, og resten kommer til salg til fast pris.

alter table public.shows add column if not exists heartbeat_at timestamptz;

-- Shows, der er live nu, regnes som aktive fra seneste billede fra kameraet eller fra starten.
update public.shows
   set heartbeat_at = coalesce(cover_at, started_at, now())
 where status = 'live' and heartbeat_at is null;

create index if not exists shows_live_heartbeat_idx on public.shows (heartbeat_at) where status = 'live';

-- ─────────────────────────────────────────────────────────────────────────────
-- Afslut et show (bruges af Afslut show og af den automatiske lukning). Kun til databasen selv.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._end_show(p_show uuid, p_note text)
returns public.shows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_show public.shows;
  v_live record;
begin
  select * into v_show from public.shows where id = p_show for update;
  if v_show.id is null or v_show.status <> 'live' then
    return v_show;
  end if;
  for v_live in select id from public.items where show_id = p_show and status = 'live' and auction_ends_at is not null loop
    perform public._close_auction(v_live.id, true);
  end loop;
  update public.items
     set status = 'unsold', rush_ends_at = null, for_sale = true, listed_at = now()
   where show_id = p_show and status in ('live', 'queued', 'unsold');
  update public.shows set status = 'ended', ended_at = now(), current_item_id = null
    where id = p_show returning * into v_show;
  insert into public.messages (show_id, user_id, handle, body, kind)
    values (p_show, null, 'SnupLive', p_note, 'event');
  return v_show;
end;
$$;
revoke execute on function public._end_show(uuid, text) from public, anon, authenticated;

-- Som før (0008), men Gå live sætter det første livstegn, og Afslut show bruger _end_show.
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

-- ─────────────────────────────────────────────────────────────────────────────
-- Livstegn fra studiet. Kun sælgeren selv, og kun mens showet er live.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.show_heartbeat(p_show uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.shows
     set heartbeat_at = now()
   where id = p_show and seller_id = auth.uid() and status = 'live';
  return found;
end;
$$;
revoke execute on function public.show_heartbeat(uuid) from public, anon;
grant  execute on function public.show_heartbeat(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Luk shows uden livstegn i 15 minutter. Kaldes, når nogen åbner forsiden, Live nu eller et
-- show, og af det daglige job, så et inaktivt show forsvinder hurtigt uden et ekstra cron-job.
-- Alle må kalde den: den tager ingen parametre og gør kun det, reglen siger.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.end_stale_shows()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_n  int := 0;
begin
  for v_id in
    select s.id from public.shows s
     where s.status = 'live' and coalesce(s.heartbeat_at, s.started_at, s.created_at) < now() - interval '15 minutes'
     order by s.id
     for update skip locked
  loop
    perform public._end_show(v_id, 'Showet er slut, fordi sælgeren ikke har været live i et stykke tid.');
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.end_stale_shows() from public;
grant  execute on function public.end_stale_shows() to anon, authenticated, service_role;

-- Luk dem, der allerede hænger.
do $$ begin perform public.end_stale_shows(); end $$;
