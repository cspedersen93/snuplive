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
select t.ok((select handle from profiles where id = '00000000-0000-0000-0000-00000000000e') = 'bruger', 'for kort brugernavn bliver "bruger"');

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
select t.throws($$update profiles set is_seller = true where id = auth.uid()$$, 'permission denied');
select become_seller('private');
update profiles set handle = 'majasgarderobe', display_name = 'Maja', area = 'Nørrebro' where id = auth.uid();
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
select t.ok((select body from messages where kind = 'event' order by id desc limit 1) = 'liva.k købte Blomstret slå-om-kjole for 150 kr', 'købet bliver annonceret i chatten');
select t.ok((select user_id is null from messages where kind = 'event' order by id desc limit 1), 'hændelsen er ikke knyttet til Livas id');

-- Ole kommer for sent
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.throws($$select snup('20000000-0000-0000-0000-000000000001')$$, 'en anden nåede');
select t.ok((select count(*) from sales) = 0, 'Ole kan ikke se andres snup');
select t.throws($$select snup('20000000-0000-0000-0000-000000000002')$$, 'ikke købes lige nu');

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

-- ── Lancering: sælgertype, bedømmelser, anmeldelser, fjernede ting og DAC7 ───
select t.ok((select seller_type = 'private' and seller_terms_at is not null from profiles where handle = 'majasgarderobe'), 'Maja er privat sælger og har accepteret vilkårene');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e"}', false);
select t.throws($$select become_seller('business')$$, 'firmanavn');
select t.throws($$select become_seller('business', 'Genbrug ApS', '1234')$$, '8 cifre');
select t.throws($$select become_seller('firma')$$, 'privatperson eller virksomhed');
select t.ok((select is_seller and business_cvr = '12345678' from become_seller('business', 'Genbrug ApS', '12 34 56 78')), 'en butik bliver erhvervssælger med CVR');
select t.throws($$update profiles set seller_type = 'private' where id = auth.uid() returning 1$$, 'permission denied');
reset role;
-- Livas første ordre bliver afsluttet. Så kan hun bedømme Maja.
update orders set status = 'completed', completed_at = now() where id = '30000000-0000-0000-0000-000000000001';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$select rate_seller('30000000-0000-0000-0000-000000000002', 5)$$, 'når du har fået');
select t.throws($$select rate_seller('30000000-0000-0000-0000-000000000001', 6)$$, 'mellem 1 og 5');
select t.throws($$insert into ratings (order_id, seller_id, buyer_id, stars) values ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', auth.uid(), 5)$$, 'permission denied');
select t.ok((select stars from rate_seller('30000000-0000-0000-0000-000000000001', 4, '  Fin kjole, hurtig levering  ')) = 4, 'Liva bedømmer Maja');
select t.throws($$select rate_seller('30000000-0000-0000-0000-000000000001', 5)$$, 'allerede bedømt');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.throws($$select rate_seller('30000000-0000-0000-0000-000000000001', 1)$$, 'findes ikke');
select t.throws($$select * from reports$$, 'permission denied');
select t.throws($$insert into reports (target_type, target_id, reason) values ('item', gen_random_uuid(), 'andet')$$, 'permission denied');
reset role;
select t.ok((select rating_avg = 4.0 and rating_count = 1 from profiles where handle = 'majasgarderobe'), 'gennemsnittet står på Majas profil');
set role anon;
select set_config('request.jwt.claims', '', false);
select t.ok((select comment = 'Fin kjole, hurtig levering' from ratings), 'alle kan læse bedømmelser');
select t.throws($$select * from admin_dac7(2026)$$, 'permission denied');
reset role;
update items set removed_at = now() where id = '20000000-0000-0000-0000-000000000002';
select t.ok((select count(*) from items_feed('for_sale', null, 100) where id = '20000000-0000-0000-0000-000000000002') = 0, 'en fjernet ting er ikke med i listerne');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.throws($$select buy_now('20000000-0000-0000-0000-000000000002')$$, 'ikke til salg');
reset role;
select t.ok((select sales = 1 and amount = 250 and seller_type = 'private' from admin_dac7(extract(year from now())::int) where handle = 'majasgarderobe'), 'listen til Skattestyrelsen har Majas salg');
select t.ok((select count(*) from admin_dac7(extract(year from now())::int - 1)) = 0, 'sidste år er tomt');
select t.ok(has_function_privilege('service_role', 'public.admin_dac7(int)', 'execute') and not has_function_privilege('authenticated', 'public.admin_dac7(int)', 'execute'), 'kun serveren kan hente listen');

-- Anmeldelser bliver afgjort på /admin/anmeldelser.
insert into shows (id, seller_id, title, category, starts_at) values ('10000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-00000000000e', 'Butikkens show', 'bolig', now() + interval '1 day');
insert into items (id, show_id, seller_id, name, price, position) values
  ('20000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-00000000000e', 'Taske med falsk logo', 300, 1),
  ('20000000-0000-0000-0000-000000000032', '10000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-00000000000e', 'Bordlampe', 200, 2);
insert into reports (id, target_type, target_id, reason, reporter_email) values
  ('40000000-0000-0000-0000-000000000001', 'item', '20000000-0000-0000-0000-000000000031', 'falsk', 'liva@example.dk'),
  ('40000000-0000-0000-0000-000000000002', 'item', '20000000-0000-0000-0000-000000000031', 'falsk', null),
  ('40000000-0000-0000-0000-000000000003', 'show', '10000000-0000-0000-0000-000000000031', 'kraenkende', null),
  ('40000000-0000-0000-0000-000000000004', 'profile', '00000000-0000-0000-0000-00000000000e', 'andet', null),
  ('40000000-0000-0000-0000-000000000005', 'profile', '00000000-0000-0000-0000-00000000000e', 'ulovlig', null);
select t.throws($$select * from admin_moderate('40000000-0000-0000-0000-000000000001', 'remove')$$, 'hvorfor');
select t.throws($$select * from admin_moderate('40000000-0000-0000-0000-000000000001', 'slet', 'x')$$, 'Ukendt handling');
select t.ok((select owner_id = '00000000-0000-0000-0000-00000000000e' and reporter_email = 'liva@example.dk' from admin_moderate('40000000-0000-0000-0000-000000000001', 'remove', 'Kopivarer må ikke sælges')), 'en anmeldt ting bliver fjernet, og vi ved, hvem der skal have besked');
select t.ok((select removed_at is not null and not for_sale from items where id = '20000000-0000-0000-0000-000000000031'), 'tingen er fjernet');
select t.ok((select status = 'removed' and decision = 'Kopivarer må ikke sælges' from reports where id = '40000000-0000-0000-0000-000000000002'), 'en anden anmeldelse af samme ting bliver afgjort samtidig');
select t.throws($$select * from admin_moderate('40000000-0000-0000-0000-000000000001', 'reject')$$, 'allerede afgjort');
select t.ok((select count(*) from items_feed('upcoming') where show_id = '10000000-0000-0000-0000-000000000031') = 1, 'resten af showet er stadig med');
select t.ok((select count(*) from admin_moderate('40000000-0000-0000-0000-000000000003', 'remove', 'Titlen er krænkende')) = 1, 'et show kan fjernes');
select t.ok((select removed_at is not null and status = 'ended' from shows where id = '10000000-0000-0000-0000-000000000031'), 'det fjernede show er stoppet');
select t.ok((select count(*) from items_feed('upcoming') where show_id = '10000000-0000-0000-0000-000000000031') = 0, 'tingene i et fjernet show er ikke med i listerne');
select t.ok((select owner_id from admin_moderate('40000000-0000-0000-0000-000000000004', 'reject')) = '00000000-0000-0000-0000-00000000000e', 'en anmeldelse kan afvises');
select t.ok((select is_seller from profiles where id = '00000000-0000-0000-0000-00000000000e') and (select status from reports where id = '40000000-0000-0000-0000-000000000005') = 'rejected', 'en afvist anmeldelse ændrer intet og lukker de andre af samme profil');
insert into reports (id, target_type, target_id, reason) values ('40000000-0000-0000-0000-000000000006', 'profile', '00000000-0000-0000-0000-00000000000e', 'ulovlig');
select * from admin_moderate('40000000-0000-0000-0000-000000000006', 'remove', 'Sælger ulovlige ting');
select t.ok((select not is_seller from profiles where id = '00000000-0000-0000-0000-00000000000e'), 'en sælgerkonto kan lukkes');
select t.ok(has_function_privilege('service_role', 'public.admin_moderate(uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.admin_moderate(uuid, text, text)', 'execute')
  and not has_function_privilege('anon', 'public.admin_moderate(uuid, text, text)', 'execute'), 'kun serveren kan afgøre anmeldelser');

-- ── Inaktive shows lukker af sig selv efter 15 minutter uden livstegn fra studiet ──
select t.ok((select heartbeat_at is not null from shows where id = '10000000-0000-0000-0000-000000000001'), 'Gå live sætter det første livstegn');
insert into shows (id, seller_id, title, category, status, started_at, heartbeat_at) values
  ('10000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-00000000000c', 'Glemt show', 'andet', 'live', now() - interval '1 day', now() - interval '20 minutes'),
  ('10000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-00000000000b', 'Aktivt show', 'andet', 'live', now() - interval '1 hour', now() - interval '20 minutes');
insert into items (id, show_id, seller_id, name, price, position, status) values ('20000000-0000-0000-0000-000000000041', '10000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-00000000000c', 'Messinglampe', 100, 1, 'queued');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.ok((select show_heartbeat('10000000-0000-0000-0000-000000000042')), 'sælgeren sender et livstegn');
select t.ok(not (select show_heartbeat('10000000-0000-0000-0000-000000000041')), 'man kan ikke sende livstegn for en andens show');
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);
select t.throws($$select show_heartbeat('10000000-0000-0000-0000-000000000042')$$, 'permission denied');
select t.ok((select end_stale_shows()) = 1, 'et show uden livstegn i 15 minutter bliver lukket');
reset role;
select t.ok((select status = 'ended' and ended_at is not null and current_item_id is null from shows where id = '10000000-0000-0000-0000-000000000041'), 'det glemte show er slut');
select t.ok((select status = 'unsold' and for_sale from items where id = '20000000-0000-0000-0000-000000000041'), 'tingene fra det glemte show kommer til salg');
select t.ok((select count(*) from messages where show_id = '10000000-0000-0000-0000-000000000041' and body like 'Showet er slut, fordi%') = 1, 'chatten fortæller, hvorfor showet sluttede');
select t.ok((select status from shows where id = '10000000-0000-0000-0000-000000000042') = 'live', 'et show med livstegn er stadig live');
select t.ok((select end_stale_shows()) = 0, 'intet at lukke anden gang');
select _end_show('10000000-0000-0000-0000-000000000042', 'Testen er slut');

