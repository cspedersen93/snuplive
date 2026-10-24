"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useCallback, useEffect, useId, useRef, useState } from "react";
import { clock, dayLabel } from "@/lib/format";
import { SUPPORT_MAX, type SupportMessage } from "@/lib/support-shared";

interface State {
  enabled: boolean;
  viewer: { loggedIn: boolean; email: string | null } | null;
  needLogin: boolean;
  thread: { status: "open" | "closed"; email: string | null } | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const POLL_MS = 4000;

export function stamp(iso: string) {
  const d = dayLabel(iso);
  return d === "I dag" ? clock(iso) : `${d.toLowerCase()} kl. ${clock(iso)}`;
}

/** Links i beskeder bliver klikbare. */
export function Linked({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)])/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <a key={i} href={p} target="_blank" rel="noopener noreferrer">{p}</a>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

/** Selve chatten. Henter nye beskeder hvert 4. sekund, mens den er åben. */
export default function SupportPanel({
  open,
  onClose,
  onThread,
  onSeen,
}: {
  open: boolean;
  onClose: () => void;
  onThread: (has: boolean) => void;
  onSeen: () => void;
}) {
  const uid = useId();
  const path = usePathname() ?? "/";
  const [state, setState] = useState<State | null>(null);
  const [failed, setFailed] = useState(false);
  const [msgs, setMsgs] = useState<SupportMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastId = useRef(0);
  const body = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLElement>(null);

  const add = useCallback((list: SupportMessage[]) => {
    if (!list.length) return;
    setMsgs((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      const next = [...cur, ...list.filter((m) => !seen.has(m.id))].sort((a, b) => a.id - b.id);
      lastId.current = next.length ? next[next.length - 1].id : 0;
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/support?open=1&after=${lastId.current}`, { cache: "no-store" });
      const j = (await r.json()) as State & { messages?: SupportMessage[] };
      if (!r.ok && j.enabled !== false) throw new Error();
      setFailed(false);
      setState({ enabled: j.enabled !== false, viewer: j.viewer ?? null, needLogin: Boolean(j.needLogin), thread: j.thread ?? null });
      add(j.messages ?? []);
      onThread(Boolean(j.thread));
      onSeen();
    } catch {
      setFailed(true);
    }
  }, [add, onThread, onSeen]);

  // Hent med det samme og derefter hvert 4. sekund, mens chatten er åben og fanen er synlig.
  useEffect(() => {
    if (!open) return;
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    const vis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [open, load]);

  // Rul ned til den nyeste besked.
  useEffect(() => {
    const el = body.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, state?.thread?.status, open]);

  const needEmail = Boolean(state && !state.viewer?.loggedIn && !state.thread);

  // Fokus i feltet, når chatten åbner. Escape lukker.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => (needEmail && !email ? emailRef.current : area.current)?.focus(), 60);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && panel.current?.contains(document.activeElement)) onClose();
    };
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", key);
    };
    // Kun når chatten åbner eller e-mail-feltet kommer frem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, needEmail]);

  // Tilpas højden på feltet til teksten.
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (busy) return;
    const text = draft.trim();
    setError(null);
    if (!text) return area.current?.focus();
    if (needEmail && !EMAIL.test(email.trim())) {
      setError("Skriv din e-mail, så vi kan svare dig.");
      return emailRef.current?.focus();
    }
    setBusy(true);
    try {
      const r = await fetch("/api/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: text, email: needEmail ? email.trim() : undefined, page: path, website }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; message?: SupportMessage | null; thread?: State["thread"] };
      if (!r.ok) throw new Error(j.error || "Beskeden blev ikke sendt. Prøv igen.");
      setDraft("");
      if (j.message) add([j.message]);
      if (j.thread) setState((s) => (s ? { ...s, needLogin: false, thread: j.thread ?? null } : s));
      onThread(true);
      area.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Beskeden blev ikke sendt. Prøv igen.");
    } finally {
      setBusy(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !touch) {
      e.preventDefault();
      send();
    }
  }

  const last = msgs[msgs.length - 1];
  const waiting = last?.sender === "user";
  const replyTo = state?.thread?.email ?? state?.viewer?.email ?? null;
  const closed = state?.thread?.status === "closed";
  const off = state && !state.enabled;
  const loginHref = `/login?next=${encodeURIComponent(`${path}?hjaelp=1`)}`;

  return (
    <section
      id="sup-panel"
      ref={panel}
      className="sup-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${uid}-t`}
      hidden={!open}
    >
      <header className="sup-head">
        <span className="sup-mark" aria-hidden="true">S</span>
        <div className="sup-head-t">
          <h2 id={`${uid}-t`}>Skriv til os</h2>
          <p>Vi svarer, så hurtigt vi kan – som regel samme dag.</p>
        </div>
        <button type="button" className="sup-x" onClick={onClose} aria-label="Luk chatten">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </header>

      <div className="sup-body" ref={body} aria-live="polite" aria-relevant="additions">
        <div className="sup-msg them">
          <span className="sup-who">Relived</span>
          <p>Hej! Driller siden, eller har du et spørgsmål til en handel? Skriv her, så hjælper vi dig.</p>
        </div>
        {state?.needLogin && !state.thread ? (
          <p className="sup-note">
            Du har en samtale med os på din konto. <Link href={loginHref}>Log ind for at se den</Link>, eller skriv en ny besked herunder.
          </p>
        ) : null}
        {msgs.map((m) => (
          <div key={m.id} className={`sup-msg ${m.sender === "user" ? "me" : "them"}`}>
            {m.sender === "admin" ? <span className="sup-who">{m.author_name ? `${m.author_name} · Relived` : "Relived"}</span> : null}
            <p><Linked text={m.body} /></p>
            <time dateTime={m.created_at}>{stamp(m.created_at)}</time>
          </div>
        ))}
        {waiting && !closed ? (
          <p className="sup-note">
            Tak, vi har fået din besked.{" "}
            {replyTo ? <>Du kan lukke siden – svaret kommer også på mail til <b>{replyTo}</b>.</> : "Bliv her, så svarer vi."}
          </p>
        ) : null}
        {closed ? <p className="sup-note">Samtalen er afsluttet. Skriv igen, hvis du har brug for mere hjælp.</p> : null}
        {failed ? <p className="sup-note warn" role="alert">Vi kan ikke få forbindelse lige nu. Tjek dit internet, eller skriv til kontakt@relived.dk.</p> : null}
        {off ? <p className="sup-note warn">Chatten er ikke sat op endnu. Skriv til kontakt@relived.dk.</p> : null}
      </div>

      <form className="sup-form" onSubmit={send} noValidate>
        {needEmail ? (
          <div className="sup-email">
            <label htmlFor={`${uid}-e`}>Din e-mail</label>
            <input
              ref={emailRef}
              id={`${uid}-e`}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="navn@mail.dk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={200}
              required
            />
          </div>
        ) : null}
        <div className="sup-hp" aria-hidden="true">
          <label htmlFor={`${uid}-w`}>Lad dette felt være tomt</label>
          <input id={`${uid}-w`} tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>
        <div className="sup-compose">
          <label htmlFor={`${uid}-m`} className="sr-only">Din besked</label>
          <textarea
            ref={area}
            id={`${uid}-m`}
            rows={1}
            placeholder={msgs.length ? "Skriv en besked" : "Hvad kan vi hjælpe med?"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            maxLength={SUPPORT_MAX}
            disabled={Boolean(off)}
          />
          <button type="submit" className="sup-send" aria-label="Send besked" disabled={busy || Boolean(off)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>
          </button>
        </div>
        {error ? <p className="sup-err" role="alert">{error}</p> : null}
        {needEmail ? (
          <p className="sup-fine">
            Vi bruger kun din e-mail til at svare dig. Se <Link href="/privatliv#support">privatlivspolitikken</Link>.
          </p>
        ) : null}
      </form>
    </section>
  );
}
