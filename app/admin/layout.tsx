import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Backoffice", template: "%s · Backoffice" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin();
  const open = admin ? ((await admin.from("order_issues").select("id", { count: "exact", head: true }).eq("status", "open")).count ?? 0) : 0;
  return (
    <div className="wrap adm">
      <AdminNav openIssues={open} />
      {children}
    </div>
  );
}
