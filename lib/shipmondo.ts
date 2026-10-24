import { createHmac, timingSafeEqual } from "node:crypto";
import { CARRIERS, type CarrierCode, type Pakkeshop } from "@/lib/carriers";
import { SITE_URL, unquoteEnv } from "@/lib/env";

// Shipmondo finder pakkeshops, køber fragtlabels på Shipmondos egne aftaler med DAO og GLS
// og sender sporingen tilbage til Relived. Kun på serveren.

const PROD = "https://app.shipmondo.com/api/public/v3";
const SANDBOX = "https://sandbox.shipmondo.com/api/public/v3";

const user = () => unquoteEnv(process.env.SHIPMONDO_API_USER);
const key = () => unquoteEnv(process.env.SHIPMONDO_API_KEY);

export const hasShipmondo = () => Boolean(user() && key());

/** Testkontoen hos Shipmondo (labels er mærket "SANDBOX" og koster ikke noget). */
export const shipmondoSandbox = () => /^(1|true|ja|yes)$/i.test(unquoteEnv(process.env.SHIPMONDO_SANDBOX));

function base() {
  // SHIPMONDO_API_BASE bruges kun til lokale tests mod en falsk Shipmondo.
  return (unquoteEnv(process.env.SHIPMONDO_API_BASE) || (shipmondoSandbox() ? SANDBOX : PROD)).replace(/\/+$/, "");
}

export class ShipmondoError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

async function call<T>(method: "GET" | "POST" | "PUT", path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
  const url = new URL(base() + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${user()}:${key()}`).toString("base64")}`,
        Accept: "application/json",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new ShipmondoError(`Shipmondo svarer ikke (${(e as Error).message})`);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const d = data as { error?: unknown; message?: unknown; errors?: unknown } | null;
    const msg = [d?.error, d?.message, Array.isArray(d?.errors) ? d.errors.join(", ") : null].filter(Boolean).join(" · ") || text.slice(0, 200);
    throw new ShipmondoError(`Shipmondo ${res.status}: ${msg}`, res.status);
  }
  return data as T;
}

// ── Pakkeshops ──────────────────────────────────────────────────────────────

interface RawPoint {
  number?: string;
  id?: string;
  company_name?: string;
  name?: string;
  address?: string;
  address2?: string | null;
  zipcode?: string;
  city?: string;
  distance?: number | null;
  opening_hours?: string[] | null;
  out_delivery?: boolean;
}

/** De nærmeste pakkeshops, hvor køberen kan hente en pakke. */
export async function findPakkeshops(carrier: CarrierCode, zipcode: string, opts: { address?: string; id?: string } = {}): Promise<Pakkeshop[]> {
  const rows = await call<RawPoint[]>("GET", "/pickup_points", {
    query: { carrier_code: carrier, country_code: "DK", zipcode, address: opts.address, id: opts.id, quantity: 10, out_delivery: true },
  });
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r.out_delivery !== false && (r.number || r.id))
    .map((r) => ({
      carrier,
      id: String(r.number || r.id).slice(0, 40),
      name: (r.name || r.company_name || "Pakkeshop").slice(0, 120),
      // address2 er tit bare "Pakkeshop: 12345", så den springer vi over.
      address: [r.address, r.address2 && !/^pakkeshop/i.test(r.address2) ? r.address2 : null].filter(Boolean).join(", ").slice(0, 160),
      zipcode: String(r.zipcode ?? zipcode).slice(0, 10),
      city: String(r.city ?? "").slice(0, 80),
      distance: typeof r.distance === "number" ? r.distance : null,
      hours: Array.isArray(r.opening_hours) ? r.opening_hours.slice(0, 7).map(String) : [],
    }));
}

// ── Produkt (DAO- eller GLS-pakkeshop) ──────────────────────────────────────

