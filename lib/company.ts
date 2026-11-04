// Firmaoplysninger til vilkår, kontakt og bunden af siden. Relived ApS blev stiftet i november 2026 (CVR 46902297).
// Kan overskrives i Vercel (Settings → Environment Variables):
//   NEXT_PUBLIC_COMPANY_NAME, NEXT_PUBLIC_COMPANY_CVR, NEXT_PUBLIC_COMPANY_ADDRESS

const clean = (v?: string) => (v ?? "").trim().replace(/^["']|["']$/g, "") || null;

export const COMPANY = {
  name: clean(process.env.NEXT_PUBLIC_COMPANY_NAME) ?? "Relived ApS",
  cvr: clean(process.env.NEXT_PUBLIC_COMPANY_CVR) ?? "46902297",
  address: clean(process.env.NEXT_PUBLIC_COMPANY_ADDRESS),
  email: "kontakt@relived.dk",
};

/** "Relived ApS · CVR 12345678 · Vej 1, 2650 Hvidovre", uden de dele, der ikke er udfyldt endnu. */
export function companyLine() {
  return [COMPANY.name, COMPANY.cvr ? `CVR ${COMPANY.cvr}` : null, COMPANY.address].filter(Boolean).join(" · ");
}
