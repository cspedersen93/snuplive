"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Linked, stamp } from "@/components/SupportPanel";
import { clock, dayLabel } from "@/lib/format";
import { deviceLabel, SUPPORT_MAX, type SupportMessage, type SupportThreadRow } from "@/lib/support-shared";
import { errorText, toast } from "@/lib/toast";

type Filter = "open" | "closed" | "all";
interface List {
  threads: SupportThreadRow[];
  open: number;
  unread: number;
}

const FILTERS: { k: Filter; label: string }[] = [
  { k: "open", label: "Åbne" },
  { k: "closed", label: "Lukkede" },
  { k: "all", label: "Alle" },
];

const who = (t: Pick<SupportThreadRow, "profile" | "email" | "name">) =>
  t.profile ? t.profile.display_name?.trim() || `@${t.profile.handle}` : t.email || t.name || "Besøgende";

/** "i dag kl. 14.05" eller "24. okt. kl. 14.05". */
const at = (iso: string) => `${dayLabel(iso).toLowerCase()} kl. ${clock(iso)}`;

const qs = (f: Filter) => (f === "open" ? "" : `?vis=${f}`);

/** Backoffice → Support: samtalerne til venstre, den valgte til højre. Henter nyt af sig selv. */
export default function SupportDesk({ initial, filter: start, selected }: { initial: List; filter: Filter; selected: string | null }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>(start);
  const [list, setList] = useState<List>(initial);

  const reload = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/support?status=${filter}`, { cache: "no-store" });
      if (r.ok) setList((await r.json()) as List);
    } catch {}
  }, [filter]);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && reload(), 8000);
    const vis = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [reload]);

  function pick(f: Filter) {
    setFilter(f);
    router.replace(`/admin/support${selected ? `/${selected}` : ""}${qs(f)}`, { scroll: false });
  }
  useEffect(() => {
    if (filter !== start) reload();
    // Kun når filteret skifter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="adm-page">
      <div className="adm-head">
        <h1>Support</h1>
        <span className="muted">
          {list.open} {list.open === 1 ? "åben samtale" : "åbne samtaler"}
          {list.unread ? ` · ${list.unread} ulæste` : ""}
        </span>
      </div>
      <div className={`sd${selected ? " has-sel" : ""}`}>
        <aside className="sd-list" aria-label="Samtaler">
          <div className="sd-filter" role="group" aria-label="Vis samtaler">
            {FILTERS.map((f) => (
              <button key={f.k} type="button" className="fchip" aria-pressed={filter === f.k} onClick={() => pick(f.k)}>
                {f.label}
              </button>
            ))}
          </div>
          {list.threads.length ? (
            <ul>
              {list.threads.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/admin/support/${t.id}${qs(filter)}`}
                    className={`sd-item${t.admin_unread ? " unread" : ""}`}
                    aria-current={selected === t.id ? "page" : undefined}
                    scroll={false}
                  >
                    <span className="sd-row1">
                      <b>{t.admin_unread ? <span className="sr-only">Ulæst: </span> : null}{who(t)}</b>
                      <time dateTime={t.last_message_at}>{stamp(t.last_message_at)}</time>
                    </span>
                    <span className="sd-prev">{t.last_sender === "admin" ? "SnupLive: " : ""}{t.preview}</span>
                    <span className="sd-meta">{[t.status === "closed" ? "Lukket" : null, t.page, deviceLabel(t.user_agent)].filter(Boolean).join(" · ")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">
              {filter === "open" ? "Ingen åbne samtaler. Når nogen skriver i chatten, kommer de her, og I får en mail." : "Ingen samtaler her."}
            </div>
          )}
        </aside>
        <div className="sd-main">
          {selected ? (
            <Thread key={selected} id={selected} back={`/admin/support${qs(filter)}`} onChange={reload} />
          ) : (
            <div className="sd-none">
              <p>Vælg en samtale.</p>
              <p className="muted">Svarer du, mens brugeren har chatten åben, ser de det med det samme. Ellers får de svaret på mail.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Thread({ id, back, onChange }: { id: string; back: string; onChange: () => void }) {
  const uid = useId();
  const router = useRouter();
  const [thread, setThread] = useState<SupportThreadRow | null>(null);
  const [msgs, setMsgs] = useState<SupportMessage[]>([]);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const lastId = useRef(0);
  const box = useRef<HTMLDivElement>(null);
  const first = useRef(true);

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
      const r = await fetch(`/api/admin/support/${id}?after=${lastId.current}`, { cache: "no-store" });
      if (r.status === 404) return setMissing(true);
      if (!r.ok) return;
      const j = (await r.json()) as { thread: SupportThreadRow; messages: SupportMessage[] };
      setThread(j.thread);
      add(j.messages);
      // Første gang: tælleren i fanen "Support" skal passe.
      if (first.current) {
        first.current = false;
        onChange();
        router.refresh();
      }
    } catch {}
  }, [id, add, onChange, router]);

  useEffect(() => {
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  async function reply(e?: React.FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/support/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: text }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; message?: SupportMessage; mailed?: boolean };
      if (!r.ok) throw new Error(j.error || "Svaret blev ikke sendt.");
      setDraft("");
      if (j.message) add([j.message]);
      toast(
        j.mailed && thread?.email
          ? `Sendt. ${thread.email} får også svaret på mail.`
          : thread?.email && !(thread.user_seen_at && Date.now() - Date.parse(thread.user_seen_at) < 12_000)
            ? "Sendt. Ser brugeren det ikke i chatten om 2 minutter, kommer det på mail."
            : "Sendt.",
      );
      load();
      onChange();
    } catch (err) {
      toast(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: "open" | "closed") {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/support/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error || "Det lykkedes ikke.");
      setThread((t) => (t ? { ...t, status } : t));
      toast(status === "closed" ? "Samtalen er lukket. Skriver brugeren igen, åbner den igen." : "Samtalen er åbnet igen.");
      onChange();
      router.refresh();
    } catch (err) {
      toast(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/support/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Samtalen blev ikke slettet.");
      toast("Samtalen er slettet.");
      onChange();
      router.push(back);
      router.refresh();
    } catch (err) {
      toast(errorText(err));
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <section className="sd-thread box">
        <Link className="sd-back" href={back}>← Alle samtaler</Link>
        <p>Samtalen findes ikke længere.</p>
      </section>
    );
  }
  if (!thread) return <section className="sd-thread box" aria-busy="true"><p className="muted">Henter samtalen …</p></section>;

  const lastMsg = msgs[msgs.length - 1];
  const seen =
    lastMsg?.sender === "admin"
      ? thread.user_seen_at && thread.user_seen_at >= lastMsg.created_at
        ? `Set ${at(thread.user_seen_at)}`
        : thread.user_notified_at && thread.user_notified_at >= lastMsg.created_at
          ? `Ikke set i chatten endnu · sendt på mail ${at(thread.user_notified_at)}`
          : thread.email
            ? "Ikke set endnu. Kommer på mail, hvis brugeren ikke ser det."
            : "Ikke set endnu."
      : null;

  return (
    <section className="sd-thread box" aria-labelledby={`${uid}-h`}>
      <Link className="sd-back" href={back}>← Alle samtaler</Link>
      <header className="sd-th-head">
        <div>
          <h2 id={`${uid}-h`}>{who(thread)}</h2>
          {thread.email ? <a className="muted" href={`mailto:${thread.email}`}>{who(thread) === thread.email ? "Skriv en mail" : thread.email}</a> : null}
        </div>
        <span className={`chip ${thread.status === "open" ? "warn" : "ok"}`}>{thread.status === "open" ? "Åben" : "Lukket"}</span>
      </header>
      <dl className="adm-facts">
        <div><dt>Startet</dt><dd>{at(thread.created_at)}</dd></div>
        {thread.page ? <div><dt>Side</dt><dd><a href={thread.page} target="_blank" rel="noopener noreferrer">{thread.page}</a></dd></div> : null}
        {deviceLabel(thread.user_agent) ? <div><dt>Enhed</dt><dd>{deviceLabel(thread.user_agent)}</dd></div> : null}
        <div>
          <dt>Konto</dt>
          <dd>{thread.profile && thread.user_id ? <Link href={`/admin/medlemmer/${thread.user_id}`}>@{thread.profile.handle}</Link> : "Ikke logget ind"}</dd>
        </div>
      </dl>

      <div className="sd-msgs" ref={box} aria-live="polite" aria-relevant="additions">
        {msgs.map((m) => (
          <div key={m.id} className={`sup-msg ${m.sender === "admin" ? "me" : "them"}`}>
            {m.sender === "admin" ? <span className="sup-who">{m.author_name || "SnupLive"}</span> : null}
            <p><Linked text={m.body} /></p>
            <time dateTime={m.created_at}>{stamp(m.created_at)}</time>
          </div>
        ))}
        {seen ? <p className="sd-seen">{seen}</p> : null}
      </div>

      <form className="sd-reply" onSubmit={reply}>
        <div className="field">
          <label htmlFor={`${uid}-r`}>Svar</label>
          <textarea
            id={`${uid}-r`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) reply();
            }}
            maxLength={SUPPORT_MAX}
            placeholder="Skriv dit svar. Ctrl+Enter sender."
          />
        </div>
        <div className="sd-actions">
          <button type="submit" className="btn btn-red btn-sm" disabled={busy || !draft.trim()}>Send svar</button>
          {thread.status === "open" ? (
            <button type="button" className="btn btn-line btn-sm" onClick={() => setStatus("closed")} disabled={busy}>Luk samtalen</button>
          ) : (
            <button type="button" className="btn btn-line btn-sm" onClick={() => setStatus("open")} disabled={busy}>Åbn igen</button>
          )}
          {askDelete ? (
            <span className="sd-confirm">
              Slet hele samtalen?
              <button type="button" className="btn btn-red btn-sm" onClick={remove} disabled={busy}>Ja, slet</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAskDelete(false)}>Fortryd</button>
            </span>
          ) : (
            <button type="button" className="linkbtn sd-del" onClick={() => setAskDelete(true)}>Slet (spam)</button>
          )}
        </div>
      </form>
    </section>
  );
}
