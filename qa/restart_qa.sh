#!/usr/bin/env bash
# Starter hele testsiden på http://localhost:3100.
#   bash restart_qa.sh          → genstart tjenesterne og siden (uden at bygge)
#   bash restart_qa.sh build    → byg siden først
#   bash restart_qa.sh reset    → nulstil databasen (migrationer + seed) og genstart
#   bash restart_qa.sh stop
QA=/home/claude/qa; REPO=/home/claude/snuplive; LOG=$QA/log; mkdir -p $LOG $QA/storage
stop() { pkill -f "$QA/bin/postgrest" 2>/dev/null; pkill -f "$QA/fakesb/server.mjs" 2>/dev/null; pkill -f "$QA/fakes/server.mjs" 2>/dev/null; pkill -f "next start -p 3100" 2>/dev/null; pkill -f "next-server" 2>/dev/null; true; }
wait_for() { for i in $(seq 1 60); do curl -s -o /dev/null "$1" && return 0; python3 -c "import time;time.sleep(0.5)"; done; echo "kom ikke op: $1"; return 1; }
stop
[ "${1:-}" = "stop" ] && exit 0
bash $QA/db.sh start
[ "${1:-}" = "reset" ] && { rm -rf $QA/storage/*; bash $QA/db.sh reset; [ -d $QA/seedfiles ] && cp -r $QA/seedfiles/. $QA/storage/; }
set -a; . $QA/env.qa; set +a
nohup $QA/bin/postgrest $QA/postgrest.conf > $LOG/postgrest.log 2>&1 &
nohup node $QA/fakesb/server.mjs > $LOG/fakesb.log 2>&1 &
nohup node $QA/fakes/server.mjs > $LOG/fakes.log 2>&1 &
wait_for http://127.0.0.1:54401/ && wait_for http://localhost:54400/__ok && wait_for http://localhost:12111/__state
cd $REPO
if [ "${1:-}" = "build" ]; then rm -rf .next; npx next build > $LOG/build.log 2>&1 || { tail -30 $LOG/build.log; exit 1; }; fi
nohup npx next start -p 3100 > $LOG/next.log 2>&1 &
wait_for http://localhost:3100/ && echo "testsiden kører på http://localhost:3100 ($(git -C $REPO rev-parse --abbrev-ref HEAD) $(git -C $REPO rev-parse --short HEAD))"
