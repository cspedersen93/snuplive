"""Rettelser efter gennemgangen (0042_rettelser.sql): punkt 1, 2, 3, 4 og 6.
Kør på en frisk database:
  bash restart_qa.sh reset && python3 qa_rettelser.py
  SHIPMONDO_SANDBOX=1 bash restart_qa.sh reset && python3 qa_rettelser.py sandbox     (testlabels: knappen findes stadig)
  python3 qa_rettelser.py uden     (på en database bygget uden 0042: flyt filen væk, kør "bash restart_qa.sh reset", og læg den tilbage)
"""
import asyncio, pathlib, subprocess, json, sys, urllib.request, urllib.error
from playwright.async_api import async_playwright

BASE = "http://localhost:3100"
S = pathlib.Path("/home/claude/qa")
OUT = S / "ds2"
OUT.mkdir(exist_ok=True)
PG = "PGHOST=/var/lib/postgresql PGPORT=54329 psql -tA -U postgres -d snupqa -c"
MAJA = "00000000-0000-0000-0000-00000000000a"; LIVA = "00000000-0000-0000-0000-00000000000b"; OLE = "00000000-0000-0000-0000-00000000000c"
SHOW = "10000000-0000-0000-0000-0000000000e2"
ITEMS = {  # navn, pris
    "e1": ("Kjole, rød", 200), "e2": ("Bluse, hvid", 120), "e3": ("Nederdel, sort", 150), "e4": ("Cardigan, beige", 180),
    "e5": ("Taske, læder", 300), "e6": ("Tørklæde, uld", 90), "e7": ("Jakke, denim", 250), "e8": ("Sko, brune", 220),
    "e9": ("Bælte, sort", 80), "ea": ("Hat, strå", 110), "eb": ("Vest, quiltet", 160), "ec": ("Skjorte, stribet", 140),
    "ed": ("Bukser, hør", 170), "ee": ("Top, silke", 130), "ef": ("Frakke, uld", 400),
}
I = {k: f"20000000-0000-0000-0000-0000000000{k}" for k in ITEMS}
fails = []
def check(name, ok, extra=""):
    print(("OK  " if ok else "FEJL"), name, str(extra)[:220])
    if not ok: fails.append(name)
def sql(q): return subprocess.run(["bash", "-c", f'{PG} "{q}"'], capture_output=True, text=True).stdout.strip()
def get(url): return json.loads(urllib.request.urlopen(url).read())
def post(url, body, headers={}):
    r = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"content-type": "application/json", **headers})
    try:
        with urllib.request.urlopen(r) as f: return f.status, json.loads(f.read() or b"null")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"null")
def tok(email): return post("http://localhost:54400/auth/v1/__session", {"email": email})[1]["access_token"]
def rpc(email, fn, args):
    """Kald en funktion i databasen direkte som en bruger (som en teknisk kyndig ville gøre)."""
    return post(f"http://localhost:54400/rest/v1/rpc/{fn}", args, {"apikey": "sb_publishable_qa", "Authorization": f"Bearer {tok(email)}"})
def rest(email, path, method="GET", body=None):
    t = tok(email) if email else "sb_publishable_qa"
    r = urllib.request.Request(f"http://localhost:54400/rest/v1/{path}", method=method, data=json.dumps(body).encode() if body is not None else None,
                               headers={"apikey": "sb_publishable_qa", "Authorization": f"Bearer {t}", "content-type": "application/json", "Prefer": "return=representation"})
    try:
        with urllib.request.urlopen(r) as f: return f.status, json.loads(f.read() or b"null")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"null")
stripe = lambda: get("http://localhost:12111/__state")
ship = lambda: get("http://localhost:12112/__state")
mails = lambda: get("http://localhost:12113/__state")["sent"]
def cron():
    rq = urllib.request.Request(BASE + "/api/cron/daily", headers={"authorization": "Bearer qa-cron"}); return json.loads(urllib.request.urlopen(rq).read())
def track(oid, status):
    sid = sql(f"select shipmondo_shipment_id from orders where id='{oid}'")
    return post("http://localhost:12112/__track", {"shipment_id": int(sid), "status": status})
def state(oid): return sql(f"select status || '|' || coalesce(tracking_status, '-') || '|' || transfer_status from orders where id='{oid}'")
def item(i): return sql(f"select status || '|' || for_sale from items where id='{i}'")

async def shot(loc, name):
    await loc.page.add_style_tag(content=".head{position:static!important}.sup-fab,.app-banner,.cookie-note,.tabbar,.toast{display:none!important}")
    await loc.scroll_into_view_if_needed(); await loc.page.wait_for_timeout(250)
    await loc.screenshot(path=str(OUT / name))

async def login(b, email, nxt, w=390, h=844):
    ctx = await b.new_context(viewport={"width": w, "height": h}, color_scheme="dark", device_scale_factor=2)
    pg = await ctx.new_page()
    await pg.goto(f"{BASE}/login?next={nxt}", wait_until="load")
    await pg.fill("#email", email); await pg.click("button[type=submit]")
    await pg.wait_for_selector("#otp"); await pg.fill("#otp", "123456"); await pg.click("button[type=submit]")
    await pg.wait_for_url(f"{BASE}{nxt}*"); await pg.wait_for_load_state("load")
    await pg.add_style_tag(content="[class*=cookie]{display:none!important}")
    return pg
async def api(pg, url, body=None, method="POST"):
    return await pg.evaluate("""async ([u,b,m]) => { const r = await fetch(u, m === 'GET' ? {} : {method:m,headers:{'content-type':'application/json'},body:JSON.stringify(b ?? {})}); return [r.status, await r.json().catch(()=>({}))]; }""", [url, body, method])
