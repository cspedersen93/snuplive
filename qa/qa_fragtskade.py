"""Fragtskade: to billeder kræves (pakken og skaden), og admin ser, hvordan kravet rejses hos fragtfirmaet.
Kør på en frisk database:  bash restart_qa.sh reset && python3 qa_fragtskade.py
"""
import asyncio, pathlib, subprocess, json, urllib.request
from playwright.async_api import async_playwright
from PIL import Image, ImageDraw

BASE = "http://localhost:3100"
S = pathlib.Path("/home/claude/qa")
OUT = S / "ds2"; OUT.mkdir(exist_ok=True)
PG = "PGHOST=/var/lib/postgresql PGPORT=54329 psql -tA -U postgres -d snupqa -c"
MAJA = "00000000-0000-0000-0000-00000000000a"; LIVA = "00000000-0000-0000-0000-00000000000b"
SHOW = "10000000-0000-0000-0000-0000000000f1"
ITEMS = {"b1": ("Glasvase, grøn", 220), "b2": ("Kaffekopper, 4 stk", 140), "b3": ("Spejl, rundt", 300), "b4": ("Fad, keramik", 90)}
I = {k: f"20000000-0000-0000-0000-0000000000{k}" for k in ITEMS}
fails = []
def check(name, ok, extra=""):
    print(("OK  " if ok else "FEJL"), name, str(extra)[:200])
    if not ok: fails.append(name)
def sql(q): return subprocess.run(["bash", "-c", f'{PG} "{q}"'], capture_output=True, text=True).stdout.strip()
def post(url, body):
    r = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"content-type": "application/json"}); return json.loads(urllib.request.urlopen(r).read())

def make_photos():
    for n, (col, txt) in enumerate([((150, 110, 70), "Pakken udefra"), ((70, 110, 150), "Skaden")], 1):
        im = Image.new("RGB", (1200, 900), col); d = ImageDraw.Draw(im); d.rectangle([200, 200, 1000, 700], outline=(240, 235, 220), width=12); d.text((240, 240), txt, fill=(240, 235, 220))
        im.save(S / f"sagfoto{n}.jpg")

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
async def toast(pg):
    await pg.wait_for_timeout(700); return " | ".join(await pg.locator(".toast").all_inner_texts())
async def ship_it(mp, oid):
    r = await api(mp, f"/api/orders/{oid}/label", {"weight": 1000})
    sid = sql(f"select shipmondo_shipment_id from orders where id='{oid}'")
    post("http://localhost:12112/__track", {"shipment_id": int(sid), "status": "EN_ROUTE"}); await asyncio.sleep(0.8)
    return r

