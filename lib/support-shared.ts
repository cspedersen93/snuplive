// Fælles for chatboblen, Backoffice og serveren.

export const SUPPORT_MAX = 2000;

/** Åbner chatten fra et link eller en knap: window.dispatchEvent(new Event(SUPPORT_OPEN_EVENT)). */
export const SUPPORT_OPEN_EVENT = "snup:support";

export interface SupportMessage {
  id: number;
  sender: "user" | "admin";
  author_name: string | null;
  body: string;
  created_at: string;
}

export interface SupportThreadRow {
  id: string;
  user_id: string | null;
  email: string | null;
  name: string | null;
  status: "open" | "closed";
  page: string | null;
  user_agent: string | null;
  admin_unread: boolean;
  preview: string | null;
  last_sender: "user" | "admin" | null;
  created_at: string;
  last_message_at: string;
  user_seen_at: string | null;
  user_notified_at: string | null;
  last_admin_at: string | null;
  profile: { handle: string; display_name: string | null } | null;
}

export const SUPPORT_THREAD_COLS =
  "id,user_id,email,name,status,page,user_agent,admin_unread,preview,last_sender,created_at,last_message_at,user_seen_at,user_notified_at,last_admin_at,profile:profiles!support_threads_user_id_fkey(handle,display_name)";

/** "iPhone · Safari" ud fra browserens navn, så vi kan finde fejl, der kun sker ét sted. */
export function deviceLabel(ua: string | null | undefined) {
  if (!ua) return null;
  const device = /iPad/.test(ua)
    ? "iPad"
    : /iPhone/.test(ua)
      ? "iPhone"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh|Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  const browser = /SamsungBrowser/.test(ua)
    ? "Samsung Internet"
    : /Edg\//.test(ua)
      ? "Edge"
      : /Firefox|FxiOS/.test(ua)
        ? "Firefox"
        : /CriOS|Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : null;
  return [device, browser].filter(Boolean).join(" · ") || null;
}
