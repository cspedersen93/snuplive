#!/usr/bin/env bash
# Kører migrationen og testene mod en lokal Postgres: PGHOST/PGPORT skal pege på den.
set -euo pipefail
cd "$(dirname "$0")"
psql -q -v ON_ERROR_STOP=1 -U postgres -c "drop database if exists snuptest" -c "create database snuptest"
psql -q -v ON_ERROR_STOP=1 -U postgres -d snuptest -f supabase_stub.sql
for f in ../migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -U postgres -d snuptest -f "$f"; done
psql -q -tA -v ON_ERROR_STOP=1 -U postgres -d snuptest -f tests.sql 2>&1 | sed -n "s/^psql:[^ ]* //; /OK\|FEJL\|ERROR\|Forkert\|Ingen fejl\|bestået/p"

# Kapløb: Liva og Ole trykker Snup på samme tid. Kun én må få tingen.
psql -q -tA -v ON_ERROR_STOP=1 -U postgres -d snuptest -f race.sql >/dev/null
snup_as() { psql -q -tA -U postgres -d snuptest -c "begin; set local role authenticated; select set_config('request.jwt.claims', '{\"sub\":\"$1\"}', true); select status from snup('20000000-0000-0000-0000-000000000009'); select pg_sleep($2); commit;" 2>&1 | grep -v '^$' | tr '\n' ' ' || true; }
snup_as 00000000-0000-0000-0000-00000000000b 1.5 > /tmp/race_b.txt &
sleep 0.3
snup_as 00000000-0000-0000-0000-00000000000c 0 > /tmp/race_c.txt
wait
echo "Liva: $(cat /tmp/race_b.txt)"
echo "Ole:  $(cat /tmp/race_c.txt)"
sales=$(psql -tA -U postgres -d snuptest -c "select count(*) from sales where item_id = '20000000-0000-0000-0000-000000000009'")
if grep -q sold /tmp/race_b.txt && grep -q "en anden nåede" /tmp/race_c.txt && [ "$sales" = "1" ]; then
  echo "OK: kun én får tingen, når to snupper samtidig"
else
  echo "FEJL: kapløbstesten"; exit 1
fi
rm -f /tmp/race_b.txt /tmp/race_c.txt
