"""Retur i en sag, returfragt som gæld hos sælgeren, og "Relived dækker" (0039).
Kør på en frisk database:  bash restart_qa.sh reset && python3 qa_retur.py
"""
import asyncio, pathlib, subprocess, json, urllib.request
from playwright.async_api import async_playwright

BASE = "http://localhost:3100"
S = pathlib.Path("/home/claude/qa")
OUT = S / "ds2"
OUT.mkdir(exist_ok=True)
PG = "PGHOST=/var/lib/postgresql PGPORT=54329 psql -tA -U postgres -d snupqa -c"
MAJA = "00000000-0000-0000-0000-00000000000a"; LIVA = "00000000-0000-0000-0000-00000000000b"
SHOW = "10000000-0000-0000-0000-0000000000e1"
ITEMS = {  # navn, pris
    "a1": ("Sommerkjole, blå", 200), "a2": ("Strikkjole, grøn", 150), "a3": ("Vinterstøvler, sorte", 300),
    "a4": ("Uldfrakke, grå", 120), "a5": ("Lædertaske, brun", 180), "a6": ("Silketørklæde", 90),
    "a7": ("Lampe, messing", 110), "a8": ("Regnjakke, gul", 250), "a9": ("Skindjakke, sort", 400), "aa": ("Hue, strik", 60),
}
I = {k: f"20000000-0000-0000-0000-0000000000{k}" for k in ITEMS}
fails = []
def check(name, ok, extra=""):
    print(("OK  " if ok else "FEJL"), name, str(extra)[:170])
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
ship = lambda: get("http://localhost:12112/__state")
mails = lambda: get("http://localhost:12113/__state")["sent"]
debts = lambda: sql("select coalesce(string_agg(amount::text, ',' order by created_at), '') from seller_debts")

async def shot(loc, name):
    """Skærmbillede af et element uden den faste top og de flydende knapper."""
    await loc.page.add_style_tag(content=".head{position:static!important}.sup-fab,.app-banner,.cookie-note,.tabbar,.toast{display:none!important}")
    await loc.scroll_into_view_if_needed(); await loc.page.wait_for_timeout(250)
    await loc.screenshot(path=str(OUT / name))

async def login(b, email, nxt, w=1280, h=900):
    ctx = await b.new_context(viewport={"width": w, "height": h}, color_scheme="dark", device_scale_factor=2)
    pg = await ctx.new_page()
    await pg.goto(f"{BASE}/login?next={nxt}", wait_until="load")
    await pg.fill("#email", email); await pg.click("button[type=submit]")
    await pg.wait_for_selector("#otp"); await pg.fill("#otp", "123456"); await pg.click("button[type=submit]")
    await pg.wait_for_url(f"{BASE}{nxt}*"); await pg.wait_for_load_state("load")
    await pg.add_style_tag(content="[class*=cookie]{display:none!important}")
    return pg
async def buy_and_pay(lp, item, pickup=False):
    await lp.goto(f"{BASE}/ting/vare-{item}"); await lp.wait_for_timeout(800)
    await lp.click(".item-cta .btn-red"); await lp.wait_for_url(f"{BASE}/kurv*"); await lp.wait_for_timeout(1000)
    if pickup:
        await lp.click(".deliv .opt:nth-child(2)"); await lp.wait_for_timeout(300)
    else:
        await lp.fill("#pshop-zip", "2650"); await lp.wait_for_selector(".pshop-list input", timeout=10000)
        await lp.locator(".pshop-list label").first.click(); await lp.wait_for_timeout(300)
    await lp.click(".summary .btn-red"); await lp.wait_for_url("http://localhost:12111/pay/*", timeout=15000)
    await lp.click("#pay"); await lp.wait_for_url(f"{BASE}/kurv?betaling=*", timeout=15000); await lp.wait_for_timeout(1200)
    return sql(f"select o.id from orders o join sales s on s.order_id=o.id where s.item_id='{item}' order by o.created_at desc limit 1")
async def api(pg, url, body):
    return await pg.evaluate("""async ([u,b]) => { const r = await fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}); return [r.status, await r.json().catch(()=>({}))]; }""", [url, body])
async def admin_click(ap, oid, button, confirm=True):
    await ap.goto(BASE + "/admin/sager", wait_until="load")
    card = ap.locator("section.box", has_text=oid).first
    await card.locator(f"button:has-text('{button}')").click()
    if confirm: await card.locator("button:has-text('Ja, gør det')").click()
    await ap.wait_for_timeout(2500)
