import { createPublicClient } from "@/lib/supabase/public";

// Genbrugstælleren (0035_genbrug.sql): varer, der har fået et nyt hjem via Relived (solgt og betalt).
// Det er Relivids egne tal, så teksten må gerne sige det, men ikke love noget om CO2 eller "bæredygtig"
// (de nye regler for grøn markedsføring fra 27. september 2026).

/** Tallet vises først, når der er nok til, at det ser godt ud (ingen "3 varer" på forsiden). */
export const REUSE_MIN = 25;

/** Antal varer med et nyt hjem, eller null (før 0035 er kørt, ved fejl eller under grænsen). */
export async function reusedCount(min = REUSE_MIN): Promise<number | null> {
  try {
    const sb = createPublicClient();
    if (!sb) return null;
    const { data, error } = await sb.rpc("reused_count");
    if (error) return null;
    const n = Number(data);
    return Number.isFinite(n) && n >= min ? n : null;
  } catch {
    return null;
  }
}

const nf = new Intl.NumberFormat("da-DK");
/** "1.248 varer har fået et liv mere via Relived". */
export const reuseText = (n: number) => `${nf.format(n)} ${n === 1 ? "vare har" : "varer har"} fået et liv mere via Relived`;
