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
  values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Sommerkjoler og strik', 'toej', now() + interval '1 hour');
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

select t.ok((select count(*) from pg_publication_tables where pubname = 'supabase_realtime') = 4, 'realtime er slået til for shows, ting, chat og snup');
\echo 'Alle tests bestået'