async def send_and_complain(lp, mp, oid, msg="Varen har en plet, som ikke blev vist.", reason="not_as_shown", photos=None):
    """Sælgeren laver label, pakken sendes, køberen melder et problem."""
    r = await api(mp, f"/api/orders/{oid}/label", {"weight": 1000})
    sid = sql(f"select shipmondo_shipment_id from orders where id='{oid}'")
    post("http://localhost:12112/__track", {"shipment_id": int(sid), "status": "EN_ROUTE"}); await asyncio.sleep(0.8)
    r2 = await api(lp, f"/api/orders/{oid}/problem", {"reason": reason, "message": msg, "photos": photos or []})
    return r[0] == 200 and r2[0] == 200, (r, r2)
def track_return(oid, status="EN_ROUTE"):
    rid = sql(f"select shipment_id from order_returns where order_id='{oid}'")
    return post("http://localhost:12112/__track", {"shipment_id": int(rid), "status": status})

async def run():
    sql(f"insert into shows (id, seller_id, title, category, status, starts_at, started_at, ended_at) values ('{SHOW}', '{MAJA}', 'Kjoler og støvler', 'dametoej', 'ended', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days') on conflict (id) do nothing")
    vals = ", ".join(f"('{I[k]}', '{SHOW}', '{MAJA}', '{n}', {p}, {i + 1}, 'unsold', true, now())" for i, (k, (n, p)) in enumerate(ITEMS.items()))
    sql(f"insert into items (id, show_id, seller_id, name, price, position, status, for_sale, listed_at) values {vals} on conflict (id) do nothing")
    # 0038 kræver billeder ved 'ikke som vist'. Her tester vi retur, så billedet lægges direkte i lageret.
    async with async_playwright() as p:
        b = await p.chromium.launch()
        lp = await login(b, "liva.k@gmail.com", "/konto")
        oa = await buy_and_pay(lp, I["a1"])
        check("A: ordre betalt", sql(f"select status from orders where id='{oa}'") == "paid", oa)
        mp = await login(b, "maja@mail.dk", "/studio")
        if await mp.locator(".payout .btn-red").count():
            await mp.click(".payout .btn-red"); await mp.wait_for_url(f"{BASE}/studio?udbetaling=*", timeout=15000); await mp.wait_for_load_state("load")
        if await mp.locator("#sa-a1").count():
            await mp.fill("#sa-a1", "Jagtvej 10, 2. tv"); await mp.fill("#sa-zip", "2200"); await mp.fill("#sa-city", "København N"); await mp.fill("#sa-phone", "+45 22 33 44 55")
            await mp.click(".addr-form .btn-red"); await mp.wait_for_timeout(1500)
        check("sælger: udbetaling og adresse sat op", sql(f"select payouts_enabled from payout_accounts where user_id='{MAJA}'") == "t" and sql(f"select count(*) from seller_addresses where user_id='{MAJA}'") == "1")
        ok, r = await send_and_complain(lp, mp, oa, "Kjolen har en plet på ryggen, som ikke blev vist.", photos=PHOTOS())
        check("A: sendt og sag meldt", ok and sql(f"select status || issue_open from orders where id='{oa}'") == "shippedtrue", r)

        ap = await login(b, "admin@snuplive.dk", "/admin/sager")
        check("admin: retur-knap og dæk-knap vises", await ap.locator("button:has-text('Bed om varen retur')").count() == 1 and await ap.locator("button:has-text('Relived dækker')").count() == 1)
        await shot(ap.locator("section.box", has_text=oa).first, "retur-admin-foer.png")
        await admin_click(ap, oa, "Bed om varen retur")
        row = sql(f"select manual, price, carrier, sp_name is not null, shipment_id is not null from order_returns where order_id='{oa}'")
        check("A: retur oprettet med label", row.startswith("f|") and row.endswith("|t|t"), row)
        price = int(row.split("|")[1])
        check("A: ingen gæld, før køberen har sendt pakken", debts() == "", debts())
        check("A: pengene holdes stadig tilbage", sql(f"select status || issue_open from orders where id='{oa}'") == "shippedtrue")
        r = await api(ap, f"/api/admin/orders/{oa}", {"action": "return"})
        check("A: kan ikke bede om retur to gange", r[0] == 409, r)
        check("A: kun én returlabel købt", len([s for s in ship()["shipments"].values() if "retur" in (s.get("reference") or "").lower()]) == 1)
        retship = [s for s in ship()["shipments"].values() if "retur" in (s.get("reference") or "").lower()][0]
        rec = [x for x in retship["parties"] if x["type"] == "receiver"][0]; snd = [x for x in retship["parties"] if x["type"] == "sender"][0]
        check("A: returlabel går fra køberen til sælgerens adresse", rec["address1"].startswith("Jagtvej 10") and rec["postal_code"] == "2200" and snd["name"] == "Test Køber", f"{snd} -> {rec}")
        m = mails()
        mb = [x for x in m if x["subject"] == "Send varen retur, så får du pengene tilbage"]; ms = [x for x in m if x["subject"] == "Køberen sender varen retur"]
        check("A: mail til køber med link til labelen", len(mb) == 1 and mb[0]["to"] == ["liva.k@gmail.com"] and "returlabel" in mb[0]["text"] and "/kurv" in mb[0]["text"], mb[:1])
        check("A: mail til sælger om returfragten", len(ms) == 1 and ms[0]["to"] == ["maja@mail.dk"] and f"Returfragten er {price} kr. Når køberen har sendt pakken, trækker vi den fra din næste udbetaling." in ms[0]["text"], ms[:1])
        # Køberen
        await lp.goto(BASE + "/kurv", wait_until="load")
        box = lp.locator(".ret-box").first
        check("A: køber ser retur-boks", await box.count() == 1 and "Send varen retur" in (await box.inner_text()))
        code = await lp.evaluate(f"async () => {{ const r = await fetch('/api/orders/{oa}/returlabel'); return [r.status, r.headers.get('content-type')]; }}")
        check("A: køber kan hente returlabel", code[0] == 200 and "pdf" in (code[1] or ""), code)
        code = await mp.evaluate(f"async () => (await fetch('/api/orders/{oa}/returlabel')).status")
        check("A: sælger kan ikke hente køberens returlabel", code == 404, code)
        await shot(box, "retur-koeber.png")
        card = lp.locator("article, section, li", has=lp.locator(".ret-box")).last
        await shot(card, "retur-koeber-ordre.png")
        # Sælgeren før pakken er sendt
        await mp.goto(BASE + "/studio", wait_until="load")
        txt = await mp.inner_text("main")
        check("A: sælger ser, at varen kommer retur", "Køberen sender varen retur" in txt and f"Når køberen har sendt pakken, trækkes returfragten ({price} kr) fra din næste udbetaling" in txt, txt[txt.find("Relived har givet"):][:260])
        check("A: sælger skylder ikke noget endnu", "Du skylder" not in txt)
        await shot(mp.locator(".issue-note", has_text="Køberen sender varen retur").first, "retur-saelger-sag.png")
        # Returpakken sendes
        track_return(oa); await asyncio.sleep(1)
        check("A: returpakken er registreret som sendt", sql(f"select sent_at is not null from order_returns where order_id='{oa}'") == "t")
        check("A: nu er returfragten sælgerens gæld", debts() == str(price), debts())
        track_return(oa, "DELIVERED"); await asyncio.sleep(0.8)
        check("A: stadig kun én gæld efter mere sporing", debts() == str(price), debts())
        check("A: ordren er ikke rørt af retur-sporingen", sql(f"select status from orders where id='{oa}'") == "shipped")
        await mp.goto(BASE + "/studio", wait_until="load")
        txt = await mp.inner_text("main")
        check("A: sælger ser gælden", f"Du skylder {price} kr i returfragt" in txt, txt[txt.find("Du skylder"):][:60])
        await shot(mp.locator("[data-debt]"), "retur-saelger-gaeld.png")
        await ap.goto(BASE + "/admin/sager", wait_until="load")
        check("A: admin ser, at varen er sendt retur", "Nu kan du refundere køberen" in await ap.inner_text(".adm-page"))
        await shot(ap.locator("section.box", has_text=oa).first, "retur-admin.png")
        await admin_click(ap, oa, "Refundér køberen")
        check("A: refunderet", sql(f"select status from orders where id='{oa}'") == "refunded")
        tot = int(sql(f"select total_amount from orders where id='{oa}'"))
        st = stripe()
        check("A: køber fik hele beløbet", [int(r["amount"]) for r in st["refunds"]] == [tot * 100], st["refunds"])
        check("A: ingen udbetaling til sælger", not st["transfers"], st["transfers"])
        check("A: varen kan sælges igen", sql(f"select status from items where id='{I['a1']}'") != "sold", sql(f"select status from items where id='{I['a1']}'"))

        # B: afsluttes, gælden trækkes fra udbetalingen.
        ob = await buy_and_pay(lp, I["a2"])
        sql(f"update orders set status='shipped', shipped_at=now() where id='{ob}'")
        r = await api(lp, f"/api/orders/{ob}/confirm", {})
        check("B: afsluttet og udbetalt", sql(f"select status || '|' || transfer_status from orders where id='{ob}'") == "completed|done", r)
        payb = int(sql(f"select items_amount from orders where id='{ob}'"))
        amounts = [int(t["amount"]) for t in stripe()["transfers"]]
        check("B: udbetalingen er minus returfragten", amounts == [(payb - price) * 100], f"{amounts} forventet {(payb - price) * 100}")
        check("B: gælden er betalt", sql("select coalesce(sum(amount),0) from seller_debt_payments") == str(price))
        check("B: samme beløb, hvis der spørges igen", sql(f"select public.reserve_debt_for_order('{ob}', {payb})") == str(price) and sql("select count(*) from seller_debt_payments") == "1")
        await mp.goto(BASE + "/studio", wait_until="load")
        txt = await mp.inner_text("main")
        check("B: sælger: gælden er væk, fradraget står på ordren", "Du skylder" not in txt and f"trukket fra: −{price} kr" in txt, txt[txt.find("trukket"):][:50])
        await shot(mp.locator("li, .row, article, section", has_text="trukket fra").last, "retur-saelger-fradrag.png")

        # Sælgervilkårene: det nye afsnit under punkt 9.
        vp = await login(b, "ole@firma.dk", "/konto")
        await vp.goto(BASE + "/vilkaar", wait_until="load")
        para = vp.locator("p", has_text="Retur, når køberen får medhold").first
        check("vilkår: afsnittet om returfragt står under punkt 9", await para.count() == 1 and "Relived lægger ud for returlabelen og trækker beløbet fra dine næste udbetalinger. Du kan se beløbet i dit studie." in await para.inner_text() and "19. november 2026" in await vp.inner_text("main"))
        await vp.add_style_tag(content=".head{position:static!important}.sup-fab,.app-banner,.cookie-note{display:none!important}")
        h = vp.locator("h3", has_text="9. Betaling og udbetaling").first
        await h.scroll_into_view_if_needed(); hb = await h.bounding_box(); pb = await para.bounding_box()
        top = await vp.evaluate("window.scrollY")
        await vp.screenshot(path=str(OUT / "vilkaar-punkt9.png"), full_page=True, clip={"x": hb["x"] - 16, "y": hb["y"] + top - 12, "width": max(hb["width"], pb["width"]) + 32, "height": pb["y"] + pb["height"] - hb["y"] + 28})
        await vp.context.close()

        # C: Relived dækker.
        oc = await buy_and_pay(lp, I["a3"])
        r = await api(lp, f"/api/orders/{oc}/problem", {"reason": "not_as_shown", "message": "Støvlerne er en anden størrelse end vist.", "photos": PHOTOS()})
        check("C: sag meldt", r[0] == 200, r)
        n_ref = len(stripe()["refunds"]); n_tr = len(stripe()["transfers"])
        await ap.goto(BASE + "/admin/sager", wait_until="load")
        await shot(ap.locator("section.box", has_text=oc).first, "daek-admin-foer.png")
        await admin_click(ap, oc, "Relived dækker")
        row = sql(f"select o.status, o.transfer_status, o.issue_open, (select resolution from order_issues where order_id=o.id), (select refunded_at is not null from order_covers where order_id=o.id) from orders o where o.id='{oc}'")
        check("C: afsluttet, udbetalt, sag lukket som dækket", row == "completed|done|f|covered|t", row)
        st = stripe()
        totc = int(sql(f"select total_amount from orders where id='{oc}'")); payc = int(sql(f"select items_amount from orders where id='{oc}'"))
        check("C: køber fik alt tilbage", len(st["refunds"]) == n_ref + 1 and int(st["refunds"][-1]["amount"]) == totc * 100, st["refunds"][-1:])
        check("C: sælger fik sin fulde udbetaling", len(st["transfers"]) == n_tr + 1 and int(st["transfers"][-1]["amount"]) == payc * 100, st["transfers"][-1:])
        check("C: varen er stadig solgt", sql(f"select status from items where id='{I['a3']}'") == "sold")
        r = await api(ap, f"/api/admin/orders/{oc}", {"action": "cover"})
        check("C: kan ikke dækkes to gange", r[0] == 409 and len(stripe()["refunds"]) == n_ref + 1, r)
        await lp.goto(BASE + "/kurv", wait_until="load")
        check("C: køber ser, at pengene er givet tilbage", f"Vi har givet dig pengene tilbage ({totc} kr)" in await lp.inner_text("main"))
        r = await api(lp, f"/api/admin/orders/{oc}", {"action": "cover"})
        check("ikke-admin afvises", r[0] == 403, r)
        r = await api(mp, f"/api/admin/orders/{oc}", {"action": "return"})
        check("sælger kan ikke selv bede om retur", r[0] == 403, r)

        # D: der bedes om retur, men køberen sender aldrig. Admin sender pengene til sælgeren: ingen gæld, labelen annulleres.
        od = await buy_and_pay(lp, I["a4"])
        ok, r = await send_and_complain(lp, mp, od, "Frakken lugter af røg.", photos=PHOTOS())
        await admin_click(ap, od, "Bed om varen retur")
        rid = int(sql(f"select shipment_id from order_returns where order_id='{od}'"))
        n_tr = len(stripe()["transfers"])
        await admin_click(ap, od, "Send pengene til sælgeren")
        check("D: afsluttet og udbetalt til sælger", sql(f"select status || '|' || transfer_status || '|' || issue_open from orders where id='{od}'") == "completed|done|false")
        check("D: sælger fik hele beløbet (ingen returfragt)", int(stripe()["transfers"][-1]["amount"]) == 120 * 100 and len(stripe()["transfers"]) == n_tr + 1, stripe()["transfers"][-1:])
        check("D: den ubrugte returlabel er annulleret", ship()["shipments"][str(rid)]["cancelled"] is True)
        track_return(od); await asyncio.sleep(0.8)
        check("D: ingen gæld, selv om pakken sendes bagefter", sql(f"select count(*) from seller_debts where order_id='{od}'") == "0")

        # E: der bedes om retur, og admin refunderer med det samme. Gælden kommer først, når pakken faktisk sendes.
        oe = await buy_and_pay(lp, I["a5"])
        ok, r = await send_and_complain(lp, mp, oe, "Tasken har en flænge i foret.", photos=PHOTOS())
        await admin_click(ap, oe, "Bed om varen retur")
        await admin_click(ap, oe, "Refundér køberen")
        check("E: refunderet uden gæld", sql(f"select status from orders where id='{oe}'") == "refunded" and sql(f"select count(*) from seller_debts where order_id='{oe}'") == "0")
        rid = int(sql(f"select shipment_id from order_returns where order_id='{oe}'"))
        check("E: returlabelen er ikke annulleret (pakken kan være på vej)", ship()["shipments"][str(rid)]["cancelled"] is False)
        track_return(oe); await asyncio.sleep(0.8)
        check("E: gæld, da pakken blev sendt", sql(f"select amount from seller_debts where order_id='{oe}'") == str(price))

        # I: udbetalingen fejler første gang. Gælden må kun trækkes én gang.
        oi = await buy_and_pay(lp, I["a9"])
        sql(f"update orders set status='shipped', shipped_at=now() where id='{oi}'")
        post("http://localhost:12111/__fail", {"transfers": 1})
        n_tr = len(stripe()["transfers"])
        r = await api(lp, f"/api/orders/{oi}/confirm", {})
        check("I: udbetalingen fejlede", sql(f"select status || '|' || transfer_status from orders where id='{oi}'") == "completed|failed" and len(stripe()["transfers"]) == n_tr, r)
        check("I: gælden er reserveret til ordren", sql(f"select coalesce(sum(amount),0) from seller_debt_payments where order_id='{oi}'") == str(price))
        rq = urllib.request.Request(BASE + "/api/cron/daily", headers={"authorization": "Bearer qa-cron"}); cron = json.loads(urllib.request.urlopen(rq).read())
        check("I: det daglige job sender udbetalingen igen", sql(f"select transfer_status from orders where id='{oi}'") == "done", cron)
        check("I: udbetalt minus returfragten, og kun trukket én gang", int(stripe()["transfers"][-1]["amount"]) == (400 - price) * 100 and len(stripe()["transfers"]) == n_tr + 1 and sql(f"select count(*) || '|' || sum(amount) from seller_debt_payments where order_id='{oi}'") == f"1|{price}", stripe()["transfers"][-1:])

        # F: Shipmondo kan ikke lave returlabelen: køberen sender selv, og sælgeren betaler ikke returfragt.
        of = await buy_and_pay(lp, I["a6"])
        ok, r = await send_and_complain(lp, mp, of, "Tørklædet er ikke silke.", photos=PHOTOS())
        post("http://localhost:12112/__fail", {"shipments": 1})
        await admin_click(ap, of, "Bed om varen retur")
        check("F: retur uden label (køberen sender selv)", sql(f"select manual || '|' || price || '|' || (shipment_id is null) from order_returns where order_id='{of}'") == "true|0|true")
        await lp.goto(BASE + "/kurv", wait_until="load")
        t = await lp.locator(".ret-box").first.inner_text()
        check("F: køber får besked om selv at sende med sporing", "med sporing inden 7 dage" in t and "Hent returlabel" not in t, t)
        mb = [x for x in mails() if x["subject"] == "Send varen retur, så får du pengene tilbage"][-1]
        check("F: mailen har sælgerens adresse", "Jagtvej 10" in mb["text"] and "sporingsnummeret" in mb["text"], mb["text"])
        await admin_click(ap, of, "Refundér køberen")
        check("F: refunderet, ingen gæld", sql(f"select status from orders where id='{of}'") == "refunded" and sql(f"select count(*) from seller_debts where order_id='{of}'") == "0")

        # G: afhentning. Retur uden label, og sagen lukkes.
        og = await buy_and_pay(lp, I["a7"], pickup=True)
        check("G: afhentningsordre betalt", sql(f"select status || '|' || delivery from orders where id='{og}'") == "paid|pickup")
        r = await api(lp, f"/api/orders/{og}/problem", {"reason": "not_as_shown", "message": "Lampen virker ikke.", "photos": PHOTOS()})
        n_ship = len(ship()["shipments"])
        await admin_click(ap, og, "Bed om varen retur")
        check("G: retur uden label, ingen label købt", sql(f"select manual from order_returns where order_id='{og}'") == "t" and len(ship()["shipments"]) == n_ship)
        await admin_click(ap, og, "Luk sagen")
        check("G: sagen lukket, ordren står som betalt", sql(f"select status || '|' || issue_open from orders where id='{og}'") == "paid|false")

        # H: Relived dækker, men refusionen fejler første gang.
        oh = await buy_and_pay(lp, I["a8"])
        r = await api(lp, f"/api/orders/{oh}/problem", {"reason": "not_as_shown", "message": "Jakken er en anden farve.", "photos": PHOTOS()})
        post("http://localhost:12111/__fail", {"refunds": 1})
        n_ref = len(stripe()["refunds"]); n_tr = len(stripe()["transfers"])
        r = await api(ap, f"/api/admin/orders/{oh}", {"action": "cover"})
        row = sql(f"select o.status, o.transfer_status, o.issue_open, (select refunded_at is null from order_covers where order_id=o.id) from orders o where o.id='{oh}'")
        check("H: refusionen fejlede, sagen står åben", r[0] == 502 and row == "completed|done|t|t" and len(stripe()["refunds"]) == n_ref, f"{r} {row}")
        await ap.goto(BASE + "/admin/sager", wait_until="load")
        card = ap.locator("section.box", has_text=oh).first
        check("H: admin ser én knap til at gøre færdig", await card.locator("button:has-text('Gør færdig: refundér køberen')").count() == 1 and await card.locator("button:has-text('Send pengene')").count() == 0)
        await shot(card, "daek-admin-halv.png")
        await card.locator("button:has-text('Gør færdig: refundér køberen')").click(); await ap.wait_for_timeout(2500)
        row = sql(f"select o.issue_open, (select resolution from order_issues where order_id=o.id), (select refunded_at is not null from order_covers where order_id=o.id) from orders o where o.id='{oh}'")
        toth = int(sql(f"select total_amount from orders where id='{oh}'"))
        st = stripe()
        check("H: gjort færdig: køber refunderet én gang, sælger betalt én gang", row == "f|covered|t" and len(st["refunds"]) == n_ref + 1 and int(st["refunds"][-1]["amount"]) == toth * 100 and len(st["transfers"]) == n_tr + 1 and int(st["transfers"][-1]["amount"]) == 250 * 100, f"{row} {st['refunds'][-1:]}")

        # J: gælden er større end udbetalingen: sælgeren får 0 kr for ordren, og resten står til næste gang.
        sql(f"insert into seller_debts (seller_id, order_id, amount) values ('{MAJA}', '{of}', 500)")
        oj = await buy_and_pay(lp, I["aa"])
        sql(f"update orders set status='shipped', shipped_at=now() where id='{oj}'")
        n_tr = len(stripe()["transfers"])
        r = await api(lp, f"/api/orders/{oj}/confirm", {})
        check("J: ordren er afsluttet uden overførsel", sql(f"select status || '|' || transfer_status from orders where id='{oj}'") == "completed|done" and len(stripe()["transfers"]) == n_tr, r)
        check("J: hele udbetalingen gik til gælden", sql(f"select sum(amount) from seller_debt_payments where order_id='{oj}'") == "60")
        await mp.goto(BASE + "/studio", wait_until="load")
        txt = await mp.inner_text("main")
        check("J: sælger ser restgælden", "Du skylder 440 kr i returfragt" in txt, txt[txt.find("Du skylder"):][:60])

        # Adgangsregler direkte i databasen
        check("adgang: sælger ser sin egen gæld", len(rest("maja@mail.dk", "seller_debts?select=amount")[1]) == 3)
        check("adgang: køber ser ikke sælgerens gæld", rest("liva.k@gmail.com", "seller_debts?select=amount")[1] == [] and rest("liva.k@gmail.com", "seller_debt_payments?select=amount")[1] == [])
        check("adgang: køber ser sine egne returer", len(rest("liva.k@gmail.com", "order_returns?select=order_id")[1]) == 5)
        check("adgang: en anden bruger ser ingen returer, gæld eller dækninger", all(rest("ole@firma.dk", t + "?select=*")[1] == [] for t in ("order_returns", "seller_debts", "seller_debt_payments", "order_covers")))
        anon = [rest(None, t + "?select=*") for t in ("order_returns", "seller_debts", "seller_debt_payments", "order_covers")]
        check("adgang: uden login ses intet", all(a[0] in (401, 403) or a[1] == [] for a in anon), anon)
        w = [rest("maja@mail.dk", "seller_debts?seller_id=eq." + MAJA, "DELETE"), rest("maja@mail.dk", "seller_debts?seller_id=eq." + MAJA, "PATCH", {"amount": 1}),
             rest("maja@mail.dk", "seller_debt_payments", "POST", {"debt_id": MAJA, "order_id": oa, "amount": 1}), rest("liva.k@gmail.com", "order_covers", "POST", {"order_id": ob, "amount": 1}),
             rest("liva.k@gmail.com", "order_returns?order_id=eq." + oa, "PATCH", {"sent_at": "2026-01-01"})]
        check("adgang: ingen kan selv rette gæld, returer eller dækninger", all(x[0] in (401, 403) for x in w) and debts().count(",") == 2, [x[0] for x in w])
        r = rest("maja@mail.dk", "rpc/reserve_debt_for_order", "POST", {"p_order": oj, "p_max": 1})
        check("adgang: funktionen, der trækker gæld, er låst", r[0] in (401, 403, 404), r)
        await b.close()

_PH = []
def PHOTOS():
    return list(_PH)

async def prepare_photo():
    """Læg ét klagebillede i lageret som Liva (0038 kræver et billede ved 'ikke som vist')."""
    from PIL import Image
    f = S / "sagfoto1.jpg"
    if not f.exists(): Image.new("RGB", (1200, 900), (150, 90, 60)).save(f)
    tok = post("http://localhost:54400/auth/v1/__session", {"email": "liva.k@gmail.com"})["access_token"]
    name = f"{LIVA}/sag-qa{abs(hash(str(f))) % 10**8:08d}.jpg"
    r = urllib.request.Request(f"http://localhost:54400/storage/v1/object/issues/{name}", data=f.read_bytes(), method="POST",
                               headers={"Authorization": f"Bearer {tok}", "apikey": "sb_publishable_qa", "content-type": "image/jpeg", "x-upsert": "true"})
    urllib.request.urlopen(r).read()
    _PH.append(name)

asyncio.run(prepare_photo())
asyncio.run(run())
print("\nFEJL:", fails) if fails else print("\nAlle tjek bestået")
