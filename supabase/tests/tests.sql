-- Tests af adgangsregler og live-funktioner. Hver test skriver "OK: ..." eller stopper med en fejl.
\set ON_ERROR_STOP 1
set client_min_messages = notice;

create schema t;
grant usage on schema t to anon, authenticated;
create function t.throws(q text, pat text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    if sqlerrm ilike '%' || pat || '%' then
      raise notice 'OK (afvist som ventet): %', sqlerrm;
      return;
    end if;
    raise exception 'Forkert fejl for [%]: % (ventede "%")', q, sqlerrm, pat;
  end;
  raise exception 'Ingen fejl for [%] (ventede "%")', q, pat;
end $$;
create function t.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FEJL: %', label; end if;
  raise notice 'OK: %', label;
end $$;
grant execute on all functions in schema t to anon, authenticated;

-- Brugere: Maja (sælger), Liva og Ole (købere), plus to der tester brugernavne.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'maja@mail.dk'),
  ('00000000-0000-0000-0000-00000000000b', 'Liva.K@gmail.com'),
  ('00000000-0000-0000-0000-00000000000c', 'ole+snup@firma.dk'),
  ('00000000-0000-0000-0000-00000000000d', 'maja@hotmail.com'),
  ('00000000-0000-0000-0000-00000000000e', 'å@x.dk');

select t.ok((select handle from profiles where id = '00000000-0000-0000-0000-00000000000a') = 'maja', 'brugernavn fra e-mail');
select t.ok((select handle from profiles where id = '00000000-0000-0000-0000-00000000000b') = 'liva.k', 'brugernavn med små bogstaver');
select t.ok((select handle from profiles where id = '00000000-0000-0000-0000-00000000000c') = 'olesnup', 'ugyldige tegn fjernes');
select t.ok((select handle ~ '^maja[0-9]{4}$' from profiles where id = '00000000-0000-0000-0000-00000000000d'), 'optaget brugernavn får tal bagpå');
select t.ok((select handle from profiles where id = '00000000-0000-0000-0000-00000000000e') = 'snupper', 'for kort brugernavn bliver "snupper"');

-- ── Anonym besøgende ─────────────────────────────────────────────────────────
set role anon;
select set_config('request.jwt.claims', '', false);
select t.ok((select count(*) from profiles) = 5, 'anonym kan se profiler');
select t.throws($$select * from sales$$, 'permission denied');
select t.throws($$insert into messages (show_id, user_id, body) values (gen_random_uuid(), null, 'hej')$$, 'permission denied');
select t.throws($$select snup(gen_random_uuid())$$, 'permission denied');
reset role;

-- ── Liva er ikke sælger og kan ikke oprette shows ────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$insert into shows (seller_id, title) values ('00000000-0000-0000-0000-00000000000b', 'Mit show')$$, 'row-level security');
update profiles set handle = 'hacker' where id = '00000000-0000-0000-0000-00000000000a';
select t.ok((select count(*) from profiles where handle = 'hacker') = 0, 'kan ikke rette andres profil');
select t.throws($$update profiles set handle = 'Ugyldigt Navn' where id = auth.uid()$$, 'check constraint');
select t.throws($$update profiles set handle = 'maja' where id = auth.uid()$$, 'duplicate key');
select t.throws($$update profiles set id = gen_random_uuid() where id = auth.uid()$$, 'permission denied');

