// Firmaoplysninger til vilkår, kontakt og bunden af siden.
// Udfyldes i Vercel (Settings → Environment Variables), når Relived ApS er registreret:
//   NEXT_PUBLIC_COMPANY_NAME, NEXT_PUBLIC_COMPANY_CVR, NEXT_PUBLIC_COMPANY_ADDRESS
// Indtil da står der, at selskabet er under stiftelse.

const clean = (v?: string) => (v ?? "").trim().replace(/^["']|["']$/g, "") || null;

export const COMPANY = {
  name: clean(process.env.NEXT_PUBLIC_COMPANY_NAME) ?? "Relived ApS (under stiftelse)",
  cvr: clean(process.env.NEXT_PUBLIC_COMPANY_CVR),
  address: clean(process.env.NEXT_PUBLIC_COMPANY_ADDRESS),
  email: "kontakt@relived.dk",
};

/** "Relived ApS · CVR 12345678 · Vej 1, 2650 Hvidovre", uden de dele, der ikke er udfyldt endnu. */
export function companyLine() {
  return [COMPANY.name, COMPANY.cvr ? `CVR ${COMPANY.cvr}` : null, COMPANY.address].filter(Boolean).join(" · ");
}
