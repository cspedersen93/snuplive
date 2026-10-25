import type { Metadata } from "next";
import Link from "next/link";
import SetupNotice from "@/components/SetupNotice";
import { requireAdmin } from "@/lib/admin";
import { category, clock, dayLabel, kr } from "@/lib/format";
import { storageUrl } from "@/lib/images";
import { itemHref } from "@/lib/items";
import { AUTH_SHOTS } from "@/lib/luxury";
import AuthDecision from "./AuthDecision";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ægthedstjek" };

interface Row {
  id: string;
  name: string;
  price: number;
  description: string | null;
  category: string | null;
  images: string[] | null;
  auth_status: "pending" | "approved" | "rejected" | null;
  auth_photos: string[];
  auth_note: string | null;
  auth_at: string | null;
  seller: { handle: string } | null;
  show: { title: string; category: string } | null;
}

const SELECT =
  "id,name,price,description,category,images,auth_status,auth_photos,auth_note,auth_at," +
  "seller:profiles!items_seller_id_fkey(handle),show:shows!items_show_id_fkey(title,category)";
const at = (iso: string | null) => (iso ? `${dayLabel(iso).toLowerCase()} kl. ${clock(iso)}` : "–");

/** Hvilket billede er det? Filnavnet starter med nøglen fra AUTH_SHOTS (auth-logo…, auth-kode…). */
function shotLabel(path: string) {
  const name = path.split("/").pop() ?? "";
  return AUTH_SHOTS.find((s) => name.startsWith(`auth-${s.key}`))?.label ?? "Billede";
}

/** Ægthedstjek af mærkevarer: sælgerens nærbilleder. Godkend eller afvis, og sælgeren får besked på mail. */
export default async function Aegthed() {
  const { admin } = await requireAdmin("/admin/aegthed");
  if (!admin) return <SetupNotice />;

  const [openQ, doneQ] = await Promise.all([
    admin.from("items").select(SELECT).eq("auth_status", "pending").is("removed_at", null).order("auth_at", { ascending: true }).limit(100),
    admin.from("items").select(SELECT).in("auth_status", ["approved", "rejected"]).order("auth_at", { ascending: false }).limit(20),
  ]);
  if (openQ.error) {
    return (
      <div className="box">
        <h1 className="h3">Ægthedstjek</h1>
        <p className="muted">Kør supabase/migrations/0017_aegthed.sql i Supabase for at slå ægthedstjek til.</p>
      </div>
    );
  }
  const open = (openQ.data ?? []) as unknown as Row[];
  const done = (doneQ.data ?? []) as unknown as Row[];

  return (
    <div className="adm-auth">
      <div>
        <h1 className="h2">Ægthedstjek</h1>
        <p className="muted" style={{ marginTop: 6, maxWidth: "70ch" }}>
          Mærkevarer og luksus over 1.000 kr kan ikke vises live eller købes, før de er godkendt her. Kig på logo, koder, syninger
          og metaldele. Er I i tvivl, så kør billederne gennem en ægthedstjeneste (fx LegitApp), før I godkender.
        </p>
      </div>

      {open.length ? (
        open.map((r) => (
          <section className="adm-auth-item" key={r.id} aria-labelledby={`a-${r.id}`}>
            <div className="adm-auth-head">
              <div>
                <h2 className="h3" id={`a-${r.id}`}>
                  {r.name} · {kr(r.price)}
                </h2>
                <span className="muted" style={{ fontSize: ".88rem" }}>
                  @{r.seller?.handle} · {category(r.category ?? r.show?.category).short} · {r.show?.title} · sendt {at(r.auth_at)}
                </span>
              </div>
              <Link className="linkbtn" href={itemHref(r)} target="_blank">Se tingen</Link>
            </div>
            {r.description ? <p style={{ fontSize: ".92rem" }}>{r.description}</p> : null}
            <div className="adm-auth-photos">
              {[...r.auth_photos, ...(r.images ?? []).slice(0, 2)].map((p, i) => (
                <figure key={p} style={{ margin: 0 }}>
                  <a href={storageUrl("items", p)} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={storageUrl("items", p)} alt="" loading="lazy" />
                  </a>
                  <figcaption>{i < r.auth_photos.length ? shotLabel(p) : "Billede på annoncen"}</figcaption>
                </figure>
              ))}
            </div>
            <AuthDecision id={r.id} />
          </section>
        ))
      ) : (
        <p className="muted">Ingen ting venter på ægthedstjek lige nu.</p>
      )}

      {done.length ? (
        <div className="box">
          <h2 className="h3" style={{ marginBottom: 8 }}>Senest afgjort</h2>
          <ul className="list">
            {done.map((r) => (
              <li key={r.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>
                    <Link href={itemHref(r)}>{r.name}</Link> · {kr(r.price)}
                  </strong>
                  <span>
                    @{r.seller?.handle} · {at(r.auth_at)}
                    {r.auth_note ? ` · ${r.auth_note}` : ""}
                  </span>
                </div>
                <span className={`chip ${r.auth_status === "approved" ? "ok" : "warn"}`}>{r.auth_status === "approved" ? "Godkendt" : "Afvist"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
