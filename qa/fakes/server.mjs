// Falske udgaver af Stripe (12111), Shipmondo (12112) og Resend (12113) til testsiden.
// De husker alt, de bliver bedt om, så testene kan spørge på /__state. Ingen rigtige penge eller nøgler.
import http from "node:http";
import crypto from "node:crypto";

const SITE = process.env.QA_SITE || "http://localhost:3100";
const WH_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_qa";
const SHIP_KEY = process.env.SHIPMONDO_API_KEY || "qa-shipmondo-key";

const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
function send(res, status, body, headers = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": typeof body === "string" ? "text/html; charset=utf-8" : "application/json", "Request-Id": "req_" + rid(8), ...headers });
  res.end(text);
}
const rid = (n = 14) => crypto.randomBytes(n).toString("hex").slice(0, n);
const now = () => Math.floor(Date.now() / 1000);

/** a[b][0][c]=1 → { a: { b: [ { c: "1" } ] } } (Stripes formular-format). */
function parseForm(text) {
  const out = {};
  for (const [k, v] of new URLSearchParams(text)) {
    const keys = k.replace(/\]/g, "").split("[");
    let cur = out;
    keys.forEach((key, i) => {
      if (i === keys.length - 1) cur[key] = v;
      else cur = cur[key] ??= {};
    });
  }
  const fix = (o) => {
    if (!o || typeof o !== "object") return o;
    const ks = Object.keys(o);
    if (ks.length && ks.every((k) => /^\d+$/.test(k))) return ks.sort((a, b) => a - b).map((k) => fix(o[k]));
    for (const k of ks) o[k] = fix(o[k]);
    return o;
  };
  return fix(out);
}

// ── Stripe ──────────────────────────────────────────────────────────────────

const stripe = { sessions: {}, intents: {}, transfers: [], refunds: [], accounts: {}, idem: {}, calls: [], fail: {} };
const sErr = (res, message, code = "invalid_request", status = 400) => send(res, status, { error: { type: "invalid_request_error", message, code } });

