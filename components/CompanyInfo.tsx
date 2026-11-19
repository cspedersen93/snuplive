import { COMPANY } from "@/lib/company";

/** Firmaoplysninger, som loven kræver på en webshop og markedsplads. */
export default function CompanyInfo({ phone = false }: { phone?: boolean }) {
  return (
    <ul className="company-info">
      <li><b>Firma:</b> {COMPANY.name}</li>
      <li><b>CVR-nummer:</b> {COMPANY.cvr}</li>
      <li><b>Adresse:</b> {COMPANY.address}</li>
      <li><b>E-mail:</b> <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></li>
      {phone ? <li><b>Telefon:</b> <a href={COMPANY.phoneHref}>{COMPANY.phone}</a></li> : null}
    </ul>
  );
}
