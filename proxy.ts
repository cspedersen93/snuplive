import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, hasSupabase } from "@/lib/env";
import { alwaysOpen, hasEarlyAccess, siteOpen } from "@/lib/siteAccess";

// Fornyer login-sessionen ved hvert sidekald, så brugeren ikke bliver logget ud.
// Før lanceringen viser den "Kommer snart" for alle andre end admins og testere (se lib/siteAccess.ts).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasSupabase) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Må ikke fjernes: kaldet fornyer sessionen og skriver nye cookies.
  const { data } = await supabase.auth.getClaims();

  const path = request.nextUrl.pathname;
  const open = await siteOpen();
  // Når siden er åben, er "Kommer snart" ikke længere forsiden.
  if (open && path === "/kommer-snart") return carry(response, NextResponse.redirect(new URL("/", request.url)));
  if (open || alwaysOpen(path)) return response;

  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  if (await hasEarlyAccess(email)) return response;

  // Lukket: forsiden viser "Kommer snart", og alle andre sider sender videre til forsiden.
  // Når siden selv navigerer (fx et tryk på logoet), sender vi til /kommer-snart, så navigationen virker.
  const accept = request.headers.get("accept") ?? "";
  const page = request.headers.get("sec-fetch-dest") === "document" || accept.includes("text/html");
  const res =
    path === "/" && page
      ? NextResponse.rewrite(new URL(`/kommer-snart${request.nextUrl.search}`, request.url), { request })
      : NextResponse.redirect(new URL(page ? "/" : "/kommer-snart", request.url));
  res.headers.set("Cache-Control", "private, no-store");
  return carry(response, res);
}

/** Tager de fornyede login-cookies med over på et redirect eller en rewrite. */
function carry(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((c) => to.cookies.set(c));
  return to;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|img/|mediapipe/|sw.js|manifest.webmanifest|icon.png|apple-icon.png|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
