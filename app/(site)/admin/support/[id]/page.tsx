import type { Metadata } from "next";
import SetupNotice from "@/components/SetupNotice";
import { requireAdmin } from "@/lib/admin";
import { isSupportFilter, listSupportThreads } from "@/lib/support";
import SupportDesk from "../SupportDesk";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Support" };

/** En samtale i supporten (linket i mailen til admins). */
export default async function SupportThread({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ vis?: string }> }) {
  const { id } = await params;
  const { admin } = await requireAdmin(`/admin/support/${id}`);
  if (!admin) return <SetupNotice />;
  const { vis } = await searchParams;
  const filter = isSupportFilter(vis) ? vis : "open";
  return <SupportDesk initial={await listSupportThreads(admin, filter)} filter={filter} selected={id} />;
}