-- ── MitID: bekræftelse af sælgere og krav om MitID for at gå live ──
select t.ok(not mitid_required(), 'MitID-kravet er slået fra fra start');
select t.ok((select admin_set_mitid('00000000-0000-0000-0000-00000000000a', 'hash-maja', 'Maja Hansen', '1990-04-01')) = 'ok', 'Maja bekræfter sig med MitID');
select t.ok((select admin_set_mitid('00000000-0000-0000-0000-00000000000b', 'hash-maja', 'Maja Hansen', '1990-04-01')) = 'taken', 'det samme MitID kan ikke bruges på en anden konto');
select t.ok((select admin_set_mitid('00000000-0000-0000-0000-00000000000a', 'hash-maja', 'Maja Hansen', '1990-04-01')) = 'ok', 'Maja kan bekræfte sig igen');
select t.ok((select mitid_verified_at is not null from profiles where id = '00000000-0000-0000-0000-00000000000a'), 'mærket står på Majas profil');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.throws($$update profiles set mitid_verified_at = now() where id = auth.uid() returning 1$$, 'permission denied');
select t.throws($$select admin_set_mitid(auth.uid(), 'x', 'Snyd', null)$$, 'permission denied');
select t.throws($$update settings set value = 'false' where key = 'mitid_required' returning 1$$, 'permission denied');
select t.ok((select count(*) from identity_verifications) = 0, 'andre kan ikke se Majas MitID-oplysninger');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.ok((select name from identity_verifications) = 'Maja Hansen', 'Maja kan se sine egne oplysninger');
reset role;
insert into shows (id, seller_id, title, category, starts_at) values
  ('10000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-00000000000c', 'Uden MitID', 'andet', now() + interval '1 hour'),
  ('10000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-00000000000a', 'Med MitID', 'andet', now() + interval '1 hour');
