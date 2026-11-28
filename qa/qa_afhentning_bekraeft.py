"""Afhentning: køber og sælger bekræfter begge, før ordren afsluttes (0041_afhentning.sql).
Kør på en frisk database:
  bash restart_qa.sh reset && python3 qa_afhentning_bekraeft.py          (med filen)
  bash restart_qa.sh reset && python3 qa_afhentning_bekraeft.py uden     (som om filen ikke er kørt: den gamle regel)
"""
import asyncio, pathlib, subprocess, json, sys, urllib.request, urllib.error
from playwright.async_api import async_playwright

BASE = "http://localhost:3100"
S = pathlib.Path("/home/claude/qa")
OUT = S / "ds2"
OUT.mkdir(exist_ok=True)
PG = "PGHOST=/var/lib/postgresql PGPORT=54329 psql -tA -U postgres -d snupqa -c"
MAJA = "00000000-0000-0000-0000-00000000000a"; LIVA = "00000000-0000-0000-0000-00000000000b"; OLE = "00000000-0000-0000-0000-00000000000c"
SHOW = "10000000-0000-0000-0000-0000000000f1"
ITEMS = {  # navn, pris
    "p1": ("Kommode, eg", 600), "p2": ("Lænestol, læder", 900), "p3": ("Spisebord, teak", 1200), "p4": ("Gulvlampe, messing", 350),
    "p5": ("Reol, fyr", 250), "p6": ("Skrivebord, hvidt", 400), "p7": ("Spejl, guld", 300), "p8": ("Sofabord, glas", 450),
    "p9": ("Bogkasse, grå", 200), "pa": ("Taburet, sort", 150), "pb": ("Natbord, eg", 220), "pc": ("Vase, keramik", 120),
    "pd": ("Skammel, bøg", 130), "pe": ("Hylde, valnød", 140),
}
I = {k: f"20000000-0000-0000-0000-0000000000{k.replace('p', 'f')}" for k in ITEMS}
fails = []
def check(name, ok, extra=""):
    print(("OK  " if ok else "FEJL"), name, str(extra)[:200])
    if not ok: fails.append(name)
def sql(q): return subprocess.run(["bash", "-c", f'{PG} "{q}"'], capture_output=True, text=True).stdout.strip()
def get(url): return json.loads(urllib.request.urlopen(url).read())
def post(url, body):
    r = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"content-type": "application/json"}); return json.loads(urllib.request.urlopen(r).read())
def rest(email, path, method="GET", body=None):
    """Kald databasen direkte som en bruger (tester adgangsreglerne)."""
    tok = post("http://localhost:54400/auth/v1/__session", {"email": email})["access_token"] if email else "sb_publishable_qa"
    r = urllib.request.Request(f"http://localhost:54400/rest/v1/{path}", method=method, data=json.dumps(body).encode() if body is not None else None,
                               headers={"apikey": "sb_publishable_qa", "Authorization": f"Bearer {tok}", "content-type": "application/json", "Prefer": "return=representation"})
    try:
        with urllib.request.urlopen(r) as f: return f.status, json.loads(f.read() or b"null")
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b"null")
stripe = lambda: get("http://localhost:12111/__state")
mails = lambda: get("http://localhost:12113/__state")["sent"]
def cron():
    rq = urllib.request.Request(BASE + "/api/cron/daily", headers={"authorization": "Bearer qa-cron"}); return json.loads(urllib.request.urlopen(rq).read())
def state(oid): return sql(f"select status || '|' || (pickup_buyer_at is not null)::int || (pickup_seller_at is not null)::int || '|' || issue_open || '|' || transfer_status from orders where id='{oid}'")

async def shot(loc, name):
    """Skærmbillede af et element uden den faste top og de flydende knapper."""
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
async def buy_and_pay(lp, items, pickup=True):
    """Køb en eller flere varer hos sælgeren og betal dem samlet."""
    items = items if isinstance(items, list) else [items]
    for item in items:
        await lp.goto(f"{BASE}/ting/vare-{item}"); await lp.wait_for_timeout(800)
        await lp.click(".item-cta .btn-red"); await lp.wait_for_url(f"{BASE}/kurv*"); await lp.wait_for_timeout(1000)
    if pickup:
        await lp.click(".deliv .opt:nth-child(2)"); await lp.wait_for_timeout(300)
    else:
        await lp.fill("#pshop-zip", "2650"); await lp.wait_for_selector(".pshop-list input", timeout=10000)
        await lp.locator(".pshop-list label").first.click(); await lp.wait_for_timeout(300)
    await lp.click(".summary .btn-red"); await lp.wait_for_url("http://localhost:12111/pay/*", timeout=15000)
    await lp.click("#pay"); await lp.wait_for_url(f"{BASE}/kurv?betaling=*", timeout=15000); await lp.wait_for_timeout(1200)
    return sql(f"select o.id from orders o join sales s on s.order_id=o.id where s.item_id='{items[0]}' order by o.created_at desc limit 1")
