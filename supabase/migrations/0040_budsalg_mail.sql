-- 0040: mail til vinderen af et budsalg.
-- Kolonnen husker, hvornår mailen er sendt, så vinderen kun får den én gang, uanset hvem der lukker budsalget.
-- Salg, der allerede findes, markeres som sendt, så ingen får en mail om et gammelt budsalg.
alter table public.sales add column if not exists won_mail_at timestamptz;
update public.sales set won_mail_at = created_at where won_mail_at is null;

notify pgrst, 'reload schema';
