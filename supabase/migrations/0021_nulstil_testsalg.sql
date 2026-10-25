-- Relived · nulstil testsalg: Backoffice → Indstillinger → Nulstil testsalg.
-- Kør hele filen i Supabase → SQL Editor → New query → Run (efter 0020). Filen kan køres flere gange uden fejl.
--
-- Sletter alle køb, ordrer, bud, sager, bedømmelser og fragtlabels, så omsætningen (og indberetningen til Skat) starter
-- forfra. Solgte ting bliver "Ikke til salg" (sælgeren kan sætte dem til salg igen). Shows, ting, brugere og følgere bliver.
-- Kun serveren kan kalde den, og serveren tillader det kun, mens Stripe kører med testnøgler. Findes der en rigtig
-- betaling (cs_live_…), nægter databasen også.

create or replace function public.admin_reset_test_sales()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counts jsonb;
begin
  if exists (select 1 from public.orders where stripe_session_id like 'cs_live_%') then
    raise exception 'Der er rigtige betalinger i databasen. Testsalg kan ikke nulstilles.';
  end if;
  v_counts := jsonb_build_object(
    'orders',  (select count(*) from public.orders),
    'sales',   (select count(*) from public.sales),
    'bids',    (select count(*) from public.bids),
    'issues',  (select count(*) from public.order_issues),
    'ratings', (select count(*) from public.ratings),
    'labels',  (select count(*) from public.shipping_labels)
  );
  -- Solgte ting (og ting med bud) bliver ikke til salg. Sælgeren kan sætte dem til salg igen under Til salg.
  update public.items
     set status = 'unsold', sold_at = null, for_sale = false,
         high_bid = null, high_bidder = null, high_handle = null, bid_count = 0, auction_ends_at = null, rush_ends_at = null
   where status = 'sold';
  update public.items
     set high_bid = null, high_bidder = null, high_handle = null, bid_count = 0
   where bid_count > 0 or high_bid is not null;
  delete from public.bids;
  delete from public.sales;
  -- Sager, bedømmelser og fragtlabels hører til ordrerne og bliver slettet med dem.
  delete from public.orders;
  update public.profiles set rating_avg = null, rating_count = 0 where rating_count > 0 or rating_avg is not null;
  return v_counts;
end;
$$;
revoke execute on function public.admin_reset_test_sales() from public, anon, authenticated;
grant  execute on function public.admin_reset_test_sales() to service_role;