async def api(pg, url, body=None, method="POST"):
    return await pg.evaluate("""async ([u,b,m]) => { const r = await fetch(u, m === 'GET' ? {} : {method:m,headers:{'content-type':'application/json'},body:JSON.stringify(b ?? {})}); return [r.status, await r.json().catch(()=>({}))]; }""", [url, body, method])
async def toast(pg):
    await pg.wait_for_timeout(700); return " | ".join(await pg.locator(".toast").all_inner_texts())
def box(pg, oid): return pg.locator(f".pickup-box[data-order='{oid}']")
async def wait_text(loc, text, ms=9000):
    try:
        await loc.filter(has_text=text).first.wait_for(timeout=ms); return True
    except Exception: return False

def seed():
    sql(f"insert into shows (id, seller_id, title, category, status, starts_at, started_at, ended_at) values ('{SHOW}', '{MAJA}', 'Møbler fra kælderen', 'bolig', 'ended', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days') on conflict (id) do nothing")
    vals = ", ".join(f"('{I[k]}', '{SHOW}', '{MAJA}', '{n}', {p}, {i + 1}, 'unsold', true, now())" for i, (k, (n, p)) in enumerate(ITEMS.items()))
    sql(f"insert into items (id, show_id, seller_id, name, price, position, status, for_sale, listed_at) values {vals} on conflict (id) do nothing")

async def setup_seller(b):
    mp = await login(b, "maja@mail.dk", "/studio")
    if await mp.locator(".payout .btn-red").count():
        await mp.click(".payout .btn-red"); await mp.wait_for_url(f"{BASE}/studio?udbetaling=*", timeout=15000); await mp.wait_for_load_state("load")
    return mp

