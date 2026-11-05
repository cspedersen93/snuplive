// Ventemusik under nedtællingen til live (0034_nedtaelling.sql). Numrene er Caspers egne (Svanekjær) og ligger i
// public/musik/ (128 kbit/s og lige høje). Sælgeren vælger et nummer eller ingen musik, når nedtællingen startes.
// Seerne hører nummeret fra starten og i ring, når de trykker på højttaleren. Det tones ud, når showet går live.
// Et nyt nummer: læg filen i public/musik/ og skriv det på listen her (nøglen må kun have a-z, 0-9 og bindestreg).

export interface Track {
  key: string;
  title: string;
  artist: string;
  src: string;
  /** Hvor smagsprøven i studiet starter (sekunder): de 20 mest livlige sekunder. */
  preview: number;
}

export const TRACKS: Track[] = [
  { key: "countdown-to-dawn", title: "Countdown to Dawn", artist: "Svanekjær", src: "/musik/svanekjaer-countdown-to-dawn.mp3", preview: 164 },
  { key: "countdown-to-dawn-2", title: "Countdown to Dawn (version 2)", artist: "Svanekjær", src: "/musik/svanekjaer-countdown-to-dawn-2.mp3", preview: 107 },
  { key: "deep-emotional-lounge", title: "Deep Emotional Lounge", artist: "Svanekjær", src: "/musik/svanekjaer-deep-emotional-lounge.mp3", preview: 109 },
  { key: "stay-here", title: "Stay Here", artist: "Svanekjær", src: "/musik/svanekjaer-stay-here.mp3", preview: 170 },
  { key: "say-you-need-me", title: "Say You Need Me", artist: "Svanekjær", src: "/musik/svanekjaer-say-you-need-me.mp3", preview: 160 },
  { key: "half-step-higher", title: "Half-Step Higher", artist: "Svanekjær", src: "/musik/svanekjaer-half-step-higher.mp3", preview: 153 },
];

export const PREVIEW_SECONDS = 20;
/** Sælgerens sidste valg i studiet ("" = ingen musik). */
export const MUSIC_PICK_KEY = "relived-ventemusik";
/** Seeren: "1" = spil ventemusikken af sig selv næste gang (hvis browseren tillader det), "0" = nej tak. */
export const MUSIC_LISTEN_KEY = "relived-ventemusik-lyt";
/** Lydstyrken for seerne (numrene er lige høje, og det er baggrundsmusik). */
export const MUSIC_VOLUME = 0.7;

export const trackByKey = (key: string | null | undefined) => TRACKS.find((t) => t.key === key) ?? null;

const fades = new WeakMap<HTMLAudioElement, number>();

/**
 * Tone en lyd ind eller ud over ms millisekunder. Løftet giver true, når tonen er nået, og false, hvis en ny
 * toning er startet imens (så må den gamle ikke stoppe lyden). I en skjult fane sker det med det samme, fordi
 * browseren næsten ikke kører timere der. (På iPhone kan lydstyrken ikke ændres, så der stopper lyden bare.)
 */
export function fadeTo(audio: HTMLAudioElement, target: number, ms: number) {
  const gen = (fades.get(audio) ?? 0) + 1;
  fades.set(audio, gen);
  return new Promise<boolean>((resolve) => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      audio.volume = target;
      return resolve(true);
    }
    const from = audio.volume;
    const start = Date.now();
    const id = setInterval(() => {
      if (fades.get(audio) !== gen) {
        clearInterval(id);
        return resolve(false);
      }
      const t = Math.min(1, (Date.now() - start) / ms);
      audio.volume = Math.max(0, Math.min(1, from + (target - from) * t));
      if (t >= 1) {
        clearInterval(id);
        resolve(true);
      }
    }, 40);
  });
}
