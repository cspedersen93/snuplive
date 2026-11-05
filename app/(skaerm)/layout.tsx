/**
 * Skærme uden menu og bund, fx chatten på en anden skærm (/studio/[id]/chat), som skal kunne ses på afstand.
 */
export default function ScreenLayout({ children }: { children: React.ReactNode }) {
  return <main id="indhold">{children}</main>;
}