async def toast(pg):
    await pg.wait_for_timeout(900); return " | ".join(await pg.locator(".toast").all_inner_texts())
async def checkout(lp, items, delivery="ship"):
    """Køb varerne og start betalingen. Giver adressen til betalingen hos (den falske) Stripe."""
    items = items if isinstance(items, list) else [items]
    for it in items:
        r = rpc("liva.k@gmail.com", "buy_now", {"p_item": it})
        assert r[0] == 200, r
    body = {"deliveries": {MAJA: delivery}, "feeFree": False}
    if delivery == "ship": body["pakkeshop"] = {"carrier": "dao", "id": "90101", "zipcode": "2650"}
    r = await api(lp, "/api/checkout", body)
    assert r[0] == 200 and r[1].get("url"), r
    return r[1]["url"]
async def pay(lp, url):
    await lp.goto(url + "?betal=1", wait_until="load"); await lp.wait_for_timeout(1800)
async def buy(lp, items, delivery="ship"):
    items = items if isinstance(items, list) else [items]
    await pay(lp, await checkout(lp, items, delivery))
    return sql(f"select o.id from orders o join sales s on s.order_id=o.id where s.item_id='{items[0]}' order by o.created_at desc limit 1")

def seed():
    sql(f"insert into shows (id, seller_id, title, category, status, starts_at, started_at, ended_at) values ('{SHOW}', '{MAJA}', 'Garderoben ryddes', 'dametoej', 'ended', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days') on conflict (id) do nothing")
    vals = ", ".join(f"('{I[k]}', '{SHOW}', '{MAJA}', '{n}', {p}, {i + 1}, 'unsold', true, now())" for i, (k, (n, p)) in enumerate(ITEMS.items()))
    sql(f"insert into items (id, show_id, seller_id, name, price, position, status, for_sale, listed_at) values {vals} on conflict (id) do nothing")

async def setup_seller(b):
    mp = await login(b, "maja@mail.dk", "/studio")
    if await mp.locator(".payout .btn-red").count():
        await mp.click(".payout .btn-red"); await mp.wait_for_url(f"{BASE}/studio?udbetaling=*", timeout=15000); await mp.wait_for_load_state("load")
    if await mp.locator("#sa-a1").count():
        await mp.fill("#sa-a1", "Jagtvej 10, 2. tv"); await mp.fill("#sa-zip", "2200"); await mp.fill("#sa-city", "København N"); await mp.fill("#sa-phone", "+45 22 33 44 55")
        await mp.click(".addr-form .btn-red"); await mp.wait_for_timeout(1500)
    return mp