async function sendStripeEvent(type, object) {
  const payload = JSON.stringify({ id: "evt_" + rid(), object: "event", api_version: "2025-01-01", created: now(), type, data: { object }, livemode: false });
  const t = now();
  const v1 = crypto.createHmac("sha256", WH_SECRET).update(`${t}.${payload}`).digest("hex");
  try {
    const r = await fetch(`${SITE}/api/stripe/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "Stripe-Signature": `t=${t},v1=${v1}` }, body: payload });
    return r.status;
  } catch (e) {
    return String(e);
  }
}

const stripeServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:12111");
  const p = url.pathname;
  const raw = await readBody(req);
  let m;
  try {
    if (p === "/__state") return send(res, 200, stripe);
    if (p === "/__reset") {
      Object.assign(stripe, { sessions: {}, intents: {}, transfers: [], refunds: [], accounts: {}, idem: {}, calls: [], fail: {} });
      return send(res, 200, { ok: true });
    }
    // Få næste kald til at fejle: POST /__fail {"transfers":1} eller {"refunds":2}
    if (p === "/__fail") {
      Object.assign(stripe.fail, JSON.parse(raw || "{}"));
      return send(res, 200, stripe.fail);
    }
    // "Betalingssiden": køberen betaler med det samme og sendes tilbage til Relived.
    if ((m = /^\/pay\/(cs_[a-z0-9_]+)$/i.exec(p))) {
      const s = stripe.sessions[m[1]];
      if (!s) return send(res, 404, "Ukendt betaling");
      if (url.searchParams.get("annuller")) return send(res, 303, "", { Location: s.cancel_url });
      // Først en lille side med en Betal-knap (som Stripes betalingsside), derefter selve betalingen.
      if (!url.searchParams.get("betal")) {
        return send(res, 200, `<!doctype html><meta charset="utf-8"><title>Falsk Stripe</title><body style="font:16px system-ui;padding:40px"><h1>Falsk Stripe (test)</h1><p>${(s.amount_total / 100).toFixed(2)} kr</p><a id="pay" href="/pay/${s.id}?betal=1">Betal</a> · <a id="cancel" href="/pay/${s.id}?annuller=1">Annullér</a></body>`);
      }
      if (s.status === "open") {
        const pi = "pi_qa_" + rid();
        const ch = "ch_qa_" + rid();
        stripe.intents[pi] = { id: pi, object: "payment_intent", amount: s.amount_total, currency: "dkk", status: "succeeded", latest_charge: ch, metadata: s.payment_intent_data?.metadata ?? {}, transfer_group: s.payment_intent_data?.transfer_group ?? null };
        const name = url.searchParams.get("navn") || "Test Køber";
        Object.assign(s, {
          status: "complete",
          payment_status: "paid",
          payment_intent: pi,
          customer_details: { email: s.customer_email ?? null, name, phone: url.searchParams.get("tlf") || "+4512345678" },
          collected_information: s.shipping_address_collection
            ? { shipping_details: { name, address: { line1: "Testvej 1", line2: null, postal_code: "2650", city: "Hvidovre", country: "DK" } } }
            : null,
        });
        if (!url.searchParams.get("uden_webhook")) await sendStripeEvent("checkout.session.completed", s);
      }
      return send(res, 303, "", { Location: s.success_url.replace("{CHECKOUT_SESSION_ID}", s.id) });
    }
    // "Stripe-onboarding": sælgeren bliver godkendt med det samme.
    if ((m = /^\/onboard\/(acct_[a-z0-9_]+)$/i.exec(p))) {
      const a = (stripe.accounts[m[1]] ??= { id: m[1], object: "account" });
      Object.assign(a, { payouts_enabled: true, details_submitted: true, charges_enabled: true });
      return send(res, 303, "", { Location: url.searchParams.get("retur") || SITE });
    }
    if (!p.startsWith("/v1/")) return send(res, 404, { error: { message: "fakestripe kender ikke " + p } });

    const body = req.method === "GET" ? Object.fromEntries(url.searchParams) : parseForm(raw);
    const idem = req.headers["idempotency-key"];
    stripe.calls.push({ at: new Date().toISOString(), method: req.method, path: p, idem: idem ?? null, body });
    if (idem && stripe.idem[idem]) return send(res, 200, stripe.idem[idem], { "Idempotent-Replayed": "true" });
    const keep = (obj) => {
      if (idem) stripe.idem[idem] = obj;
      return send(res, 200, obj);
    };

    if (p === "/v1/checkout/sessions" && req.method === "POST") {
      const id = "cs_test_" + rid(24);
      const amount = (body.line_items ?? []).reduce((sum, li) => sum + Number(li.price_data?.unit_amount ?? 0) * Number(li.quantity ?? 1), 0);
      const s = {
        id,
        object: "checkout.session",
        status: "open",
        payment_status: "unpaid",
        mode: body.mode,
        url: `http://localhost:12111/pay/${id}`,
        amount_total: amount,
        currency: "dkk",
        metadata: body.metadata ?? {},
        payment_intent: null,
        payment_intent_data: body.payment_intent_data ?? null,
        customer_email: body.customer_email ?? null,
        client_reference_id: body.client_reference_id ?? null,
        shipping_address_collection: body.shipping_address_collection ?? null,
        customer_details: null,
        collected_information: null,
        line_items_in: body.line_items ?? [],
        success_url: body.success_url,
        cancel_url: body.cancel_url,
        expires_at: Number(body.expires_at) || now() + 1800,
      };
      stripe.sessions[id] = s;
      return keep(s);
    }
    if ((m = /^\/v1\/checkout\/sessions\/([^/]+)$/.exec(p)) && req.method === "GET") {
      const s = stripe.sessions[m[1]];
      return s ? send(res, 200, s) : sErr(res, `No such checkout.session: ${m[1]}`, "resource_missing", 404);
    }
    if ((m = /^\/v1\/checkout\/sessions\/([^/]+)\/expire$/.exec(p))) {
      const s = stripe.sessions[m[1]];
      if (!s) return sErr(res, "No such checkout.session", "resource_missing", 404);
      if (s.status !== "open") return sErr(res, "Only Checkout Sessions with a status in [\"open\"] can be expired.");
      s.status = "expired";
      return send(res, 200, s);
    }
    if ((m = /^\/v1\/payment_intents\/([^/]+)$/.exec(p))) {
      const pi = stripe.intents[m[1]] ?? { id: m[1], object: "payment_intent", status: "succeeded", latest_charge: m[1].replace(/^pi_/, "ch_"), amount: null };
      return send(res, 200, pi);
    }
    if (p === "/v1/transfers" && req.method === "POST") {
      if (stripe.fail.transfers > 0) {
        stripe.fail.transfers--;
        return sErr(res, "Insufficient funds in your Stripe account (test).", "balance_insufficient");
      }
      const acct = stripe.accounts[body.destination];
      if (acct && acct.payouts_enabled === false) return sErr(res, "The destination account needs to have the transfers capability enabled.", "insufficient_capabilities_for_transfer");
      const t = { id: "tr_qa_" + rid(), object: "transfer", amount: Number(body.amount), currency: body.currency, destination: body.destination, source_transaction: body.source_transaction ?? null, transfer_group: body.transfer_group ?? null, description: body.description ?? null, metadata: body.metadata ?? {}, created: now() };
      stripe.transfers.push(t);
      return keep(t);
    }
    if (p === "/v1/refunds" && req.method === "POST") {
      if (stripe.fail.refunds > 0) {
        stripe.fail.refunds--;
        return sErr(res, "Refund failed (test).", "refund_failed");
      }
      const pi = stripe.intents[body.payment_intent];
      const already = stripe.refunds.filter((r) => r.payment_intent === body.payment_intent).reduce((s, r) => s + r.amount, 0);
      const amount = body.amount ? Number(body.amount) : (pi?.amount ?? 0) - already;
      if (pi?.amount != null && already + amount > pi.amount) return sErr(res, `Refund amount (${amount}) is greater than unrefunded amount on charge (${pi.amount - already})`, "charge_already_refunded");
      const r = { id: "re_qa_" + rid(), object: "refund", amount, currency: "dkk", payment_intent: body.payment_intent ?? null, status: "succeeded", metadata: body.metadata ?? {}, created: now() };
      stripe.refunds.push(r);
      return keep(r);
    }
    if (p === "/v1/accounts" && req.method === "POST") {
      const a = { id: "acct_qa_" + rid(), object: "account", email: body.email ?? null, country: body.country, payouts_enabled: false, details_submitted: false, charges_enabled: false, metadata: body.metadata ?? {}, controller: body.controller ?? null, business_profile: body.business_profile ?? null };
      stripe.accounts[a.id] = a;
      return keep(a);
    }
    if ((m = /^\/v1\/accounts\/([^/]+)$/.exec(p)) && req.method === "GET") {
      // Konti, der er lagt direkte i testdatabasen, er godkendte.
      const a = (stripe.accounts[m[1]] ??= { id: m[1], object: "account", payouts_enabled: true, details_submitted: true, charges_enabled: true });
      return send(res, 200, a);
    }
    if ((m = /^\/v1\/accounts\/([^/]+)\/login_links$/.exec(p))) return send(res, 200, { object: "login_link", url: `http://localhost:12111/dashboard/${m[1]}` });
    if (p === "/v1/account_links" && req.method === "POST") {
      return send(res, 200, { object: "account_link", url: `http://localhost:12111/onboard/${body.account}?retur=${encodeURIComponent(body.return_url)}`, expires_at: now() + 300 });
    }
    return sErr(res, `fakestripe kender ikke ${req.method} ${p}`, "unknown_url", 404);
  } catch (e) {
    console.error("[fakestripe]", e);
    return send(res, 500, { error: { message: String(e?.message || e) } });
  }
});

