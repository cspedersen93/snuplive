"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gradFor } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { errorText, toast } from "@/lib/toast";
import type { Message } from "@/lib/types";
import type { Me } from "@/components/useMe";

interface Props {
  showId: string;
  messages: Message[];
  me: Me | null | undefined;
  live: boolean;
  loginHref: string;
  title?: string;
  hint?: string;
  style?: React.CSSProperties;
  /** Sælgeren af showet kan fjerne alle beskeder og blokere brugere. */
  canModerate?: boolean;
}

/** Menuen på en besked: fjern den (egen besked, eller alle hvis man er sælgeren) og blokér afsenderen. */
function LineActions({ m, me, canModerate }: { m: Message; me: Me; canModerate: boolean }) {
  const [open, setOpen] = useState(false);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const own = m.user_id === me.id;

  // Menuen kan ligge nederst i chatten, så den rulles frem, når den åbner.
  useEffect(() => {
    if (open) menu.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [open, ask]);

  async function run(fn: "remove_message" | "block_user") {
    setBusy(true);
    const args = fn === "remove_message" ? { p_message: m.id } : { p_user: m.user_id };
    const { error } = await getSupabase().rpc(fn, args);
    setBusy(false);
    if (error) return toast(errorText(error));
    toast(fn === "remove_message" ? "Beskeden er fjernet." : `@${m.handle} er blokeret i dine shows.`);
    setOpen(false);
    setAsk(false);
  }

  if (!open) {
    return (
      <button className="cmsg-more" type="button" onClick={() => setOpen(true)} aria-label={`Handlinger for beskeden fra ${m.handle}`}>
        <span aria-hidden="true">⋯</span>
      </button>
    );
  }
  if (ask) {
    return (
      <div className="cmsg-menu" ref={menu}>
        <span>Blokér @{m.handle}? Personen kan ikke skrive eller snuppe i dine shows, og beskederne her forsvinder.</span>
        <div className="row">
          <button className="btn btn-red btn-sm" type="button" onClick={() => run("block_user")} disabled={busy}>
            {busy ? "Blokerer …" : "Ja, blokér"}
          </button>
          <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk(false)} disabled={busy}>Fortryd</button>
        </div>
      </div>
    );
  }
  return (
    <div className="cmsg-menu" ref={menu}>
      <div className="row">
        <button className="btn btn-line btn-sm" type="button" onClick={() => run("remove_message")} disabled={busy}>
          {busy ? "Fjerner …" : "Fjern besked"}
        </button>
        {canModerate && !own ? (
          <button className="btn btn-line btn-sm" type="button" onClick={() => setAsk(true)} disabled={busy}>
            Blokér @{m.handle}
          </button>
        ) : null}
        <button className="linkbtn" type="button" onClick={() => setOpen(false)}>Luk</button>
      </div>
    </div>
  );
}

export function ChatLine({ m, me, canModerate = false }: { m: Message; me?: Me | null; canModerate?: boolean }) {
  if (m.kind === "event") return <div className="cmsg event">{m.body}</div>;
  const meId = me?.id;
  const cls = m.from_seller ? "cmsg seller" : m.user_id && m.user_id === meId ? "cmsg me" : "cmsg";
  const actions = me && m.user_id && (canModerate || m.user_id === meId);
  return (
    <div className={actions ? `${cls} has-more` : cls}>
      <i style={{ ["--c" as string]: gradFor(m.handle) }} />
      <div>
        <b>{m.handle}</b>
        {m.body}
        {actions ? <LineActions m={m} me={me} canModerate={canModerate} /> : null}
      </div>
    </div>
  );
}

export default function Chat({ showId, messages, me, live, loginHref, title = "Chat", hint, style, canModerate = false }: Props) {
  const log = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const el = log.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !me || busy) return;
    setBusy(true);
    const { error } = await getSupabase().from("messages").insert({ show_id: showId, user_id: me.id, body });
    setBusy(false);
    if (error) return toast(errorText(error));
    setText("");
    stick.current = true;
  }

  return (
    <div className="box chatbox" style={style}>
      <div className="chatbox-head">
        <h2>{title}</h2>
        {live ? (
          <span className="chip live">
            <span className="live-dot white" />
            Live
          </span>
        ) : hint ? (
          <span className="muted" style={{ fontSize: ".85rem" }}>{hint}</span>
        ) : null}
      </div>
      <div
        className="chat-log"
        ref={log}
        aria-live="polite"
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {messages.length ? (
          messages.map((m) => <ChatLine key={m.id} m={m} me={me} canModerate={canModerate} />)
        ) : (
          <p className="muted" style={{ fontSize: ".9rem" }}>{live ? "Skriv den første besked." : "Chatten åbner, når showet går live."}</p>
        )}
      </div>
      {me ? (
        <form className="chat-form" onSubmit={send}>
          <label htmlFor={`chat-${showId}`} style={{ position: "absolute", left: -9999 }}>
            Skriv i chatten
          </label>
          <input
            id={`chat-${showId}`}
            type="text"
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
            placeholder={live ? "Stil et spørgsmål til sælgeren" : "Chatten er lukket"}
            autoComplete="off"
            disabled={!live}
          />
          <button className="btn btn-red btn-sm" type="submit" disabled={!live || busy || !text.trim()}>
            Send
          </button>
        </form>
      ) : me === null ? (
        <div className="chat-form" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <span className="muted" style={{ fontSize: ".9rem" }}>Log ind for at skrive og snuppe</span>
          <Link className="btn btn-red btn-sm" href={loginHref}>Log ind</Link>
        </div>
      ) : null}
    </div>
  );
}