async def run():
    seed()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        mp = await setup_seller(b)
        check("sælger: udbetaling og adresse sat op", sql(f"select payouts_enabled from payout_accounts where user_id='{MAJA}'") == "t" and sql(f"select count(*) from seller_addresses where user_id='{MAJA}'") == "1")
        lp = await login(b, "liva.k@gmail.com", "/konto")
        ap = await login(b, "admin@snuplive.dk", "/admin/sager", 1280, 900)

        # ── Punkt 6: kun fragtfirmaets scanning tæller som sendt ───────────────────────────────────
        o6 = await buy(lp, I["e1"])
        r = await api(mp, f"/api/orders/{o6}/label", {"weight": 1000})
        check("6: ordre betalt og label lavet", r[0] == 200 and state(o6) == "paid|INFORMED|none", f"{r} {state(o6)}")
        await mp.goto(BASE + "/studio", wait_until="load")
        so = mp.locator(".seller-order", has_text="Kjole, rød").first
        t = await so.inner_text()
        check("6 sælger: ingen knap til selv at markere pakken som afleveret", await so.locator("button:has-text('afleveret')").count() == 0 and "Det er scanningen, der tæller" in t and "kvittering i pakkeshoppen" in t, t[t.find("Pak varerne"):][:330])
        check("6 sælger: sporingens status og link til fragtfirmaet", "Labelen er lavet. Pakken er ikke afleveret endnu." in t and await so.locator("a:has-text('Se sporingen hos DAO')").count() == 1)
        await shot(so, "ret-6-saelger-label.png")
        r = rpc("maja@mail.dk", "mark_shipped", {"p_order": o6})
        check("6: sælgeren kan ikke markere pakken som sendt direkte i databasen", r[0] == 400 and "fragtfirmaet har scannet" in r[1].get("message", "") and state(o6) == "paid|INFORMED|none", f"{r} {state(o6)}")
        r = rpc("maja@mail.dk", "mark_shipped", {"p_order": o6, "p_carrier": "GLS", "p_tracking": "123"})
        check("6: heller ikke med eget sporingsnummer", r[0] == 400 and state(o6) == "paid|INFORMED|none" and sql(f"select tracking like '0570%' from orders where id='{o6}'") == "t", r)
        r = await api(mp, f"/api/orders/{o6}/afleveret")
        check("6: testknappens adresse svarer nej med rigtige labels", r[0] == 409 and "fragtfirmaet har scannet" in r[1].get("error", "") and state(o6) == "paid|INFORMED|none", r)
        # Før: efter "Jeg har afleveret pakken" blev ordren afsluttet 7 dage senere, uden scanning.
        n_tr = len(stripe()["transfers"])
        sql(f"update orders set paid_at = now() - interval '9 days', label_created_at = now() - interval '4 days' where id='{o6}'")
        c = cron()
        check("6: uden scanning sker der ingen udbetaling, heller ikke 9 dage efter betalingen", state(o6) == "paid|INFORMED|none" and len(stripe()["transfers"]) == n_tr and c.get("completed") == 0 and c.get("scanFlagged") == 0, c)
        await lp.goto(BASE + "/kurv", wait_until="load")
        card = lp.locator("section.group", has_text="Kjole, rød").first
        t = await card.inner_text()
        check("6 køber: før scanningen står ordren som betalt uden bekræft-knap", "BETALT" in t.upper() and "Sælgeren pakker og afleverer din pakke" in t and await card.locator("button:has-text('Jeg har fået mine varer')").count() == 0, t)
        await shot(card, "ret-6-koeber-foer-scanning.png")
        # Fragtfirmaet scanner pakken: Shipmondo giver besked, og ordren skifter selv.
        r = track(o6, "EN_ROUTE"); await asyncio.sleep(0.8)
        check("6: første scanning gør ordren til sendt", r[1].get("site") == 200 and state(o6) == "shipped|EN_ROUTE|none" and sql(f"select status from sales where order_id='{o6}'") == "shipped", f"{r} {state(o6)}")
        await lp.goto(BASE + "/kurv", wait_until="load")
        t = await card.inner_text()
        check("6 køber: ser 'Pakken er på vej' og sporingslinket", "SENDT" in t.upper() and "Pakken er på vej." in t and await card.locator("a[href*='dao.as']").count() == 1 and await card.locator("button:has-text('Jeg har fået mine varer')").count() == 1, t)
        await shot(card, "ret-6-koeber-paa-vej.png")
        track(o6, "AVAILABLE_FOR_DELIVERY"); await asyncio.sleep(0.8)
        await lp.goto(BASE + "/kurv", wait_until="load")
        t = await card.inner_text()
        check("6 køber: ser, at pakken er klar i pakkeshoppen", "Pakken er klar til afhentning i pakkeshoppen." in t and state(o6) == "shipped|AVAILABLE_FOR_DELIVERY|none", t)
        await shot(card, "ret-6-koeber-klar.png")
        track(o6, "DELIVERED"); await asyncio.sleep(0.8)
        await lp.goto(BASE + "/kurv", wait_until="load")
        t = await card.inner_text()
        check("6 køber: ser, at pakken er hentet", "Pakken er hentet i pakkeshoppen." in t and sql(f"select delivered_at is not null from orders where id='{o6}'") == "t", t)
        await mp.goto(BASE + "/studio", wait_until="load")
        t = await mp.inner_text("main")
        check("6 sælger: ser også sporingen", "Pakken er hentet i pakkeshoppen." in t)
        sql(f"update orders set delivered_at = now() - interval '3 days' where id='{o6}'")
        c = cron(); st = stripe()
        check("6: to dage efter, at pakken er hentet, afsluttes ordren, og sælgeren får pengene", state(o6) == "completed|DELIVERED|done" and len(st["transfers"]) == n_tr + 1 and int(st["transfers"][-1]["amount"]) == 200 * 100, f"{state(o6)} {c}")

        # Pakker, der ikke bliver scannet: mail til sælger og Relived, og Relived afgør dem.
        o7 = await buy(lp, I["e2"]); o8 = await buy(lp, I["e3"]); o9 = await buy(lp, I["e4"])
        for o in (o7, o8, o9):
            r = await api(mp, f"/api/orders/{o}/label", {"weight": 1000}); assert r[0] == 200, r
        sql(f"update orders set label_created_at = now() - interval '6 days' where id in ('{o7}', '{o8}')")
        sql(f"update orders set label_created_at = now() - interval '2 days' where id = '{o9}'")
        n_mail = len(mails()); c = cron(); new = mails()[n_mail:]
        subj = sorted((m["to"][0], m["subject"]) for m in new)
        check("6: to pakker uden scanning efter 5 dage: mail til sælger og Relived", c.get("scanFlagged") == 2 and subj == [("admin@snuplive.dk", "Pakke ikke scannet: @liva.k og @maja")] * 2 + [("maja@mail.dk", "Din pakke til @liva.k er ikke scannet endnu")] * 2, f"{c.get('scanFlagged')} {subj}")
        ts = next((m["text"] for m in new if m["to"] == ["maja@mail.dk"] and "Bluse, hvid" in m["text"]), ""); ta = next((m["text"] for m in new if m["to"] == ["admin@snuplive.dk"] and "Bluse, hvid" in m["text"]), "")
        check("6: sælgerens mail", "men fragtfirmaet har ikke scannet pakken endnu" in ts and "- Bluse, hvid: 120 kr" in ts and "kvitteringen fra pakkeshoppen" in ts and "annullere ordren i dit studie" in ts and "/studio" in ts, ts)
        check("6: Reliveds mail med pakkenummer og link til sporingen", "DAO, pakkenummer 0570" in ta and "dao.as" in ta and "sælgeren skal have 120 kr" in ta and "/admin/sager" in ta, ta)
        (OUT / "ret-mail-scanning-saelger.txt").write_text(ts); (OUT / "ret-mail-scanning-relived.txt").write_text(ta)
        n_mail = len(mails()); c = cron()
        check("6: beskeden sendes kun én gang, og pakken på 2 dage er ikke med", c.get("scanFlagged") == 0 and len(mails()) == n_mail and sql(f"select scan_flagged_at is null from orders where id='{o9}'") == "t", c)
        await ap.goto(BASE + "/admin/sager", wait_until="load")
        sec = ap.locator("#scanning")
        check("6 admin: afsnittet med pakker uden scanning", await sec.locator("section.box").count() == 2 and "Pakker, der ikke er scannet" in await sec.inner_text())
        c7 = ap.locator(f"section[data-scan='{o7}']"); t7 = await c7.inner_text()
        check("6 admin: kortet har sporing, link og to knapper", "venter på en pakke fra @maja" in t7 and "Labelen er lavet. Pakken er ikke afleveret endnu." in t7 and await c7.locator("a[href*='dao.as']").count() == 1 and await c7.locator("button").count() == 2 and await c7.locator("button:has-text('Markér som sendt')").count() == 1 and await c7.locator("button:has-text('Refundér køberen')").count() == 1, t7)
        check("6 admin: tallet ved Sager", await ap.locator("a[href='/admin/sager'] .count").all_inner_texts() == ["2"])
        await shot(sec, "ret-6-admin.png")
        r = await api(mp, f"/api/admin/orders/{o7}", {"action": "shipped"})
        check("6: sælgeren kan ikke bruge admins knap", r[0] == 403 and state(o7).startswith("paid|"), r)
        await c7.locator("button:has-text('Markér som sendt')").click()
        ask = await c7.locator(".confirm-ask").inner_text()
        await c7.locator("button:has-text('Ja, gør det')").click(); await ap.wait_for_timeout(2500)
        check("6 admin: markerer pakken som sendt", state(o7) == "shipped|INFORMED|none" and sql(f"select status from sales where order_id='{o7}'") == "shipped" and "selv om sporingen ikke har registreret pakken" in ask, f"{state(o7)} {ask}")
        n_tr = len(stripe()["transfers"])
        r = await api(lp, f"/api/orders/{o7}/confirm")
        check("6: derefter følger ordren den normale vej (køberen bekræfter)", r[0] == 200 and state(o7) == "completed|INFORMED|done" and len(stripe()["transfers"]) == n_tr + 1, f"{r} {state(o7)}")
        n_ref = len(stripe()["refunds"])
        c8 = ap.locator(f"section[data-scan='{o8}']")
        await c8.locator("button:has-text('Refundér køberen')").click(); await c8.locator("button:has-text('Ja, gør det')").click(); await ap.wait_for_timeout(2500)
        check("6 admin: refunderer pakken, der aldrig blev afleveret", state(o8).startswith("refunded|") and len(stripe()["refunds"]) == n_ref + 1, state(o8))
        await ap.goto(BASE + "/admin/sager", wait_until="load")
        check("6 admin: afsnittet er væk, når begge er afgjort", await ap.locator("#scanning").count() == 0)
        # En scanning, der kommer senere, virker stadig på den tredje pakke.
        track(o9, "EN_ROUTE"); await asyncio.sleep(0.8)
        check("6: den tredje pakke bliver scannet og er sendt", state(o9) == "shipped|EN_ROUTE|none", state(o9))

        # ── Punkt 1: en refunderet vare kommer ikke til salg af sig selv ───────────────────────────
        check("1: varen fra den refunderede ordre er usolgt, men ikke til salg", item(I["e3"]) == "unsold|false", item(I["e3"]))
        html = urllib.request.urlopen(BASE + "/til-salg").read().decode()
        check("1: den står ikke under Til salg", "Nederdel, sort" not in html and "Tørklæde, uld" in html and sql(f"select count(*) from items_feed('for_sale', null, 100) where id='{I['e3']}'") == "0")
        r = rpc("ole@firma.dk", "buy_now", {"p_item": I["e3"]})
        check("1: en ny køber kan ikke købe den", r[0] == 400 and item(I["e3"]) == "unsold|false", r)
        await mp.goto(BASE + "/studio", wait_until="load")
        row = mp.locator("ul.list li", has_text="Nederdel, sort").first
        check("1 sælger: varen står som taget af under Til salg i studiet", await row.count() == 1 and "Taget af" in await row.inner_text() and not await row.locator("input[type=checkbox]").is_checked(), await row.inner_text() if await row.count() else "")
        await shot(row, "ret-1-saelger-taget-af.png")
        await row.locator("label.switch").click(); tt = await toast(mp)
        check("1 sælger: sætter den selv til salg igen", item(I["e3"]) == "unsold|true" and "til salg igen" in tt, f"{item(I['e3'])} {tt}")
        html = urllib.request.urlopen(BASE + "/til-salg").read().decode()
        check("1: nu står den under Til salg igen", "Nederdel, sort" in html)
        # Sælgeren annullerer og refunderer selv: samme regel.
        o1 = await buy(lp, I["e5"], "pickup")
        r = await api(mp, f"/api/orders/{o1}/refund")
        check("1: også når sælgeren selv refunderer", r[0] == 200 and item(I["e5"]) == "unsold|false" and sql(f"select status from orders where id='{o1}'") == "refunded", f"{r} {item(I['e5'])}")
        # Et ubetalt køb, sælgeren annullerer, kommer til salg igen som før.
        rpc("liva.k@gmail.com", "buy_now", {"p_item": I["e6"]})
        sale = sql(f"select id from sales where item_id='{I['e6']}' and status='reserved'")
        r = rpc("maja@mail.dk", "cancel_reservation", {"p_sale": sale})
        check("1: et annulleret, ubetalt køb kommer stadig til salg med det samme", r[0] in (200, 204) and item(I["e6"]) == "unsold|true", f"{r} {item(I['e6'])}")

        # ── Punkt 2: sælgeren kan ikke annullere, mens køberen betaler ─────────────────────────────
        url = await checkout(lp, I["e7"], "pickup")
        sale = sql(f"select id from sales where item_id='{I['e7']}' and status='reserved'")
        r = rpc("maja@mail.dk", "cancel_reservation", {"p_sale": sale})
        check("2: annullering afvises, mens køberen står i betalingen", r[0] == 400 and r[1].get("message") == "Køberen er ved at betale lige nu. Prøv igen om lidt." and sql(f"select status from sales where id='{sale}'") == "reserved", r)
        await mp.goto(BASE + "/studio", wait_until="load")
        res = mp.locator("li", has_text="Jakke, denim").filter(has=mp.locator("button:has-text('Annullér')")).first
        await res.locator("button:has-text('Annullér')").click(); tt = await toast(mp)
        check("2 sælger: får beskeden på siden", "Køberen er ved at betale lige nu. Prøv igen om lidt." in tt and sql(f"select status from sales where id='{sale}'") == "reserved", tt)
        await mp.screenshot(path=str(OUT / "ret-2-saelger-besked.png"))
        r = rpc("ole@firma.dk", "buy_now", {"p_item": I["e7"]})
        check("2: varen kan ikke sælges til en anden imens", r[0] == 400, r)
        n_mail = len(mails())
        await pay(lp, url)
        oid = sql(f"select order_id from sales where id='{sale}'")
        check("2: køberen betaler og får sin vare", sql(f"select o.status || '|' || (select count(*) from sales s where s.order_id=o.id and s.status='paid') from orders o where o.id='{oid}'") == "paid|1" and item(I["e7"]) == "sold|true", sql(f"select status from orders where id='{oid}'"))
        check("2: ingen advarsel til Relived ved en normal betaling", not [m for m in mails()[n_mail:] if "uden varer" in m["subject"] or "mangler varer" in m["subject"]])
        r = rpc("maja@mail.dk", "cancel_reservation", {"p_sale": sale})
        check("2: et betalt køb kan stadig ikke annulleres", r[0] == 400 and "betalt" in r[1].get("message", ""), r)
        # Efter 40 minutter (betalingen hos Stripe er lukket) kan sælgeren annullere igen.
        url = await checkout(lp, I["e8"], "pickup")
        sale8 = sql(f"select id from sales where item_id='{I['e8']}' and status='reserved'")
        sql(f"update orders set created_at = now() - interval '41 minutes' where id = (select order_id from sales where id='{sale8}')")
        r = rpc("maja@mail.dk", "cancel_reservation", {"p_sale": sale8})
        check("2: når betalingen er udløbet, kan sælgeren annullere", r[0] in (200, 204) and sql(f"select status from sales where id='{sale8}'") == "cancelled" and item(I["e8"]) == "unsold|true", r)

        # Sikkerhedsnettet: en betalt ordre uden varer refunderes automatisk (her fremkaldt direkte i databasen).
        url = await checkout(lp, I["e9"], "pickup")
        sale9 = sql(f"select id from sales where item_id='{I['e9']}' and status='reserved'")
        o_empty = sql(f"select order_id from sales where id='{sale9}'")
        sql(f"update sales set status='cancelled', order_id=null where id='{sale9}'"); sql(f"update items set status='unsold', sold_at=null where id='{I['e9']}'")
        n_mail = len(mails()); n_ref = len(stripe()["refunds"]); n_tr = len(stripe()["transfers"])
        await pay(lp, url)
        new = mails()[n_mail:]; st = stripe()
        tot = int(sql(f"select total_amount from orders where id='{o_empty}'"))
        check("2 net: den tomme ordre refunderes med det samme", sql(f"select status from orders where id='{o_empty}'") == "refunded" and len(st["refunds"]) == n_ref + 1 and int(st["refunds"][-1]["amount"]) == tot * 100 and len(st["transfers"]) == n_tr, f"{sql(f'select status from orders where id={chr(39)}{o_empty}{chr(39)}')} {st['refunds'][-1:]}")
        subj = sorted((m["to"][0], m["subject"]) for m in new)
        check("2 net: køberen og Relived får besked, og ingen får en ordrebekræftelse", subj == [("admin@snuplive.dk", "En betalt ordre uden varer er refunderet"), ("liva.k@gmail.com", "Du har fået pengene tilbage")], subj)
        ta = next((m["text"] for m in new if m["to"] == ["admin@snuplive.dk"]), "")
        check("2 net: Reliveds mail siger, hvad der skete", "Refunderet automatisk, og køberen har fået en mail: " + o_empty in ta and "Varer, da betalingen blev startet: 1. Varer nu: 0." in ta, ta)
        (OUT / "ret-mail-tom-ordre.txt").write_text(ta)
        # Fejler refusionen hos Stripe, får Relived det at vide, og ingen får en ordrebekræftelse for den tomme ordre.
        url = await checkout(lp, I["ec"], "pickup")
        salec = sql(f"select id from sales where item_id='{I['ec']}' and status='reserved'")
        o_fail = sql(f"select order_id from sales where id='{salec}'")
        sql(f"update sales set status='cancelled', order_id=null where id='{salec}'"); sql(f"update items set status='unsold', sold_at=null where id='{I['ec']}'")
        post("http://localhost:12111/__fail", {"refunds": 1})
        n_mail = len(mails()); n_ref = len(stripe()["refunds"])
        await pay(lp, url)
        new = mails()[n_mail:]
        subj = sorted((m["to"][0], m["subject"]) for m in new)
        check("2 net: fejler refusionen, får Relived besked om at refundere i hånden", subj == [("admin@snuplive.dk", "En betalt ordre uden varer kunne ikke refunderes")] and "Kunne IKKE refunderes automatisk" in new[0]["text"] and o_fail in new[0]["text"] and len(stripe()["refunds"]) == n_ref and sql(f"select status from orders where id='{o_fail}'") == "paid", subj)
        r = await api(ap, f"/api/admin/orders/{o_fail}", {"action": "refund"})
        check("2 net: Relived kan så refundere ordren fra backoffice", r[0] == 200 and sql(f"select status from orders where id='{o_fail}'") == "refunded" and len(stripe()["refunds"]) == n_ref + 1, r)
        # Mangler kun den ene af to varer, refunderes intet automatisk, men Relived får besked.
        url = await checkout(lp, [I["ea"], I["eb"]], "pickup")
        saleb = sql(f"select id from sales where item_id='{I['eb']}' and status='reserved'")
        o_half = sql(f"select order_id from sales where id='{saleb}'")
        sql(f"update sales set status='cancelled', order_id=null where id='{saleb}'")
        n_mail = len(mails()); n_ref = len(stripe()["refunds"])
        await pay(lp, url)
        new = mails()[n_mail:]
        adm = [m for m in new if m["to"] == ["admin@snuplive.dk"]]
        check("2 net: mangler en af to varer, får Relived besked, og intet refunderes automatisk", sql(f"select status from orders where id='{o_half}'") == "paid" and len(stripe()["refunds"]) == n_ref and len(adm) == 1 and adm[0]["subject"] == "En betaling mangler varer" and "Varer, da betalingen blev startet: 2. Varer nu: 1." in adm[0]["text"], [(m["to"], m["subject"]) for m in new])

        # ── Punkt 4: gæstelink og invitation til et lukket show har hver sin kode ──────────────────
        code, body = rest("maja@mail.dk", "shows", "POST", {"seller_id": MAJA, "title": "Lukket aften for stamkunder", "category": "dametoej", "starts_at": "2027-06-01T18:00:00Z", "visibility": "invite"})
        closed = body[0]["id"] if code == 201 else ""
        check("4: lukket show oprettet", code == 201 and body[0].get("visibility") == "invite", f"{code} {body}")
        v = rpc("maja@mail.dk", "show_invite_code", {"p_show": closed}); g = rpc("maja@mail.dk", "guest_invite", {"p_show": closed})
        vcode, gcode = v[1], g[1]
        check("4: seernes invitation og gæstelinket er to forskellige koder", v[0] == 200 and g[0] == 200 and len(vcode) == 12 and len(gcode) == 32 and vcode != gcode, f"{v} {g}")
        check("4: de ligger i hver sin tabel", sql(f"select count(*) from show_invites where show_id='{closed}' and code='{vcode}'") == "1" and sql(f"select count(*) from show_guest_invites where show_id='{closed}' and code='{gcode}'") == "1")
        r = rpc("ole@firma.dk", "become_seller", {"p_type": "private"})
        check("Ole bliver sælger", r[0] == 200 and sql(f"select is_seller from profiles where id='{OLE}'") == "t", r)
        op = await login(b, "ole@firma.dk", f"/gaest/{gcode}")
        t = await op.inner_text("main")
        check("4: gæstelinket virker i et lukket show", "Lukket aften for stamkunder" in t and "gælder ikke længere" not in t and await op.locator("main button").count() >= 1, t[:300])
        await op.screenshot(path=str(OUT / "ret-4-gaestelink.png"))
        r = rpc("ole@firma.dk", "guest_join", {"p_code": vcode})
        check("4: en inviteret seer kan ikke gøre sig til gæst med seernes kode", r[0] == 400 and "gælder ikke længere" in r[1].get("message", "") and sql(f"select count(*) from show_guests where show_id='{closed}'") == "0", r)
        r = rpc("ole@firma.dk", "guest_invite_info", {"p_code": vcode})
        check("4: seernes kode viser ingen gæsteinvitation", r[0] == 200 and r[1] == [], r)
        r = rpc("liva.k@gmail.com", "join_show", {"p_code": gcode}); r2 = rpc("liva.k@gmail.com", "join_show", {"p_code": vcode})
        check("4: gæstelinket er ikke en invitation til seere, men seernes kode er", r[0] == 200 and r[1] is None and r2[0] == 200 and r2[1] == closed and sql(f"select count(*) from show_members where show_id='{closed}' and user_id='{LIVA}'") == "1", f"{r} {r2}")
        v2 = rpc("maja@mail.dk", "show_invite_code", {"p_show": closed, "p_new": True})[1]
        check("4: et nyt link til seerne rører ikke gæstelinket", v2 != vcode and rpc("maja@mail.dk", "guest_invite", {"p_show": closed})[1] == gcode, v2)
        g2 = rpc("maja@mail.dk", "guest_invite", {"p_show": closed, "p_renew": True})[1]
        check("4: et nyt gæstelink rører ikke seernes invitation", g2 != gcode and len(g2) == 32 and rpc("maja@mail.dk", "show_invite_code", {"p_show": closed})[1] == v2, g2)
        r = rpc("ole@firma.dk", "guest_join", {"p_code": gcode}); r2 = rpc("ole@firma.dk", "guest_join", {"p_code": g2})
        check("4: det gamle gæstelink er dødt, det nye virker", r[0] == 400 and r2[0] == 200 and r2[1] == closed and sql(f"select count(*) from show_guests where show_id='{closed}' and guest_id='{OLE}' and left_at is null") == "1", f"{r} {r2}")
        r = rest("ole@firma.dk", "show_guest_invites?select=code"); r2 = rest(None, "show_guest_invites?select=code")
        check("4: ingen kan læse gæstekoderne direkte", r[0] in (401, 403) and r2[0] in (401, 403), f"{r} {r2}")
        await mp.goto(f"{BASE}/studio/{closed}", wait_until="load"); await mp.wait_for_timeout(1500)
        page_text = await mp.inner_text("body")
        check("4 studiet: siden for det lukkede show åbner uden fejl", "Lukket aften for stamkunder" in page_text and "Noget gik galt" not in page_text)

        # ── Punkt 3: en sælger, Relived har lukket, kan ikke åbne sig selv igen ────────────────────
        r = await api(lp, "/api/report", {"target_type": "profile", "target_id": OLE, "reason": "falsk", "message": "Sælger kopivarer igen og igen."})
        rid = sql(f"select id from reports where target_type='profile' and target_id='{OLE}' and status='open' limit 1")
        check("3: profilen er anmeldt", r[0] == 200 and rid != "", r)
        r = await api(ap, f"/api/admin/reports/{rid}", {"action": "remove", "decision": "Gentagne salg af kopivarer."})
        check("3: Relived lukker sælgeren, og lukningen huskes", r[0] == 200 and sql(f"select is_seller from profiles where id='{OLE}'") == "f" and sql(f"select count(*) from seller_closures where user_id='{OLE}'") == "1", r)
        r = rpc("ole@firma.dk", "become_seller", {"p_type": "private"})
        check("3: den lukkede sælger kan ikke åbne sig selv med Bliv sælger", r[0] == 400 and r[1].get("message") == "Relived har lukket din sælgerprofil. Skriv til kontakt@relived.dk, hvis du mener, det er en fejl." and sql(f"select is_seller from profiles where id='{OLE}'") == "f", r)
        r = rpc("ole@firma.dk", "become_seller", {"p_type": "business", "p_business_name": "Oles Firma ApS", "p_cvr": "12345678"})
        check("3: heller ikke som virksomhed", r[0] == 400 and sql(f"select is_seller from profiles where id='{OLE}'") == "f", r)
        code, body = rest("ole@firma.dk", "shows", "POST", {"seller_id": OLE, "title": "Jeg er tilbage", "category": "dametoej", "starts_at": "2027-01-01T20:00:00Z"})
        check("3: og kan ikke oprette et show", code in (400, 401, 403) and sql(f"select count(*) from shows where seller_id='{OLE}'") == "0", f"{code} {body}")
        r = rest("ole@firma.dk", "seller_closures?select=user_id"); r2 = rest("ole@firma.dk", f"seller_closures?user_id=eq.{OLE}", "DELETE")
        check("3: lukningen kan hverken læses eller slettes af brugeren", r[0] in (401, 403) and r2[0] in (401, 403) and sql(f"select count(*) from seller_closures where user_id='{OLE}'") == "1", f"{r} {r2}")
        await op.goto(BASE + "/studio", wait_until="load")
        await op.locator("label.seller-opt").first.click()
        if await op.locator(".seller-form input[type=checkbox]").count(): await op.locator(".seller-form input[type=checkbox]").first.check()
        await op.locator(".seller-form button[type=submit]").click(); tt = await toast(op)
        check("3 på siden: Bliv sælger giver en klar besked", "Relived har lukket din sælgerprofil" in tt and sql(f"select is_seller from profiles where id='{OLE}'") == "f", tt)
        await op.screenshot(path=str(OUT / "ret-3-lukket-saelger.png"))
        r = await api(op, "/api/admin/lukket-saelger", {"user": OLE}); r2 = await api(mp, "/api/admin/lukket-saelger", {"user": OLE})
        check("3: kun Relived kan åbne sælgeren igen", r[0] == 403 and r2[0] == 403 and sql(f"select count(*) from seller_closures where user_id='{OLE}'") == "1", f"{r} {r2}")
        await ap.goto(f"{BASE}/admin/medlemmer/{OLE}", wait_until="load")
        bx = ap.locator("[data-seller-closed]")
        check("3 admin: medlemmets side viser, at sælgerprofilen er lukket", await bx.count() == 1 and "Relived har lukket sælgerprofilen" in await bx.inner_text())
        await shot(bx, "ret-3-admin-lukket.png")
        await bx.locator("button:has-text('Åbn sælgerprofilen igen')").click()
        await bx.locator("button:has-text('Ja, åbn sælgerprofilen')").click(); await ap.wait_for_timeout(2000)
        check("3 admin: åbner sælgerprofilen igen", sql(f"select count(*) from seller_closures where user_id='{OLE}'") == "0" and await ap.locator("[data-seller-closed]").count() == 0)
        r = rpc("ole@firma.dk", "become_seller", {"p_type": "private"})
        check("3: derefter kan brugeren selv blive sælger igen", r[0] == 200 and sql(f"select is_seller from profiles where id='{OLE}'") == "t", r)
        r = await api(ap, "/api/admin/lukket-saelger", {"user": OLE})
        check("3 admin: en sælger, der ikke er lukket, kan ikke åbnes", r[0] == 404, r)
        r = rpc("maja@mail.dk", "become_seller", {"p_type": "private"})
        check("3: andre sælgere er ikke berørt", r[0] == 200 and sql(f"select is_seller from profiles where id='{MAJA}'") == "t", r)
        await b.close()
    print("\n" + ("ALT OK" if not fails else f"{len(fails)} FEJL: " + "; ".join(fails)))

