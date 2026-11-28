import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import AdminNav from "./AdminNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Backoffice", template: "%s · Backoffice" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin();
  const [issues, reports, support, auth, pickups, unscanned] = admin
    ? await Promise.all([
        admin.from("order_issues").select("id", { count: "exact", head: true }).eq("status", "open"),
        admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
        admin.from("support_threads").select("id", { count: "exact", head: true }).eq("admin_unread", true),
        // Ægthedstjek (findes først, når 0017_aegthed.sql er kørt)
        admin.from("items").select("id", { count: "exact", head: true }).eq("auth_status", "pending").is("removed_at", null),
        // Afhentninger, der ikke er bekræftet af begge, og som skal afgøres under Sager (findes først, når 0041_afhentning.sql er kørt)
        admin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "paid")
          .eq("delivery", "pickup")
          .eq("issue_open", false)
          .not("pickup_flagged_at", "is", null),
        // Pakker med Reliveds label, som ikke er scannet, og som skal afgøres under Sager (0042_rettelser.sql)
        admin
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "paid")
          .eq("delivery", "ship")
          .eq("issue_open", false)
          .not("scan_flagged_at", "is", null),
      ])
    : [null, null, null, null, null, null];
  return (
    <div className="wrap adm">
      <AdminNav
        openIssues={(issues?.count ?? 0) + (pickups?.error ? 0 : (pickups?.count ?? 0)) + (unscanned?.error ? 0 : (unscanned?.count ?? 0))}
        openReports={reports?.count ?? 0}
        unreadSupport={support?.count ?? 0}
        pendingAuth={auth?.error ? 0 : (auth?.count ?? 0)}
      />
      {children}
    </div>
  );
}
