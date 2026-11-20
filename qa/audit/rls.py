import json, urllib.request, subprocess
PG = "PGHOST=/var/lib/postgresql PGPORT=54329 psql -tA -U postgres -d snupqa -c"
def sql(q): return subprocess.run(["bash","-c",f'{PG} "{q}"'],capture_output=True,text=True).stdout.strip()
def post(url, body):
    r = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"content-type":"application/json"}); return json.loads(urllib.request.urlopen(r).read())
toks = {"anon": "sb_publishable_qa"}
for k, e in (("ole","ole@firma.dk"),("liva","liva.k@gmail.com"),("maja","maja@mail.dk")): toks[k] = post("http://localhost:54400/auth/v1/__session",{"email":e})["access_token"]
def count(tok, table):
    r = urllib.request.Request(f"http://localhost:54400/rest/v1/{table}?select=*", headers={"apikey":"sb_publishable_qa","Authorization":f"Bearer {tok}","Prefer":"count=exact","Range":"0-0"})
    try:
        with urllib.request.urlopen(r) as f:
            cr = f.headers.get("content-range","");  return cr.split("/")[-1], (json.loads(f.read() or b"[]") or [{}])[0]
    except urllib.error.HTTPError as e: return f"E{e.code}", {}
tables = sql("select string_agg(c.relname, ',' order by c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v','m')").split(",")
norls = sql("select string_agg(c.relname, ',') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity")
print("tabeller uden RLS:", norls or "ingen")
print(f"{'tabel':28} {'i alt':>6} {'anon':>6} {'ole':>6} {'liva':>6} {'maja':>6}  kolonner anon ser")
for t in tables:
    tot = sql(f"select count(*) from public.\\\"{t}\\\"")
    row = [count(toks[k], t) for k in ("anon","ole","liva","maja")]
    cols = ",".join(row[0][1].keys())[:150] if row[0][1] else ""
    print(f"{t:28} {tot:>6} " + " ".join(f"{r[0]:>6}" for r in row) + "  " + cols)