update settings set value = 'true' where key = 'mitid_required';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.throws($$select set_show_status('10000000-0000-0000-0000-000000000051', 'live')$$, 'MitID');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.ok((select status from set_show_status('10000000-0000-0000-0000-000000000052', 'live')) = 'live', 'en sælger med MitID kan gå live, når kravet er slået til');
reset role;
select _end_show('10000000-0000-0000-0000-000000000052', 'Testen er slut');
update settings set value = 'false' where key = 'mitid_required';

-- ── Kommer snart: lukket side, venteliste og testere ──
select t.ok((select value = 'false'::jsonb from settings where key = 'site_open'), 'siden er lukket, når 0012 er kørt');
insert into waitlist (email, role) values ('liva@example.dk', 'buyer');
select t.throws($$insert into waitlist (email, role) values ('liva@example.dk', 'seller')$$, 'duplicate key');
select t.throws($$insert into waitlist (email, role) values ('Liva@Example.dk', 'buyer')$$, 'check constraint');
select t.throws($$insert into waitlist (email, role) values ('ole@example.dk', 'snyder')$$, 'check constraint');
set role anon;
select set_config('request.jwt.claims', '', false);
select t.throws($$select * from waitlist$$, 'permission denied');
select t.throws($$insert into waitlist (email, role) values ('x@example.dk', 'buyer')$$, 'permission denied');
select t.throws($$select * from beta_access$$, 'permission denied');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$select * from waitlist$$, 'permission denied');
select t.throws($$insert into beta_access (email) values ('liva@example.dk')$$, 'permission denied');
select t.ok((select value = 'false'::jsonb from settings where key = 'site_open'), 'alle kan læse, om siden er åben');
reset role;

-- ── Supportchat: kun serveren, mails til admins og brugere, spamgrænser ──
set role anon;
select set_config('request.jwt.claims', '', false);
select t.throws($$select * from support_threads$$, 'permission denied');
select t.throws($$select * from support_messages$$, 'permission denied');
select t.throws($$select support_start(null, 'x@example.dk', null, '/', null, null, 'hej')$$, 'permission denied');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$select * from support_threads$$, 'permission denied');
select t.throws($$insert into support_messages (thread_id, sender, body) values (gen_random_uuid(), 'admin', 'snyd')$$, 'permission denied');
select t.throws($$select support_add(gen_random_uuid(), 'admin', null, 'Snyd', 'hej')$$, 'permission denied');
select t.throws($$select * from support_user_notices()$$, 'permission denied');
reset role;

create temp table st as
  select support_start(null, 'Gaest@Example.dk', null, '/kurv', 'Mozilla/5.0 (iPhone)', 'ip-1', '  Siden driller  ') as r;
select t.ok((select (r->>'notify')::boolean from st), 'første besked giver admins en mail');
select t.ok((select email = 'gaest@example.dk' and page = '/kurv' and admin_unread and status = 'open' from support_threads where id = (select (r->>'thread_id')::uuid from st)), 'samtalen er gemt med e-mail og side');
select t.ok((select body from support_messages where thread_id = (select (r->>'thread_id')::uuid from st)) = 'Siden driller', 'beskeden er gemt uden mellemrum');
select t.ok(not (select (support_add((select (r->>'thread_id')::uuid from st), 'user', null, null, 'Hallo?')->>'notify')::boolean), 'ingen ny mail, før admins har kigget');
update support_threads set admin_unread = false, admin_seen_at = now() where id = (select (r->>'thread_id')::uuid from st);
select t.ok((select (support_add((select (r->>'thread_id')::uuid from st), 'user', null, null, 'Er I der?')->>'notify')::boolean), 'ny mail, når admins har kigget og der kommer en ny besked');
select t.throws($$select support_add((select (r->>'thread_id')::uuid from st), 'user', null, null, '   ')$$, 'Skriv en besked');
select t.throws($$select support_add((select (r->>'thread_id')::uuid from st), 'user', null, null, repeat('x', 2001))$$, 'for lang');
select t.throws($$select support_add((select (r->>'thread_id')::uuid from st), 'robot', null, null, 'hej')$$, 'Ukendt afsender');

-- Svar fra SnupLive. Brugeren har lige skrevet, så der kommer ingen mail med det samme.
select support_add((select (r->>'thread_id')::uuid from st), 'admin', '00000000-0000-0000-0000-00000000000a', 'Maja', 'Vi kigger på det');
select t.ok((select not admin_unread and last_admin_at is not null from support_threads where id = (select (r->>'thread_id')::uuid from st)), 'svar fra admin: samtalen er læst');
select t.ok((select count(*) from support_user_notices((select (r->>'thread_id')::uuid from st))) = 0, 'ingen mail, mens brugeren har chatten åben');
-- Brugeren er gået: mail med det samme.
update support_threads set user_seen_at = now() - interval '10 minutes' where id = (select (r->>'thread_id')::uuid from st);
select t.ok((select count(*) from support_user_notices((select (r->>'thread_id')::uuid from st)) where email = 'gaest@example.dk') = 1, 'mail til brugeren, når de er gået');
select support_add((select (r->>'thread_id')::uuid from st), 'admin', null, 'Maja', 'Nu virker det');
select t.ok((select count(*) from support_user_notices((select (r->>'thread_id')::uuid from st))) = 0, 'højst én mail hvert 5. minut');
select t.ok((select count(*) from support_user_notices()) = 0, 'det sidste svar sendes ikke, før det er 2 minutter gammelt');
update support_threads set user_notified_at = now() - interval '6 minutes', last_admin_at = now() - interval '3 minutes' where id = (select (r->>'thread_id')::uuid from st);
select t.ok((select count(*) from support_user_notices() where since between now() - interval '7 minutes' and now() - interval '5 minutes') = 1, 'det daglige tjek sender det næste svar med de nye beskeder');
select t.ok((select count(*) from support_user_notices()) = 0, 'det samme svar sendes kun én gang');

