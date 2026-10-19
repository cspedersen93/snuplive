import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

/** Supabase-klient til server-komponenter og route handlers. Ny klient pr. request. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server-komponenter må ikke sætte cookies. proxy.ts fornyer sessionen i stedet.
        }
      },
    },
  });
}

export type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Den indloggede brugers id, verificeret ud fra JWT'en. */
export async function getUserId(supabase: ServerClient): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}
