-- Relived · kategorierne Luksus og Skønhed, ægthedstjek af luksusvarer og "Falsk vare" under Meld et problem.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0016). Filen kan køres flere gange uden fejl.

-- ─────────────────────────────────────────────────────────────────────────────
-- Nye kategorier
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.shows drop constraint if exists shows_category_check;
alter table public.shows add constraint shows_category_check
  check (category in ('dametoej', 'herretoej', 'luksus', 'skoenhed', 'boernetoej', 'bolig', 'samlerting', 'andet'));
alter table public.items drop constraint if exists items_category_check;
alter table public.items add constraint items_category_check
  check (category in ('dametoej', 'herretoej', 'luksus', 'skoenhed', 'boernetoej', 'bolig', 'samlerting', 'andet'));

-- "Meld et problem": køberen kan melde en falsk vare.
alter table public.order_issues drop constraint if exists order_issues_reason_check;
alter table public.order_issues add constraint order_issues_reason_check
  check (reason in ('not_received', 'not_as_shown', 'damaged', 'withdrawal', 'counterfeit', 'other'));

-- ─────────────────────────────────────────────────────────────────────────────
-- Ægthedstjek. Sælgeren lægger nærbilleder op, og Relived godkender eller afviser i Backoffice.
-- Før godkendelsen kan tingen ikke vises live, bydes på eller købes.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.items add column if not exists auth_required boolean not null default false;
alter table public.items add column if not exists auth_status   text;
alter table public.items add column if not exists auth_photos   text[] not null default '{}';
alter table public.items add column if not exists auth_note     text;
alter table public.items add column if not exists auth_at       timestamptz;
alter table public.items add column if not exists auth_by       uuid references public.profiles (id) on delete set null;
alter table public.items drop constraint if exists items_auth_status_check;
alter table public.items add constraint items_auth_status_check check (auth_status is null or auth_status in ('pending', 'approved', 'rejected'));
alter table public.items drop constraint if exists items_auth_note_check;
alter table public.items add constraint items_auth_note_check check (auth_note is null or char_length(auth_note) <= 500);
create index if not exists items_auth_pending_idx on public.items (auth_at) where auth_status = 'pending';

-- Mærker, der altid skal tjekkes (samme liste som lib/luxury.ts).
create or replace function public.luxury_brand(p text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p, '') ~* ('(^|[^a-z0-9æøåéè])('
    || 'louis\s+vuitton|vuitton|lv|gucci|chanel|hermès|hermes|prada|dior|fendi|balenciaga|bottega\s+veneta|celine|céline|'
    || 'saint\s+laurent|ysl|burberry|givenchy|valentino|loewe|goyard|miu\s+miu|rolex|cartier|omega|patek\s+philippe|'
    || 'audemars\s+piguet|bulgari|bvlgari|van\s+cleef|moncler|canada\s+goose'
    || ')($|[^a-z0-9æøåéè])');
$$;

create or replace function public.items_auth_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cat text := coalesce(new.category, (select s.category from public.shows s where s.id = new.show_id));
begin
  -- Skønhed sælges kun ny og uåbnet.
  if v_cat = 'skoenhed' then
    new.condition := 'Ny og uåbnet';
  end if;

  new.auth_required := (v_cat = 'luksus' and new.price >= 1000) or public.luxury_brand(new.name || ' ' || coalesce(new.description, ''));

  if tg_op = 'UPDATE' then
    -- Skifter sælgeren navn, kategori eller billederne til tjekket efter godkendelsen, skal tingen tjekkes igen.
    if old.auth_status = 'approved' and new.auth_status = 'approved' and new.auth_required
       and (new.name is distinct from old.name or new.category is distinct from old.category or new.auth_photos is distinct from old.auth_photos) then
      new.auth_status := null;
      new.auth_at := null;
      new.auth_by := null;
    end if;

    if new.auth_required and new.auth_status is distinct from 'approved' then
      if (new.status in ('live', 'sold') and new.status is distinct from old.status)
         or (new.high_bid is not null and new.high_bid is distinct from old.high_bid)
         or (new.auction_ends_at is not null and new.auction_ends_at is distinct from old.auction_ends_at)
         or (new.rush_ends_at is not null and new.rush_ends_at is distinct from old.rush_ends_at) then
        raise exception 'Tingen venter på ægthedstjek. Den kan vises og købes, når Relived har tjekket den.';
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists items_auth_rules on public.items;
create trigger items_auth_rules before insert or update on public.items
  for each row execute function public.items_auth_rules();

-- Beregn for de ting, der allerede findes (sætter auth_required via triggeren).
update public.items set auth_required = auth_required where removed_at is null and status <> 'sold';

-- Sælgeren sender sine billeder til tjek (4-8 billeder i sin egen mappe: <sælger>/<ting>/auth-….jpg).
create or replace function public.submit_auth(p_item uuid, p_photos text[])
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_item public.items;
begin
  select * into v_item from public.items where id = p_item and seller_id = v_uid and removed_at is null for update;
  if v_item.id is null then
    raise exception 'Tingen findes ikke';
  end if;
  if not v_item.auth_required then
    raise exception 'Tingen skal ikke ægthedstjekkes';
  end if;
  if v_item.status = 'sold' then
    raise exception 'Tingen er allerede solgt';
  end if;
  if v_item.auth_status = 'approved' then
    raise exception 'Tingen er allerede ægthedstjekket';
  end if;
  if coalesce(cardinality(p_photos), 0) < 4 or cardinality(p_photos) > 8 then
    raise exception 'Læg mindst 4 billeder op (højst 8)';
  end if;
  if exists (
    select 1 from unnest(p_photos) x
     where x !~ ('^' || v_uid::text || '/' || p_item::text || '/auth-[a-z0-9]{1,30}\.jpg$')
  ) then
    raise exception 'Billederne kunne ikke gemmes. Prøv igen.';
  end if;
  update public.items
     set auth_photos = p_photos, auth_status = 'pending', auth_note = null, auth_at = now(), auth_by = null
   where id = p_item
  returning * into v_item;
  return v_item;
end;
$$;
revoke execute on function public.submit_auth(uuid, text[]) from public, anon;
grant  execute on function public.submit_auth(uuid, text[]) to authenticated;
