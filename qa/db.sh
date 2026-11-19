#!/usr/bin/env bash
# Starter test-databasen (egen klynge på port 54329) og bygger den forfra fra migrationerne.
#   bash db.sh start   → start klyngen
#   bash db.sh reset   → slet og genopbyg databasen snupqa (stub + alle migrationer + seed)
set -euo pipefail
QA=/home/claude/qa; REPO=/home/claude/snuplive
PGBIN=/usr/lib/postgresql/16/bin; DATA=/var/lib/postgresql/qa16
export PGHOST=/var/lib/postgresql PGPORT=54329
start() {
  if [ ! -d "$DATA" ]; then su postgres -c "$PGBIN/initdb -D $DATA -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null"; fi
  if ! su postgres -c "$PGBIN/pg_isready -q -h $PGHOST -p $PGPORT"; then
    su postgres -c "$PGBIN/pg_ctl -D $DATA -l /var/lib/postgresql/qa16.log -o '-p $PGPORT -k $PGHOST -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off -c full_page_writes=off' -w start" >/dev/null
  fi
}
reset() {
  start
  psql -q -v ON_ERROR_STOP=1 -U postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='snupqa' and pid<>pg_backend_pid()" >/dev/null
  psql -q -v ON_ERROR_STOP=1 -U postgres -c "drop database if exists snupqa" -c "create database snupqa"
  psql -q -v ON_ERROR_STOP=1 -U postgres -d snupqa -f $REPO/supabase/tests/supabase_stub.sql
  psql -q -v ON_ERROR_STOP=1 -U postgres -d snupqa -f $QA/stub_extra.sql
  for f in $REPO/supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -U postgres -d snupqa -f "$f" 2>&1 | grep -v "^psql:.*NOTICE" || true; done
  psql -q -v ON_ERROR_STOP=1 -U postgres -d snupqa -f $QA/after_migrations.sql
  if [ -f $QA/seed.sql ]; then psql -q -v ON_ERROR_STOP=1 -U postgres -d snupqa -f $QA/seed.sql; fi
  psql -q -U postgres -d snupqa -c "notify pgrst, 'reload schema'"
}
"${1:-start}"