async def run_sandbox():
    """Testfasen (SHIPMONDO_SANDBOX=1): testlabels bliver aldrig scannet, så sælgeren har en testknap."""
    seed()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        mp = await setup_seller(b)
        lp = await login(b, "liva.k@gmail.com", "/konto")
        o = await buy(lp, I["e1"])
        r = await api(mp, f"/api/orders/{o}/label", {"weight": 1000})
        check("sandbox: ordre betalt og testlabel lavet", r[0] == 200 and state(o) == "paid|INFORMED|none", f"{r} {state(o)}")
        r = rpc("maja@mail.dk", "mark_shipped", {"p_order": o})
        check("sandbox: databasens funktion siger stadig nej", r[0] == 400 and state(o) == "paid|INFORMED|none", r)
        r = await api(lp, f"/api/orders/{o}/afleveret")
        check("sandbox: køberen kan ikke bruge testknappen", r[0] == 409 and state(o) == "paid|INFORMED|none", r)
        sql(f"update orders set label_created_at = now() - interval '6 days' where id='{o}'")
        n_mail = len(mails()); c = cron()
        check("sandbox: ingen mails om manglende scanning i testfasen", c.get("scanFlagged") == 0 and len(mails()) == n_mail, c)
        await mp.goto(BASE + "/studio", wait_until="load")
        so = mp.locator(".seller-order", has_text="Kjole, rød").first
        t = await so.inner_text()
        check("sandbox sælger: testknappen vises med forklaring", await so.locator("button:has-text('Testlabel: markér som afleveret')").count() == 1 and "Knappen findes kun i testfasen." in t, t[t.find("Pak varerne"):][:400])
        await shot(so, "ret-6-saelger-testlabel.png")
        await so.locator("button:has-text('Testlabel: markér som afleveret')").click(); tt = await toast(mp)
        check("sandbox sælger: testpakken er markeret som afleveret", state(o) == "shipped|INFORMED|none" and "Testpakken er markeret som afleveret." in tt, f"{state(o)} {tt}")
        n_tr = len(stripe()["transfers"])
        r = await api(lp, f"/api/orders/{o}/confirm")
        check("sandbox: køberen bekræfter, og forløbet kan prøves til ende", r[0] == 200 and state(o) == "completed|INFORMED|done" and len(stripe()["transfers"]) == n_tr + 1, f"{r} {state(o)}")
        await b.close()
    print("\n" + ("ALT OK" if not fails else f"{len(fails)} FEJL: " + "; ".join(fails)))

