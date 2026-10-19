-- Opsætning til kapløbstesten: et nyt live-show med én ting, der vises frem.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a"}', false);
insert into shows (id, seller_id, title) values ('10000000-0000-0000-0000-000000000003', auth.uid(), 'Kapløb');
insert into items (id, show_id, seller_id, name, price) values ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003', auth.uid(), 'Teaklampe', 400);
select status from set_show_status('10000000-0000-0000-0000-000000000003', 'live');
select status from present_item('20000000-0000-0000-0000-000000000009');
