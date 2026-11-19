-- Ekstra til testmiljøet oven på repoets supabase_stub.sql: en login-rolle til PostgREST,
-- og de kolonner og rettigheder den falske Supabase (fakesb) bruger.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login noinherit password 'qa';
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;

alter table auth.users add column if not exists created_at timestamptz not null default now();
create unique index if not exists users_email_key on auth.users (lower(email));
grant usage on schema auth to service_role;
grant all on auth.users to service_role;

alter table storage.objects add column if not exists created_at timestamptz not null default now();
alter table storage.objects add column if not exists metadata jsonb;
create unique index if not exists objects_bucket_name on storage.objects (bucket_id, name);
grant usage on schema storage to service_role;
grant all on storage.objects, storage.buckets to service_role;
grant select on storage.objects to anon;
