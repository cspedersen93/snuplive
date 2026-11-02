-- Relived · kategorien Cykler og barnevogne: cykler, børnecykler, ladcykler, elcykler, løbehjul, barnevogne og klapvogne.
-- Nøglen i databasen er 'cykler', adressen er /kategori/cykler-og-barnevogne.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0028). Filen kan køres flere gange uden fejl.

alter table public.shows drop constraint if exists shows_category_check;
alter table public.shows add constraint shows_category_check
  check (category in ('dametoej', 'herretoej', 'luksus', 'skoenhed', 'boernetoej', 'cykler', 'bolig', 'samlerting', 'andet'));
alter table public.items drop constraint if exists items_category_check;
alter table public.items add constraint items_category_check
  check (category in ('dametoej', 'herretoej', 'luksus', 'skoenhed', 'boernetoej', 'cykler', 'bolig', 'samlerting', 'andet'));

-- Søgeagenter (0024_soegning.sql): også med den nye kategori. Springes over, hvis 0024 ikke er kørt.
do $do$
begin
  if to_regclass('public.saved_searches') is null then
    return;
  end if;
  execute 'alter table public.saved_searches drop constraint if exists saved_searches_category_check';
  execute $sql$alter table public.saved_searches add constraint saved_searches_category_check
    check (category is null or category in ('dametoej', 'herretoej', 'luksus', 'skoenhed', 'boernetoej', 'cykler', 'bolig', 'samlerting', 'andet'))$sql$;
  execute $sql$
create or replace function public.save_search(p_query text, p_category text default null, p_max_price int default null, p_size text default null)
returns public.saved_searches
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_uid  uuid := auth.uid();
  v_q    text := left(regexp_replace(trim(coalesce(p_query, '')), '\s+', ' ', 'g'), 60);
  v_size text := nullif(left(trim(coalesce(p_size, '')), 20), '');
  v_row  public.saved_searches;
begin
  if v_uid is null then
    raise exception 'Log ind for at gemme søgningen';
  end if;
  if char_length(v_q) < 2 and p_category is null then
    raise exception 'Skriv, hvad du leder efter, eller vælg en kategori';
  end if;
  if p_category is not null and p_category not in ('dametoej', 'herretoej', 'luksus', 'skoenhed', 'boernetoej', 'cykler', 'bolig', 'samlerting', 'andet') then
    raise exception 'Ukendt kategori';
  end if;
  if p_max_price is not null and (p_max_price < 1 or p_max_price > 100000) then
    raise exception 'Maks pris skal være mellem 1 og 100.000 kr';
  end if;
  select * into v_row from public.saved_searches s
   where s.user_id = v_uid and lower(s.query) = lower(v_q) and coalesce(s.category, '') = coalesce(p_category, '')
     and coalesce(s.max_price, 0) = coalesce(p_max_price, 0) and lower(coalesce(s.size, '')) = lower(coalesce(v_size, ''));
  if v_row.id is not null then
    return v_row;
  end if;
  if (select count(*) from public.saved_searches s where s.user_id = v_uid) >= 10 then
    raise exception 'Du kan have 10 søgeagenter. Slet en af de andre under Min konto først';
  end if;
  insert into public.saved_searches (user_id, query, category, max_price, size)
    values (v_uid, v_q, p_category, p_max_price, v_size)
  returning * into v_row;
  return v_row;
end;
$fn$$sql$;
  execute 'revoke execute on function public.save_search(text, text, int, text) from public, anon';
  execute 'grant execute on function public.save_search(text, text, int, text) to authenticated';
end;
$do$;

-- Siden spørger her, om kategorien findes, før den kan vælges (så intet går galt, før filen er kørt).
create or replace function public.category_ready(p_key text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_key in ('dametoej', 'herretoej', 'luksus', 'skoenhed', 'boernetoej', 'cykler', 'bolig', 'samlerting', 'andet');
$$;
grant execute on function public.category_ready(text) to anon, authenticated, service_role;
