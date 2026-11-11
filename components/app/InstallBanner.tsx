"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { IconInstall } from "@/components/Icons";
import { promptInstall, useInstall } from "@/lib/appInstall";
import { APP_BANNER_KEY, COOKIE_NOTICE_KEY } from "@/lib/cookies";
import { toast } from "@/lib/toast";

/** Kun på sider, hvor man kigger rundt. Ikke i shows, studiet, klip, kurven, login og på /app selv. */
const PAGES = /^\/($|live$|til-salg|budsalg|kategori|soeg|ting\/|guides|saadan-virker-det)/;
const DAYS = 30;
/** Tilbuddet kommer først, når man har set en side mere end den, man landede på (tælles kun i hukommelsen). */
let views = 0;
let lastPath = "";

function dismissedRecently() {
  try {
    const at = Number(localStorage.getItem(APP_BANNER_KEY) || 0);
    return Date.now() - at < DAYS * 86_400_000;
  } catch {
    return true;
  }
}

function cookieNoticeOpen() {
  try {
    return localStorage.getItem(COOKIE_NOTICE_KEY) !== "1";
  } catch {
    return true;
  }
}

/**
 * Et lille tilbud nederst på telefonen om at hente Relived som app. Kommer kun på telefoner, der ikke allerede
 * bruger appen, efter mindst to sider, når cookiebeskeden er væk, og ikke igen i 30 dage, når man har lukket det.
 */
export default function InstallBanner() {
  const path = usePathname();
  const st = useInstall();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (path !== lastPath) {
      lastPath = path;
      views += 1;
    }
    if (!st || st.installed) return setShow(false);
    const phone = window.matchMedia("(max-width: 899px) and (pointer: coarse)").matches;
    const supported = st.platform === "ios" || st.canPrompt;
    setShow(phone && supported && views >= 2 && PAGES.test(path) && !dismissedRecently() && !cookieNoticeOpen());
  }, [path, st]);

  if (!show || !st) return null;

  function close() {
    try {
      localStorage.setItem(APP_BANNER_KEY, String(Date.now()));
    } catch {
      // Så kommer tilbuddet igen næste gang. Det gør ikke noget.
    }
    setShow(false);
  }

  return (
    <aside className="app-banner" aria-label="Hent Relived som app">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={44} height={44} />
      <div className="app-banner-text">
        <b>Hent Relived som app</b>
        <span>Ét tryk væk, og besked når dine sælgere går live.</span>
      </div>
      <div className="app-banner-act">
        {st.canPrompt ? (
          <button
            className="btn btn-ivory btn-sm"
            type="button"
            onClick={async () => {
              const ok = await promptInstall();
              if (ok) toast("Relived ligger nu på din hjemmeskærm.");
              close();
            }}
          >
            <IconInstall width={16} height={16} />
            Hent
          </button>
        ) : (
          <Link className="btn btn-ivory btn-sm" href="/app" onClick={close}>
            Se hvordan
          </Link>
        )}
        <button className="app-banner-x" type="button" onClick={close} aria-label="Ikke nu">
          ×
        </button>
      </div>
    </aside>
  );
}
