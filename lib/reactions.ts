// Reaktioner i et live-show: hjerter, emojis og store effekter (konfetti, hjerteregn, stjerneskud).
//
// Sådan virker det:
// - Seerne sender deres tryk til værten (sælgeren i studiet) over videoforbindelsen (LiveKit). Ikke til alle de andre seere.
// - Værten samler trykkene og sender én opsamling til alle hvert halve sekund. Så vokser trafikken ikke voldsomt med antallet
//   af seere, og ingen kan sende mere, end værten slipper igennem (bremsen herunder).
// - Store effekter kræver, at man er logget ind (navnet vises), og hver seer kan højst sende én hvert 30. sekund.
// - Intet bliver gemt. Er værten ikke forbundet, ser man kun sine egne tryk.
//
// Filen har ingen imports, så logikken kan testes direkte med node.

export const TOPIC = "reaktion";

export const SMALL = [
  { k: "heart", emoji: "❤️", label: "Hjerte" },
  { k: "fire", emoji: "🔥", label: "Ild" },
  { k: "love", emoji: "😍", label: "Vil have den" },
  { k: "clap", emoji: "👏", label: "Klap" },
  { k: "laugh", emoji: "😂", label: "Grin" },
  { k: "wow", emoji: "😮", label: "Wow" },
] as const;
export type SmallKind = (typeof SMALL)[number]["k"];

export const BIG = [
  { k: "konfetti", emoji: "🎉", label: "Konfetti", verb: "sendte konfetti" },
  { k: "hjerteregn", emoji: "💖", label: "Hjerteregn", verb: "sendte en regn af hjerter" },
  { k: "stjerneskud", emoji: "🌠", label: "Stjerneskud", verb: "sendte et stjerneskud" },
] as const;
export type BigKind = (typeof BIG)[number]["k"];

export type Counts = Partial<Record<SmallKind, number>>;

/** Seer → vært. */
export type ToHost = { v: 1; t: "r"; c: Counts } | { v: 1; t: "b"; k: BigKind };
/** Vært → alle. `id` er afsenderens forbindelse, så afsenderen ikke ser sin egen effekt to gange. */
export type BigEvent = { k: BigKind; who: string; id: string };
export type ToAll = { v: 1; t: "R"; c: Counts } | ({ v: 1; t: "B" } & BigEvent);

const SMALL_KEYS = new Set<string>(SMALL.map((s) => s.k));
const BIG_KEYS = new Set<string>(BIG.map((b) => b.k));
export const isSmall = (k: unknown): k is SmallKind => typeof k === "string" && SMALL_KEYS.has(k);
export const isBig = (k: unknown): k is BigKind => typeof k === "string" && BIG_KEYS.has(k);
export const smallInfo = (k: SmallKind) => SMALL.find((s) => s.k === k)!;
export const bigInfo = (k: BigKind) => BIG.find((b) => b.k === k)!;

/** Hvor ofte seerne sender deres tryk, og hvor ofte værten sender opsamlingen. */
export const SEND_EVERY_MS = 400;
export const FLUSH_EVERY_MS = 500;
/** Bremsen pr. seer: højst 10 i træk, og derefter 6 i sekundet. */
export const BUCKET_SIZE = 10;
export const BUCKET_PER_SEC = 6;
/** Højst så mange små reaktioner i én opsamling (resten droppes, skærmen kan alligevel ikke vise flere). */
export const MAX_PER_FLUSH = 40;
/** Store effekter: én pr. seer hvert 30. sekund, én ad gangen på skærmen og højst 3 i kø. */
export const BIG_COOLDOWN_MS = 30_000;
export const BIG_SHOW_MS = 3600;
export const BIG_QUEUE = 3;
const MAX_BYTES = 512;
const MAX_NAME = 40;

const enc = new TextEncoder();
const dec = new TextDecoder();

export function encode(msg: ToHost | ToAll): Uint8Array<ArrayBuffer> {
  return enc.encode(JSON.stringify(msg));
}

function cleanCounts(c: unknown): Counts | null {
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;
  const out: Counts = {};
  let any = false;
  for (const [k, v] of Object.entries(c as Record<string, unknown>)) {
    if (!isSmall(k) || typeof v !== "number" || !Number.isFinite(v)) continue;
    const n = Math.min(MAX_PER_FLUSH, Math.floor(v));
    if (n > 0) {
      out[k] = n;
      any = true;
    }
  }
  return any ? out : null;
}

/** Læser en besked fra en seer. Alt andet end det forventede bliver kasseret. */
export function decodeToHost(data: Uint8Array): ToHost | null {
  if (data.byteLength > MAX_BYTES) return null;
  try {
    const m = JSON.parse(dec.decode(data)) as Record<string, unknown>;
    if (m?.v !== 1) return null;
    if (m.t === "r") {
      const c = cleanCounts(m.c);
      return c ? { v: 1, t: "r", c } : null;
    }
    if (m.t === "b" && isBig(m.k)) return { v: 1, t: "b", k: m.k };
  } catch {
    // Ikke en reaktion
  }
  return null;
}

/** Læser en besked fra værten. */
export function decodeToAll(data: Uint8Array): ToAll | null {
  if (data.byteLength > MAX_BYTES) return null;
  try {
    const m = JSON.parse(dec.decode(data)) as Record<string, unknown>;
    if (m?.v !== 1) return null;
    if (m.t === "R") {
      const c = cleanCounts(m.c);
      return c ? { v: 1, t: "R", c } : null;
    }
    if (m.t === "B" && isBig(m.k) && typeof m.who === "string" && typeof m.id === "string")
      return { v: 1, t: "B", k: m.k, who: m.who.slice(0, MAX_NAME), id: m.id.slice(0, 120) };
  } catch {
    // Ikke en reaktion
  }
  return null;
}