async def run():
    seed()
    async with async_playwright() as p:
        b = await p.chromium.launch()
        mp = await setup_seller(b)
        check("sælger: udbetaling sat op", sql(f"select payouts_enabled from payout_accounts where user_id='{MAJA}'") == "t")
        lp = await login(b, "liva.k@gmail.com", "/konto")
        check("kolonnerne findes", sql("select count(*) from information_schema.columns where table_name='orders' and column_name like 'pickup_%'") == "4")

        # ── A: køberen bekræfter først, sælgeren bagefter ──────────────────────────────────────────
        n_mail = len(mails())
        oa = await buy_and_pay(lp, I["p1"])
        check("A: afhentningsordre betalt", state(oa) == "paid|00|false|none", state(oa))
        new = mails()[n_mail:]
        ms = [m for m in new if m["to"] == ["maja@mail.dk"]]; mb = [m for m in new if m["to"] == ["liva.k@gmail.com"]]
        check("A: sælgerens mail fortæller, at begge bekræfter", ms and "Køberen henter selv. Aftal tid og sted" in ms[0]["text"] and "bekræfter I begge afhentningen på jeres telefoner, før I går hver til sit. Først derefter bliver pengene sendt til din bankkonto." in ms[0]["text"] and "når køberen har fået varerne" not in ms[0]["text"], ms[:1])
        check("A: køberens mail fortæller, at begge bekræfter", mb and "Du henter selv varerne hos @maja" in mb[0]["text"] and "bekræfter I begge afhentningen på jeres telefoner, før I går hver til sit. Først derefter får sælgeren pengene." in mb[0]["text"], mb[:1])

        await lp.goto(BASE + "/kurv", wait_until="load")
        bx = box(lp, oa)
        t = await bx.inner_text()
        check("A køber: boksen vises med begge som ikke bekræftet", "Bekræft afhentningen sammen" in t and "Du har ikke bekræftet endnu" in t and "Sælgeren har ikke bekræftet endnu" in t and await bx.locator("button").count() == 1, t)
        check("A køber: den gamle knap er væk", await lp.locator("button:has-text('Jeg har hentet mine varer')").count() == 0)
        card = lp.locator("section.group", has=bx).first
        check("A køber: kan stadig melde et problem", await card.locator(".linkbtn").count() >= 1, await card.inner_text())
        await shot(card, "afh-1-koeber-foer.png")
        await bx.locator("button:has-text('Bekræft afhentning')").click()
        warn = await bx.locator(".pickup-warn").inner_text()
        check("A køber: advarsel før bekræftelsen", warn == "Har du fået varen, og er den som vist? Når I begge har bekræftet, er handlen afsluttet, og sælgeren får pengene. Bekræftelsen kan ikke trækkes tilbage.", warn)
        check("A køber: knapperne er ikke røde", await bx.locator(".btn-red").count() == 0 and await bx.locator("button:has-text('Ja, jeg har fået varen')").count() == 1)
        await shot(card, "afh-2-koeber-advarsel.png")
        await bx.locator("button:has-text('Fortryd')").click()
        check("A køber: fortryd ændrer ingenting", state(oa) == "paid|00|false|none" and await bx.locator(".pickup-warn").count() == 0, state(oa))

        # Sælgeren har siden åben imens
        await mp.goto(BASE + "/studio", wait_until="load")
        sx = box(mp, oa)
        t = await sx.inner_text()
        check("A sælger: boksen vises", "Bekræft afhentningen sammen" in t and "Du har ikke bekræftet endnu" in t and "Køberen har ikke bekræftet endnu" in t, t)
        so = mp.locator(".seller-order", has=sx).first
        st = await so.inner_text()
        check("A sælger: telefonnummer og ingen gammel tekst", "Afhentning:" in st and "aftal tid og sted" in st and "Køberen bekræfter i appen" not in st, st)
        check("A sælger: overskriften nævner afhentning", await mp.locator("h2:has-text('Skal sendes eller hentes')").count() == 1)
        await shot(so, "afh-3-saelger-foer.png")

        n_tr = len(stripe()["transfers"])
        await bx.locator("button:has-text('Bekræft afhentning')").click()
        await bx.locator("button:has-text('Ja, jeg har fået varen')").click()
        tt = await toast(lp)
        check("A køber: bekræftet, men ordren er ikke afsluttet", state(oa) == "paid|10|false|none" and "Du har bekræftet. Nu mangler sælgeren." in tt and len(stripe()["transfers"]) == n_tr, f"{state(oa)} {tt}")
        t = await bx.inner_text()
        check("A køber: ser sin egen bekræftelse og beskeden om sælgeren", "Du har bekræftet" in t and "Sælgeren har ikke bekræftet endnu" in t and "Bed sælgeren bekræfte" in t and await bx.locator("button").count() == 0, t)
        await shot(card, "afh-4-koeber-venter.png")
        check("A sælger: ser køberens bekræftelse uden at hente siden igen", await wait_text(sx.locator(".pickup-marks li.is-on"), "Køberen har bekræftet"), await sx.inner_text())
        await sx.locator("button:has-text('Bekræft afhentning')").click()
        warn = await sx.locator(".pickup-warn").inner_text()
        check("A sælger: advarsel før bekræftelsen", warn == "Har køberen fået varen? Når I begge har bekræftet, er handlen afsluttet, og pengene bliver sendt til dig. Bekræftelsen kan ikke trækkes tilbage.", warn)
        await shot(so, "afh-5-saelger-advarsel.png")
        await sx.locator("button:has-text('Ja, køberen har fået varen')").click()
        tt = await toast(mp)
        st = stripe()
        check("A: begge har bekræftet: ordren er afsluttet, og sælgeren er betalt én gang", state(oa) == "completed|11|false|done" and len(st["transfers"]) == n_tr + 1 and int(st["transfers"][-1]["amount"]) == 600 * 100 and "I har begge bekræftet" in tt, f"{state(oa)} {tt} {st['transfers'][-1:]}")
        check("A: varen står som handlet", sql(f"select status from sales where order_id='{oa}'") == "done")
        check("A køber: siden skifter selv til Modtaget", await wait_text(lp.locator("section.group .chip"), "Modtaget", 12000) and await box(lp, oa).count() == 0)
        await lp.wait_for_timeout(600)
        await shot(lp.locator("section.group", has_text="Kommode, eg").first, "afh-6-koeber-afsluttet.png")
        await mp.wait_for_timeout(1500)
        check("A sælger: ordren er væk fra listen", await box(mp, oa).count() == 0)
        r = await api(lp, f"/api/orders/{oa}/pickup")
        check("A: et ekstra tryk bagefter gør ingenting", r[0] == 200 and r[1].get("done") is True and len(stripe()["transfers"]) == n_tr + 1, r)

        # ── B: sælgeren først, to varer, og de sidste to tryk næsten samtidig ───────────────────────
        ob = await buy_and_pay(lp, [I["p2"], I["p3"]])
        check("B: ordre med to varer betalt", state(ob) == "paid|00|false|none" and sql(f"select count(*) from sales where order_id='{ob}'") == "2", state(ob))
        await mp.goto(BASE + "/studio", wait_until="load")
        sx = box(mp, ob)
        await sx.locator("button:has-text('Bekræft afhentning')").click()
        warn = await sx.locator(".pickup-warn").inner_text()
        check("B sælger: flertal i advarslen", warn.startswith("Har køberen fået varerne?") and await sx.locator("button:has-text('Ja, køberen har fået varerne')").count() == 1, warn)
        await sx.locator("button:has-text('Ja, køberen har fået varerne')").click(); tt = await toast(mp)
        check("B sælger: bekræftet alene giver ingen penge", state(ob) == "paid|01|false|none" and "Du har bekræftet. Nu mangler køberen." in tt, f"{state(ob)} {tt}")
        t = await sx.inner_text()
        check("B sælger: bedes få køberen til at bekræfte", "Bed køberen bekræfte på ordren under Mine køb" in t, t)
        await shot(mp.locator(".seller-order", has=sx).first, "afh-7-saelger-venter.png")
        await lp.goto(BASE + "/kurv", wait_until="load")
        bx = box(lp, ob)
        t = await bx.inner_text()
        check("B køber: ser, at sælgeren har bekræftet", "Sælgeren har bekræftet" in t and "Du har ikke bekræftet endnu" in t, t)
        await shot(lp.locator("section.group", has=bx).first, "afh-8-koeber-saelger-har-bekraeftet.png")
        r = await api(mp, f"/api/orders/{ob}/pickup")
        check("B sælger: trykker igen, stadig ikke afsluttet", r[0] == 200 and r[1] == {"ok": True, "buyer": False, "seller": True, "done": False} and state(ob) == "paid|01|false|none", r)
        n_tr = len(stripe()["transfers"])
        both = await asyncio.gather(api(lp, f"/api/orders/{ob}/pickup"), api(lp, f"/api/orders/{ob}/pickup"), api(lp, f"/api/orders/{ob}/confirm"))
        st = stripe()
        check("B: tre tryk på samme tid giver én udbetaling", state(ob) == "completed|11|false|done" and len(st["transfers"]) == n_tr + 1 and int(st["transfers"][-1]["amount"]) == 2100 * 100, f"{both} {state(ob)}")

        # ── C: hvem må hvad ───────────────────────────────────────────────────────────────────────
        oc = await buy_and_pay(lp, I["p4"])
        op = await login(b, "ole@firma.dk", "/konto")
        r = await api(op, f"/api/orders/{oc}/pickup")
        check("C: en fremmed kan ikke bekræfte", r[0] == 409 and r[1].get("error") == "Ordren findes ikke." and state(oc) == "paid|00|false|none", r)
        r = await api(op, f"/api/orders/{oc}/pickup", method="GET")
        check("C: en fremmed kan ikke se, hvem der har bekræftet", r[0] == 404, r)
        anon = await (await b.new_context()).new_page(); await anon.goto(BASE + "/vilkaar", wait_until="load")
        r = await api(anon, f"/api/orders/{oc}/pickup"); r2 = await api(anon, f"/api/orders/{oc}/pickup", method="GET")
        check("C: uden login: afvist", r[0] == 401 and r2[0] == 401, f"{r} {r2}")
        code, body = rest("maja@mail.dk", f"orders?id=eq.{oc}", "PATCH", {"pickup_buyer_at": "2026-01-01T00:00:00Z"})
        check("C: sælgeren kan ikke bekræfte for køberen direkte i databasen", code in (401, 403) and state(oc) == "paid|00|false|none", f"{code} {body}")
        code, body = rest("liva.k@gmail.com", f"orders?id=eq.{oc}", "PATCH", {"pickup_seller_at": "2026-01-01T00:00:00Z", "status": "completed"})
        check("C: køberen kan ikke bekræfte for sælgeren direkte i databasen", code in (401, 403) and state(oc) == "paid|00|false|none", f"{code} {body}")
        code, body = rest("liva.k@gmail.com", f"orders?id=eq.{oc}&select=pickup_buyer_at,pickup_seller_at")
        check("C: køberen kan læse status på sin egen ordre", code == 200 and body == [{"pickup_buyer_at": None, "pickup_seller_at": None}], f"{code} {body}")
        code, body = rest("ole@firma.dk", f"orders?id=eq.{oc}&select=pickup_buyer_at")
        check("C: en fremmed kan ikke læse ordren", code == 200 and body == [], f"{code} {body}")
        r = await api(mp, f"/api/orders/{oc}/confirm")
        check("C: sælgeren kan ikke bruge køberens gamle knap", r[0] == 409 and state(oc) == "paid|00|false|none", r)
        r = await api(lp, f"/api/orders/{oc}/confirm")
        check("C: køberens gamle knap tæller kun som køberens bekræftelse", r[0] == 200 and r[1] == {"ok": True, "done": False} and state(oc) == "paid|10|false|none", f"{r} {state(oc)}")
        r = await api(lp, f"/api/orders/{oc}/pickup", method="GET")
        check("C: status kan hentes af køberen", r[0] == 200 and r[1] == {"status": "paid", "buyer": True, "seller": False, "done": False}, r)
        n_done = cron()
        check("C: det daglige job afslutter ikke en ordre, kun køberen har bekræftet", state(oc) == "paid|10|false|none" and n_done.get("completed") == 0, n_done)
        # En pakke til pakkeshop kan ikke bekræftes som afhentning
        os_ = await buy_and_pay(lp, I["p5"], pickup=False)
        r = await api(lp, f"/api/orders/{os_}/pickup"); r2 = await api(mp, f"/api/orders/{os_}/pickup")
        check("C: en pakke kan ikke bekræftes som afhentning", r[0] == 409 and r2[0] == 409 and r[1].get("error") == "Ordren skal ikke afhentes." and sql(f"select status from orders where id='{os_}'") == "paid", f"{r} {r2}")
        r = await api(lp, f"/api/orders/{os_}/confirm")
        check("C: en betalt pakke, der ikke er sendt, kan stadig ikke bekræftes", r[0] == 409 and sql(f"select status from orders where id='{os_}'") == "paid", r)
        await mp.goto(BASE + "/studio", wait_until="load"); await lp.goto(BASE + "/kurv", wait_until="load")
        check("C: pakken har ingen afhentningsboks", await box(mp, os_).count() == 0 and await box(lp, os_).count() == 0)

        # ── D: køberen melder et problem ───────────────────────────────────────────────────────────
        r = await api(lp, f"/api/orders/{oc}/problem", {"reason": "other", "message": "Lampen var ikke den, der blev vist i showet.", "photos": []})
        if r[0] != 200:
            r = await api(lp, f"/api/orders/{oc}/problem", {"reason": "not_received", "message": "Lampen var ikke den, der blev vist i showet.", "photos": []})
        check("D: køberen melder et problem efter sin bekræftelse", r[0] == 200 and state(oc) == "paid|10|true|none", f"{r} {state(oc)}")
        r = await api(mp, f"/api/orders/{oc}/pickup")
        check("D: sælgeren kan ikke bekræfte sig til pengene, mens sagen er åben", r[0] == 409 and "Køberen har meldt et problem" in r[1].get("error", "") and state(oc) == "paid|10|true|none", r)
        await mp.goto(BASE + "/studio", wait_until="load")
        sx = box(mp, oc); t = await sx.inner_text()
        check("D sælger: ingen knap, men en forklaring", await sx.locator("button").count() == 0 and "Køberen har meldt et problem. Afhentningen kan først bekræftes, når Relived har kigget på sagen." in t, t)
        await shot(mp.locator(".seller-order", has=sx).first, "afh-9-saelger-sag.png")
        ap = await login(b, "admin@snuplive.dk", "/admin/sager", 1280, 900)
        ct = await ap.locator("section.box", has_text=oc).first.inner_text()
        check("D admin: sagen viser, hvem der har bekræftet", "Afhentning: køberen har bekræftet" in ct and "sælgeren har ikke bekræftet" in ct, ct[ct.find("Afhentning"):][:160])
        # Sagen lukkes uden at flytte penge, og sælgeren kan så bekræfte
        r = await api(ap, f"/api/admin/orders/{oc}", {"action": "close"})
        check("D: sagen lukket, ordren venter stadig på sælgeren", r[0] == 200 and state(oc) == "paid|10|false|none", f"{r} {state(oc)}")
        n_tr = len(stripe()["transfers"])
        r = await api(mp, f"/api/orders/{oc}/pickup")
        check("D: sælgeren bekræfter efter sagen, og ordren afsluttes", r[0] == 200 and r[1].get("done") is True and state(oc) == "completed|11|false|done" and len(stripe()["transfers"]) == n_tr + 1, f"{r} {state(oc)}")

        # Sælgeren har bekræftet, køberen melder et problem og bekræfter så alligevel
        od = await buy_and_pay(lp, I["p6"])
        r = await api(mp, f"/api/orders/{od}/pickup")
        r2 = await api(lp, f"/api/orders/{od}/problem", {"reason": "not_received", "message": "Sælgeren mødte ikke op, og jeg har ikke fået bordet.", "photos": []})
        check("D2: sælgeren har bekræftet, køberen melder et problem", r[0] == 200 and r2[0] == 200 and state(od) == "paid|01|true|none", f"{r} {r2} {state(od)}")
        c = cron()
        check("D2: det daglige job rører ikke en ordre med åben sag", state(od) == "paid|01|true|none" and c.get("pickupReminders") == 0 and c.get("pickupFlagged") == 0, c)
        n_tr = len(stripe()["transfers"])
        r = await api(lp, f"/api/orders/{od}/pickup")
        res = sql(f"select status || '|' || coalesce(resolution, '') from order_issues where order_id='{od}'")
        check("D2: køberen bekræfter alligevel: sagen er løst, og ordren afsluttes", r[0] == 200 and r[1].get("done") is True and state(od) == "completed|11|false|done" and res == "resolved|buyer_confirmed" and len(stripe()["transfers"]) == n_tr + 1, f"{r} {state(od)} {res}")

        # Køberen melder et problem og bekræfter selv bagefter, før sælgeren har bekræftet
        oe = await buy_and_pay(lp, I["p7"])
        r = await api(lp, f"/api/orders/{oe}/problem", {"reason": "not_received", "message": "Jeg kan ikke få fat i sælgeren.", "photos": []})
        r2 = await api(lp, f"/api/orders/{oe}/pickup")
        res = sql(f"select status || '|' || coalesce(resolution, '') from order_issues where order_id='{oe}'")
        check("D3: køberens bekræftelse løser sagen, men afslutter ikke ordren alene", r[0] == 200 and r2[0] == 200 and r2[1].get("done") is False and state(oe) == "paid|10|false|none" and res == "resolved|buyer_confirmed", f"{r2} {state(oe)} {res}")
        # Sælgeren annullerer i stedet: køberen får pengene tilbage
        n_ref = len(stripe()["refunds"])
        r = await api(mp, f"/api/orders/{oe}/refund")
        check("D3: sælgeren kan stadig annullere og refundere", r[0] == 200 and state(oe).startswith("refunded|10") and len(stripe()["refunds"]) == n_ref + 1, f"{r} {state(oe)}")
        r = await api(mp, f"/api/orders/{oe}/pickup")
        check("D3: en refunderet ordre kan ikke bekræftes", r[0] == 409 and state(oe).startswith("refunded|10"), r)

        # ── E: det daglige job ─────────────────────────────────────────────────────────────────────
        o1 = await buy_and_pay(lp, I["p8"])
        o2 = await buy_and_pay(lp, I["p9"])
        o3 = await buy_and_pay(lp, I["pa"])
        o4 = await buy_and_pay(lp, I["pb"])
        o5 = await buy_and_pay(lp, I["pc"])
        # o1: betalt for 8 dage siden, ingen har bekræftet. Før afsluttede jobbet den efter 7 dage.
        sql(f"update orders set paid_at = now() - interval '8 days' where id='{o1}'")
        # o2: køberen bekræftede for 3 timer siden. o3: sælgeren bekræftede for 30 minutter siden (for tidligt til en påmindelse).
        sql(f"update orders set pickup_buyer_at = now() - interval '3 hours' where id='{o2}'")
        sql(f"update orders set pickup_seller_at = now() - interval '30 minutes' where id='{o3}'")
        # o4: begge har bekræftet, men ordren blev ikke afsluttet (afbrudt undervejs).
        sql(f"update orders set pickup_buyer_at = now() - interval '1 hour', pickup_seller_at = now() - interval '1 hour' where id='{o4}'")
        n_mail = len(mails()); n_tr = len(stripe()["transfers"])
        c = cron()
        new = mails()[n_mail:]
        subj = sorted((m["to"][0], m["subject"]) for m in new)
        check("E: ordren på 8 dage afsluttes ikke længere af sig selv", state(o1) == "paid|00|false|none", state(o1))
        check("E: påmindelser: begge på o1, sælgeren på o2, ingen på o3", c.get("pickupReminders") == 2 and c.get("pickupFlagged") == 0 and subj == [
            ("liva.k@gmail.com", "Har du hentet din vare hos @maja?"), ("maja@mail.dk", "@liva.k har bekræftet afhentningen. Nu mangler du"), ("maja@mail.dk", "Afhentningen til @liva.k er ikke bekræftet")], f"{c} {subj}")
        tb = next((m["text"] for m in new if m["subject"].startswith("Har du hentet")), ""); ts = next((m["text"] for m in new if m["subject"].startswith("Afhentningen til")), ""); tn = next((m["text"] for m in new if "Nu mangler du" in m["subject"]), "")
        check("E: køberens påmindelse", "- Sofabord, glas: 450 kr" in tb and "bekræfter I begge på jeres telefoner, før I går hver til sit. Først derefter får sælgeren pengene." in tb and "/kurv" in tb and "Meld et problem" in tb, tb)
        check("E: sælgerens påmindelse", "som skal hentes hos dig" in ts and "/studio" in ts and "kan du annullere ordren i dit studie. Så får køberen pengene tilbage." in ts, ts)
        check("E: påmindelse til den, der mangler", "@liva.k har bekræftet, at varen er hentet hos dig" in tn and "- Bogkasse, grå: 200 kr" in tn and "Nu mangler kun din bekræftelse." in tn and "annullere" not in tn, tn)
        check("E: begge havde bekræftet: jobbet gør ordren færdig", state(o4) == "completed|11|false|done" and c.get("completed") == 1 and len(stripe()["transfers"]) == n_tr + 1, f"{state(o4)} {c}")
        n_mail = len(mails()); c = cron()
        check("E: ingen får påmindelsen to gange", c.get("pickupReminders") == 0 and len(mails()) == n_mail, c)
        (OUT / "afh-mail-paamindelse-koeber.txt").write_text(tb); (OUT / "afh-mail-paamindelse-saelger.txt").write_text(ts); (OUT / "afh-mail-mangler.txt").write_text(tn)

        # Sælgeren bekræfter o1 efter påmindelsen. Køberen får så sin egen påmindelse.
        r = await api(mp, f"/api/orders/{o1}/pickup")
        sql(f"update orders set pickup_seller_at = now() - interval '3 hours', pickup_reminded_at = now() - interval '5 hours' where id='{o1}'")
        n_mail = len(mails()); c = cron(); new = mails()[n_mail:]
        check("E: den ene bekræfter efter første påmindelse: den anden får en ny", c.get("pickupReminders") == 1 and [(m["to"][0], m["subject"]) for m in new] == [("liva.k@gmail.com", "Bekræft, at du har hentet din vare hos @maja")], f"{c} {[(m['to'], m['subject']) for m in new]}")
        tk = new[0]["text"] if new else ""
        check("E: køberens påmindelse, når sælgeren har bekræftet", "@maja har bekræftet, at du har hentet varen" in tk and "Har du ikke fået varen, eller er noget galt, så tryk Meld et problem på ordren." in tk, tk)
        (OUT / "afh-mail-bekraeft-koeber.txt").write_text(tk)
        n_mail = len(mails()); c = cron()
        check("E: og kun én gang", c.get("pickupReminders") == 0 and len(mails()) == n_mail, c)

        # Besked til Relived: o1 (kun sælgeren, for 4 dage siden) og o5 (ingen, betalt for 15 dage siden)
        sql(f"update orders set pickup_seller_at = now() - interval '4 days' where id='{o1}'")
        sql(f"update orders set paid_at = now() - interval '15 days' where id='{o5}'")
        n_mail = len(mails()); c = cron(); new = mails()[n_mail:]
        adm = [m for m in new if m["subject"].startswith("Afhentning ikke bekræftet")]
        check("E: Relived får besked om de to ordrer", c.get("pickupFlagged") == 2 and len(adm) == 2 and all(m["subject"] == "Afhentning ikke bekræftet: @liva.k og @maja" for m in adm), f"{c} {[(m['to'], m['subject']) for m in new]}")
        ta = next((m["text"] for m in adm if o1 in m["text"]), "")
        check("E: beskeden siger, hvem der har bekræftet", "Køber: @liva.k har ikke bekræftet" in ta and "Sælger: @maja har bekræftet" in ta and "sælgeren skal have 450 kr" in ta and "/admin/sager" in ta, ta)
        check("E: o5 fik også sin påmindelse i samme kørsel", c.get("pickupReminders") == 1 and state(o5) == "paid|00|false|none", c)
        (OUT / "afh-mail-relived.txt").write_text(ta)
        n_mail = len(mails()); c = cron()
        check("E: Relived får kun beskeden én gang", c.get("pickupFlagged") == 0 and len(mails()) == n_mail, c)

        # Admin afgør dem under Sager
        await ap.goto(BASE + "/admin/sager", wait_until="load")
        sec = ap.locator("#afhentning")
        check("admin: afsnittet med ubekræftede afhentninger vises", await sec.locator("section.box").count() == 2 and "Afhentninger, der ikke er bekræftet" in await sec.inner_text())
        c1 = ap.locator(f"section[data-pickup='{o1}']"); t1 = await c1.inner_text()
        check("admin: kortet viser, hvem der har bekræftet, og kun de to knapper", "Køberen: har ikke bekræftet" in t1 and "Sælgeren: har bekræftet" in t1 and "Sofabord, glas (450 kr)" in t1 and await c1.locator("button").count() == 2 and await c1.locator("button:has-text('Luk sagen')").count() == 0, t1)
        badge = await ap.locator("a[href='/admin/sager'] .count").all_inner_texts()
        check("admin: tallet ved Sager tæller de ubekræftede afhentninger med", badge == ["2"], badge)
        await shot(sec, "afh-admin.png")
        n_mail = len(mails()); n_tr = len(stripe()["transfers"])
        await c1.locator("button:has-text('Send pengene til sælgeren')").click(); await c1.locator("button:has-text('Ja, gør det')").click(); await ap.wait_for_timeout(2500)
        new = mails()[n_mail:]
        check("admin: sender pengene til sælgeren", state(o1) == "completed|01|false|done" and len(stripe()["transfers"]) == n_tr + 1, state(o1))
        check("admin: begge får besked om afgørelsen", sorted((m["to"][0], m["subject"]) for m in new) == [("liva.k@gmail.com", "Din ordre er afsluttet"), ("maja@mail.dk", "Ordren er afsluttet: du får din udbetaling")] and all("Afhentningen blev ikke bekræftet af jer begge" in m["text"] for m in new), [(m["to"], m["subject"]) for m in new])
        n_mail = len(mails()); n_ref = len(stripe()["refunds"])
        c5 = ap.locator(f"section[data-pickup='{o5}']")
        await c5.locator("button:has-text('Refundér køberen')").click(); await c5.locator("button:has-text('Ja, gør det')").click(); await ap.wait_for_timeout(2500)
        new = mails()[n_mail:]
        check("admin: refunderer køberen", state(o5).startswith("refunded|00") and len(stripe()["refunds"]) == n_ref + 1, state(o5))
        check("admin: begge får besked om refusionen", sorted((m["to"][0], m["subject"]) for m in new) == [("liva.k@gmail.com", "Du har fået pengene tilbage"), ("maja@mail.dk", "Ordren er annulleret: køberen har fået pengene tilbage")], [(m["to"], m["subject"]) for m in new])
        await ap.goto(BASE + "/admin/sager", wait_until="load")
        check("admin: afsnittet er væk, når alt er afgjort", await ap.locator("#afhentning").count() == 0)

        # Resten af siden: teksterne
        await lp.goto(f"{BASE}/ting/vare-{I['pd']}", wait_until="load")
        await lp.goto(BASE + "/saadan-virker-det", wait_until="load")
        t = await lp.inner_text("main")
        check("Sådan virker det: afhentning beskriver, at begge bekræfter", "bekræfter I begge på jeres telefoner, før I går hver til sit. Først derefter får sælgeren pengene." in t, t[t.find("Afhentning: gratis"):][:300])
        await lp.goto(BASE + "/faq", wait_until="load")
        t = await lp.text_content("main") or ""
        check("FAQ: afhentning nævnt under pengene", "Henter du varen hos sælgeren, bekræfter I begge, når du har fået den, og først derefter får sælgeren pengene." in t)
        await b.close()
    print("\n" + ("ALT OK" if not fails else f"{len(fails)} FEJL: " + "; ".join(fails)))

