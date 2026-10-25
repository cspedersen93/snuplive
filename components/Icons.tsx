import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: "0 0 24 24", "aria-hidden": true } as const;

export const IconCart = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 4h2l2.4 11h11L21 8H6.2" />
    <circle cx="9" cy="19.5" r="1.5" />
    <circle cx="17" cy="19.5" r="1.5" />
  </svg>
);
export const IconUser = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </svg>
);
export const IconMenu = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);
export const IconEye = (p: P) => (
  <svg {...base} fill="none" stroke="#fff" strokeWidth={2} {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
export const IconShield = (p: P) => (
  <svg {...base} className="ico" {...p}>
    <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6Z" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </svg>
);
export const IconBox = (p: P) => (
  <svg {...base} className="ico" {...p}>
    <path d="M3 8l9-5 9 5v8l-9 5-9-5Z" />
    <path d="M3 8l9 5 9-5M12 13v8" />
  </svg>
);
export const IconBulb = (p: P) => (
  <svg {...base} className="ico" {...p}>
    <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z" />
  </svg>
);
export const IconInfo = (p: P) => (
  <svg {...base} className="ico" {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
export const IconCamera = (p: P) => (
  <svg {...base} className="ico" {...p}>
    <rect x="3" y="6" width="13" height="12" rx="2" />
    <path d="m16 10 5-3v10l-5-3" />
  </svg>
);
export const IconList = (p: P) => (
  <svg {...base} className="ico" {...p}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);
export const IconBolt = (p: P) => (
  <svg {...base} className="ico" {...p}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7Z" />
  </svg>
);
export const IconCard = (p: P) => (
  <svg {...base} className="ico" {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18M7 15h3" />
  </svg>
);
export const IconDoc = (p: P) => (
  <svg {...base} className="ico" {...p}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
);
export const IconStar = (p: P) => (
  <svg {...base} className="ico" {...p}>
    <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7Z" />
  </svg>
);
export const IconChat = (p: P) => (
  <svg {...base} className="ico" {...p}>
    <path d="M4 5h16v11H9l-5 4Z" />
  </svg>
);
export const IconCheck = (p: P) => (
  <svg {...base} {...p}>
    <path d="M5 12.5 10 17 19 7" />
  </svg>
);
export const IconHeart = (p: P) => (
  <svg {...base} fill="#fff" {...p}>
    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.8 6.6 4.8c2.1 0 3.6 1.2 5.4 3.1 1.8-1.9 3.3-3.1 5.4-3.1 3.6 0 5.7 3.6 4.2 7C19.5 16.4 12 21 12 21Z" />
  </svg>
);
export const IconShare = (p: P) => (
  <svg {...base} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M14 4h6v6M20 4 10 14" />
    <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
export const IconMic = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" {...p}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
  </svg>
);
export const IconFlip = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 8V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
    <path d="m8 11-3 3-3-3M16 13l3-3 3 3" />
  </svg>
);

/* Kategorier */
export const IconDress = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M9 3h6l-1 4 4 13H6l4-13Z" />
    <path d="M10 7h4" />
  </svg>
);
export const IconSneaker = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M3 17v-6l4-1 3 3 6 1c3 .5 5 1.6 5 3.5V17Z" />
    <path d="M3 17h18M9.5 12.5l1-1.5M12 13.3l1-1.5" />
  </svg>
);
export const IconBear = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" {...p}>
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="6.5" r="2.5" />
    <circle cx="12" cy="13" r="7" />
    <circle cx="12" cy="15" r="2.2" />
    <path d="M9.5 11h.01M14.5 11h.01" strokeWidth={2.4} />
  </svg>
);
export const IconLamp = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M8 3h8l3 8H5Z" />
    <path d="M12 11v8M8 21h8" />
  </svg>
);
export const IconRecord = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.6} {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 6.5a5.5 5.5 0 0 1 5.5 5.5" strokeLinecap="round" />
  </svg>
);
export const IconBell = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </svg>
);
/** Video-ikon i samme streg som de andre små ikoner (fx på /saelg). */
export const IconClip = (p: P) => (
  <svg {...base} className="ico" {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="3" />
    <path d="M10 9.2v5.6l4.6-2.8L10 9.2Z" />
  </svg>
);
export const IconPlay = (p: P) => (
  <svg {...base} fill="currentColor" {...p}>
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
  </svg>
);
export const IconSound = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
  </svg>
);
export const IconMute = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </svg>
);
export const IconSun = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </svg>
);
export const IconBlurBg = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <circle cx="12" cy="9" r="3.2" />
    <path d="M6.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" />
    <path d="M3 5h.01M3 9h.01M3 13h.01M21 5h.01M21 9h.01M21 13h.01M3 17h.01M21 17h.01" strokeWidth={2.6} />
  </svg>
);
export const IconGem = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M6.5 4h11L21 9l-9 11L3 9Z" />
    <path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5" />
  </svg>
);
export const IconBeauty = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect x="7" y="10" width="10" height="11" rx="2" />
    <path d="M9.5 10V7h5v3M11 7V3.5h2V7" />
    <path d="M10 14.5h4" />
  </svg>
);
export const IconShieldCheck = (p: P) => (
  <svg {...base} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.4 7.5 9.5 4.3-1.1 7.5-4.9 7.5-9.5V6Z" />
    <path d="m8.8 12.2 2.3 2.3 4.3-4.6" />
  </svg>
);