-- Lukket samtale åbner igen, når brugeren skriver.
update support_threads set status = 'closed', closed_at = now() where id = (select (r->>'thread_id')::uuid from st);
select support_add((select (r->>'thread_id')::uuid from st), 'user', null, null, 'Én ting mere');
select t.ok((select status = 'open' and closed_at is null from support_threads where id = (select (r->>'thread_id')::uuid from st)), 'en lukket samtale åbner igen');

-- Spamgrænser.
do $$
declare v uuid := (select (r->>'thread_id')::uuid from st);
begin
  for i in 1..11 loop perform public.support_add(v, 'user', null, null, 'spam ' || i); end loop;
end $$;
select t.throws($$select support_add((select (r->>'thread_id')::uuid from st), 'user', null, null, 'nummer 16')$$, 'mange beskeder');
select support_add((select (r->>'thread_id')::uuid from st), 'admin', null, 'Maja', 'Admins kan altid svare');
select support_start(null, 'a@example.dk', null, '/', null, 'ip-1', 'hej') from generate_series(1, 4);
select t.throws($$select support_start(null, 'b@example.dk', null, '/', null, 'ip-1', 'hej')$$, 'For mange nye samtaler');
select t.ok((select (support_start(null, 'b@example.dk', null, '/', null, 'ip-2', 'hej')->>'notify')::boolean), 'en anden kan stadig skrive');
select t.throws($$select support_start(null, 'b@example.dk', null, '/', null, 'ip-3', '')$$, 'Skriv en besked');

-- Logget ind: samtalen hører til kontoen og slettes med den.
select support_start('00000000-0000-0000-0000-00000000000e', 'å@x.dk', 'bruger', '/konto', null, null, 'Hjælp');
select t.ok((select count(*) from support_threads where user_id = '00000000-0000-0000-0000-00000000000e') = 1, 'samtalen hører til kontoen');

-- Oprydning.
update support_threads set created_at = now() - interval '3 days' where ip_hash = 'ip-2';
insert into support_threads (email, last_message_at) values ('gammel@example.dk', now() - interval '13 months');
select t.ok((select support_cleanup()) = 1, 'samtaler slettes 12 måneder efter sidste besked');
select t.ok((select count(*) from support_threads where ip_hash = 'ip-2') = 0, 'spam-stemplet slettes efter to døgn');
delete from support_threads where id = (select (r->>'thread_id')::uuid from st);
select t.ok((select count(*) from support_messages where thread_id = (select (r->>'thread_id')::uuid from st)) = 0, 'beskederne slettes med samtalen');

