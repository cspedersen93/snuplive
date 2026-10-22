"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { MITID_RESULT } from "@/lib/mitid-text";
import { toast } from "@/lib/toast";

/** Viser svaret efter MitID (?mitid=ok, brugt, alder …) og fjerner det fra adressen igen. */
export default function MitIdResult() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const result = sp.get("mitid");
  useEffect(() => {
    if (!result) return;
    toast(MITID_RESULT[result] ?? MITID_RESULT.fejl);
    const rest = new URLSearchParams(sp.toString());
    rest.delete("mitid");
    router.replace(`${path}${rest.size ? `?${rest}` : ""}${window.location.hash}`, { scroll: false });
  }, [result, sp, router, path]);
  return null;
}