-- ── Maja bliver sælger og opretter et show ───────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
update profiles set is_seller = true, handle = 'majasgarderobe', display_name = 'Maja', area = 'Nørrebro' where id = auth.uid();
select t.ok((select is_seller from profiles where id = auth.uid()), 'Maja er sælger');
select t.throws($$insert into shows (seller_id, title, status) values (auth.uid(), 'Snyd', 'live')$$, 'permission denied');
insert into shows (id, seller_id, title, category, starts_at)
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Sommerkjoler og strik', 'dametoej', now() + interval '1 hour');
insert into items (id, show_id, seller_id, name, size, condition, price, position) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', auth.uid(), 'Blomstret slå-om-kjole', 'S', 'Som ny', 150, 1),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', auth.uid(), 'Uldcardigan, beige', 'M', 'God stand', 120, 2),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', auth.uid(), 'Hørbukser', 'S', 'Brugt', 90, 3),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', auth.uid(), 'Strikvest', 'M', 'God stand', 80, 4);
select t.throws($$insert into items (show_id, seller_id, name, price, status) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Snyd', 10, 'sold')$$, 'permission denied');
select t.throws($$insert into items (show_id, seller_id, name, price) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Gratis', 0)$$, 'check constraint');
select t.throws($$update shows set status = 'live' where id = '10000000-0000-0000-0000-000000000001'$$, 'permission denied');
select t.throws($$select present_item('20000000-0000-0000-0000-000000000001')$$, 'Gå live');

-- Liva kan ikke lægge ting i Majas show eller styre det
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$insert into items (show_id, seller_id, name, price) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Fremmed ting', 10)$$, 'row-level security');
select t.throws($$select set_show_status('10000000-0000-0000-0000-000000000001', 'live')$$, 'findes ikke');
update items set price = 1 where id = '20000000-0000-0000-0000-000000000001';
select t.ok((select price from items where id = '20000000-0000-0000-0000-000000000001') = 150, 'kan ikke ændre prisen på andres ting');
delete from shows where id = '10000000-0000-0000-0000-000000000001';
select t.ok((select count(*) from shows) = 1, 'kan ikke slette andres show');
select t.throws($$insert into messages (show_id, user_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Hej')$$, 'row-level security');

-- ── Maja går live ────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.ok((select status from set_show_status('10000000-0000-0000-0000-000000000001', 'live')) = 'live', 'showet er live');
select t.throws($$select set_show_status('10000000-0000-0000-0000-000000000001', 'live')$$, 'allerede startet');
insert into shows (id, seller_id, title) values ('10000000-0000-0000-0000-000000000002', auth.uid(), 'Andet show');
select t.throws($$select set_show_status('10000000-0000-0000-0000-000000000002', 'live')$$, 'allerede live');
select t.ok((select status from present_item('20000000-0000-0000-0000-000000000001')) = 'live', 'kjolen vises frem');
select t.ok((select current_item_id from shows where id = '10000000-0000-0000-0000-000000000001') = '20000000-0000-0000-0000-000000000001', 'showet peger på kjolen');
select t.throws($$select snup('20000000-0000-0000-0000-000000000001')$$, 'egne ting');
update items set price = 1 where id = '20000000-0000-0000-0000-000000000001';
select t.ok((select price from items where id = '20000000-0000-0000-0000-000000000001') = 150, 'prisen ligger fast, mens tingen vises');
insert into messages (show_id, user_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), '  Velkommen alle sammen  ');
select t.ok((select from_seller and handle = 'majasgarderobe' and body = 'Velkommen alle sammen' from messages where kind = 'chat' order by id desc limit 1), 'sælgerens besked er mærket og trimmet');

-- ── Liva chatter og snupper ──────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$insert into messages (show_id, user_id, handle, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'majasgarderobe', 'Jeg er Maja')$$, 'permission denied');
insert into messages (show_id, user_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Hvor lang er kjolen?');
select t.ok((select handle = 'liva.k' and not from_seller from messages where kind = 'chat' order by id desc limit 1), 'man kan ikke skrive i andres navn');
select t.throws($$insert into messages (show_id, user_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'spam')$$, 'for hurtigt');
select pg_sleep(1.1);
select t.throws($$insert into messages (show_id, user_id, body) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Jeg er Maja')$$, 'row-level security');
select t.throws($$insert into messages (show_id, user_id, body, kind) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'falsk', 'event')$$, 'permission denied');
select t.throws($$insert into messages (show_id, user_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), '')$$, '');
select t.ok((select status from snup('20000000-0000-0000-0000-000000000001')) = 'sold', 'Liva snupper kjolen');
select t.ok((select count(*) from sales where buyer_id = auth.uid()) = 1, 'Liva kan se sit snup');
select t.ok((select body from messages where kind = 'event' order by id desc limit 1) = 'liva.k snuppede Blomstret slå-om-kjole for 150 kr', 'snuppet bliver annonceret i chatten');
select t.ok((select user_id is null from messages where kind = 'event' order by id desc limit 1), 'hændelsen er ikke knyttet til Livas id');

-- Ole kommer for sent
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.throws($$select snup('20000000-0000-0000-0000-000000000001')$$, 'en anden nåede');
select t.ok((select count(*) from sales) = 0, 'Ole kan ikke se andres snup');
select t.throws($$select snup('20000000-0000-0000-0000-000000000002')$$, 'ikke snuppes lige nu');

-- ── Lynrunde ─────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.ok((select count(*) from sales) = 1, 'Maja kan se sit salg');
select present_item('20000000-0000-0000-0000-000000000002');
select t.throws($$select present_item('20000000-0000-0000-0000-000000000001')$$, 'allerede solgt');
select t.ok((select rush_ends_at > now() + interval '4 seconds' from start_rush('20000000-0000-0000-0000-000000000002', 5)), 'lynrunde på 5 sekunder');
select t.throws($$select start_rush('20000000-0000-0000-0000-000000000003', 10)$$, 'Vis tingen frem');
select pg_sleep(5.3);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.throws($$select snup('20000000-0000-0000-0000-000000000002')$$, 'Lynrunden er slut');

-- Næste ting, og cardiganen bliver usolgt
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select present_item('20000000-0000-0000-0000-000000000003');
select t.ok((select status from items where id = '20000000-0000-0000-0000-000000000002') = 'unsold', 'den forrige ting bliver usolgt');
select start_rush('20000000-0000-0000-0000-000000000003', 30);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.ok((select status from snup('20000000-0000-0000-0000-000000000003')) = 'sold', 'Ole snupper i lynrunden');

-- ── Showet slutter ───────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select present_item('20000000-0000-0000-0000-000000000004');
select t.ok((select status from set_show_status('10000000-0000-0000-0000-000000000001', 'ended')) = 'ended', 'showet er slut');
select t.ok((select status from items where id = '20000000-0000-0000-0000-000000000004') = 'unsold', 'det, der blev vist, bliver usolgt');
select t.ok((select current_item_id is null from shows where id = '10000000-0000-0000-0000-000000000001'), 'ingen ting vises efter showet');
select t.throws($$insert into items (show_id, seller_id, name, price) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'For sent', 10)$$, 'row-level security');
select t.ok((select count(*) from sales where seller_id = auth.uid()) = 2, 'Maja har to salg');
select t.ok((select sum(price) from sales where seller_id = auth.uid()) = 240, 'omsætning 240 kr');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$insert into messages (show_id, user_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Er I der?')$$, 'row-level security');
reset role;

-- ── Billeder ─────────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
update profiles set avatar_path = '00000000-0000-0000-0000-00000000000a/avatar-1.jpg' where id = auth.uid();
select t.ok((select avatar_path is not null from profiles where id = auth.uid()), 'Maja har et profilbillede');
select t.throws($$update profiles set avatar_path = 'https://andet-sted.dk/x.jpg' where id = auth.uid()$$, 'check constraint');
select t.throws($$update profiles set avatar_path = '00000000-0000-0000-0000-00000000000b/avatar.jpg' where id = auth.uid()$$, 'check constraint');
update shows set cover_path = '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000002/live.jpg', cover_at = now()
  where id = '10000000-0000-0000-0000-000000000002';
select t.ok((select cover_path is not null from shows where id = '10000000-0000-0000-0000-000000000002'), 'Maja har et billede af sit show');
select t.throws($$update shows set cover_path = '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000001/live.jpg' where id = '10000000-0000-0000-0000-000000000002'$$, 'check constraint');
insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000a/avatar-1.jpg');
select t.ok((select count(*) from storage.objects where bucket_id = 'avatars') = 1, 'Maja kan lægge et billede i sin egen mappe');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$insert into storage.objects (bucket_id, name) values ('avatars', '00000000-0000-0000-0000-00000000000a/hack.jpg')$$, 'row-level security');
select t.throws($$insert into storage.objects (bucket_id, name) values ('avatars', 'hack.jpg')$$, 'row-level security');
delete from storage.objects where name like '00000000-0000-0000-0000-00000000000a/%';
reset role;
select t.ok((select count(*) from storage.objects) = 1, 'Liva kan ikke slette Majas billede');
select t.ok((select public from storage.buckets where id = 'avatars'), 'mappen med profilbilleder er offentlig');

-- ── Betaling ─────────────────────────────────────────────────────────────────
-- Serveren opretter en betalt ordre for Livas kjole (sale fra testen ovenfor).
set role service_role;
insert into orders (id, checkout_id, buyer_id, seller_id, show_id, status, delivery, items_amount, shipping_amount, fee_amount, total_amount, ship_name, ship_line1, ship_postal_code, ship_city, paid_at)
  values ('30000000-0000-0000-0000-000000000001', gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a',
          '10000000-0000-0000-0000-000000000001', 'paid', 'ship', 150, 39, 13, 202, 'Liva K', 'Nørrebrogade 1', '2200', 'København N', now());
update sales set order_id = '30000000-0000-0000-0000-000000000001', status = 'paid' where item_id = '20000000-0000-0000-0000-000000000001';
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.ok((select count(*) from orders) = 1, 'Liva kan se sin ordre');
select t.throws($$update orders set status = 'completed' returning 1$$, 'permission denied');
select t.throws($$insert into orders (checkout_id, buyer_id, seller_id, show_id, delivery, items_amount, shipping_amount, fee_amount, total_amount) values (gen_random_uuid(), auth.uid(), auth.uid(), '10000000-0000-0000-0000-000000000001', 'ship', 1, 0, 0, 1)$$, 'permission denied');
select t.throws($$select mark_shipped('30000000-0000-0000-0000-000000000001', 'GLS', '123')$$, 'kan ikke markeres');
select t.ok((select count(*) from payout_accounts) = 0, 'Liva kan ikke se andres udbetalingskonti');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.ok((select count(*) from orders) = 0, 'Ole kan ikke se andres ordrer');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.ok((select count(*) from orders) = 1, 'Maja kan se ordren som sælger');
select t.ok((select ship_city = 'København N' from orders), 'sælgeren kan se leveringsadressen');
select t.throws($$select cancel_reservation((select id from sales where item_id = '20000000-0000-0000-0000-000000000001'))$$, 'er betalt');
select t.ok((select status from mark_shipped('30000000-0000-0000-0000-000000000001', 'GLS', ' 00012345 ')) = 'shipped', 'Maja markerer pakken som sendt');
select t.ok((select tracking = '00012345' from orders), 'sporingsnummeret er gemt uden mellemrum');
select t.ok((select status from sales where item_id = '20000000-0000-0000-0000-000000000001') = 'shipped', 'snuppet står som sendt');
select t.throws($$select mark_shipped('30000000-0000-0000-0000-000000000001')$$, 'kan ikke markeres');
-- Oles snup af hørbukserne er ikke betalt, så Maja kan annullere det.
select cancel_reservation((select id from sales where item_id = '20000000-0000-0000-0000-000000000003'));
select t.ok((select status from sales where item_id = '20000000-0000-0000-0000-000000000003') = 'cancelled', 'Maja annullerer et ubetalt snup');
select t.ok((select status from items where id = '20000000-0000-0000-0000-000000000003') = 'unsold', 'tingen kan sælges igen');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$select cancel_reservation((select id from sales where item_id = '20000000-0000-0000-0000-000000000003'))$$, 'findes ikke');
reset role;

