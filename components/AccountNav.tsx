import Link from "next/link";
import Avatar from "@/components/Avatar";
import { IconCamera, IconCart, IconUser } from "@/components/Icons";
import type { Profile } from "@/lib/types";

export default function AccountNav({ profile, active, snupCount }: { profile: Profile; active: "konto" | "kurv" | "studio"; snupCount?: number }) {
  const tab = (key: typeof active) => (active === key ? "page" : undefined);
  return (
    <nav className="dnav" aria-label="Min konto">
      <div className="me">
        <Avatar handle={profile.handle} />
        <div>
          <strong>{profile.display_name || profile.handle}</strong>
          <span className="muted" style={{ fontSize: ".82rem" }}>@{profile.handle}</span>
        </div>
      </div>
      <Link className="dtab" href="/konto" aria-current={tab("konto")}>
        <IconUser className="ico" />
        Min konto
      </Link>
      <Link className="dtab" href="/kurv" aria-current={tab("kurv")}>
        <IconCart className="ico" />
        Mine snup
        {snupCount ? <span className="count">{snupCount}</span> : null}
      </Link>
      <Link className="dtab" href="/studio" aria-current={tab("studio")}>
        <IconCamera />
        {profile.is_seller ? "Mine shows" : "Bliv sælger"}
      </Link>
      <form action="/auth/signout" method="post">
        <button className="btn btn-line btn-sm btn-block" type="submit">Log ud</button>
      </form>
    </nav>
  );
}