async def run():
    make_photos()
    sql(f"insert into shows (id, seller_id, title, category, status, starts_at, started_at, ended_at) values ('{SHOW}', '{MAJA}', 'Glas og keramik', 'bolig', 'ended', now() - interval '2 days', now() - interval '2 days', now() - interval '2 days') on conflict (id) do nothing")
    vals = ", ".join(f"('{I[k]}', '{SHOW}', '{MAJA}', '{n}', {p}, {i + 1}, 'unsold', true, now())" for i, (k, (n, p)) in enumerate(ITEMS.items()))
    sql(f"insert into items (id, show_id, seller_id, name, price, position, status, for_sale, listed_at) values {vals} on conflict (id) do nothing")
    async with async_playwright() as p:
        b = await p.chromium.launch()
        mp = await login(b, "maja@mail.dk", "/studio")
        if await mp.locator(".payout .btn-red").count():
            await mp.click(".payout .btn-red"); await mp.wait_for_url(f"{BASE}/studio?udbetaling=*", timeout=15000); await mp.wait_for_load_state("load")
        if await mp.locator("#sa-a1").count():
            await mp.fill("#sa-a1", "Jagtvej 10, 2. tv"); await mp.fill("#sa-zip", "2200"); await mp.fill("#sa-city", "København N"); await mp.fill("#sa-phone", "+45 22 33 44 55")
            await mp.click(".addr-form .btn-red"); await mp.wait_for_timeout(1500)
        lp = await login(b, "liva.k@gmail.com", "/konto", 390, 844)
        o1 = await buy_and_pay(lp, I["b1"])
        r = await ship_it(mp, o1)
        check("ordre 1 betalt og sendt", sql(f"select status from orders where id='{o1}'") == "shipped", r)

        # Formularen på mobil
        await lp.goto(BASE + "/kurv", wait_until="load")
        await lp.click(".order-state .linkbtn:has-text('Meld det her')")
        await lp.click(".problem-form label:has-text('gået i stykker undervejs')")
        form = await lp.inner_text(".problem-form")
        check("formular: beder om to billeder og om at gemme emballagen", "Billeder af pakken og skaden" in form and "ét af pakken udefra" in form and "Gem varen og al emballagen" in form, form[form.find("Billeder"):][:260])
        await lp.fill(".problem-form textarea", "Vasen var knust, da jeg åbnede pakken.")
        await lp.click(".problem-form .btn-ivory"); t = await toast(lp)
        check("uden billeder: afvist", "to billeder" in t, t)
        await lp.set_input_files(".problem-ph-add input", [str(S / "sagfoto1.jpg")])
        await lp.wait_for_function("document.querySelectorAll('.problem-ph li').length === 1", timeout=10000)
        await lp.click(".problem-form .btn-ivory"); t = await toast(lp)
        check("med ét billede: afvist", "to billeder" in t and sql("select count(*) from order_issues") == "0", t)
        path1 = sql(f"select name from storage.objects where bucket_id='issues' order by created_at limit 1")
        r = await api(lp, f"/api/orders/{o1}/problem", {"reason": "damaged", "message": "Vasen var knust, da jeg åbnede pakken.", "photos": [path1]})
        check("server: ét billede er ikke nok ved fragtskade", r[0] == 400 and "to billeder" in r[1].get("error", ""), r)
        r = await api(lp, f"/api/orders/{o1}/problem", {"reason": "damaged", "message": "Vasen var knust, da jeg åbnede pakken.", "photos": [], "photosReady": False})
        check("server: kan ikke snydes til at springe billederne over", r[0] == 400 and sql("select count(*) from order_issues") == "0", r)
        r = await api(lp, f"/api/orders/{o1}/problem", {"reason": "damaged", "message": "Vasen var knust, da jeg åbnede pakken.", "photos": [path1, path1]})
        check("server: samme billede to gange tæller som ét", r[0] == 400, r)
        await lp.set_input_files(".problem-ph-add input", [str(S / "sagfoto2.jpg")])
        await lp.wait_for_function("document.querySelectorAll('.problem-ph li').length === 2", timeout=10000)
        ovf = await lp.evaluate("document.documentElement.scrollWidth > window.innerWidth + 1")
        check("mobil: ingen vandret rul", not ovf)
        await shot(lp.locator(".problem-form"), "fragtskade-form-mob.png")
        await lp.click(".problem-form .btn-ivory"); t = await toast(lp)
        check("med to billeder: sagen er meldt", "holder pengene" in t, t)
        check("to billeder gemt på sagen", sql(f"select cardinality(photos) || '|' || reason from order_issues where order_id='{o1}'") == "2|damaged")

        # Andre grunde er uændrede
        o2 = await buy_and_pay(lp, I["b2"]); await ship_it(mp, o2)
        r = await api(lp, f"/api/orders/{o2}/problem", {"reason": "not_as_shown", "message": "Der er kun tre kopper, ikke fire.", "photos": []})
        check("ikke som vist: kræver stadig ét billede", r[0] == 400 and "mindst ét billede" in r[1].get("error", ""), r)
        r = await api(lp, f"/api/orders/{o2}/problem", {"reason": "not_as_shown", "message": "Der er kun tre kopper, ikke fire.", "photos": [path1]})
        check("ikke som vist: ét billede er nok", r[0] == 200, r)
        o3 = await buy_and_pay(lp, I["b3"]); await ship_it(mp, o3)
        r = await api(lp, f"/api/orders/{o3}/problem", {"reason": "not_received", "message": "Pakken er aldrig kommet frem til pakkeshoppen.", "photos": []})
        check("ikke modtaget: ingen billeder nødvendige", r[0] == 200, r)
        o4 = await buy_and_pay(lp, I["b4"], pickup=True)
        paths = sql("select string_agg(name, ',' order by created_at) from storage.objects where bucket_id='issues'").split(",")
        r = await api(lp, f"/api/orders/{o4}/problem", {"reason": "damaged", "message": "Fadet havde en revne, da jeg hentede det.", "photos": paths[:2]})
        check("afhentning: sag om skade meldt", r[0] == 200, r)

        # Admin
        ap = await login(b, "admin@snuplive.dk", "/admin/sager")
        c1 = ap.locator("section.box", has_text=o1).first
        claim = await c1.locator("[data-claim]").inner_text()
        pkg = sql(f"select tracking from orders where id='{o1}'"); carrier = sql(f"select sp_carrier from orders where id='{o1}'")
        limit = "2.500 kr" if carrier == "dao" else "4.500 kr"
        check("admin: krav mod fragtfirmaet med loft, beløb og pakkenummer", "Krav mod fragtfirmaet" in claim and limit in claim and "kostede 220 kr" in claim and pkg in claim and "gemme varen og al emballagen" in claim, claim)
        check("admin: køberens to billeder vises", await c1.locator("img[alt^='Køberens billede']").count() == 2, await c1.locator("img").count())
        loaded = await c1.locator("img[alt^='Køberens billede']").evaluate_all("els => els.every(e => e.complete && e.naturalWidth > 0)")
        check("admin: billederne kan faktisk hentes", loaded)
        await shot(c1, "fragtskade-admin.png")
        c3 = ap.locator("section.box", has_text=o3).first
        claim3 = await c3.locator("[data-claim]").inner_text()
        check("admin: ikke modtaget viser også kravet, uden emballage-teksten", "Krav mod fragtfirmaet" in claim3 and "emballagen" not in claim3, claim3)
        check("admin: ikke som vist har intet krav mod fragtfirmaet", await ap.locator("section.box", has_text=o2).first.locator("[data-claim]").count() == 0)
        check("admin: afhentning har intet krav mod fragtfirmaet", await ap.locator("section.box", has_text=o4).first.locator("[data-claim]").count() == 0)

        # Sælgeren ser billederne, men kan ikke hente andres
        await mp.goto(BASE + "/studio", wait_until="load")
        n = await mp.locator(".issue-ph img").count()
        check("sælger ser køberens billeder", n >= 2, n)
        op = await login(b, "ole@firma.dk", "/konto")
        r = await op.evaluate("""async (p) => { const k='sb_publishable_qa'; const c=document.cookie; const r = await fetch('http://localhost:54400/storage/v1/object/sign/issues/'+p,{method:'POST',headers:{apikey:k,'content-type':'application/json'},body:JSON.stringify({expiresIn:60})}); return r.status; }""", path1)
        check("uvedkommende kan ikke få et link til billederne", r in (400, 401, 403), r)
        await b.close()

asyncio.run(run())
print("\nFEJL:", fails) if fails else print("\nAlle tjek bestået")
