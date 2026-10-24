import type { Metadata } from "next";
import SetupNotice from "@/components/SetupNotice";
import { requireAdmin } from "@/lib/admin";
import { isSupportFilter, listSupportThreads } from "@/lib/support";
import SupportDesk from "./SupportDesk";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Support" };

/** Samtaler fra chatten "Skriv til os". Kun for e-mails i ADMIN_EMAILS. */
export default async function Support({ searchParams }: { searchParams: Promise<{ vis?: string }> }) {
  const { admin } = await requireAdmin("/admin/support");
  if (!admin) return <SetupNotice />;
  const { vis } = await searchParams;
  const filter = isSupportFilter(vis) ? vis : "open";
  return <SupportDesk initial={await listSupportThreads(admin, filter)} filter={filter} selected={null} />;
}
