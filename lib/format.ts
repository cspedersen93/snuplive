export const CATEGORIES = [
  { key: "toej", label: "Tøj og vintage", cover: "/img/c-kjoler.jpg" },
  { key: "overtoej", label: "Jakker og overtøj", cover: "/img/c-jakker.jpg" },
  { key: "denim", label: "Denim", cover: "/img/c-denim.jpg" },
  { key: "vinyl", label: "Vinyl og musik", cover: "/img/c-vinyl.jpg" },
  { key: "design", label: "Retro og design", cover: "/img/c-lamper.jpg" },
  { key: "andet", label: "Andet", cover: "/img/live3.jpg" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export function category(key: string) {
  return CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[CATEGORIES.length - 1];
}

const nf = new Intl.NumberFormat("da-DK");
export function kr(n: number) {
  return `${nf.format(n)} kr`;
}

const GRADS = [
  "linear-gradient(135deg,#F4AC94,#C46E8A)",
  "linear-gradient(135deg,#B9D9C6,#4E8A74)",
  "linear-gradient(135deg,#F2D27A,#B5803A)",
  "linear-gradient(135deg,#9DB4E0,#3D5C9E)",
  "linear-gradient(135deg,#D9A38C,#8C4E3A)",
];
export function gradFor(handle: string) {
  let h = 0;
  for (let i = 0; i < handle.length; i++) h = (h * 31 + handle.charCodeAt(i)) >>> 0;
  return GRADS[h % GRADS.length];
}
export function initial(handle: string) {
  return (handle.replace(/[^a-z0-9]/gi, "").charAt(0) || "S").toUpperCase();
}

const TZ = "Europe/Copenhagen";
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("da-DK", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const weekdayFmt = new Intl.DateTimeFormat("da-DK", { timeZone: TZ, weekday: "long" });
const dateFmt = new Intl.DateTimeFormat("da-DK", { timeZone: TZ, day: "numeric", month: "short" });

/** Klokkeslæt som "20.15" (dansk tid). */
export function clock(iso: string) {
  return timeFmt.format(new Date(iso)).replace(":", ".");
}

/** "I dag", "I morgen", "Tirsdag" eller "24. okt." (dansk tid). */
export function dayLabel(iso: string, now = new Date()) {
  const d = new Date(iso);
  const key = dayKey.format(d);
  if (key === dayKey.format(now)) return "I dag";
  if (key === dayKey.format(new Date(now.getTime() + 864e5))) return "I morgen";
  const diff = d.getTime() - now.getTime();
  if (diff > 0 && diff < 6 * 864e5) {
    const w = weekdayFmt.format(d);
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  return dateFmt.format(d);
}

export function when(iso: string | null) {
  if (!iso) return "Tidspunkt kommer";
  return `${dayLabel(iso)} kl. ${clock(iso)}`;
}

export const HANDLE_RE = /^[a-z0-9._]{3,24}$/;
