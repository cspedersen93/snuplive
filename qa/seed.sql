-- Testbrugere: Maja (sælger), Liva og Ole (købere) og en admin. Samme id'er som i repoets tests.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'maja@mail.dk'),
  ('00000000-0000-0000-0000-00000000000b', 'liva.k@gmail.com'),
  ('00000000-0000-0000-0000-00000000000c', 'ole@firma.dk'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@snuplive.dk');
update profiles set is_seller = true, seller_type = 'private', seller_terms_at = now(), display_name = 'Majas garderobe', area = 'København'
  where id = '00000000-0000-0000-0000-00000000000a';
update profiles set display_name = 'Liva' where id = '00000000-0000-0000-0000-00000000000b';
insert into settings (key, value) values ('site_open', 'true') on conflict (key) do update set value = excluded.value;