// ── Shipmondo ───────────────────────────────────────────────────────────────

const ship = { shipments: {}, next: 7001, webhooks: [], calls: [], fail: {} };
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 283 538]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n").toString("base64");
const POINTS = {
  dao: [
    ["90101", "Kvickly Hvidovre", "Hvidovrevej 300", "2650", "Hvidovre", 350],
    ["90102", "SuperBrugsen Friheden", "Hvidovrevej 59", "2650", "Hvidovre", 900],
    ["90103", "Kiosk Avedøre", "Naverporten 1", "2650", "Hvidovre", 2100],
  ],
  gls: [
    ["2080096001", "Pakkeshop Min Købmand", "Gammel Køge Landevej 263", "2650", "Hvidovre", 420],
    ["2080096002", "Pakkeshop Shell", "Avedøre Havnevej 60", "2650", "Hvidovre", 1500],
    ["2080096003", "Pakkeshop Roskilde Kiosk", "Algade 10", "4000", "Roskilde", 28000],
  ],
};

async function sendTracking(shipmentId, status) {
  const key = ship.webhooks.at(-1)?.key || crypto.createHmac("sha256", SHIP_KEY).update("snuplive-sporing-v1").digest("hex");
  const h = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const pl = Buffer.from(JSON.stringify({ data: { shipment_id: shipmentId, current_status: status, current_status_registered_at: new Date().toISOString() } })).toString("base64url");
  const sig = crypto.createHmac("sha256", key).update(`${h}.${pl}`).digest("base64url");
  const r = await fetch(`${SITE}/api/shipmondo/webhook`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: `${h}.${pl}.${sig}` }) });
  return r.status;
}

const shipServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:12112");
  const p = url.pathname.replace(/^\/api\/public\/v3/, "");
  const raw = await readBody(req);
  let m;
  try {
    if (p === "/__state") return send(res, 200, ship);
    if (p === "/__reset") {
      Object.assign(ship, { shipments: {}, next: 7001, webhooks: [], calls: [], fail: {} });
      return send(res, 200, { ok: true });
    }
    if (p === "/__fail") {
      Object.assign(ship.fail, JSON.parse(raw || "{}"));
      return send(res, 200, ship.fail);
    }
    // Simulér sporing: POST /__track {"shipment_id": 7001, "status": "IN_TRANSIT"}
    if (p === "/__track") {
      const b = JSON.parse(raw || "{}");
      return send(res, 200, { site: await sendTracking(Number(b.shipment_id), String(b.status)) });
    }
    const body = raw ? JSON.parse(raw) : null;
    ship.calls.push({ at: new Date().toISOString(), method: req.method, path: p + url.search, body });
    if (!/^Basic /.test(req.headers.authorization || "")) return send(res, 401, { error: "Unauthorized" });

    if (p === "/pickup_points") {
      const carrier = url.searchParams.get("carrier_code");
      const zip = url.searchParams.get("zipcode") || "";
      const id = url.searchParams.get("id");
      let rows = (POINTS[carrier] ?? []).map(([number, name, address, zipcode, city, distance]) => ({ number, id: number, company_name: name, name, address, address2: `Pakkeshop: ${number}`, zipcode, city, distance, opening_hours: ["Man-Fre 08:00-20:00", "Lør 09:00-18:00"], out_delivery: true }));
      if (id) rows = rows.filter((r) => r.number === id);
      else if (zip === "0000") rows = [];
      return send(res, 200, rows);
    }
    if (p === "/products") {
      const carrier = url.searchParams.get("carrier_code");
      const code = carrier === "gls" ? "GLSDK_SD" : "DAO_STS";
      return send(res, 200, [
        { code, name: carrier === "gls" ? "GLS Pakkeshop" : "DAO Pakkeshop", available: true, service_point_required: true, customs_declaration_required: false, required_services: [], available_services: [{ code: "EMAIL_NT" }, { code: "SMS_NT" }], weight_intervals: [{ to_weight: 20000 }] },
        { code: code + "_RET", name: "Retur pakkeshop", available: true, service_point_required: true, weight_intervals: [{ to_weight: 20000 }] },
      ]);
    }
    if (p === "/shipments" && req.method === "POST") {
      if (ship.fail.shipments > 0) {
        ship.fail.shipments--;
        return send(res, 422, { error: "Validation failed (test)" });
      }
      const id = ship.next++;
      const w = Number(body?.parcels?.[0]?.weight ?? 0);
      const price = w <= 1000 ? "39,00" : "49,00";
      const s = { id, pkg_no: "0570" + String(id).padStart(14, "0"), price, product_code: body.product_code, service_point_id: body.service_point_id, reference: body.reference, parties: body.parties, parcels: [{ weight: w, pkg_no: "0570" + String(id).padStart(14, "0") }], cancelled: false };
      ship.shipments[id] = s;
      return send(res, 201, s);
    }
    if ((m = /^\/shipments\/(\d+)\/labels$/.exec(p))) return ship.shipments[m[1]] ? send(res, 200, [{ base64: PDF, file_format: "pdf" }]) : send(res, 404, { error: "Not found" });
    if ((m = /^\/shipments\/(\d+)\/cancel$/.exec(p))) {
      if (!ship.shipments[m[1]]) return send(res, 404, { error: "Not found" });
      ship.shipments[m[1]].cancelled = true;
      return send(res, 200, ship.shipments[m[1]]);
    }
    if (p === "/webhooks" && req.method === "GET") return send(res, 200, ship.webhooks);
    if (p === "/webhooks" && req.method === "POST") {
      ship.webhooks.push({ ...body, id: ship.webhooks.length + 1, active: true });
      return send(res, 201, ship.webhooks.at(-1));
    }
    return send(res, 404, { error: `fakeshipmondo kender ikke ${req.method} ${p}` });
  } catch (e) {
    console.error("[fakeshipmondo]", e);
    return send(res, 500, { error: String(e?.message || e) });
  }
});

// ── Resend (mails) ──────────────────────────────────────────────────────────

const mail = { sent: [] };
const mailServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:12113");
  const raw = await readBody(req);
  if (url.pathname === "/__state") return send(res, 200, mail);
  if (url.pathname === "/__reset") {
    mail.sent = [];
    return send(res, 200, { ok: true });
  }
  if (url.pathname === "/emails" && req.method === "POST") {
    const m = JSON.parse(raw);
    mail.sent.push({ at: new Date().toISOString(), ...m });
    return send(res, 200, { id: "mail_" + rid() });
  }
  if (url.pathname === "/emails/batch" && req.method === "POST") {
    const list = JSON.parse(raw);
    for (const m of list) mail.sent.push({ at: new Date().toISOString(), ...m });
    return send(res, 200, { data: list.map(() => ({ id: "mail_" + rid() })) });
  }
  return send(res, 404, { message: "fakeresend kender ikke " + url.pathname });
});

stripeServer.listen(12111, () => console.log("[fakestripe] 12111"));
shipServer.listen(12112, () => console.log("[fakeshipmondo] 12112"));
mailServer.listen(12113, () => console.log("[fakeresend] 12113"));
