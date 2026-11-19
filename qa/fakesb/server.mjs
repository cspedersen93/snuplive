// Falsk Supabase til testsiden: /rest/v1 → PostgREST, /auth/v1 → engangskode-login med HS256-JWT,
// /storage/v1 → filer på disken (rettighederne tjekkes i databasen gennem PostgREST, så RLS gælder).
// Ingen rigtige nøgler: alt herinde er testværdier.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.FAKESB_PORT || 54400);
const PGRST = process.env.PGRST_URL || "http://127.0.0.1:54401";
const SECRET = process.env.JWT_SECRET || "qa-jwt-secret-der-er-mindst-32-tegn-lang";
const ANON = process.env.ANON_KEY || "sb_publishable_qa";
const SERVICE = process.env.SERVICE_KEY || "sb_secret_qa";
const FILES = process.env.FAKESB_FILES || "/home/claude/qa/storage";
const SELF = `http://localhost:${PORT}`;

const b64u = (b) => Buffer.from(b).toString("base64url");
function sign(claims) {
  const h = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const p = b64u(JSON.stringify(claims));
  const s = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
}
function verify(token) {
  const [h, p, s] = String(token || "").split(".");
  if (!h || !p || !s) return null;
  const want = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  if (want !== s) return null;
  try {
    const c = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    if (c.exp && c.exp < Date.now() / 1000) return null;
    return c;
  } catch {
    return null;
  }
}
const now = () => Math.floor(Date.now() / 1000);
const SERVICE_JWT = () => sign({ role: "service_role", iss: "fakesb", exp: now() + 3600 });
const ANON_JWT = () => sign({ role: "anon", iss: "fakesb", exp: now() + 3600 });

function send(res, status, body, headers = {}) {
  const buf = body == null ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  res.writeHead(status, {
    "Content-Type": typeof body === "string" || Buffer.isBuffer(body) ? "text/plain" : "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD",
    "Access-Control-Expose-Headers": "Content-Range, Content-Profile, Preference-Applied",
    ...headers,
  });
  res.end(buf);
}
const readBody = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

/** Hvem spørger? Den hemmelige nøgle → service_role, en gyldig bruger-JWT → brugeren, ellers anon. */
function who(req) {
  const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const apikey = req.headers.apikey || "";
  if (bearer === SERVICE || (apikey === SERVICE && (!bearer || bearer === SERVICE))) return { role: "service_role", jwt: SERVICE_JWT(), claims: { role: "service_role" } };
  const claims = bearer && bearer !== ANON ? verify(bearer) : null;
  if (claims?.role === "service_role") return { role: "service_role", jwt: bearer, claims };
  if (claims?.sub) return { role: "authenticated", jwt: bearer, claims };
  return { role: "anon", jwt: ANON_JWT(), claims: null };
}

/** Kald PostgREST som en bestemt rolle. */
async function pg(jwt, method, url, { body, headers = {}, schema } = {}) {
  const h = { Authorization: `Bearer ${jwt}`, ...headers };
  if (schema) {
    h[method === "GET" || method === "HEAD" ? "Accept-Profile" : "Content-Profile"] = schema;
  }
  if (body !== undefined) h["Content-Type"] = "application/json";
  const r = await fetch(PGRST + url, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: r.ok, status: r.status, data };
}

// ── Auth ────────────────────────────────────────────────────────────────────

const userObj = (u) => ({
  id: u.id,
  aud: "authenticated",
  role: "authenticated",
  email: u.email,
  email_confirmed_at: u.created_at,
  confirmed_at: u.created_at,
  phone: "",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [],
  created_at: u.created_at,
  updated_at: u.created_at,
  is_anonymous: false,
});
function session(u) {
  const exp = now() + 7 * 24 * 3600;
  const access_token = sign({
    iss: `${SELF}/auth/v1`,
    sub: u.id,
    aud: "authenticated",
    role: "authenticated",
    email: u.email,
    exp,
    iat: now(),
    session_id: crypto.randomUUID(),
    is_anonymous: false,
  });
  return { access_token, token_type: "bearer", expires_in: exp - now(), expires_at: exp, refresh_token: `r.${u.id}`, user: userObj(u) };
}
async function userByEmail(email) {
  const r = await pg(SERVICE_JWT(), "GET", `/users?email=ilike.${encodeURIComponent(email)}&limit=1`, { schema: "auth" });
  return r.ok && r.data?.[0] ? r.data[0] : null;
}
async function userById(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const r = await pg(SERVICE_JWT(), "GET", `/users?id=eq.${id}&limit=1`, { schema: "auth" });
  return r.ok && r.data?.[0] ? r.data[0] : null;
}
async function ensureUser(email) {
  const hit = await userByEmail(email);
  if (hit) return hit;
  const r = await pg(SERVICE_JWT(), "POST", "/users", { schema: "auth", body: { email: email.toLowerCase() }, headers: { Prefer: "return=representation" } });
  if (!r.ok) throw new Error("kunne ikke oprette bruger: " + JSON.stringify(r.data));
  return r.data[0];
}

