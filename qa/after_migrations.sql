-- Køres efter migrationerne. Rettighederne kommer fra stubben (alter default privileges, som hos Supabase)
-- og fra migrationernes egne grant/revoke. Giv IKKE anon/authenticated mere her: så tester vi ikke de rigtige regler.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
