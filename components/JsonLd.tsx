import { COMPANY } from "@/lib/company";
import { SITE_URL } from "@/lib/env";

/** Strukturerede data til Google (schema.org). `<` gøres uskadelig, så tekst fra brugere ikke kan lukke script-tagget. */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path === "/" ? "/" : path}`);

/** Brødkrummer som schema.org-liste: [["Forside", "/"], ["Sælg live", "/saelg"]]. */
export function crumbsLd(items: readonly (readonly [string, string])[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(path) })),
  };
}

/** Brødkrummerne øverst på en side, så Google kan vise stien i søgeresultatet i stedet for den rå adresse. */
export function CrumbsLd({ items }: { items: readonly (readonly [string, string])[] }) {
  return <JsonLd data={{ "@context": "https://schema.org", ...crumbsLd(items) }} />;
}

/** Relived som virksomhed: navn, logo, CVR, adresse og mail. Samme oplysninger som i bunden af siden. */
export function orgLd() {
  const m = /^(.*),\s*(\d{4})\s+(.+)$/.exec(COMPANY.address ?? "");
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organisation`,
    name: "Relived",
    legalName: COMPANY.name,
    url: `${SITE_URL}/`,
    logo: { "@type": "ImageObject", url: `${SITE_URL}/img/logo.png`, width: 1000, height: 362 },
    email: COMPANY.email,
    ...(COMPANY.cvr ? { vatID: `DK${COMPANY.cvr}`, identifier: { "@type": "PropertyValue", propertyID: "CVR", value: COMPANY.cvr } } : {}),
    ...(m ? { address: { "@type": "PostalAddress", streetAddress: m[1], postalCode: m[2], addressLocality: m[3], addressCountry: "DK" } } : {}),
    contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: COMPANY.email, availableLanguage: ["da", "en"] },
  };
}
