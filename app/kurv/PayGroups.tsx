"use client";

import { useState } from "react";
import Avatar from "@/components/Avatar";
import { IconShield } from "@/components/Icons";
import { kr } from "@/lib/format";
import { DELIVERY, orderAmounts, type Delivery } from "@/lib/pricing";
import { errorText, toast } from "@/lib/toast";

export interface PayGroup {
  key: string;
  seller: { handle: string; display_name: string | null; avatar_path: string | null };
  showTitle: string;
  deadline: string;
  items: { id: string; name: string; meta: string; price: number }[];
}

export default function PayGroups({ groups, ready }: { groups: PayGroup[]; ready: boolean }) {
  const [choice, setChoice] = useState<Record<string, Delivery>>(() => Object.fromEntries(groups.map((g) => [g.key, "ship"])));
  const [busy, setBusy] = useState(false);

  const sums = groups.map((g) => orderAmounts(g.items.reduce((a, i) => a + i.price, 0), choice[g.key] ?? "ship"));
  const total = sums.reduce(
    (a, s) => ({ items: a.items + s.items, shipping: a.shipping + s.shipping, fee: a.fee + s.fee, total: a.total + s.total }),
    { items: 0, shipping: 0, fee: 0, total: 0 },
  );

  async function pay() {
    setBusy(true);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deliveries: choice }),
      });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || "Betalingen kunne ikke startes.");
      window.location.href = j.url;
    } catch (e) {
      setBusy(false);
      toast(errorText(e));
    }
  }

  return (
    <div className="cart-grid" style={{ paddingBlock: 0 }}>
      <div style={{ minWidth: 0 }}>
        {groups.map((g, gi) => (
          <section className="group" key={g.key} aria-label={`Fra ${g.seller.handle}`}>
            <div className="group-head">
              <div className="seller-row">
                <Avatar handle={g.seller.handle} path={g.seller.avatar_path} />
                <div>
                  <strong>{g.seller.handle}</strong>
                  <span className="muted" style={{ fontSize: ".85rem" }}>{g.showTitle}</span>
                </div>
              </div>
              <span className="chip warn">Betal senest {g.deadline}</span>
            </div>
            {g.items.map((i) => (
              <div className="citem" key={i.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{i.name}</strong>
                  {i.meta ? <span className="from">{i.meta}</span> : null}
                </div>
                <div className="right">
                  <span className="num" style={{ fontWeight: 600 }}>{kr(i.price)}</span>
                </div>
              </div>
            ))}
            <fieldset className="deliv">
              <legend>Levering</legend>
              <div className="opts">
                {(Object.keys(DELIVERY) as Delivery[]).map((d) => (
                  <label className="opt" key={d}>
                    <input
                      type="radio"
                      name={`lev-${gi}`}
                      checked={choice[g.key] === d}
                      onChange={() => setChoice((c) => ({ ...c, [g.key]: d }))}
                    />
                    <span>
                      <strong>{DELIVERY[d].label}</strong>
                      <small>{DELIVERY[d].note}</small>
                    </span>
                    <span className="num">{kr(DELIVERY[d].price)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="group-foot">
              <span>Sendes i én pakke</span>
              <b>{kr(sums[gi].items + sums[gi].shipping)}</b>
            </div>
          </section>
        ))}
      </div>
      <aside className="summary" aria-label="Oversigt">
        <h2 className="h3">Oversigt</h2>
        <div className="sum-row"><span>Ting</span><span className="num">{kr(total.items)}</span></div>
        <div className="sum-row"><span>Fragt</span><span className="num">{kr(total.shipping)}</span></div>
        <div className="sum-row"><span>Køberbeskyttelse</span><span className="num">{kr(total.fee)}</span></div>
        <div className="sum-row total"><span>I alt</span><span className="num">{kr(total.total)}</span></div>
        <button className="btn btn-red btn-block" type="button" onClick={pay} disabled={!ready || busy}>
          {!ready ? "Betaling er ikke sat op endnu" : busy ? "Åbner betaling …" : `Betal ${kr(total.total)}`}
        </button>
        <p className="fine" style={{ textAlign: "center" }}>MobilePay, kort, Apple Pay og Google Pay</p>
        <div className="protect">
          <IconShield />
          <span>Pengene holdes tilbage hos SnupLive, indtil du har fået dine ting. Køberbeskyttelsen er 5 % + 5 kr pr. pakke.</span>
        </div>
      </aside>
    </div>
  );
}
