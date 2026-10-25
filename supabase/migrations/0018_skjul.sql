-- Relived · sælgeren kan skjule afsluttede shows fra sin egen liste under Mine shows.
-- Showet, salget, ordrerne og tingene til salg bliver liggende (ordrer skal gemmes i 5 år).
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0017). Filen kan køres flere gange uden fejl.

alter table public.shows add column if not exists hidden_at timestamptz;

create or replace function public.set_show_hidden(p_show uuid, p_hidden boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_show public.shows;
begin
  select * into v_show from public.shows where id = p_show and seller_id = auth.uid() for update;
  if v_show.id is null then
    raise exception 'Showet findes ikke';
  end if;
  if p_hidden and v_show.status <> 'ended' then
    raise exception 'Kun afsluttede shows kan skjules. Planlagte shows kan slettes.';
  end if;
  update public.shows set hidden_at = case when p_hidden then now() else null end where id = p_show;
end;
$$;
revoke execute on function public.set_show_hidden(uuid, boolean) from public, anon;
grant  execute on function public.set_show_hidden(uuid, boolean) to authenticated;
