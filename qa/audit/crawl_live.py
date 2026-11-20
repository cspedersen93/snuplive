"""Gennemgang af den rigtige side udefra (uden login): alle sider fra sitemap + links, på mobil og computer."""
import asyncio, json, re, sys, urllib.request
from urllib.parse import urljoin, urlparse
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "https://relived.dk"
OUT = sys.argv[2] if len(sys.argv) > 2 else "live.json"
HOST = urlparse(BASE).netloc
def norm(u):
    p = urlparse(u); return f"{p.scheme}://{p.netloc}{p.path.rstrip('/') or '/'}" + (f"?{p.query}" if p.query else "")
async def main():
    seeds = {BASE + "/"}
    try:
        sm = urllib.request.urlopen(BASE + "/sitemap.xml", timeout=30).read().decode()
        seeds |= {u.replace("https://relived.dk", BASE) for u in re.findall(r"<loc>([^<]+)</loc>", sm)}
    except Exception as e: print("sitemap fejl", e)
    for extra in ["/login", "/kurv", "/studio", "/konto", "/soeg?q=kjole", "/findes-ikke-xyz", "/kommer-snart", "/nyhedsbrev", "/app", "/niveauer"]: seeds.add(BASE + extra)
    todo = [norm(s) for s in seeds]; seen = set(todo); res = {}; ext = {}
    async with async_playwright() as p:
        b = await p.chromium.launch()
        mob = await b.new_context(viewport={"width": 390, "height": 844}, user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", is_mobile=True, has_touch=True)
        desk = await b.new_context(viewport={"width": 1366, "height": 850})
        while todo and len(res) < 140:
            url = todo.pop(0)
            r = {"console": [], "bad": [], "url": url}
            for name, ctx in (("mob", mob), ("desk", desk)):
                pg = await ctx.new_page()
                pg.on("console", lambda m, r=r, name=name: r["console"].append(f"{name}: {m.text[:200]}") if m.type == "error" else None)
                pg.on("pageerror", lambda e, r=r, name=name: r["console"].append(f"{name} JS: {str(e)[:200]}"))
                pg.on("response", lambda resp, r=r, name=name: r["bad"].append(f"{name} {resp.status} {resp.url[:150]}") if resp.status >= 400 and not resp.url.startswith(url) else None)
                try:
                    resp = await pg.goto(url, wait_until="load", timeout=45000)
                    await pg.wait_for_timeout(1200)
                    r[name + "_status"] = resp.status if resp else None; r[name + "_final"] = pg.url
                    info = await pg.evaluate("""() => {
                        const q = (s) => document.querySelector(s);
                        const imgs = [...document.images].filter(i => i.complete && i.naturalWidth === 0 && i.currentSrc).map(i => i.currentSrc.slice(0,140));
                        const noalt = [...document.images].filter(i => !i.hasAttribute('alt')).length;
                        const wide = [...document.querySelectorAll('body *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > window.innerWidth + 2 && getComputedStyle(e).position !== 'fixed'; }).slice(0,3).map(e => e.tagName + '.' + (e.className||'').toString().slice(0,40));
                        const small = [...document.querySelectorAll('a,button')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.height < 28 || b.width < 28) && !e.closest('p,li,.prose,footer,.crumbs,nav'); }).length;
                        const empties = [...document.querySelectorAll('a,button')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && !(e.innerText||'').trim() && !e.getAttribute('aria-label') && !e.querySelector('img[alt],svg[aria-label]') && !e.title; }).slice(0,3).map(e => e.outerHTML.slice(0,120));
                        return { title: document.title, desc: q('meta[name=description]')?.content || '', h1: [...document.querySelectorAll('h1')].map(h => h.innerText.trim().slice(0,80)), canonical: q('link[rel=canonical]')?.href || '', robots: q('meta[name=robots]')?.content || '',
                          overflow: document.documentElement.scrollWidth > window.innerWidth + 1, wide, imgs, noalt, small, empties, lang: document.documentElement.lang,
                          text: document.body.innerText.length, links: [...document.querySelectorAll('a[href]')].map(a => a.href) };
                    }""")
                    links = info.pop("links"); r[name] = info
                    for l in links:
                        if l.startswith(("mailto:", "tel:", "javascript:")): continue
                        pu = urlparse(l)
                        if pu.netloc == HOST:
                            n = norm(l.split("#")[0])
                            if n not in seen and not re.search(r"/api/|/_next/|\.(png|jpg|webp|pdf|xml|txt)$", n): seen.add(n); todo.append(n)
                        elif pu.scheme in ("http", "https"): ext.setdefault(l.split("#")[0], url)
                except Exception as e:
                    r[name + "_err"] = str(e)[:200]
                await pg.close()
            res[url] = r; print(len(res), r.get("mob_status"), url, flush=True)
        await b.close()
    json.dump({"pages": res, "external": ext, "left": todo}, open(OUT, "w"), ensure_ascii=False, indent=1)
asyncio.run(main())
