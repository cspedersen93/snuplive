import type { ReactNode } from "react";
import NewsletterForm from "@/components/NewsletterForm";

/**
 * En tom side (intet live, intet til salg, ingen budsalg eller klip): fortæl det kort, og giv køberen én ting at gøre
 * med det samme, nemlig at skrive sig op til nyhedsbrevet, i stedet for at sende hende videre til en anden tom side.
 * `source` gemmes ved tilmeldingen, så Backoffice kan se, hvilken side folk skrev sig op fra.
 */
export default function EmptyNext({ text, source, children }: { text: ReactNode; source: string; children?: ReactNode }) {
  return (
    <div className="empty empty-next">
      <p>{text}</p>
      <NewsletterForm source={source} button="Giv mig besked" sellOption={false} />
      {children}
    </div>
  );
}
