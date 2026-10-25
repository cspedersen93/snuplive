"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthPanel from "./[id]/AuthPanel";

/** Til salg: en mærkevare, der skal ægthedstjekkes, før den kan købes (fx en videoannonce). */
export default function ForSaleAuth({
  sellerId,
  itemId,
  itemName,
  status,
  note,
}: {
  sellerId: string;
  itemId: string;
  itemName: string;
  status: "pending" | "rejected" | null;
  note: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const pending = sent || status === "pending";
  return (
    <div className="fs-auth">
      <span className={`auth-line ${pending ? "pending" : (status ?? "none")}`}>
        {pending
          ? "Venter på ægthedstjek. Den kan købes, når vi har tjekket den."
          : status === "rejected"
            ? `Ægthedstjek afvist${note ? `: ${note}` : ""}`
            : "Skal ægthedstjekkes, før den kan købes."}
        {!pending ? (
          <>
            {" "}
            <button className="linkbtn" type="button" onClick={() => setOpen((o) => !o)}>
              {status === "rejected" ? "Send nye billeder" : "Send billeder"}
            </button>
          </>
        ) : null}
      </span>
      {open && !pending ? (
        <AuthPanel
          sellerId={sellerId}
          itemId={itemId}
          itemName={itemName}
          note={status === "rejected" ? note : null}
          onSent={() => {
            setSent(true);
            setOpen(false);
            router.refresh();
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
