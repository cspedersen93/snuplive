"""Ordre-mails (betalt, vundet budsalg, sag afgjort) og rettelserne fra gennemgangen (beløb, login, show i fortiden).
Kør på en frisk database:  bash restart_qa.sh reset && python3 qa_mails.py
"""
import asyncio, pathlib, subprocess, json, urllib.request
from playwright.async_api import async_playwright

BASE = "http://localhost:3100"
S = pathlib.Path("/home/claude/qa")
OUT = S / "ds2"; OUT.mkdir(exist_ok=True)
PG = "PGHOST=/var/lib/postgresql PGPORT=54329 psql -tA -U postgres -d snupqa -c"
MAJA = "00000000-0000-0000-0000-00000000000a"; LIVA = "00000000-0000-0000-0000-00000000000b"; OLE = "00000000-0000-0000-0000-00000000000c"
SHOW = "10000000-0000-0000-0000-0000000000d1"; PLAN = "10000000-0000-0000-0000-0000000000d2"; LIVE = "10000000-0000-0000-0000-0000000000d3"
ITEMS = {"d1": ("Sommerkjole, blå", 200), "d2": ("Lampe, messing", 110), "d3": ("Uldfrakke, grå", 120), "d4": ("Regnjakke, gul", 250),
         "d5": ("Glasvase, grøn", 220), "d6": ("Silketørklæde", 90), "d7": ("Hue, strik", 60), "d8": ("Skindjakke, sort", 400), "d9": ("Lædertaske, brun", 180)}
I = {k: f"20000000-0000-0000-0000-0000000000{k}" for k in ITEMS}
AUC1 = "20000000-0000-0000-0000-0000000000e1"; AUC2 = "20000000-0000-0000-0000-0000000000e2"; AUC3 = "20000000-0000-0000-0000-0000000000e3"
fails = []
def check(name, ok, extra=""):
    print(("OK  " if ok else "FEJL"), name, str(extra)[:260])
    if not ok: fails.append(name)
def sql(q): return subprocess.run(["bash", "-c", f'{PG} "{q}"'], capture_output=True, text=True).stdout.strip()
def get(url): return json.loads(urllib.request.urlopen(url).read())
def post(url, body, headers=None):
    r = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"content-type": "application/json", **(headers or {})}); return json.loads(urllib.request.urlopen(r).read())
mails = lambda: get("http://localhost:12113/__state")["sent"]
def new_mails(mark): return mails()[mark:]
def by(ms, to, subj): return [m for m in ms if m["to"] == [to] and subj in m["subject"]]
SEEN = {}
def keep(key, m):
    if m: SEEN.setdefault(key, m[0])

async def login(b, email, nxt, w=1280, h=900):
    ctx = await b.new_context(viewport={"width": w, "height": h}, color_scheme="dark", device_scale_factor=2)
    pg = await ctx.new_page()
    await pg.goto(f"{BASE}/login?next={nxt}", wait_until="load")
    await pg.fill("#email", email); await pg.click("button[type=submit]")
    await pg.wait_for_selector("#otp"); await pg.fill("#otp", "123456"); await pg.click("button[type=submit]")
    await pg.wait_for_url(f"{BASE}{nxt}*"); await pg.wait_for_load_state("load")
    return pg
async def buy_and_pay(lp, items, pickup=False):
    for it in items:
        await lp.goto(f"{BASE}/ting/vare-{it}"); await lp.wait_for_timeout(800)
        await lp.click(".item-cta .btn-red"); await lp.wait_for_url(f"{BASE}/kurv*"); await lp.wait_for_timeout(900)
    if pickup:
        await lp.click(".deliv .opt:nth-child(2)"); await lp.wait_for_timeout(300)
    else:
        await lp.fill("#pshop-zip", "2650"); await lp.wait_for_selector(".pshop-list input", timeout=10000)
        await lp.locator(".pshop-list label").first.click(); await lp.wait_for_timeout(300)
    await lp.click(".summary .btn-red"); await lp.wait_for_url("http://localhost:12111/pay/*", timeout=15000)
    await lp.click("#pay"); await lp.wait_for_url(f"{BASE}/kurv?betaling=*", timeout=15000); await lp.wait_for_timeout(1500)
    return sql(f"select o.id from orders o join sales s on s.order_id=o.id where s.item_id='{items[0]}' order by o.created_at desc limit 1")
