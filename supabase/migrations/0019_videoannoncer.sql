-- Relived · videoannoncer: sælgeren filmer tingen og sætter den til salg uden at gå live.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0018). Filen kan køres flere gange uden fejl.
--
-- En videoannonce er en ting, der er til salg til fast pris med det samme (som tingene efter et show).
-- Tingene ligger i et skjult "show" pr. sælger (kind = 'video'), så betaling, ordrer, fragt, Køb nu, Til salg
-- og Klip virker præcis som i dag. Det skjulte show bliver aldrig live og vises ikke som et show.

alter table public.shows add column if not exists kind text not null default 'show';
alter table public.shows drop constraint if exists shows_kind_check;
alter table public.shows add constraint shows_kind_check check (kind in ('show', 'video'));
-- Højst ét skjult videoannonce-show pr. sælger, og det er altid afsluttet.
create unique index if not exists shows_one_video_per_seller on public.shows (seller_id) where kind = 'video';
alter table public.shows drop constraint if exists shows_video_ended_check;
alter table public.shows add constraint shows_video_ended_check check (kind <> 'video' or status = 'ended');

-- ─────────────────────────────────────────────────────────────────────────────
-- Sælgeren lægger en videoannonce op. Videoen og billederne er allerede lagt i sælgerens egne mapper:
--   clips/<sælger>/<ting>/clip-….mp4|webm   og   items/<sælger>/<ting>/….jpg
-- Mærkevarer skal stadig ægthedstjekkes, før de kan købes (triggeren fra 0017 sørger for det).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_video_listing(
  p_id          uuid,
  p_name        text,
  p_size        text,
  p_condition   text,
  p_price       int,
  p_category    text,
  p_description text,
  p_images      text[],
  p_clip        text
)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_show public.shows;
  v_item public.items;
  v_pos  int;
begin
  if v_uid is null then
    raise exception 'Log ind først';
  end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.is_seller) then
    raise exception 'Bliv sælger først (under Mine shows)';
  end if;
  if public.mitid_required()
     and not exists (select 1 from public.profiles p where p.id = v_uid and p.mitid_verified_at is not null) then
    raise exception 'Bekræft, hvem du er, med MitID, før du sætter ting til salg';
  end if;
  if p_clip is null or p_clip !~ ('^' || v_uid::text || '/' || p_id::text || '/clip-[a-z0-9]{1,20}\.(mp4|webm)$') then
    raise exception 'Videoen kunne ikke gemmes. Prøv igen.';
  end if;
  if coalesce(cardinality(p_images), 0) < 1 or cardinality(p_images) > 4 then
    raise exception 'Vælg 1-4 billeder til annoncen';
  end if;
  if p_category is null then
    raise exception 'Vælg en kategori';
  end if;
  -- Bremse mod spam: højst 40 videoannoncer pr. døgn.
  if (select count(*) from public.items i join public.shows s on s.id = i.show_id
       where s.seller_id = v_uid and s.kind = 'video' and i.created_at > now() - interval '24 hours') >= 40 then
    raise exception 'Du har lagt mange videoannoncer op i dag. Prøv igen i morgen.';
  end if;

  select * into v_show from public.shows where seller_id = v_uid and kind = 'video' for update;
  if v_show.id is null then
    insert into public.shows (seller_id, title, category, status, kind, starts_at, started_at, ended_at)
      values (v_uid, 'Videoannoncer', p_category, 'ended', 'video', now(), now(), now())
      on conflict (seller_id) where kind = 'video' do nothing;
    select * into v_show from public.shows where seller_id = v_uid and kind = 'video' for update;
  end if;
  if v_show.removed_at is not null then
    raise exception 'Du kan ikke lægge videoannoncer op lige nu. Skriv til os under Hjælp, hvis det er en fejl.';
  end if;

  select coalesce(max(position), 0) + 1 into v_pos from public.items where show_id = v_show.id;
  insert into public.items (
    id, show_id, seller_id, name, size, condition, price, position, status, for_sale, listed_at,
    sale_type, category, description, images, clip_path, clip_at
  ) values (
    p_id, v_show.id, v_uid, btrim(p_name), nullif(btrim(coalesce(p_size, '')), ''), nullif(btrim(coalesce(p_condition, '')), ''),
    p_price, v_pos, 'unsold', true, now(),
    'fixed', p_category, nullif(btrim(coalesce(p_description, '')), ''), p_images, p_clip, now()
  )
  returning * into v_item;
  return v_item;
end;
$$;
revoke execute on function public.create_video_listing(uuid, text, text, text, int, text, text, text[], text) from public, anon;
grant  execute on function public.create_video_listing(uuid, text, text, text, int, text, text, text[], text) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Lukker Relived en sælger (Backoffice → Anmeldelser), bliver alt, sælgeren har til salg, taget af salg.
-- Før blev ting fra afsluttede shows liggende. Med videoannoncer er det vigtigere, så det lukkes her.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.seller_closed_off_sale()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_seller and not new.is_seller then
    update public.items set for_sale = false
     where seller_id = new.id and status = 'unsold' and for_sale;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_seller_closed on public.profiles;
create trigger profiles_seller_closed after update of is_seller on public.profiles
  for each row execute function public.seller_closed_off_sale();