-- ── Fragt ────────────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
insert into seller_addresses (user_id, name, address1, zipcode, city, phone)
  values (auth.uid(), 'Maja Holm', 'Jagtvej 10, 2. tv', '2200', 'København N', '+45 22 33 44 55');
select t.ok((select count(*) from seller_addresses) = 1, 'Maja gemmer sin afsenderadresse');
update seller_addresses set city = 'København Ø' where user_id = auth.uid();
select t.ok((select city from seller_addresses) = 'København Ø', 'Maja retter sin afsenderadresse');
select t.throws($$update seller_addresses set zipcode = '22' where user_id = auth.uid()$$, 'check constraint');
select t.throws($$insert into seller_addresses (user_id, name, address1, zipcode, city) values ('00000000-0000-0000-0000-00000000000b', 'Liva', 'Vej 1', '2200', 'Kbh')$$, 'row-level security');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.ok((select count(*) from seller_addresses) = 0, 'Liva kan ikke se Majas afsenderadresse');
update seller_addresses set city = 'Hacket' where user_id = '00000000-0000-0000-0000-00000000000a';
reset role;
select t.ok((select city from seller_addresses) = 'København Ø', 'Liva kan ikke ændre Majas afsenderadresse');
set role anon;
select t.throws($$select * from seller_addresses$$, 'permission denied');
reset role;
-- Ordrer til pakkeshop: uden label kan de ikke markeres som sendt, med label beholder de labelens sporingsnummer.
set role service_role;
insert into orders (id, checkout_id, buyer_id, seller_id, show_id, status, delivery, items_amount, shipping_amount, fee_amount, total_amount,
                    ship_name, ship_line1, ship_postal_code, ship_city, paid_at, sp_carrier, sp_id, sp_name)
  values ('30000000-0000-0000-0000-000000000002', gen_random_uuid(), '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a',
          '10000000-0000-0000-0000-000000000001', 'paid', 'ship', 100, 49, 10, 159, 'Liva K', 'Nørrebrogade 1', '2200', 'København N', now(),
          'gls', '95892', '7-Eleven Nørrebrogade');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.ok((select sp_name from orders where id = '30000000-0000-0000-0000-000000000002') = '7-Eleven Nørrebrogade', 'sælgeren kan se pakkeshoppen');
