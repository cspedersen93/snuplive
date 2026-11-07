-- Relived · genbrugstælleren: hvor mange varer der har fået et nyt hjem via Relived (solgt og betalt).
-- Tallet vises på forsiden og på "Om Relived", når det er over en grænse (lib/reuse.ts). Det er jeres egne tal,
-- så det er en konkret påstand, der kan dokumenteres (de nye regler for grøn markedsføring fra 27.9.2026).
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0034). Filen kan køres flere gange uden fejl.

create or replace function public.reused_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from public.sales s where s.status in ('paid', 'shipped', 'done');
$$;
revoke execute on function public.reused_count() from public;
grant  execute on function public.reused_count() to anon, authenticated;

notify pgrst, 'reload schema';
