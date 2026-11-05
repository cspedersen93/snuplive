-- Relived · slet alle testshows: Backoffice → Indstillinger → Slet alle testshows.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0030). Filen kan køres flere gange uden fejl.
--
-- Før lanceringen: sletter alle shows med deres varer, chat, bud, påmindelser, gæster og invitationer, og nulstiller
-- testsalget først (køb, ordrer, sager, bedømmelser og fragtlabels). Anmeldelser af shows og varer bliver også slettet.
-- Brugere, sælgerprofiler, følgere, nyhedsbrevet og indstillinger bliver liggende.
-- Kun serveren kan kalde den, og serveren tillader det kun, mens Stripe kører med testnøgler. Findes der en rigtig
-- betaling (cs_live_…), nægter databasen også.

create or replace function public.admin_delete_test_shows()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counts jsonb;
begin
  if exists (select 1 from public.orders where stripe_session_id like 'cs_live_%') then
    raise exception 'Der er rigtige betalinger i databasen. Shows kan ikke slettes her.';
  end if;
  v_counts := jsonb_build_object(
    'shows', (select count(*) from public.shows),
    'items', (select count(*) from public.items)
  );
  -- Ordrerne peger på shows (og må ikke forsvinde af sig selv), så testsalget nulstilles først.
  v_counts := v_counts || public.admin_reset_test_sales();
  delete from public.reports where target_type in ('show', 'item');
  -- Varer, chat, bud, påmindelser, gæster og invitationer hører til showet og bliver slettet med det.
  -- "where true": Supabase kræver en WHERE ved DELETE (sikringen safeupdate).
  delete from public.shows where true;
  return v_counts;
end;
$$;
revoke execute on function public.admin_delete_test_shows() from public, anon, authenticated;
grant  execute on function public.admin_delete_test_shows() to service_role;

notify pgrst, 'reload schema';