select t.throws($$select mark_shipped('30000000-0000-0000-0000-000000000002')$$, 'kan ikke markeres');
select t.throws($$update orders set shipmondo_shipment_id = 1 where id = '30000000-0000-0000-0000-000000000002' returning 1$$, 'permission denied');
select t.throws($$select * from shipping_labels$$, 'permission denied');
reset role;
set role service_role;
update orders set shipmondo_shipment_id = 4242, carrier = 'GLS', tracking = '0123456789' where id = '30000000-0000-0000-0000-000000000002';
insert into shipping_labels (order_id, shipment_id, carrier, product_code, weight, price)
  values ('30000000-0000-0000-0000-000000000002', 4242, 'gls', 'GLSDK_SD', 1000, 43.50);
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$select mark_shipped('30000000-0000-0000-0000-000000000002')$$, 'kan ikke markeres');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select mark_shipped('30000000-0000-0000-0000-000000000002');
select t.ok((select status = 'shipped' and carrier = 'GLS' and tracking = '0123456789' from orders where id = '30000000-0000-0000-0000-000000000002'),
            'pakken med label er afleveret og beholder sporingsnummeret');
reset role;

-- ── Moderation ───────────────────────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select set_show_status('10000000-0000-0000-0000-000000000002', 'live');
insert into items (id, show_id, seller_id, name, price, position)
  values ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', auth.uid(), 'Bordlampe', 200, 1);
