import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Backoffice", template: "%s · Backoffice" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin();
  const [issues, reports, support] = admin
    ? await Promise.all([
        admin.from("order_issues").select("id", { count: "exact", head: true }).eq("status", "open"),
        admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
        admin.from("support_threads").select("id", { count: "exact", head: true }).eq("admin_unread", true),
      ])
    : [null, null, null];
  return (
    <div className="wrap adm">
      <AdminNav openIssues={issues?.count ?? 0} openReports={reports?.count ?? 0} unreadSupport={support?.count ?? 0} />
      {children}
    </div>
  );
}