interface RawService {
  code?: string;
}
interface RawProduct {
  code?: string;
  name?: string;
  available?: boolean;
  service_point_required?: boolean;
  customs_declaration_required?: boolean;
  required_services?: RawService[];
  available_services?: RawService[];
  weight_intervals?: { to_weight?: number }[];
}
interface Product {
  code: string;
  required: string[];
  notify: string[];
}

const productCache = new Map<CarrierCode, { at: number; product: Product }>();

/** Find Shipmondos produkt til levering i pakkeshop hos fragtfirmaet (fx GLSDK_SD for GLS). */
export async function pakkeshopProduct(carrier: CarrierCode): Promise<Product> {
  const hit = productCache.get(carrier);
  if (hit && Date.now() - hit.at < 6 * 3600e3) return hit.product;

  const list = await call<RawProduct[]>("GET", "/products", {
    query: { carrier_code: carrier, sender_country_code: "DK", receiver_country_code: "DK", per_page: 100 },
  });
  const override = unquoteEnv(process.env[`SHIPMONDO_PRODUCT_${carrier.toUpperCase()}`]);
  const maxWeight = (p: RawProduct) => Math.max(0, ...(p.weight_intervals ?? []).map((w) => w.to_weight ?? 0)) || Infinity;
  const candidates = (Array.isArray(list) ? list : []).filter(
    (p) =>
      p.code &&
      p.available !== false &&
      p.service_point_required &&
      !p.customs_declaration_required &&
      !/retur|return|click|collect|erhverv|business|express|pallet|palle/i.test(p.name ?? "") &&
      maxWeight(p) >= 5000,
  );
  const chosen =
    (override && (Array.isArray(list) ? list : []).find((p) => p.code === override)) ||
    candidates.find((p) => p.code === "GLSDK_SD") ||
    candidates[0];
  if (!chosen?.code) throw new ShipmondoError(`Shipmondo har ikke et pakkeshop-produkt for ${CARRIERS[carrier].name}`);

  const codes = (s?: RawService[]) => (s ?? []).map((x) => x.code).filter((c): c is string => Boolean(c));
  const required = codes(chosen.required_services);
  const notify = codes(chosen.available_services).filter((c) => c === "EMAIL_NT" || c === "SMS_NT");
  const product = { code: chosen.code, required, notify };
  productCache.set(carrier, { at: Date.now(), product });
  return product;
}

// ── Labels ──────────────────────────────────────────────────────────────────

export interface Party {
  name: string;
  address1: string;
  address2?: string | null;
  zipcode: string;
  city: string;
  email?: string | null;
  phone?: string | null;
}

interface RawShipment {
  id?: number;
  pkg_no?: string | null;
  price?: string | null;
  labelless_code?: string | null;
  parcels?: { pkg_no?: string | null; labelless_code?: string | null }[];
}

export interface CreatedLabel {
  shipmentId: number;
  pkgNo: string | null;
  labellessCode: string | null;
  price: number | null;
  productCode: string;
}

const party = (type: "sender" | "receiver", p: Party) => ({
  type,
  name: p.name,
  address1: p.address1,
  address2: p.address2 || undefined,
  postal_code: p.zipcode,
  city: p.city,
  country_code: "DK",
  email: p.email || undefined,
  phone: p.phone || undefined,
});

