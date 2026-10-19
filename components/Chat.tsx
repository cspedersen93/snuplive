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
}

export function ChatLine({ m, meId }: { m: Message; meId?: string }) {
  if (m.kind === "event") return <div className="cmsg event">{m.body}</div>;
  const cls = m.from_seller ? "cmsg seller" : m.user_id && m.user_id === meId ? "cmsg me" : "cmsg";
  return (
    <div className={cls}>
      <i style={{ ["--c" as string]: gradFor(m.handle) }} />
      <div>
        <b>{m.handle}</b>
        {m.body}
      </div>
    </div>
  );
}

export default function Chat({ showId, messages, me, live, loginHref, title = "Chat", hint, style }: Props) {
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
          messages.map((m) => <ChatLine key={m.id} m={m} meId={me?.id} />)
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