select present_item('20000000-0000-0000-0000-000000000005');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
insert into messages (show_id, user_id, body) values ('10000000-0000-0000-0000-000000000002', auth.uid(), 'Grim besked');
select pg_sleep(1.1);
insert into messages (show_id, user_id, body) values ('10000000-0000-0000-0000-000000000002', auth.uid(), 'Endnu en grim');
select t.throws($$update messages set removed_at = now() where user_id = auth.uid()$$, 'permission denied');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
insert into messages (show_id, user_id, body) values ('10000000-0000-0000-0000-000000000002', auth.uid(), 'Ups, forkert show');
select remove_message((select id from messages where body = 'Ups, forkert show'));
select t.ok((select count(*) from messages where user_id = auth.uid() and removed_at is not null) = 1, 'Liva fjerner sin egen besked');
select t.throws($$select remove_message((select id from messages where body = 'Grim besked'))$$, 'kan ikke fjernes');
select t.throws($$select block_user('00000000-0000-0000-0000-00000000000c')$$, 'Kun sælgere');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select remove_message((select id from messages where body = 'Grim besked'));
select t.ok((select count(*) from messages where body = 'Grim besked') = 0, 'sælgeren fjerner en besked, og teksten er væk');
select t.throws($$select remove_message((select id from messages where kind = 'event' order by id desc limit 1))$$, 'kan ikke fjernes');
select t.throws($$select block_user(auth.uid())$$, 'dig selv');
select block_user('00000000-0000-0000-0000-00000000000c');
select t.ok((select count(*) from seller_blocks) = 1, 'Maja kan se, hvem hun har blokeret');
select t.ok((select count(*) from messages where user_id = '00000000-0000-0000-0000-00000000000c' and show_id = '10000000-0000-0000-0000-000000000002' and removed_at is null) = 0,
            'den blokerede brugers beskeder i showet er fjernet');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select pg_sleep(1.1);
select t.throws($$insert into messages (show_id, user_id, body) values ('10000000-0000-0000-0000-000000000002', auth.uid(), 'Hallo?')$$, 'blokeret dig i chatten');
select t.throws($$select snup('20000000-0000-0000-0000-000000000005')$$, 'blokeret dig');
select t.ok((select count(*) from seller_blocks) = 0, 'Ole kan ikke se listen over blokerede');
select t.throws($$insert into seller_blocks (seller_id, user_id) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')$$, 'permission denied');
select unblock_user('00000000-0000-0000-0000-00000000000c');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.ok((select count(*) from seller_blocks) = 1, 'Ole kan ikke selv fjerne blokeringen');
select unblock_user('00000000-0000-0000-0000-00000000000c');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
insert into messages (show_id, user_id, body) values ('10000000-0000-0000-0000-000000000002', auth.uid(), 'Undskyld');
select t.ok((select count(*) from messages where body = 'Undskyld' and removed_at is null) = 1, 'Ole kan skrive igen, når blokeringen er fjernet');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select set_show_status('10000000-0000-0000-0000-000000000002', 'ended');
reset role;

-- ── Meld et problem ──────────────────────────────────────────────────────────
-- Serveren opretter sagen (her som databasens ejer).
insert into order_issues (order_id, buyer_id, reason, message)
  values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'not_as_shown', 'Kjolen har en plet, der ikke blev vist');
update orders set issue_open = true where id = '30000000-0000-0000-0000-000000000001';
select t.throws($$insert into order_issues (order_id, buyer_id, reason, message) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'other', 'En sag mere om det samme')$$, 'duplicate key');
select t.throws($$insert into order_issues (order_id, buyer_id, reason, message, status) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'other', 'kort', 'resolved')$$, 'check constraint');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.ok((select count(*) from order_issues) = 1, 'Liva kan se sin sag');
select t.throws($$insert into order_issues (order_id, buyer_id, reason, message) values ('30000000-0000-0000-0000-000000000001', auth.uid(), 'other', 'Jeg prøver selv at oprette en sag')$$, 'permission denied');
select t.throws($$update orders set issue_open = false where id = '30000000-0000-0000-0000-000000000001' returning 1$$, 'permission denied');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.ok((select count(*) from order_issues) = 1, 'sælgeren kan se sagen');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.ok((select count(*) from order_issues) = 0, 'andre kan ikke se sagen');
reset role;
set role anon;
select t.throws($$select * from order_issues$$, 'permission denied');
reset role;