/** Køb en label til en pakkeshop. Shipmondo trækker prisen på Reliveds konto. */
export async function createLabel(input: {
  carrier: CarrierCode;
  pakkeshopId: string;
  weight: number;
  reference: string;
  sender: Party;
  receiver: Party;
}): Promise<CreatedLabel> {
  const product = await pakkeshopProduct(input.carrier);
  const services = new Set(product.required);
  if (product.notify.includes("EMAIL_NT") && input.receiver.email) services.add("EMAIL_NT");
  if (product.notify.includes("SMS_NT") && input.receiver.phone) services.add("SMS_NT");

  const s = await call<RawShipment>("POST", "/shipments", {
    body: {
      own_agreement: false,
      product_code: product.code,
      service_codes: [...services].join(","),
      reference: input.reference,
      automatic_select_service_point: false,
      service_point_id: input.pakkeshopId,
      parties: [party("sender", input.sender), party("receiver", input.receiver)],
      parcels: [{ weight: input.weight }],
    },
  });
  if (!s?.id) throw new ShipmondoError("Shipmondo lavede ikke en label");
  const price = s.price ? Number(String(s.price).replace(",", ".")) : NaN;
  return {
    shipmentId: s.id,
    pkgNo: s.pkg_no || s.parcels?.[0]?.pkg_no || null,
    labellessCode: s.labelless_code || s.parcels?.[0]?.labelless_code || null,
    price: Number.isFinite(price) ? price : null,
    productCode: product.code,
  };
}

/** Labelen som PDF: A4 til almindelige printere, 10x19 til labelprintere. */
export async function labelPdf(shipmentId: number, format: "a4_pdf" | "10x19_pdf"): Promise<Buffer> {
  const labels = await call<{ base64?: string }[]>("GET", `/shipments/${shipmentId}/labels`, { query: { label_format: format } });
  const b64 = Array.isArray(labels) ? labels.find((l) => l.base64)?.base64 : undefined;
  if (!b64) throw new ShipmondoError("Labelen findes ikke hos Shipmondo");
  return Buffer.from(b64, "base64");
}

/** Annullér en label, der ikke bliver brugt (Shipmondo refunderer ikke prisen). */
export async function cancelLabel(shipmentId: number) {
  await call("PUT", `/shipments/${shipmentId}/cancel`);
}

// ── Sporing (webhook fra Shipmondo) ─────────────────────────────────────────

/** Nøglen, Shipmondo signerer sporingen med. Sættes SHIPMONDO_WEBHOOK_KEY ikke, udledes den af API-nøglen. */
export function webhookKey() {
  return (
    unquoteEnv(process.env.SHIPMONDO_WEBHOOK_KEY) ||
    createHmac("sha256", key() || "ingen-noegle").update("snuplive-sporing-v1").digest("hex")
  );
}

export const webhookEndpoint = () => `${SITE_URL}/api/shipmondo/webhook`;

/** Tjek og pak en besked fra Shipmondo ud: {"data": "<JWT signeret med HS256>"}. */
export function readWebhook(raw: string): Record<string, unknown> | null {
  let token: unknown;
  try {
    token = (JSON.parse(raw) as { data?: unknown })?.data;
  } catch {
    return null;
  }
  if (typeof token !== "string") return null;
  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) return null;
  try {
    const header = JSON.parse(Buffer.from(h, "base64url").toString("utf8")) as { alg?: string };
    if (header.alg !== "HS256") return null;
    const expected = createHmac("sha256", webhookKey()).update(`${h}.${p}`).digest();
    const given = Buffer.from(sig, "base64url");
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    let payload: unknown = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    // Shipmondo pakker af og til objektet ind som en JSON-tekst.
    if (typeof payload === "string") payload = JSON.parse(payload);
    return payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

let webhookReady = false;

/** Sørg for, at Shipmondo sender sporing til Relived. Opretter webhooken første gang. */
export async function ensureTrackingWebhook() {
  if (webhookReady || !hasShipmondo()) return;
  const endpoint = webhookEndpoint();
  const hooks = await call<{ endpoint?: string; resource_name?: string; active?: boolean }[]>("GET", "/webhooks", {
    query: { per_page: 100 },
  });
  const exists = (Array.isArray(hooks) ? hooks : []).some(
    (w) => w.endpoint === endpoint && /shipment monitor/i.test(w.resource_name ?? "") && w.active !== false,
  );
  if (!exists) {
    await call("POST", "/webhooks", {
      body: { name: "Relived sporing", endpoint, key: webhookKey(), action: "latest", resource_name: "Shipment Monitor" },
    });
  }
  webhookReady = true;
}