async def run_without():
    """Som om 0041 ikke er kørt: kolonnerne fjernes, og alt skal virke som før."""
    seed()
    sql("alter table orders drop column if exists pickup_buyer_at, drop column if exists pickup_seller_at, drop column if exists pickup_reminded_at, drop column if exists pickup_flagged_at; notify pgrst, 'reload schema'")
    await asyncio.sleep(1.5)
    check("uden: kolonnerne er væk", sql("select count(*) from information_schema.columns where table_name='orders' and column_name like 'pickup_%'") == "0")
    async with async_playwright() as p:
        b = await p.chromium.launch()
        mp = await setup_seller(b)
        lp = await login(b, "liva.k@gmail.com", "/konto")
        n_mail = len(mails())
        oa = await buy_and_pay(lp, I["p1"])
        st = lambda oid: sql(f"select status || '|' || transfer_status from orders where id='{oid}'")
        check("uden: afhentningsordre betalt", st(oa) == "paid|none", st(oa))
        new = mails()[n_mail:]
        ms = [m for m in new if m["to"] == ["maja@mail.dk"]]; mb = [m for m in new if m["to"] == ["liva.k@gmail.com"]]
        check("uden: mails som før", ms and "Pengene bliver sendt til din bankkonto, når køberen har fået varerne." in ms[0]["text"] and "bekræfter I begge" not in ms[0]["text"] and mb and "bekræfter I begge" not in mb[0]["text"], f"{ms[:1]} {mb[:1]}")
        await lp.goto(BASE + "/kurv", wait_until="load")
        check("uden køber: den gamle knap og ingen boks", await lp.locator("button:has-text('Jeg har hentet mine varer')").count() == 1 and await lp.locator(".pickup-box").count() == 0)
        await mp.goto(BASE + "/studio", wait_until="load")
        t = await mp.inner_text("main")
        check("uden sælger: den gamle tekst og ingen boks", "Køberen bekræfter i appen, når varerne er hentet." in t and await mp.locator(".pickup-box").count() == 0)
        r = await api(mp, f"/api/orders/{oa}/pickup"); r2 = await api(lp, f"/api/orders/{oa}/pickup", method="GET")
        check("uden: den nye adresse svarer pænt nej", r[0] == 409 and r2[0] == 409 and st(oa) == "paid|none", f"{r} {r2}")
        n_tr = len(stripe()["transfers"])
        await lp.click("button:has-text('Jeg har hentet mine varer')"); await lp.click("button:has-text('Ja, alt er i orden')"); tt = await toast(lp)
        check("uden: køberen bekræfter alene som før", st(oa) == "completed|done" and "Pengene sendes nu til sælgeren" in tt and len(stripe()["transfers"]) == n_tr + 1, f"{st(oa)} {tt}")
        ob = await buy_and_pay(lp, I["p2"])
        sql(f"update orders set paid_at = now() - interval '8 days' where id='{ob}'")
        c = cron()
        check("uden: det daglige job afslutter efter 7 dage som før", st(ob) == "completed|done" and c.get("completed") == 1 and c.get("pickupReminders") == 0, f"{st(ob)} {c}")
        ap = await login(b, "admin@snuplive.dk", "/admin/sager", 1280, 900)
        check("uden admin: Sager virker, uden afsnittet", await ap.locator("h1:has-text('Sager')").count() == 1 and await ap.locator("#afhentning").count() == 0)
        await b.close()
    # Læg kolonnerne tilbage, så databasen er som efter 0041.
    subprocess.run(["bash", "-c", "PGHOST=/var/lib/postgresql PGPORT=54329 psql -q -U postgres -d snupqa -f /home/claude/snuplive/supabase/migrations/0041_afhentning.sql"], capture_output=True)
    print("\n" + ("ALT OK" if not fails else f"{len(fails)} FEJL: " + "; ".join(fails)))

asyncio.run(run_without() if len(sys.argv) > 1 and sys.argv[1] == "uden" else run())
sys.exit(1 if fails else 0)