async def run_without():
    """Før 0042 er kørt (databasen er bygget uden filen): siden skal virke som før, uden fejl."""
    seed()
    check("uden: databasen har ikke 0042", sql("select count(*) from information_schema.columns where table_name='orders' and column_name='scan_flagged_at'") == "0" and sql("select to_regclass('public.seller_closures') is null") == "t")
    async with async_playwright() as p:
        b = await p.chromium.launch()
        mp = await setup_seller(b)
        lp = await login(b, "liva.k@gmail.com", "/konto")
        ap = await login(b, "admin@snuplive.dk", "/admin/sager", 1280, 900)
        o = await buy(lp, I["e1"])
        r = await api(mp, f"/api/orders/{o}/label", {"weight": 1000})
        check("uden: ordre betalt og label lavet", r[0] == 200 and state(o) == "paid|INFORMED|none", f"{r} {state(o)}")
        sql(f"update orders set label_created_at = now() - interval '6 days' where id='{o}'")
        n_mail = len(mails()); c = cron()
        check("uden: det daglige job kører uden fejl og sender ingen nye mails", c.get("scanFlagged") == 0 and "completed" in c and len(mails()) == n_mail, c)
        for pg, path, needle in ((mp, "/studio", "Kjole, rød"), (lp, "/kurv", "Kjole, rød"), (ap, "/admin/sager", "Sager"), (ap, f"/admin/medlemmer/{MAJA}", "@maja"), (ap, "/admin/ordrer", "Ordrer")):
            await pg.goto(BASE + path, wait_until="load"); t = await pg.inner_text("body")
            check(f"uden: {path} åbner uden fejl", needle in t and "Noget gik galt" not in t)
        check("uden admin: ingen afsnit eller bokse, der kræver filen", await ap.locator("#scanning").count() == 0 and await ap.locator("[data-seller-closed]").count() == 0)
        r = await api(ap, "/api/admin/lukket-saelger", {"user": MAJA})
        check("uden admin: åbn-knappens adresse beder om filen", r[0] == 500 and "0042_rettelser.sql" in r[1].get("error", ""), r)
        track(o, "EN_ROUTE"); await asyncio.sleep(0.8)
        check("uden: sporingen virker som før", state(o) == "shipped|EN_ROUTE|none", state(o))
        url = await checkout(lp, I["e2"], "pickup")
        await pay(lp, url)
        check("uden: betaling virker som før", sql(f"select o.status from orders o join sales s on s.order_id=o.id where s.item_id='{I['e2']}'") == "paid")
        g = rpc("maja@mail.dk", "guest_invite", {"p_show": sql("select id from shows where seller_id='" + MAJA + "' and status <> 'ended' limit 1") or SHOW})
        check("uden: gæstelinket svarer som før (ingen fejl i siden)", g[0] in (200, 400), g)
        await b.close()
    print("\n" + ("ALT OK" if not fails else f"{len(fails)} FEJL: " + "; ".join(fails)))

MODE = sys.argv[1] if len(sys.argv) > 1 else ""
asyncio.run(run_sandbox() if MODE == "sandbox" else run_without() if MODE == "uden" else run())
sys.exit(1 if fails else 0)
