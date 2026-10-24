import { after } from "next/server";
import { fail, json } from "@/lib/api";
import { isAdminEmail } from "@/lib/mail";
import { isSupportFilter, listSupportThreads, sweepSupportNotices } from "@/lib/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getUserInfo } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Samtalerne i supporten: ?status=open|closed|all. Backoffice henter listen igen hvert 8. sekund. */
export async function GET(req: Request) {
  const user = await getUserInfo(await createClient());
  if (!user || !isAdminEmail(user.email)) return fail("Ingen adgang.", 403);
  const admin = createAdminClient();
  if (!admin) return fail("Databasen er ikke sat op.", 503);
  const status = new URL(req.url).searchParams.get("status");
  after(() => sweepSupportNotices(admin));
  return json(await listSupportThreads(admin, isSupportFilter(status) ? status : "open"));
}