-- ── Backoffice ───────────────────────────────────────────────────────────────
-- En ting med et annulleret snup kan snuppes igen, men kun én ad gangen.
insert into sales (item_id, show_id, seller_id, buyer_id, price)
  values ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 90);
select t.ok((select count(*) from sales where item_id = '20000000-0000-0000-0000-000000000003') = 2, 'en annulleret ting kan snuppes igen');
select t.throws($$insert into sales (item_id, show_id, seller_id, buyer_id, price) values ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c', 90)$$, 'duplicate key');
select t.ok((admin_overview(now() - interval '1 day') ->> 'members_total')::int = 5, 'overblikket tæller medlemmer');
select t.ok((admin_overview(now() - interval '1 day') ->> 'items_sold')::int = 2, 'overblikket tæller solgte ting (ikke annullerede)');
select t.ok((select count(*) from admin_daily(now() - interval '2 days')) = 3, 'en række pr. dag');
select t.ok((select email from admin_members('liva')) = 'Liva.K@gmail.com', 'medlemmer kan søges på brugernavn og har e-mail');
select t.ok((select count(*) from admin_members('gmail.com')) = 1, 'medlemmer kan søges på e-mail');
select t.ok((select count(*) from admin_members('%')) = 0, 'procenttegn i søgningen er bare et tegn');
select t.ok((select total from admin_members(null, 2, 0) limit 1) = 5, 'medlemslisten kender det samlede antal');
select t.ok((select handle from admin_members(null, 50, 0, '00000000-0000-0000-0000-00000000000a')) = 'majasgarderobe', 'ét medlem kan hentes');
select t.ok((select count(*) from admin_shows()) = 2, 'shows-listen');
select t.ok((select handle from admin_top_sellers(now() - interval '1 day') limit 1) = 'majasgarderobe', 'top-sælgere');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.throws($$select admin_overview(now())$$, 'permission denied');
select t.throws($$select * from admin_members('maja')$$, 'permission denied');
reset role;
set role anon;
select t.throws($$select * from admin_shows()$$, 'permission denied');
reset role;

-- ── Varer: kategorier, billeder, Køb nu og Husk mig ──────────────────────────
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.throws($$insert into shows (seller_id, title, category) values (auth.uid(), 'Gammel kategori', 'toej')$$, 'check constraint');
insert into shows (id, seller_id, title, category, starts_at)
  values ('10000000-0000-0000-0000-000000000007', auth.uid(), 'Lørdagsshow med lamper', 'bolig', now() + interval '1 day');
insert into items (id, show_id, seller_id, name, price, position, description, images, category)
  values ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000007', auth.uid(), 'Le Klint-lampe', 450, 1,
          'Original fra 70erne, lille hak i kanten.',
          array['00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000006/1.jpg'], 'bolig');
