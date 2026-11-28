-- 0041: afhentning bekræftes af både køber og sælger.
-- Når varen skifter hænder, trykker køber og sælger hver for sig "Bekræft afhentning". Først når begge har gjort det,
-- afsluttes ordren, og pengene sendes til sælgeren. Før filen er kørt, bekræfter køberen alene som hidtil.
--   pickup_buyer_at / pickup_seller_at     hvornår hver af dem har bekræftet
--   pickup_reminded_at / pickup_flagged_at påmindelsen og beskeden til Relived er sendt (så de kun sendes én gang)
-- Kun serveren kan skrive i ordrer (0003_betaling.sql giver køber og sælger læseadgang, ikke skriveadgang),
-- så ingen kan bekræfte på den andens vegne.
alter table public.orders add column if not exists pickup_buyer_at    timestamptz;
alter table public.orders add column if not exists pickup_seller_at   timestamptz;
alter table public.orders add column if not exists pickup_reminded_at timestamptz;
alter table public.orders add column if not exists pickup_flagged_at  timestamptz;

notify pgrst, 'reload schema';
