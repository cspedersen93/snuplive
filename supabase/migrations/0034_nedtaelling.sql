-- Relived · nedtælling til live. Sælgeren kan starte en nedtælling på 1, 3, 5 eller 10 minutter i stedet for at gå
-- live med det samme. Seerne ser "Live om 4:32" på showets side, følgerne får besked, når nedtællingen starter,
-- og chatten er åben, mens der tælles ned. Når tiden er gået, går studiet selv live (3-2-1).
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0033). Filen kan køres flere gange uden fejl.

alter table public.shows add column if not exists countdown_to timestamptz;

-- Start nedtællingen. Kun værten, og kun før showet er gået live. Starttidspunktet flyttes til nedtællingens slut,
-- så showet står øverst under "Snart live".
create or replace function public.start_countdown(p_show uuid, p_minutes int)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_to timestamptz;
begin
  if p_minutes not in (1, 3, 5, 10) then
    raise exception 'Vælg 1, 3, 5 eller 10 minutter';
  end if;
  v_to := now() + make_interval(mins => p_minutes);
  update public.shows s
     set countdown_to = v_to, starts_at = v_to
   where s.id = p_show and s.seller_id = auth.uid() and s.status = 'planned' and s.removed_at is null;
  if not found then
    raise exception 'Nedtællingen kan kun startes af værten, før showet er live';
  end if;
  return v_to;
end;
$$;
revoke execute on function public.start_countdown(uuid, int) from public, anon;
grant  execute on function public.start_countdown(uuid, int) to authenticated;

-- Stop nedtællingen (showet bliver ved med at være planlagt).
create or replace function public.stop_countdown(p_show uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.shows s set countdown_to = null
   where s.id = p_show and s.seller_id = auth.uid() and s.status = 'planned';
end;
$$;
revoke execute on function public.stop_countdown(uuid) from public, anon;
grant  execute on function public.stop_countdown(uuid) to authenticated;

-- Når showet går live (eller slutter), er nedtællingen forbi.
create or replace function public.shows_clear_countdown()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'planned' then
    new.countdown_to := null;
  end if;
  return new;
end;
$$;
drop trigger if exists shows_clear_countdown on public.shows;
create trigger shows_clear_countdown before update of status on public.shows
  for each row execute function public.shows_clear_countdown();

-- Chatten: åben, mens showet er live, og mens der tælles ned (og et kvarter efter, hvis sælgeren ikke når at gå live).
drop policy if exists "messages_insert_own" on public.messages;
create policy "messages_insert_own" on public.messages for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and kind = 'chat'
    and exists (
      select 1 from public.shows s
       where s.id = show_id
         and (s.status = 'live'
              or (s.status = 'planned' and s.countdown_to is not null and s.countdown_to > now() - interval '15 minutes'))
    )
  );

notify pgrst, 'reload schema';