-- ── Klip af tingene fra live-showet ──
insert into items (id, show_id, seller_id, name, price) values
  ('20000000-0000-0000-0000-000000000091', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Klip-test', 100),
  ('20000000-0000-0000-0000-000000000092', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Klip-solgt', 100),
  ('20000000-0000-0000-0000-000000000093', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'Klip-nyligt-solgt', 100);
set role anon;
select set_config('request.jwt.claims', '', false);
select t.throws($$select set_item_clip('20000000-0000-0000-0000-000000000091', 'x')$$, 'permission denied');
reset role;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.ok((select set_item_clip('20000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000091/clip-abc.mp4')) is null, 'sælgeren gemmer et klip på sin ting');
select t.ok((select set_item_clip('20000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000091/clip-def.webm')) like '%clip-abc.mp4', 'et nyt klip giver det gamle tilbage, så filen kan slettes');
select t.throws($$select set_item_clip('20000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-00000000000b/20000000-0000-0000-0000-000000000091/clip-x.mp4')$$, 'check constraint');
select t.throws($$select set_item_clip('20000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000091/clip-x.mov')$$, 'check constraint');
select t.throws($$select * from clips_to_clean()$$, 'permission denied');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$select set_item_clip('20000000-0000-0000-0000-000000000091', '00000000-0000-0000-0000-00000000000b/20000000-0000-0000-0000-000000000091/clip-x.mp4')$$, 'findes ikke');
select t.throws($$select clear_item_clip('20000000-0000-0000-0000-000000000091')$$, 'findes ikke');
reset role;
select t.ok((select clip_path from items_feed('upcoming', null, 100, 0, '00000000-0000-0000-0000-00000000000a', null) where id = '20000000-0000-0000-0000-000000000091') like '%clip-def.webm'
            or not exists (select 1 from items_feed('upcoming', null, 100, 0, '00000000-0000-0000-0000-00000000000a', null) where id = '20000000-0000-0000-0000-000000000091'),
            'listerne har klippet med');
update items set clip_path = '00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000092/clip-old.mp4', status = 'sold', sold_at = now() - interval '20 days' where id = '20000000-0000-0000-0000-000000000092';
update items set clip_path = '00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000093/clip-new.mp4', status = 'sold', sold_at = now() - interval '2 days' where id = '20000000-0000-0000-0000-000000000093';
select t.ok((select array_agg(p) from clips_to_clean() p) = array['00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-000000000092/clip-old.mp4'], 'klip af ting solgt for mere end 14 dage siden ryddes op');
select t.ok((select clip_path is null from items where id = '20000000-0000-0000-0000-000000000092') and (select clip_path is not null from items where id = '20000000-0000-0000-0000-000000000093'), 'et nyligt solgt klip bliver');
update items set removed_at = now() where id = '20000000-0000-0000-0000-000000000091';
select t.ok((select count(*) from clips_to_clean()) = 1, 'klip af en fjernet ting ryddes op');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.ok((select clear_item_clip('20000000-0000-0000-0000-000000000093')) like '%clip-new.mp4', 'sælgeren kan fjerne sit klip');
reset role;
select t.ok((select clip_path is null from items where id = '20000000-0000-0000-0000-000000000093'), 'klippet er væk fra tingen');
delete from items where id in ('20000000-0000-0000-0000-000000000091', '20000000-0000-0000-0000-000000000092', '20000000-0000-0000-0000-000000000093');

-- ── Følg sælgere: kun sine egne, antal på profilen, blokering, morgenmail ──
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000f1', 'ikke.saelger@mail.dk');
update profiles set follower_count = 0 where id = '00000000-0000-0000-0000-00000000000a';
delete from follows;
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
insert into follows (follower_id, seller_id) values (auth.uid(), '00000000-0000-0000-0000-00000000000a');
select t.ok((select count(*) from follows) = 1, 'Liva følger Maja');
select t.throws($$insert into follows (follower_id, seller_id) values (auth.uid(), '00000000-0000-0000-0000-00000000000a')$$, 'duplicate key');
select t.throws($$insert into follows (follower_id, seller_id) values (auth.uid(), auth.uid())$$, 'row-level security');
select t.throws($$insert into follows (follower_id, seller_id) values (auth.uid(), '00000000-0000-0000-0000-0000000000f1')$$, 'row-level security');
select t.throws($$insert into follows (follower_id, seller_id) values ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a')$$, 'row-level security');
select t.throws($$update profiles set follower_count = 999 where id = auth.uid()$$, 'permission denied');
select t.throws($$select * from follower_recipients('00000000-0000-0000-0000-00000000000a')$$, 'permission denied');
select t.throws($$select * from follow_digest()$$, 'permission denied');
select t.throws($$insert into push_subscriptions (user_id, endpoint, p256dh, auth) values (auth.uid(), 'https://fcm.googleapis.com/x', repeat('a', 40), repeat('b', 16))$$, 'permission denied');
select t.throws($$select * from app_secrets$$, 'permission denied');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.ok((select count(*) from follows) = 0, 'Ole kan ikke se, hvem Liva følger');
insert into follows (follower_id, seller_id) values (auth.uid(), '00000000-0000-0000-0000-00000000000a');
reset role;
select t.ok((select follower_count from profiles where id = '00000000-0000-0000-0000-00000000000a') = 2, 'Maja har 2 følgere');
select t.ok((select count(*) from follower_recipients('00000000-0000-0000-0000-00000000000a')) = 2, 'begge følgere får besked, når Maja går live');
-- Maja blokerer Ole: han følger hende ikke længere
insert into seller_blocks (seller_id, user_id) values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c') on conflict do nothing;
select t.ok((select follower_count from profiles where id = '00000000-0000-0000-0000-00000000000a') = 1, 'en blokeret bruger følger ikke længere');
select t.ok((select array_agg(email) from follower_recipients('00000000-0000-0000-0000-00000000000a')) = array['Liva.K@gmail.com'], 'kun Liva får besked');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.throws($$insert into follows (follower_id, seller_id) values (auth.uid(), '00000000-0000-0000-0000-00000000000a')$$, 'blokeret');
reset role;
delete from seller_blocks where seller_id = '00000000-0000-0000-0000-00000000000a' and user_id = '00000000-0000-0000-0000-00000000000c';
-- Morgenmail: shows inden for et døgn, kun én gang
insert into shows (id, seller_id, title, category, status, starts_at) values
  ('10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'Morgenshow', 'dametoej', 'planned', now() + interval '3 hours'),
  ('10000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000a', 'Senere show', 'dametoej', 'planned', now() + interval '30 hours');
insert into items (id, show_id, seller_id, name, price, position) values
  ('20000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'Kjole', 100, 1);
create temp table digest as select * from follow_digest();
select t.ok((select count(*) from digest where show_id = '10000000-0000-0000-0000-0000000000f1') = 1
            and (select item_count from digest where show_id = '10000000-0000-0000-0000-0000000000f1') = 1
            and (select email from digest where show_id = '10000000-0000-0000-0000-0000000000f1') = 'Liva.K@gmail.com', 'morgenmailen har dagens show til Liva');
select t.ok(not exists (select 1 from digest where show_id = '10000000-0000-0000-0000-0000000000f2'), 'et show om mere end et døgn kommer ikke med endnu');
select t.ok(not exists (select 1 from follow_digest() where show_id = '10000000-0000-0000-0000-0000000000f1'), 'det samme show kommer kun med én gang');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
delete from follows where seller_id = '00000000-0000-0000-0000-00000000000a';
reset role;
select t.ok((select follower_count from profiles where id = '00000000-0000-0000-0000-00000000000a') = 0, 'følgere tælles ned, når man stopper med at følge');
delete from shows where id in ('10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000f2');
drop table digest;

-- ── Luksus, Skønhed og ægthedstjek ──
select t.ok(luxury_brand('LV Neverfull') and luxury_brand('Taske fra HERMÈS') and luxury_brand('Gucci-bælte') and luxury_brand('louis  vuitton'), 'kendte mærker genkendes');
select t.ok(not luxury_brand('Olivia kjole') and not luxury_brand('Omegaman') and not luxury_brand('Vintage lampe'), 'almindelige ord tæller ikke');
insert into shows (id, seller_id, title, category, status, starts_at, started_at, ended_at) values
  ('10000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-00000000000a', 'Tasker og smykker', 'luksus', 'ended', now() - interval '2 hours', now() - interval '2 hours', now() - interval '1 hour'),
  ('10000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-00000000000a', 'Tøj', 'dametoej', 'ended', now() - interval '2 hours', now() - interval '2 hours', now() - interval '1 hour'),
  ('10000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-00000000000a', 'Parfume', 'skoenhed', 'planned', now() + interval '2 hours', null, null);
insert into items (id, show_id, seller_id, name, condition, price, position, status, for_sale) values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-00000000000a', 'Louis Vuitton Neverfull', 'God stand', 6000, 1, 'unsold', true),
  ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-00000000000a', 'Lædertaske', 'God stand', 500, 2, 'unsold', true),
  ('20000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-00000000000a', 'Halskæde i guld', 'Som ny', 1500, 3, 'unsold', true),
  ('20000000-0000-0000-0000-0000000000a4', '10000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-00000000000a', 'Gucci bælte', 'Brugt', 300, 1, 'unsold', true),
  ('20000000-0000-0000-0000-0000000000a5', '10000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-00000000000a', 'Parfume 50 ml', 'Brugt', 300, 1, 'queued', false);
select t.ok((select auth_required from items where id = '20000000-0000-0000-0000-0000000000a1')
            and (select auth_required from items where id = '20000000-0000-0000-0000-0000000000a3')
            and (select auth_required from items where id = '20000000-0000-0000-0000-0000000000a4')
            and not (select auth_required from items where id = '20000000-0000-0000-0000-0000000000a2'), 'mærker og luksus over 1.000 kr skal tjekkes, en billig lædertaske ikke');
select t.ok((select condition from items where id = '20000000-0000-0000-0000-0000000000a5') = 'Ny og uåbnet', 'skønhed er altid ny og uåbnet');
select t.throws($$update items set status = 'live' where id = '20000000-0000-0000-0000-0000000000a4'$$, 'ægthedstjek');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$select buy_now('20000000-0000-0000-0000-0000000000a1')$$, 'ægthedstjek');
select t.ok((select status from buy_now('20000000-0000-0000-0000-0000000000a2')) = 'sold', 'en ting, der ikke skal tjekkes, kan købes som før');
select t.throws($$select submit_auth('20000000-0000-0000-0000-0000000000a1', array['x/y/auth-a.jpg','x/y/auth-b.jpg','x/y/auth-c.jpg','x/y/auth-d.jpg'])$$, 'findes ikke');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select t.throws($$update items set auth_status = 'approved' where id = '20000000-0000-0000-0000-0000000000a1'$$, 'permission denied');
select t.throws($$select submit_auth('20000000-0000-0000-0000-0000000000a1', array['00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-0000000000a1/auth-a.jpg'])$$, 'mindst 4');
select t.throws($$select submit_auth('20000000-0000-0000-0000-0000000000a1', array['00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-0000000000a1/auth-a.jpg','00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-0000000000a1/auth-b.jpg','00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-0000000000a1/auth-c.jpg','00000000-0000-0000-0000-00000000000b/x/auth-d.jpg'])$$, 'kunne ikke gemmes');
select t.throws($$select submit_auth('20000000-0000-0000-0000-0000000000a2', array['a','b','c','d'])$$, 'skal ikke');
select t.ok((select auth_status from submit_auth('20000000-0000-0000-0000-0000000000a1', array['00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-0000000000a1/auth-a.jpg','00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-0000000000a1/auth-b.jpg','00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-0000000000a1/auth-c.jpg','00000000-0000-0000-0000-00000000000a/20000000-0000-0000-0000-0000000000a1/auth-d.jpg'])) = 'pending', 'sælgeren sender 4 billeder til tjek');
reset role;
update items set auth_status = 'approved', auth_at = now(), auth_by = '00000000-0000-0000-0000-00000000000a' where id in ('20000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a3');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.ok((select status from buy_now('20000000-0000-0000-0000-0000000000a1')) = 'sold', 'efter godkendelsen kan tasken købes');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
update items set name = 'Halskæde i sølv' where id = '20000000-0000-0000-0000-0000000000a3';
reset role;
select t.ok((select auth_status is null from items where id = '20000000-0000-0000-0000-0000000000a3'), 'skifter sælgeren navn efter godkendelsen, skal tingen tjekkes igen');
select t.ok((select pg_get_constraintdef(oid) like '%counterfeit%' from pg_constraint where conname = 'order_issues_reason_check'), 'Falsk vare kan meldes som problem');
delete from sales where item_id in ('20000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-0000000000a2');
delete from shows where id in ('10000000-0000-0000-0000-0000000000f4', '10000000-0000-0000-0000-0000000000f5', '10000000-0000-0000-0000-0000000000f6');

-- ── Mine shows: skjul afsluttede shows, slet planlagte ──
insert into shows (id, seller_id, title, category, status, starts_at, started_at, ended_at) values
  ('10000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-00000000000a', 'Gammelt show', 'dametoej', 'ended', now() - interval '3 days', now() - interval '3 days', now() - interval '3 days'),
  ('10000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-00000000000a', 'Næste show', 'dametoej', 'planned', now() + interval '3 days', null, null);
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select set_show_hidden('10000000-0000-0000-0000-0000000000f7', true);
select t.ok((select hidden_at is not null from shows where id = '10000000-0000-0000-0000-0000000000f7'), 'et afsluttet show kan skjules');
select set_show_hidden('10000000-0000-0000-0000-0000000000f7', false);
select t.ok((select hidden_at is null from shows where id = '10000000-0000-0000-0000-0000000000f7'), 'og vises igen');
select t.throws($$select set_show_hidden('10000000-0000-0000-0000-0000000000f8', true)$$, 'Kun afsluttede');
select t.throws($$update shows set hidden_at = now() where id = '10000000-0000-0000-0000-0000000000f7'$$, 'permission denied');
delete from shows where id = '10000000-0000-0000-0000-0000000000f7';
select t.ok(exists (select 1 from shows where id = '10000000-0000-0000-0000-0000000000f7'), 'et afsluttet show kan ikke slettes');
delete from shows where id = '10000000-0000-0000-0000-0000000000f8';
select t.ok(not exists (select 1 from shows where id = '10000000-0000-0000-0000-0000000000f8'), 'et planlagt show kan slettes');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$select set_show_hidden('10000000-0000-0000-0000-0000000000f7', true)$$, 'findes ikke');
reset role;
delete from shows where id = '10000000-0000-0000-0000-0000000000f7';

-- ── Videoannoncer: sælgeren filmer tingen og sætter den til salg uden at gå live ──
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select create_video_listing('30000000-0000-0000-0000-0000000000a1', 'Strikkjole, grøn', 'M', 'Som ny', 220, 'dametoej', 'Lidt fnuller',
  array['00000000-0000-0000-0000-00000000000a/30000000-0000-0000-0000-0000000000a1/f1.jpg', '00000000-0000-0000-0000-00000000000a/30000000-0000-0000-0000-0000000000a1/f2.jpg'],
  '00000000-0000-0000-0000-00000000000a/30000000-0000-0000-0000-0000000000a1/clip-abc123.mp4');
select t.ok((select status = 'unsold' and for_sale and listed_at is not null and sale_type = 'fixed' and clip_path is not null and cardinality(images) = 2
               from items where id = '30000000-0000-0000-0000-0000000000a1'), 'videoannoncen er til salg med det samme');
select t.ok((select s.kind = 'video' and s.status = 'ended' and s.title = 'Videoannoncer' from items i join shows s on s.id = i.show_id
               where i.id = '30000000-0000-0000-0000-0000000000a1'), 'den ligger i sælgerens skjulte videoannonce-show');
select create_video_listing('30000000-0000-0000-0000-0000000000a2', 'Louis Vuitton Speedy 30', null, 'Brugt', 4500, 'luksus', null,
  array['00000000-0000-0000-0000-00000000000a/30000000-0000-0000-0000-0000000000a2/f1.jpg'],
  '00000000-0000-0000-0000-00000000000a/30000000-0000-0000-0000-0000000000a2/clip-x1.webm');
select t.ok((select count(*) from shows where seller_id = '00000000-0000-0000-0000-00000000000a' and kind = 'video') = 1, 'kun ét videoannonce-show pr. sælger');
select t.ok((select auth_required and auth_status is null from items where id = '30000000-0000-0000-0000-0000000000a2'), 'en mærketaske skal ægthedstjekkes');
select t.throws($$select create_video_listing('30000000-0000-0000-0000-0000000000a3', 'Taske', null, null, 100, 'andet', null,
  array['00000000-0000-0000-0000-00000000000a/30000000-0000-0000-0000-0000000000a3/f1.jpg'],
  '00000000-0000-0000-0000-00000000000b/30000000-0000-0000-0000-0000000000a3/clip-x1.mp4')$$, 'Videoen kunne ikke gemmes');
select t.throws($$select create_video_listing('30000000-0000-0000-0000-0000000000a3', 'Taske', null, null, 100, 'andet', null, '{}',
  '00000000-0000-0000-0000-00000000000a/30000000-0000-0000-0000-0000000000a3/clip-x1.mp4')$$, 'Vælg 1-4 billeder');
select t.throws($$select create_video_listing('30000000-0000-0000-0000-0000000000a3', 'Taske', null, null, 100, 'andet', null,
  array['andensaelger/30000000-0000-0000-0000-0000000000a3/f1.jpg'],
  '00000000-0000-0000-0000-00000000000a/30000000-0000-0000-0000-0000000000a3/clip-x1.mp4')$$, 'items_images_check');
select t.throws($$select set_show_status((select id from shows where seller_id = auth.uid() and kind = 'video'), 'live')$$, 'allerede startet eller slut');
select t.throws($$update shows set kind = 'show' where seller_id = auth.uid() and kind = 'video'$$, 'permission denied');
select t.throws($$insert into shows (seller_id, title, category, starts_at, kind) values (auth.uid(), 'Snyd', 'andet', now(), 'video')$$, 'permission denied');
-- En køber kan købe videoannoncen med Køb nu, men ikke mærketasken før den er tjekket.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$select create_video_listing('30000000-0000-0000-0000-0000000000a4', 'Bluse', null, null, 100, 'andet', null,
  array['00000000-0000-0000-0000-00000000000b/30000000-0000-0000-0000-0000000000a4/f1.jpg'],
  '00000000-0000-0000-0000-00000000000b/30000000-0000-0000-0000-0000000000a4/clip-x1.mp4')$$, 'Bliv sælger først');
select buy_now('30000000-0000-0000-0000-0000000000a1');
select t.ok((select status = 'sold' from items where id = '30000000-0000-0000-0000-0000000000a1')
            and exists (select 1 from sales where item_id = '30000000-0000-0000-0000-0000000000a1' and buyer_id = auth.uid()), 'videoannoncen kan købes med Køb nu');
select t.throws($$select buy_now('30000000-0000-0000-0000-0000000000a2')$$, 'ægthedstjek');
reset role;
-- Lukker Relived sælgeren, bliver alt, sælgeren har til salg, taget af salg.
update profiles set is_seller = false where id = '00000000-0000-0000-0000-00000000000a';
select t.ok((select count(*) from items where seller_id = '00000000-0000-0000-0000-00000000000a' and status = 'unsold' and for_sale) = 0,
            'en lukket sælger har ikke noget til salg');
update profiles set is_seller = true where id = '00000000-0000-0000-0000-00000000000a';

-- ── Gæst i showet: værten inviterer op til 2 sælgere med ──
insert into shows (id, seller_id, title, category, status, starts_at) values
  ('10000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-00000000000a', 'Fælles loppemarked', 'dametoej', 'planned', now() + interval '1 day');
-- Ole og den anden Maja er sælgere i denne del (gæsterne).
update profiles set is_seller = true where id in ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000d');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
create temp table if not exists t_code (code text);
grant all on t_code to authenticated;
insert into t_code select guest_invite('10000000-0000-0000-0000-0000000000f9');
select t.ok((select length(code) = 32 from t_code), 'værten får et invitationslink');
select t.ok((select guest_invite('10000000-0000-0000-0000-0000000000f9')) = (select code from t_code), 'det samme link, til værten laver et nyt');
select t.throws($$select guest_join((select code from t_code))$$, 'Det er dit eget show');
select t.throws($$select guest_invite('10000000-0000-0000-0000-000000000001')$$, 'Showet');
-- En køber (ikke sælger) kan ikke være gæst.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select t.throws($$select guest_join((select code from t_code))$$, 'Bliv sælger først');
select t.throws($$select * from show_invites$$, 'permission denied');
-- Ole siger ja og lægger sine ting i værtens kø.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.ok((select title = 'Fælles loppemarked' and host_handle = 'majasgarderobe' and guests = 0 and not joined from guest_invite_info((select code from t_code))), 'invitationen viser show og vært');
select t.ok(guest_join((select code from t_code)) = '10000000-0000-0000-0000-0000000000f9', 'en sælger kan sige ja');
select t.ok(is_show_guest('10000000-0000-0000-0000-0000000000f9', auth.uid()), 'og er gæst');
insert into items (id, show_id, seller_id, name, price) values
  ('30000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-0000000000f9', auth.uid(), 'Vinylplade, Kim Larsen', 150),
  ('30000000-0000-0000-0000-0000000000b2', '10000000-0000-0000-0000-0000000000f9', auth.uid(), 'Pladespiller', 600);
select t.ok((select count(*) from items where show_id = '10000000-0000-0000-0000-0000000000f9' and seller_id = auth.uid()) = 2, 'gæsten lægger ting i køen');
select t.throws($$insert into items (show_id, seller_id, name, price) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Snyd', 10)$$, 'row-level security');
select t.throws($$insert into show_guests (show_id, guest_id) values ('10000000-0000-0000-0000-000000000001', auth.uid())$$, 'permission denied');
-- Den anden Maja er gæst nummer 2. Flere kan ikke komme med.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d"}', false);
select guest_join((select code from t_code));
reset role;
update profiles set is_seller = true where id = '00000000-0000-0000-0000-00000000000e';
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000e"}', false);
select t.throws($$select guest_join((select code from t_code))$$, 'allerede 2 gæster');
reset role;
update shows set status = 'live', started_at = now() where id = '10000000-0000-0000-0000-0000000000f9';
set role authenticated;
-- Kun værten viser ting frem og starter lynrunder, også gæsternes ting.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.throws($$select present_item('30000000-0000-0000-0000-0000000000b1')$$, 'Tingen findes ikke');
select pg_sleep(1.05); -- Ole har skrevet i chatten lige før (bremse mod spam).
insert into messages (show_id, user_id, body) values ('10000000-0000-0000-0000-0000000000f9', auth.uid(), 'Hej fra Ole');
select t.ok((select from_seller from messages where show_id = '10000000-0000-0000-0000-0000000000f9' and body = 'Hej fra Ole'), 'gæstens beskeder er fremhævet som sælgerens');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select present_item('30000000-0000-0000-0000-0000000000b1');
select t.ok((select current_item_id = '30000000-0000-0000-0000-0000000000b1' from shows where id = '10000000-0000-0000-0000-0000000000f9'), 'værten viser gæstens ting frem');
select start_rush('30000000-0000-0000-0000-0000000000b1', 10);
select t.ok((select rush_ends_at is not null from items where id = '30000000-0000-0000-0000-0000000000b1'), 'værten starter en lynrunde på gæstens ting');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.throws($$select start_rush('30000000-0000-0000-0000-0000000000b1', 10)$$, 'Vis tingen frem');
-- Liva køber gæstens ting: salget (og pengene) går til gæsten.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b"}', false);
select snup('30000000-0000-0000-0000-0000000000b1');
select t.ok((select seller_id = '00000000-0000-0000-0000-00000000000c' from sales where item_id = '30000000-0000-0000-0000-0000000000b1'), 'salget af gæstens ting går til gæsten');
-- Værten tager Ole ud. Hans ting kan ikke vises, og han kan ikke komme med igen.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select guest_remove('10000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-00000000000c');
select t.throws($$select present_item('30000000-0000-0000-0000-0000000000b2')$$, 'ikke med i showet længere');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c"}', false);
select t.ok(not is_show_guest('10000000-0000-0000-0000-0000000000f9', auth.uid()), 'en gæst, der er taget ud, er ikke gæst');
select t.throws($$select guest_join((select code from t_code))$$, 'taget dig ud');
select t.throws($$select guest_remove('10000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-00000000000d')$$, 'Showet findes ikke');
-- Den anden Maja forlader showet og kan komme med igen. Et nyt link gør det gamle ugyldigt.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d"}', false);
select guest_leave('10000000-0000-0000-0000-0000000000f9');
select t.ok(not is_show_guest('10000000-0000-0000-0000-0000000000f9', auth.uid()), 'gæsten har forladt showet');
select t.ok(exists (select 1 from messages where show_id = '10000000-0000-0000-0000-0000000000f9' and kind = 'event' and body like '%har forladt showet'), 'chatten siger, at gæsten er gået');
select guest_join((select code from t_code));
select t.ok(is_show_guest('10000000-0000-0000-0000-0000000000f9', auth.uid()), 'og kan komme med igen');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
select guest_invite('10000000-0000-0000-0000-0000000000f9', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d"}', false);
select guest_leave('10000000-0000-0000-0000-0000000000f9');
select t.throws($$select guest_join((select code from t_code))$$, 'gælder ikke længere');
reset role;
delete from shows where id = '10000000-0000-0000-0000-0000000000f9';
update profiles set is_seller = false
 where id in ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000e');

-- ── Nulstil testsalg (Backoffice → Indstillinger) ──
reset role;
select t.ok((select count(*) from orders) > 0 and (select count(*) from sales) > 0 and (select count(*) from items where status = 'sold') > 0, 'der er testsalg før nulstillingen');
select t.ok(has_function_privilege('service_role', 'public.admin_reset_test_sales()', 'execute')
            and not has_function_privilege('authenticated', 'public.admin_reset_test_sales()', 'execute')
            and not has_function_privilege('anon', 'public.admin_reset_test_sales()', 'execute'), 'kun serveren kan nulstille');
update orders set stripe_session_id = 'cs_live_rigtig' where id = (select id from orders order by created_at limit 1);
select t.throws($$select admin_reset_test_sales()$$, 'rigtige betalinger');
update orders set stripe_session_id = 'cs_test_x' where stripe_session_id = 'cs_live_rigtig';
create temp table t_before as select (select count(*) from shows) s, (select count(*) from items) i, (select count(*) from profiles) p;
set role service_role;
select admin_reset_test_sales();
reset role;
select t.ok((select count(*) from orders) = 0 and (select count(*) from sales) = 0 and (select count(*) from bids) = 0
            and (select count(*) from ratings) = 0 and (select count(*) from order_issues) = 0, 'alle køb, ordrer, bud, sager og bedømmelser er slettet');
select t.ok((select count(*) from items where status = 'sold' or bid_count > 0) = 0, 'ingen ting står som solgt eller med bud');
select t.ok((select count(*) from profiles where rating_count > 0 or rating_avg is not null) = 0, 'sælgernes bedømmelser er nulstillet');
select t.ok((select s = (select count(*) from shows) and i = (select count(*) from items) and p = (select count(*) from profiles) from t_before), 'shows, ting og brugere er der stadig');
select t.ok((admin_overview(now() - interval '10 years') ->> 'gmv')::int = 0, 'omsætningen i Backoffice er 0');

-- ── Nyt navn: beskeder fra siden selv står som Relived ──
select t.ok((select count(*) from messages where user_id is null and handle = 'SnupLive') = 0, 'ingen beskeder fra "SnupLive" i chatten');
select t.ok((select count(*) from messages where user_id is null and handle = 'Relived') > 0, 'beskeder fra siden står som Relived');

select t.ok((select count(*) from pg_publication_tables where pubname = 'supabase_realtime') = 4, 'realtime er slået til for shows, ting, chat og snup');
\echo 'Alle tests bestået'