select t.ok((select description is not null and cardinality(images) = 1 from items where id = '20000000-0000-0000-0000-000000000006'), 'ting med beskrivelse og billede');
select t.throws($$update items set images = array['00000000-0000-0000-0000-00000000000b/20000000-0000-0000-0000-000000000006/x.jpg'] where id = '20000000-0000-0000-0000-000000000006'$$, 'check constraint');
select t.throws($$update items set images = array['https://andet-sted.dk/x.jpg'] where id = '20000000-0000-0000-0000-000000000006'$$, 'check constraint');
select t.throws($$update items set category = 'biler' where id = '20000000-0000-0000-0000-000000000006'$$, 'check constraint');
select add_item_photo('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000006/live-1.jpg');
select t.ok((select cardinality(images) = 2 from items where id = '20000000-0000-0000-0000-000000000006'), 'billede fra kameraet lægges på tingen');
select t.ok((select for_sale and status = 'unsold' from items where id = '20000000-0000-0000-0000-000000000002'), 'en usolgt ting er til salg, når showet er slut');
select t.ok((select for_sale and status = 'unsold' from items where id = '20000000-0000-0000-0000-000000000005'), 'også ting, der aldrig blev vist');
select t.throws($$select buy_now('20000000-0000-0000-0000-000000000002')$$, 'egne ting');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$select add_item_photo('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-00000000000b/20000000-0000-0000-0000-000000000006/x.jpg')$$, 'kunne ikke gemmes');
update items set description = 'Hacket' where id = '20000000-0000-0000-0000-000000000006';
select t.throws($$select buy_now('20000000-0000-0000-0000-000000000006')$$, 'ikke til salg');
select t.ok((select status from buy_now('20000000-0000-0000-0000-000000000002')) = 'sold', 'Liva køber cardiganen efter showet');
select t.ok((select status from sales where item_id = '20000000-0000-0000-0000-000000000002' and buyer_id = auth.uid()) = 'reserved', 'købet ligger i Livas kurv');
select t.ok((select count(*) from items_feed('upcoming')) = 1, 'kommende ting kan ses');
select t.ok((select show_title from items_feed('upcoming', 'bolig')) = 'Lørdagsshow med lamper', 'kommende ting i en kategori');
select t.ok((select count(*) from items_feed('for_sale', null, 50) where id = '20000000-0000-0000-0000-000000000002') = 0, 'en solgt ting er ikke længere til salg');
insert into reminders (user_id, show_id) values (auth.uid(), '10000000-0000-0000-0000-000000000007');
insert into reminders (user_id, show_id, item_id) values (auth.uid(), '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000006');
select t.throws($$insert into reminders (user_id, show_id) values (auth.uid(), '10000000-0000-0000-0000-000000000007')$$, 'duplicate key');
select t.throws($$insert into reminders (user_id, show_id) values (auth.uid(), '10000000-0000-0000-0000-000000000001')$$, 'row-level security');
select t.throws($$insert into reminders (user_id, show_id) values ('00000000-0000-0000-0000-00000000000c', '10000000-0000-0000-0000-000000000007')$$, 'row-level security');
select t.ok((select count(*) from reminders) = 2, 'Liva kan se sine påmindelser');
select t.throws($$select * from reminder_recipients('10000000-0000-0000-0000-000000000007')$$, 'permission denied');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.throws($$select buy_now('20000000-0000-0000-0000-000000000002')$$, 'en anden nåede');
select t.ok((select count(*) from reminders) = 0, 'andre kan ikke se Livas påmindelser');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select cancel_reservation((select id from sales where item_id = '20000000-0000-0000-0000-000000000002' and status = 'reserved'));
select t.ok((select for_sale and status = 'unsold' from items where id = '20000000-0000-0000-0000-000000000002'), 'et annulleret køb kommer til salg igen');
reset role;
select t.ok((select description from items where id = '20000000-0000-0000-0000-000000000006') = 'Original fra 70erne, lille hak i kanten.', 'andre kan ikke rette tingen');
select t.ok((select email = 'Liva.K@gmail.com' and items = array['Le Klint-lampe'] from reminder_recipients('10000000-0000-0000-0000-000000000007')), 'serveren ved, hvem der skal have besked');
set role anon;
select t.ok((select count(*) from items_feed('for_sale', null, 50)) >= 2, 'alle kan se ting til salg');
select t.throws($$insert into reminders (user_id, show_id) values (null, '10000000-0000-0000-0000-000000000007')$$, 'permission denied');
reset role;

-- ── Budsalg: start, bud i trin, +10 sekunder, vinder, ingen bud ─────────────
select t.ok(bid_step(95) = 5 and bid_step(100) = 10 and bid_step(499) = 10 and bid_step(500) = 25 and bid_step(1000) = 50, 'budtrin efter pris');
select t.ok(next_bid(100, null) = 100 and next_bid(100, 100) = 110 and next_bid(80, 95) = 100, 'næste bud');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
insert into items (id, show_id, seller_id, name, price, position, sale_type) values
  ('20000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000007', auth.uid(), 'Teak-skænk', 100, 2, 'auction'),
  ('20000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000007', auth.uid(), 'Kähler-vase', 200, 3, 'auction'),
  ('20000000-0000-0000-0000-000000000019', '10000000-0000-0000-0000-000000000007', auth.uid(), 'Arne Jacobsen-stol', 50, 4, 'auction');
