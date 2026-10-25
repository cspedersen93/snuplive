import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Backoffice", template: "%s · Backoffice" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin();
  const [issues, reports, support, auth] = admin
    ? await Promise.all([
        admin.from("order_issues").select("id", { count: "exact", head: true }).eq("status", "open"),
        admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
        admin.from("support_threads").select("id", { count: "exact", head: true }).eq("admin_unread", true),
        // Ægthedstjek (findes først, når 0017_aegthed.sql er kørt)
        admin.from("items").select("id", { count: "exact", head: true }).eq("auth_status", "pending").is("removed_at", null),
      ])
    : [null, null, null, null];
  return (
    <div className="wrap adm">
      <AdminNav
        openIssues={issues?.count ?? 0}
        openReports={reports?.count ?? 0}
        unreadSupport={support?.count ?? 0}
        pendingAuth={auth?.error ? 0 : (auth?.count ?? 0)}
      />
      {children}
    </div>
  );
}