/** En simpel bremse: højst `size` i træk, og derefter `perSec` i sekundet. */
export class Bucket {
  private tokens: number;
  private at: number;
  private size: number;
  private perSec: number;
  constructor(size = BUCKET_SIZE, perSec = BUCKET_PER_SEC, now = Date.now()) {
    this.size = size;
    this.perSec = perSec;
    this.tokens = size;
    this.at = now;
  }
  /** Tager op til `n` og svarer, hvor mange der var plads til. */
  take(n: number, now = Date.now()) {
    this.tokens = Math.min(this.size, this.tokens + ((now - this.at) / 1000) * this.perSec);
    this.at = now;
    const got = Math.max(0, Math.min(Math.floor(this.tokens), Math.floor(n)));
    this.tokens -= got;
    return got;
  }
}

/** Seerens forbindelse er "user:<id>:<fane>" (logget ind) eller "guest:<fane>". Se /api/livekit-token. */
export const loggedInIdentity = (identity: string) => identity.startsWith("user:");
const userOf = (identity: string) => identity.split(":")[1] ?? identity;

/**
 * Værtens side: tager imod seernes tryk, bremser dem og samler dem til én opsamling.
 * `fromViewer` svarer med det, værten selv skal vise med det samme. `flush` svarer med det, der skal sendes til alle.
 */
export class HostRelay {
  private buckets = new Map<string, Bucket>();
  private bigAt = new Map<string, number>();
  private pending: Counts = {};
  private pendingTotal = 0;
  private queue: BigEvent[] = [];
  private lastBig = 0;

  fromViewer(identity: string, name: string, msg: ToHost, now = Date.now()): Counts | null {
    if (!identity || identity.startsWith("seller:") || identity.startsWith("cohost:")) return null;
    if (msg.t === "b") {
      // Store effekter: kun logget ind, én hvert 30. sekund pr. person (også på tværs af faner), højst 3 i kø.
      if (!loggedInIdentity(identity)) return null;
      const who = userOf(identity);
      const last = this.bigAt.get(who);
      if ((last !== undefined && now - last < BIG_COOLDOWN_MS - 1000) || this.queue.length >= BIG_QUEUE) return null;
      this.bigAt.set(who, now);
      this.queue.push({ k: msg.k, who: (name || "En seer").slice(0, MAX_NAME), id: identity });
      return null;
    }
    let b = this.buckets.get(identity);
    if (!b) {
      if (this.buckets.size > 5000) this.buckets.clear();
      b = new Bucket(BUCKET_SIZE, BUCKET_PER_SEC, now);
      this.buckets.set(identity, b);
    }
    const shown: Counts = {};
    let any = false;
    for (const [k, v] of Object.entries(msg.c) as [SmallKind, number][]) {
      const room = MAX_PER_FLUSH - this.pendingTotal;
      if (room <= 0) break;
      const n = b.take(Math.min(v, room), now);
      if (!n) continue;
      shown[k] = (shown[k] ?? 0) + n;
      this.pending[k] = (this.pending[k] ?? 0) + n;
      this.pendingTotal += n;
      any = true;
    }
    return any ? shown : null;
  }

  /** Kaldes hvert halve sekund. Højst én stor effekt ad gangen, med tid til, at den forrige er færdig. */
  flush(now = Date.now()): { small: Counts | null; big: BigEvent | null } {
    const small = this.pendingTotal ? this.pending : null;
    this.pending = {};
    this.pendingTotal = 0;
    let big: BigEvent | null = null;
    if (this.queue.length && now - this.lastBig >= BIG_SHOW_MS) {
      big = this.queue.shift()!;
      this.lastBig = now;
    }
    // Ryd op i gamle bremser og tider, så listen ikke vokser i et langt show.
    if (this.bigAt.size > 2000) for (const [k, t] of this.bigAt) if (now - t > BIG_COOLDOWN_MS) this.bigAt.delete(k);
    return { small, big };
  }
}

/**
 * Seerens side: ens egne tryk vises med det samme. Når værtens opsamling kommer tilbage, er ens egne tryk også talt med,
 * så dem trækker vi fra, ellers ville man se sine egne hjerter to gange.
 */
export class Echo {
  private owed = new Map<SmallKind, { n: number; at: number }>();
  sent(c: Counts, now = Date.now()) {
    for (const [k, v] of Object.entries(c) as [SmallKind, number][]) {
      const o = this.owed.get(k);
      this.owed.set(k, { n: (o && now - o.at < 3000 ? o.n : 0) + v, at: now });
    }
  }
  /** Det af opsamlingen, der er fra de andre. */
  others(c: Counts, now = Date.now()): Counts {
    const out: Counts = {};
    for (const [k, v] of Object.entries(c) as [SmallKind, number][]) {
      const o = this.owed.get(k);
      const mine = o && now - o.at < 3000 ? Math.min(o.n, v) : 0;
      if (o) {
        if (o.n - mine > 0 && now - o.at < 3000) this.owed.set(k, { n: o.n - mine, at: o.at });
        else this.owed.delete(k);
      }
      if (v - mine > 0) out[k] = v - mine;
    }
    return out;
  }
}
