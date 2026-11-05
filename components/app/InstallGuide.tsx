"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconAddSquare, IconCheck, IconDots, IconInstall, IconIosShare } from "@/components/Icons";
import { promptInstall, useInstall, type Platform } from "@/lib/appInstall";
import { toast } from "@/lib/toast";

const TABS: { key: Platform; label: string }[] = [
  { key: "ios", label: "iPhone og iPad" },
  { key: "android", label: "Android" },
  { key: "desktop", label: "Computer" },
];

/** Knappen, der installerer med det samme, hvor browseren kan (Chrome og Edge). */
export function InstallNowButton({ className = "btn btn-red", label = "Hent appen" }: { className?: string; label?: string }) {
  const st = useInstall();
  if (!st?.canPrompt) return null;
  return (
    <button
      className={className}
      type="button"
      onClick={async () => {
        const ok = await promptInstall();
        toast(ok ? "Relived ligger nu på din hjemmeskærm." : "Du kan altid hente appen her senere.");
      }}
    >
      <IconInstall width={18} height={18} />
      {label}
    </button>
  );
}

/**
 * /app: sådan lægger man Relived på hjemmeskærmen. Viser den telefon, man har, først. Har browseren en
 * installationsknap (Chrome og Edge), står den øverst. Er appen allerede installeret, står der det.
 */
export default function InstallGuide() {
  const st = useInstall();
  const [tab, setTab] = useState<Platform>("ios");
  useEffect(() => {
    if (st) setTab(st.platform);
    // Kun første gang, vi kender telefonen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st === null]);

  if (st?.standalone) {
    return (
      <div className="install-done">
        <IconCheck width={22} height={22} />
        <div>
          <b>Du bruger allerede appen.</b>
          <p className="muted">
            Slå beskeder til under <Link href="/konto#foelger">Min konto</Link>, så du får besked, når dem, du følger, går live.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="install-guide">
      {st?.canPrompt ? (
        <div className="install-now">
          <InstallNowButton />
          <span className="muted">Tryk, og vælg Installer. Så ligger Relived på din hjemmeskærm.</span>
        </div>
      ) : null}
      <div className="install-tabs" role="tablist" aria-label="Vælg din enhed">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`install-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`install-${t.key}`}
            className={tab === t.key ? "on" : undefined}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="install-ios" role="tabpanel" aria-labelledby="install-tab-ios" hidden={tab !== "ios"}>
        <ol className="install-steps">
          <li>
            <span className="install-n">1</span>
            <div>
              <b>Åbn relived.dk i Safari.</b>
              <p className="muted">Bruger du Chrome, virker det også: Del-knappen sidder i adresselinjen.</p>
            </div>
          </li>
          <li>
            <span className="install-n">2</span>
            <div>
              <b>
                Tryk på Del <span className="install-ico"><IconIosShare width={18} height={18} /></span>
              </b>
              <p className="muted">Firkanten med en pil op, nederst på skærmen (på iPad øverst).</p>
            </div>
          </li>
          <li>
            <span className="install-n">3</span>
            <div>
              <b>
                Vælg Føj til hjemmeskærm <span className="install-ico"><IconAddSquare width={18} height={18} /></span>
              </b>
              <p className="muted">Kan du ikke se den, så rul lidt ned i listen.</p>
            </div>
          </li>
          <li>
            <span className="install-n">4</span>
            <div>
              <b>Tryk Tilføj.</b>
              <p className="muted">Nu ligger Relived på hjemmeskærmen. Åbn den derfra, så kan du også få beskeder på din iPhone.</p>
            </div>
          </li>
        </ol>
      </div>

      <div id="install-android" role="tabpanel" aria-labelledby="install-tab-android" hidden={tab !== "android"}>
        <ol className="install-steps">
          <li>
            <span className="install-n">1</span>
            <div>
              <b>Åbn relived.dk i Chrome.</b>
              <p className="muted">Står der en knap med Hent appen øverst på siden, så tryk på den. Så er du færdig.</p>
            </div>
          </li>
          <li>
            <span className="install-n">2</span>
            <div>
              <b>
                Tryk på menuen <span className="install-ico"><IconDots width={18} height={18} /></span>
              </b>
              <p className="muted">De tre prikker øverst til højre.</p>
            </div>
          </li>
          <li>
            <span className="install-n">3</span>
            <div>
              <b>Vælg Installer app eller Føj til startskærm.</b>
              <p className="muted">Tryk Installer. Relived ligger nu sammen med dine andre apps.</p>
            </div>
          </li>
        </ol>
      </div>

      <div id="install-desktop" role="tabpanel" aria-labelledby="install-tab-desktop" hidden={tab !== "desktop"}>
        <ol className="install-steps">
          <li>
            <span className="install-n">1</span>
            <div>
              <b>Chrome eller Edge:</b>
              <p className="muted">
                Tryk på ikonet med en skærm og en pil i højre side af adresselinjen, eller åbn menuen og vælg Installer Relived.
              </p>
            </div>
          </li>
          <li>
            <span className="install-n">2</span>
            <div>
              <b>Safari på Mac:</b>
              <p className="muted">Vælg Arkiv i menuen øverst, og tryk Føj til Dock.</p>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}