async function auth(req, res, url) {
  const p = url.pathname.replace(/^\/auth\/v1/, "");
  const raw = await readBody(req);
  let body = {};
  try {
    body = raw.length ? JSON.parse(raw.toString("utf8")) : {};
  } catch {}
  const me = who(req);

  if (p === "/.well-known/jwks.json") return send(res, 200, { keys: [] });
  if (p === "/settings") return send(res, 200, { external: { email: true }, disable_signup: false });
  // Send engangskode: koden er altid 123456 i testmiljøet.
  if (p === "/otp" && req.method === "POST") {
    if (!body.email) return send(res, 400, { code: 400, msg: "email mangler" });
    await ensureUser(String(body.email));
    return send(res, 200, {});
  }
  if (p === "/verify" && req.method === "POST") {
    if (String(body.token) !== "123456") return send(res, 403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
    const u = await ensureUser(String(body.email));
    return send(res, 200, session(u));
  }
  if (p === "/token" && req.method === "POST") {
    const id = String(body.refresh_token || "").replace(/^r\./, "");
    const u = await userById(id);
    if (!u) return send(res, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
    return send(res, 200, session(u));
  }
  if (p === "/user" && req.method === "GET") {
    const u = me.claims?.sub ? await userById(me.claims.sub) : null;
    if (!u) return send(res, 401, { code: 401, msg: "invalid JWT" });
    return send(res, 200, userObj(u));
  }
  if (p === "/logout") return send(res, 204, null);
  const adminUser = /^\/admin\/users\/([0-9a-f-]{36})$/i.exec(p);
  if (adminUser) {
    if (me.role !== "service_role") return send(res, 401, { code: 401, msg: "kræver den hemmelige nøgle" });
    const u = await userById(adminUser[1]);
    if (!u) return send(res, 404, { code: 404, msg: "User not found" });
    if (req.method === "DELETE") {
      await pg(SERVICE_JWT(), "DELETE", `/users?id=eq.${u.id}`, { schema: "auth" });
      return send(res, 200, {});
    }
    return send(res, 200, userObj(u));
  }
  // Testgenvej: en færdig session til en e-mail (bruges af testene til at sætte login-cookien).
  if (p === "/__session" && req.method === "POST") {
    const u = await ensureUser(String(body.email));
    return send(res, 200, session(u));
  }
  return send(res, 404, { code: 404, msg: `fakesb kender ikke auth${p}` });
}

// ── Storage ─────────────────────────────────────────────────────────────────

const safe = (bucket, name) => {
  const full = path.resolve(FILES, bucket, name);
  return full.startsWith(path.resolve(FILES) + path.sep) ? full : null;
};
const mime = (name) =>
  ({ ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".mp4": "video/mp4", ".webm": "video/webm", ".pdf": "application/pdf" })[
    path.extname(name).toLowerCase()
  ] || "application/octet-stream";
const enc = (s) => encodeURIComponent(s);

async function bucketInfo(id) {
  const r = await pg(SERVICE_JWT(), "GET", `/buckets?id=eq.${enc(id)}&limit=1`, { schema: "storage" });
  return r.ok ? r.data?.[0] ?? null : null;
}
function serveFile(req, res, bucket, name) {
  const full = safe(bucket, name);
  if (!full || !fs.existsSync(full)) return send(res, 404, { statusCode: "404", error: "not_found", message: "Object not found" });
  const stat = fs.statSync(full);
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
  const base = { "Content-Type": mime(name), "Accept-Ranges": "bytes", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" };
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
    res.writeHead(206, { ...base, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": end - start + 1 });
    return fs.createReadStream(full, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...base, "Content-Length": stat.size });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(full).pipe(res);
}

async function storage(req, res, url) {
  const p = decodeURIComponent(url.pathname.replace(/^\/storage\/v1/, ""));
  const me = who(req);
  let m;

  // Offentlige filer
  if ((m = /^\/object\/public\/([^/]+)\/(.+)$/.exec(p)) && (req.method === "GET" || req.method === "HEAD")) {
    const b = await bucketInfo(m[1]);
    if (!b?.public) return send(res, 400, { statusCode: "404", error: "Bucket not found", message: "Bucket not found" });
    return serveFile(req, res, m[1], m[2]);
  }
  // Signeret link: lav
  if ((m = /^\/object\/sign\/([^/]+)(?:\/(.+))?$/.exec(p)) && req.method === "POST") {
    const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const bucket = m[1];
    const mk = async (name) => {
      const r = await pg(me.jwt, "GET", `/objects?bucket_id=eq.${enc(bucket)}&name=eq.${enc(name)}&select=name&limit=1`, { schema: "storage" });
      if (!r.ok || !r.data?.length) return null;
      const token = sign({ url: `${bucket}/${name}`, exp: now() + Number(body.expiresIn || 3600) });
      return `/object/sign/${bucket}/${name.split("/").map(enc).join("/")}?token=${token}`;
    };
    if (m[2]) {
      const signedURL = await mk(m[2]);
      if (!signedURL) return send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      return send(res, 200, { signedURL });
    }
    const out = [];
    for (const name of body.paths || []) {
      const signedURL = await mk(name);
      out.push(signedURL ? { path: name, signedURL, error: null } : { path: name, signedURL: null, error: "Either the object does not exist or you do not have access to it" });
    }
    return send(res, 200, out);
  }
  // Signeret link: hent
  if ((m = /^\/object\/sign\/([^/]+)\/(.+)$/.exec(p)) && (req.method === "GET" || req.method === "HEAD")) {
    const c = verify(url.searchParams.get("token"));
    if (!c || c.url !== `${m[1]}/${m[2]}`) return send(res, 400, { statusCode: "400", error: "InvalidJWT", message: "signaturen passer ikke" });
    return serveFile(req, res, m[1], m[2]);
  }
  // Liste
  if ((m = /^\/object\/list\/([^/]+)$/.exec(p)) && req.method === "POST") {
    const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const prefix = String(body.prefix || "").replace(/\/+$/, "");
    const like = prefix ? `&name=like.${enc(prefix + "/*")}` : "";
    const r = await pg(me.jwt, "GET", `/objects?bucket_id=eq.${enc(m[1])}${like}&select=id,name,created_at,metadata&order=name`, { schema: "storage" });
    if (!r.ok) return send(res, 400, r.data);
    const rows = r.data
      .map((o) => ({ ...o, rest: prefix ? o.name.slice(prefix.length + 1) : o.name }))
      .filter((o) => !o.rest.includes("/"))
      .map((o) => ({ name: o.rest, id: o.id, created_at: o.created_at, updated_at: o.created_at, last_accessed_at: o.created_at, metadata: o.metadata || {} }));
    return send(res, 200, rows.slice(Number(body.offset || 0), Number(body.offset || 0) + Number(body.limit || 100)));
  }
  // Slet flere
  if ((m = /^\/object\/([^/]+)$/.exec(p)) && req.method === "DELETE") {
    const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const names = (body.prefixes || []).map(String);
    if (!names.length) return send(res, 200, []);
    const list = names.map((n) => `"${n.replace(/"/g, '\\"')}"`).join(",");
    const r = await pg(me.jwt, "DELETE", `/objects?bucket_id=eq.${enc(m[1])}&name=in.(${enc(list)})`, { schema: "storage", headers: { Prefer: "return=representation" } });
    if (!r.ok) return send(res, 400, r.data);
    for (const o of r.data) {
      const full = safe(m[1], o.name);
      if (full && fs.existsSync(full)) fs.unlinkSync(full);
    }
    return send(res, 200, r.data.map((o) => ({ name: o.name, bucket_id: m[1] })));
  }
  // Upload (POST = ny, PUT eller x-upsert = må overskrive) og hent (privat, med login)
  if ((m = /^\/object\/(?:authenticated\/)?([^/]+)\/(.+)$/.exec(p))) {
    const [, bucket, name] = m;
    if (req.method === "GET" || req.method === "HEAD") {
      const r = await pg(me.jwt, "GET", `/objects?bucket_id=eq.${enc(bucket)}&name=eq.${enc(name)}&select=name&limit=1`, { schema: "storage" });
      if (!r.ok || !r.data?.length) return send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      return serveFile(req, res, bucket, name);
    }
    if (req.method === "POST" || req.method === "PUT") {
      const b = await bucketInfo(bucket);
      if (!b) return send(res, 400, { statusCode: "404", error: "Bucket not found", message: "Bucket not found" });
      let data = await readBody(req);
      let type = req.headers["content-type"] || "application/octet-stream";
      // supabase-js sender en Blob/File som multipart, når der ikke er sat contentType.
      const boundary = /multipart\/form-data;\s*boundary=(.+)$/i.exec(type)?.[1];
      if (boundary) {
        const sep = Buffer.from(`--${boundary}`);
        let best = null;
        let at = data.indexOf(sep);
        while (at !== -1) {
          const next = data.indexOf(sep, at + sep.length);
          if (next === -1) break;
          const part = data.subarray(at + sep.length + 2, next - 2);
          const split = part.indexOf("\r\n\r\n");
          const head = part.subarray(0, split).toString("utf8");
          if (/name="?(file|)"?/i.test(head) && /filename=|Content-Type:/i.test(head)) {
            best = part.subarray(split + 4);
            type = /Content-Type:\s*([^\r\n]+)/i.exec(head)?.[1] || type;
          }
          at = next;
        }
        if (best) data = best;
      }
      if (b.file_size_limit && data.length > Number(b.file_size_limit)) return send(res, 400, { statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" });
      if (b.allowed_mime_types?.length && !b.allowed_mime_types.some((t) => t === type.split(";")[0].trim() || (t.endsWith("/*") && type.startsWith(t.slice(0, -1))))) {
        return send(res, 400, { statusCode: "415", error: "invalid_mime_type", message: `mime type ${type} is not supported` });
      }
      const upsert = req.method === "PUT" || String(req.headers["x-upsert"] || "") === "true";
      const meta = { size: data.length, mimetype: type.split(";")[0].trim() };
      const exists = await pg(SERVICE_JWT(), "GET", `/objects?bucket_id=eq.${enc(bucket)}&name=eq.${enc(name)}&select=id&limit=1`, { schema: "storage" });
      let r;
      if (exists.data?.length) {
        if (!upsert) return send(res, 400, { statusCode: "409", error: "Duplicate", message: "The resource already exists" });
        r = await pg(me.jwt, "PATCH", `/objects?bucket_id=eq.${enc(bucket)}&name=eq.${enc(name)}`, { schema: "storage", body: { metadata: meta }, headers: { Prefer: "return=representation" } });
        if (r.ok && !r.data?.length) r = { ok: false, status: 403, data: { message: "new row violates row-level security policy" } };
      } else {
        r = await pg(me.jwt, "POST", "/objects", { schema: "storage", body: { bucket_id: bucket, name, metadata: meta }, headers: { Prefer: "return=representation" } });
      }
      if (!r.ok) return send(res, 400, { statusCode: "403", error: "Unauthorized", message: r.data?.message || "new row violates row-level security policy" });
      const full = safe(bucket, name);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, data);
      return send(res, 200, { Key: `${bucket}/${name}`, Id: r.data?.[0]?.id ?? null });
    }
    if (req.method === "DELETE") {
      const r = await pg(me.jwt, "DELETE", `/objects?bucket_id=eq.${enc(bucket)}&name=eq.${enc(name)}`, { schema: "storage", headers: { Prefer: "return=representation" } });
      if (!r.ok || !r.data?.length) return send(res, 400, { statusCode: "404", error: "not_found", message: "Object not found" });
      const full = safe(bucket, name);
      if (full && fs.existsSync(full)) fs.unlinkSync(full);
      return send(res, 200, { message: "Successfully deleted" });
    }
  }
  return send(res, 404, { statusCode: "404", error: "not_found", message: `fakesb kender ikke storage${p}` });
}

// ── REST → PostgREST ────────────────────────────────────────────────────────

async function rest(req, res, url) {
  const me = who(req);
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (["host", "connection", "content-length", "apikey", "authorization", "accept-encoding"].includes(k)) continue;
    headers[k] = v;
  }
  headers.authorization = `Bearer ${me.jwt}`;
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await readBody(req);
  const r = await fetch(PGRST + url.pathname.replace(/^\/rest\/v1/, "") + url.search, { method: req.method, headers, body: body?.length ? body : undefined });
  const out = {};
  r.headers.forEach((v, k) => {
    if (!["transfer-encoding", "connection", "content-encoding", "content-length"].includes(k)) out[k] = v;
  });
  out["access-control-allow-origin"] = "*";
  out["access-control-expose-headers"] = "Content-Range, Content-Profile, Preference-Applied";
  const buf = Buffer.from(await r.arrayBuffer());
  res.writeHead(r.status, out);
  res.end(req.method === "HEAD" ? undefined : buf);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, SELF);
  try {
    if (req.method === "OPTIONS") return send(res, 204, null);
    if (url.pathname.startsWith("/rest/v1")) return await rest(req, res, url);
    if (url.pathname.startsWith("/auth/v1")) return await auth(req, res, url);
    if (url.pathname.startsWith("/storage/v1")) return await storage(req, res, url);
    if (url.pathname === "/__ok") return send(res, 200, { ok: true });
    return send(res, 404, { message: `fakesb kender ikke ${url.pathname}` });
  } catch (e) {
    console.error("[fakesb]", req.method, url.pathname, e);
    if (!res.headersSent) send(res, 500, { message: String(e?.message || e) });
  }
});
// Realtime (websocket) findes ikke i testmiljøet: afvis pænt, så siden bare kører uden.
server.on("upgrade", (_req, socket) => {
  socket.end("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
});
server.listen(PORT, () => console.log(`[fakesb] lytter på ${SELF} → ${PGRST}`));
