import { usePathname } from "next/navigation";

/**
 * Sidens adresse, som usePathname giver den, men med forsiden som "/".
 * Når Vercel genopbygger forsiden i baggrunden, hedder den "/index" på serveren og "/" i browseren. Så blev
 * serverens og browserens udgave af siden forskellige (tilbage-knap, markeret menupunkt), og React kasserede
 * den færdige side og byggede den forfra.
 */
export function usePath(): string {
  const path = usePathname() ?? "/";
  return path === "/index" ? "/" : path;
}