select t.throws($$update items set sale_type = 'bud' where id = '20000000-0000-0000-0000-000000000017'$$, 'check constraint');
select t.ok((select count(*) from items_feed('auctions')) = 3, 'kommende budsalg kan ses');
select set_show_status('10000000-0000-0000-0000-000000000007', 'live');
select present_item('20000000-0000-0000-0000-000000000017');
select t.throws($$select start_rush('20000000-0000-0000-0000-000000000017')$$, 'egen nedtælling');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$select place_bid('20000000-0000-0000-0000-000000000017', 100)$$, 'ikke startet');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.ok((select auction_ends_at > now() + interval '29 seconds' from start_auction('20000000-0000-0000-0000-000000000017')), 'budsalget kører i 30 sekunder');
select t.throws($$select start_auction('20000000-0000-0000-0000-000000000017')$$, 'allerede startet');
select t.throws($$select place_bid('20000000-0000-0000-0000-000000000017', 100)$$, 'egne ting');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$select place_bid('20000000-0000-0000-0000-000000000017', 90)$$, 'mindste bud er nu 100');
select t.ok((select high_bid = 100 and high_handle = 'liva.k' and bid_count = 1 from place_bid('20000000-0000-0000-0000-000000000017', 100)), 'Liva byder startprisen');
select t.throws($$select place_bid('20000000-0000-0000-0000-000000000017', 110)$$, 'allerede det højeste bud');
select t.throws($$select snup('20000000-0000-0000-0000-000000000017')$$, 'på budsalg');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.throws($$select place_bid('20000000-0000-0000-0000-000000000017', 100)$$, 'mindste bud er nu 110');
select t.ok((select high_bid = 110 and high_handle = 'olesnup' from place_bid('20000000-0000-0000-0000-000000000017', 110)), 'Ole byder over');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.throws($$select present_item('20000000-0000-0000-0000-000000000018')$$, 'Vent, til budsalget er slut');
reset role;
update items set auction_ends_at = now() + interval '3 seconds' where id = '20000000-0000-0000-0000-000000000017';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.ok((select auction_ends_at > now() + interval '9 seconds' from place_bid('20000000-0000-0000-0000-000000000017', 120)), 'et sent bud giver 10 sekunder ekstra');
select t.ok((select count(*) from bids) = 2, 'Liva kan se sine egne bud');
select t.ok((select status from close_auction('20000000-0000-0000-0000-000000000017')) = 'live', 'budsalget lukker ikke før tid');
reset role;
update items set auction_ends_at = now() - interval '1 second' where id = '20000000-0000-0000-0000-000000000017';
set role anon;
select set_config('request.jwt.claims', '', false);
select t.ok((select status from close_auction('20000000-0000-0000-0000-000000000017')) = 'sold', 'budsalget lukker, når tiden er gået');
select t.ok((select status from close_auction('20000000-0000-0000-0000-000000000017')) = 'sold', 'at lukke igen gør ingenting');
select t.throws($$select place_bid('20000000-0000-0000-0000-000000000017', 130)$$, 'permission denied');
reset role;
select t.ok((select count(*) from sales where item_id = '20000000-0000-0000-0000-000000000017' and buyer_id = '00000000-0000-0000-0000-00000000000b' and price = 120 and status = 'reserved') = 1, 'vinderen får tingen i sin kurv til sit bud');
select t.ok((select count(*) from messages where body = 'liva.k vandt Teak-skænk for 120 kr') = 1, 'vinderen står i chatten');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.ok((select count(*) from bids) = 3, 'sælgeren kan se alle bud på sine ting');
select present_item('20000000-0000-0000-0000-000000000018');
select start_auction('20000000-0000-0000-0000-000000000018');
reset role;
update items set auction_ends_at = now() - interval '1 second' where id = '20000000-0000-0000-0000-000000000018';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select present_item('20000000-0000-0000-0000-000000000019');
select t.ok((select status from items where id = '20000000-0000-0000-0000-000000000018') = 'unsold', 'ingen bud: tingen er usolgt');
select start_auction('20000000-0000-0000-0000-000000000019');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select place_bid('20000000-0000-0000-0000-000000000019', 50);
select t.ok((select count(*) from items_feed('auctions') where id = '20000000-0000-0000-0000-000000000019') = 1, 'budsalg, der kører, er med i listen');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select set_show_status('10000000-0000-0000-0000-000000000007', 'ended');
reset role;
select t.ok((select status from items where id = '20000000-0000-0000-0000-000000000019') = 'sold', 'showet slutter: det højeste bud vinder');
select t.ok((select buyer_id = '00000000-0000-0000-0000-00000000000c' and price = 50 from sales where item_id = '20000000-0000-0000-0000-000000000019' and status = 'reserved'), 'Ole får stolen til 50 kr');
select t.ok((select for_sale and status = 'unsold' and price = 200 from items where id = '20000000-0000-0000-0000-000000000018'), 'uden bud kommer tingen til salg til startprisen');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.ok((select status from buy_now('20000000-0000-0000-0000-000000000018')) = 'sold', 'og kan købes med Køb nu');
reset role;

select t.ok((select count(*) from pg_publication_tables where pubname = 'supabase_realtime') = 4, 'realtime er slået til for shows, ting, chat og snup');
\echo 'Alle tests bestået'