async def api(pg, url, body):
    return await pg.evaluate("""async ([u,b]) => { const r = await fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}); return [r.status, await r.json().catch(()=>({}))]; }""", [url, body])
async def toast(pg):
    await pg.wait_for_timeout(800); return " | ".join(t for t in await pg.locator(".toast").all_inner_texts() if t)

def photo():
    from PIL import Image
    f = S / "sagfoto1.jpg"
    if not f.exists(): Image.new("RGB", (1200, 900), (150, 90, 60)).save(f)
    out = []
    for n in (1, 2):
        tok = post("http://localhost:54400/auth/v1/__session", {"email": "liva.k@gmail.com"})["access_token"]
        name = f"{LIVA}/sag-qamail{n}.jpg"
        r = urllib.request.Request(f"http://localhost:54400/storage/v1/object/issues/{name}", data=f.read_bytes(), method="POST",
                                   headers={"Authorization": f"Bearer {tok}", "apikey": "sb_publishable_qa", "content-type": "image/jpeg", "x-upsert": "true"})
        urllib.request.urlopen(r).read(); out.append(name)
    return out

async def run():
    sql(f"insert into shows (id, seller_id, title, category, status, starts_at, started_at, ended_at) values ('{SHOW}', '{MAJA}', 'Kjoler og design', 'dametoej', 'ended', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days')")
    vals = ", ".join(f"('{I[k]}', '{SHOW}', '{MAJA}', '{n}', {p}, {i + 1}, 'unsold', true, now())" for i, (k, (n, p)) in enumerate(ITEMS.items()))
    sql(f"insert into items (id, show_id, seller_id, name, price, position, status, for_sale, listed_at) values {vals}")
    sql(f"insert into shows (id, seller_id, title, category, status, starts_at) values ('{PLAN}', '{MAJA}', 'Næste uges show', 'dametoej', 'planned', now() + interval '3 days')")
    PH = photo()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        lp = await login(b, "liva.k@gmail.com", "/konto")

        # ── 1. Betalt ordre: sælgeren har endnu ingen bankkonto tilknyttet ──
        mark = len(mails())
        o1 = await buy_and_pay(lp, [I["d1"]])
        await lp.reload(); await lp.wait_for_timeout(800)   # retur-siden kaldes igen: må ikke give flere mails
        nm = new_mails(mark)
        ms = by(nm, "maja@mail.dk", "Betalt:"); mb = by(nm, "liva.k@gmail.com", "Tak for dit køb")
        keep("saelger-betalt", ms); keep("koeber-betalt", mb)
        check("betalt: præcis én mail til sælger og én til køber", len(ms) == 1 and len(mb) == 1 and len(nm) == 2, [m["subject"] for m in nm])
        t = ms[0]["text"] if ms else ""
        check("sælger: emne, vare, pakkeshop og frist", ms and ms[0]["subject"] == "Betalt: 1 vare til @liva.k skal sendes" and "- Sommerkjole, blå: 200 kr" in t and "Pakken skal til DAO-pakkeshoppen Kvickly Hvidovre, Hvidovrevej 300, 2650 Hvidovre." in t and "send pakken inden 3 hverdage" in t and f"{BASE}/studio" in t, t)
        check("sælger: får at vide, at bankkontoen mangler", "Du mangler at tilknytte din bankkonto" in t)
        t = mb[0]["text"] if mb else ""
        tot = sql(f"select total_amount from orders where id='{o1}'"); fee = sql(f"select fee_amount from orders where id='{o1}'")
        check("køber: varer, fragt, gebyr og total passer med ordren", "Fra @maja (privat sælger):" in t and "- Sommerkjole, blå: 200 kr" in t and "- Fragt til pakkeshop: 39 kr" in t and f"- Køberbeskyttelse: {fee} kr" in t and f"Betalt i alt: {tot} kr" in t, t)
        check("køber: levering, beskyttelse, fortrydelse og vilkår", "Sælgeren sender pakken til DAO-pakkeshoppen Kvickly Hvidovre" in t and "Pengene holdes tilbage hos Relived" in t and "Sælgeren er en privatperson, så der er ikke fortrydelsesret." in t and f"{BASE}/handelsbetingelser" in t and f"{BASE}/kurv" in t)

        mp = await login(b, "maja@mail.dk", "/studio")
        if await mp.locator(".payout .btn-red").count():
            await mp.click(".payout .btn-red"); await mp.wait_for_url(f"{BASE}/studio?udbetaling=*", timeout=15000); await mp.wait_for_load_state("load")
        if await mp.locator("#sa-a1").count():
            await mp.fill("#sa-a1", "Jagtvej 10, 2. tv"); await mp.fill("#sa-zip", "2200"); await mp.fill("#sa-city", "København N"); await mp.fill("#sa-phone", "+45 22 33 44 55")
            await mp.click(".addr-form .btn-red"); await mp.wait_for_timeout(1500)

        # ── 2. Afhentning, to varer, virksomhedssælger ──
        sql(f"update profiles set seller_type='business', business_name='Majas Genbrug ApS', business_cvr='12345678' where id='{MAJA}'")
        mark = len(mails())
        o2 = await buy_and_pay(lp, [I["d2"], I["d3"]], pickup=True)
        nm = new_mails(mark); ms = by(nm, "maja@mail.dk", "Betalt:"); mb = by(nm, "liva.k@gmail.com", "Tak for dit køb")
        keep("saelger-afhentning", ms); keep("koeber-virksomhed", mb)
        t = ms[0]["text"] if ms else ""
        check("afhentning: sælgerens mail", ms and ms[0]["subject"] == "Betalt: 2 varer til @liva.k skal afhentes" and "Køberen henter selv. Aftal tid og sted" in t and "- Lampe, messing: 110 kr" in t and "- Uldfrakke, grå: 120 kr" in t and "Du mangler" not in t, t)
        t = mb[0]["text"] if mb else ""
        tot2 = sql(f"select total_amount from orders where id='{o2}'")
        check("afhentning og virksomhed: køberens mail", "Fra @maja (virksomhed: Majas Genbrug ApS, CVR 12345678):" in t and "- Afhentning hos sælgeren: 0 kr" in t and "Du henter selv varerne hos @maja" in t and "14 dages fortrydelsesret" in t and f"Betalt i alt: {tot2} kr" in t, t)
        sql(f"update profiles set seller_type='private', business_name=null, business_cvr=null where id='{MAJA}'")

        # ── 3. Sager afgøres ──
        ap = await login(b, "admin@snuplive.dk", "/admin/sager")
        async def case(item, reason, action, photos):
            oid = await buy_and_pay(lp, [item])
            r = await api(lp, f"/api/orders/{oid}/problem", {"reason": reason, "message": "Der er noget galt med varen, som ikke blev vist.", "photos": photos})
            assert r[0] == 200, r
            mark = len(mails())
            r = await api(ap, f"/api/admin/orders/{oid}", {"action": action})
            nm = new_mails(mark)
            return oid, r, [m for m in nm if m["to"] == ["liva.k@gmail.com"]], [m for m in nm if m["to"] == ["maja@mail.dk"]]
        oid, r, kb, sl = await case(I["d4"], "not_as_shown", "refund", PH[:1]); keep("sag-refund-koeber", kb); keep("sag-refund-saelger", sl)
        tot = sql(f"select total_amount from orders where id='{oid}'")
        check("refusion: køber får medhold-mail med beløb", r[0] == 200 and len(kb) == 1 and kb[0]["subject"] == "Din sag er afgjort: du får pengene tilbage" and f"givet dig medhold. Du får {tot} kr tilbage" in kb[0]["text"] and "nogle bankdage" in kb[0]["text"], kb)
        check("refusion: sælger får besked, og man kan svare til Relived", len(sl) == 1 and "ingen udbetaling for ordren" in sl[0]["text"] and "sætte dem til salg igen" in sl[0]["text"] and sl[0].get("reply_to") == ["admin@snuplive.dk"], sl)
        oid, r, kb, sl = await case(I["d5"], "damaged", "cover", PH); keep("sag-daekket-koeber", kb); keep("sag-daekket-saelger", sl)
        check("dækket: køber skal ikke sende retur, men gemme emballagen", r[0] == 200 and len(kb) == 1 and "du skal ikke sende noget retur" in kb[0]["text"] and "Gem varen og emballagen lidt endnu" in kb[0]["text"], kb)
        check("dækket: sælger får sin udbetaling", len(sl) == 1 and sl[0]["subject"] == "Sagen er afgjort: du får din udbetaling" and "Relived har dækket købet" in sl[0]["text"], sl)
        oid, r, kb, sl = await case(I["d6"], "not_as_shown", "release", PH[:1]); keep("sag-afvist-koeber", kb); keep("sag-medhold-saelger", sl)
        check("udbetalt til sælger: køber får afslag", r[0] == 200 and len(kb) == 1 and kb[0]["subject"] == "Din sag er afgjort" and "ikke kunnet give dig medhold" in kb[0]["text"], kb)
        check("udbetalt til sælger: sælger får medhold", len(sl) == 1 and "givet dig medhold. Pengene for ordren bliver sendt til din bankkonto" in sl[0]["text"], sl)
        oid, r, kb, sl = await case(I["d7"], "other", "close", []); keep("sag-lukket-koeber", kb); keep("sag-lukket-saelger", sl)
        check("lukket: begge får besked", r[0] == 200 and len(kb) == 1 and len(sl) == 1 and kb[0]["subject"] == "Din sag er lukket" and "uden at flytte penge" in sl[0]["text"], [kb, sl])
        r2 = await api(ap, f"/api/admin/orders/{oid}", {"action": "close"})
        # Sælgeren giver selv pengene tilbage (uden sag)
        o8 = await buy_and_pay(lp, [I["d8"]]); mark = len(mails())
        r = await api(mp, f"/api/orders/{o8}/refund", {})
        nm = new_mails(mark); kb = by(nm, "liva.k@gmail.com", "Du har fået pengene tilbage"); keep("refund-uden-sag", kb)
        tot = sql(f"select total_amount from orders where id='{o8}'")
        check("sælger refunderer selv: køber får én neutral mail", r[0] == 200 and len(nm) == 1 and len(kb) == 1 and f"Du har fået pengene tilbage for din ordre fra @maja: {tot} kr." in kb[0]["text"] and "sag" not in kb[0]["text"].lower(), nm)
        # Admin refunderer en ordre uden sag
        o9 = await buy_and_pay(lp, [I["d9"]]); mark = len(mails())
        r = await api(ap, f"/api/admin/orders/{o9}", {"action": "refund"})
        nm = new_mails(mark)
        check("admin refunderer uden sag: ingen 'din sag er afgjort'", r[0] == 200 and len(nm) == 1 and nm[0]["subject"] == "Du har fået pengene tilbage" and nm[0]["to"] == ["liva.k@gmail.com"], nm)

        # ── 4. Vundet budsalg ──
        sql(f"insert into shows (id, seller_id, title, category, status, starts_at, started_at, heartbeat_at) values ('{LIVE}', '{MAJA}', 'Budsalg i aften', 'luksus', 'live', now(), now(), now())")
        for iid, nm_, bidder, handle in ((AUC1, "Vintage armbåndsur", LIVA, "liva.k"), (AUC2, "Sølvarmbånd", OLE, "ole"), (AUC3, "Perlekæde", LIVA, "liva.k")):
            sql(f"insert into items (id, show_id, seller_id, name, price, position, status, sale_type, auction_ends_at, high_bid, high_bidder, high_handle, bid_count) values ('{iid}', '{LIVE}', '{MAJA}', '{nm_}', 300, 1, 'live', 'auction', now() - interval '2 seconds', 340, '{bidder}', '{handle}', 3)")
        mark = len(mails())
        sql(f"select (public._close_auction('{AUC1}', true)).status")
        check("budsalg lukket: salget er reserveret til vinderen", sql(f"select status || '|' || price || '|' || (won_mail_at is null) from sales where item_id='{AUC1}'") == "reserved|340|true")
        a = post(f"{BASE}/api/sales/vundet", {"itemId": AUC1}); c = post(f"{BASE}/api/sales/vundet", {"itemId": AUC1})
        nm = new_mails(mark); keep("budsalg-vundet", nm)
        check("budsalg: vinderen får én mail, også når to kalder", a.get("sent") == 1 and c.get("sent") == 0 and len(nm) == 1 and nm[0]["to"] == ["liva.k@gmail.com"] and nm[0]["subject"] == "Du vandt budsalget: Vintage armbåndsur for 340 kr", [a, c, [m["subject"] for m in nm]])
        t = nm[0]["text"] if nm else ""
        check("budsalg: mailen siger bud, frist og hvad der sker ellers", "med dit bud på 340 kr" in t and "Betal inden 3 dage" in t and f"{BASE}/kurv" in t and "bliver købet annulleret" in t, t)
        sql(f"select (public._close_auction('{AUC2}', true)).status"); sql(f"select (public._close_auction('{AUC3}', true)).status")
        mark = len(mails())
        rq = urllib.request.Request(BASE + "/api/cron/daily", headers={"authorization": "Bearer qa-cron"}); cron = json.loads(urllib.request.urlopen(rq).read())
        nm = [m for m in new_mails(mark) if "Du vandt budsalget" in m["subject"]]
        check("budsalg: det daglige job sender til dem, der ikke fik mailen", cron.get("auctionMails") == 2 and sorted(m["to"][0] for m in nm) == ["liva.k@gmail.com", "ole@firma.dk"], [cron.get("auctionMails"), [m["to"] for m in nm]])
        cron2 = json.loads(urllib.request.urlopen(rq).read())
        check("budsalg: ingen får mailen to gange", cron2.get("auctionMails") == 0)
        await lp.goto(f"{BASE}/ting/vare-{I['d1']}")
        mark = len(mails()); r = post(f"{BASE}/api/sales/vundet", {"itemId": I["d1"]})
        check("budsalg: et almindeligt køb giver ingen vinder-mail", r.get("sent") == 0 and len(new_mails(mark)) == 0)

        # ── 5. Rettelser: beløb med komma ──
        await mp.goto(f"{BASE}/studio/{PLAN}", wait_until="load"); await mp.wait_for_timeout(800)
        async def add(name, price):
            await mp.fill("#ni-name-new", name); await mp.fill("#ni-price-new", price); await mp.click("button:has-text('Læg i køen')"); await mp.wait_for_timeout(1300)
            return sql(f"select coalesce(string_agg(price::text, ',' order by position), '') from items where show_id='{PLAN}'"), await mp.inner_text("main")
        prices, txt = await add("Kjole med komma", "12,50")
        check("pris 12,50 gemmes ikke, og sælgeren får besked", prices == "" and "hele kroner mellem 1 og 100.000, uden komma" in txt, prices)
        await mp.locator("form", has=mp.locator("#ni-price-new")).first.screenshot(path=str(OUT / "pris-komma.png"))
        prices, txt = await add("Kjole med komma", "149,95"); check("pris 149,95 gemmes ikke", prices == "", prices)
        prices, txt = await add("Kjole med tusindtal", "1.250"); check("pris 1.250 gemmes som 1250 kr", prices == "1250", prices)
        prices, txt = await add("Kjole almindelig", "150"); check("pris 150 gemmes som 150 kr", prices == "1250,150", prices)
        prices, txt = await add("Kjole med kr", "75 kr"); check("pris '75 kr' gemmes som 75 kr", prices == "1250,150,75", prices)
        # Maks-bud
        AUCP = "20000000-0000-0000-0000-0000000000f9"
        sql(f"insert into items (id, show_id, seller_id, name, price, position, status, sale_type) values ('{AUCP}', '{PLAN}', '{MAJA}', 'Designerstol', 300, 9, 'queued', 'auction')")
        await lp.goto(f"{BASE}/ting/vare-{AUCP}", wait_until="load"); await lp.wait_for_timeout(1200)
        if await lp.locator(".maxbid-open").count():
            await lp.click(".maxbid-open"); await lp.fill(".maxbid-form input", "350,50"); await lp.click(".maxbid-form button[type=submit]"); t = await toast(lp)
            check("maks-bud 350,50 afvises (blev før til 35.050 kr)", "hele kroner uden komma" in t and sql(f"select count(*) from max_bids where item_id='{AUCP}'") == "0", t)
            await lp.locator(".maxbid").first.screenshot(path=str(OUT / "maksbud-komma.png"))
            await lp.fill(".maxbid-form input", "400"); await lp.click(".maxbid-form button[type=submit]"); t = await toast(lp)
            check("maks-bud 400 gemmes som 400 kr", sql(f"select amount from max_bids where item_id='{AUCP}'") == "400" and "400 kr" in t, t)
        else:
            check("maks-bud: feltet blev fundet på varesiden", False, (await lp.inner_text("main"))[:300])

        # Login må ikke sende videre til et andet websted
        for nxt in ["/\\\\example.com", "//example.com/x", "https://example.com/x", "/konto\\\\x"]:
            ctx = await b.new_context(); pg = await ctx.new_page()
            await pg.goto(f"{BASE}/login?next={nxt}"); await pg.fill("#email", "ole@firma.dk"); await pg.click("button[type=submit]"); await pg.wait_for_selector("#otp"); await pg.fill("#otp", "123456"); await pg.click("button[type=submit]"); await pg.wait_for_timeout(2500)
            check(f"login med next={nxt} bliver på Relived", pg.url == f"{BASE}/konto", pg.url); await ctx.close()
        ctx = await b.new_context(); pg = await ctx.new_page()
        await pg.goto(f"{BASE}/login?next=/kurv"); await pg.fill("#email", "ole@firma.dk"); await pg.click("button[type=submit]"); await pg.wait_for_selector("#otp"); await pg.fill("#otp", "123456"); await pg.click("button[type=submit]"); await pg.wait_for_timeout(2500)
        check("login med next=/kurv virker stadig", pg.url.startswith(f"{BASE}/kurv"), pg.url); await ctx.close()

        # Show i fortiden
        await mp.goto(f"{BASE}/studio", wait_until="load"); await mp.wait_for_timeout(600)
        n0 = sql("select count(*) from shows")
        await mp.fill("#ns-title", "Show i fortiden"); await mp.fill("#ns-start", "2020-01-01T10:00"); await mp.click("button:has-text('Opret show og læg varer ind')"); await mp.wait_for_timeout(1500)
        check("show med starttid i fortiden oprettes ikke", sql("select count(*) from shows") == n0 and "Starttidspunktet er i fortiden" in await mp.inner_text("main"))
        await mp.locator("form", has=mp.locator("#ns-start")).first.screenshot(path=str(OUT / "show-fortid.png"))
        await mp.fill("#ns-start", "2030-06-01T19:00"); await mp.click("button:has-text('Opret show og læg varer ind')"); await mp.wait_for_timeout(2500)
        check("show med starttid i fremtiden oprettes", sql("select count(*) from shows") == str(int(n0) + 1) and "/studio/" in mp.url, mp.url)
        await b.close()
    (S / "log").mkdir(exist_ok=True)
    with open(S / "log" / "mails.txt", "w") as f:
        for k, m in SEEN.items(): f.write(f"===== {k}\nTil: {m['to'][0]}\nEmne: {m['subject']}\n\n{m['text']}\n\n")

asyncio.run(run())
print("\nFEJL:", fails) if fails else print("\nAlle tjek bestået")
