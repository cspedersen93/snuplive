import { COMPANY } from "@/lib/company";

/** Firmaoplysninger, som loven kræver på en webshop og markedsplads. */
export default function CompanyInfo() {
  return (
    <ul className="company-info">
      <li><b>Firma:</b> {COMPANY.name}</li>
      <li><b>CVR-nummer:</b> {COMPANY.cvr}</li>
      <li><b>Adresse:</b> {COMPANY.address ?? "kommer snart"}</li>
      <li><b>E-mail:</b> <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></li>
    </ul>
  );
}
