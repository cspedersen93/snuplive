import { IconBear, IconBeauty, IconBox, IconDress, IconGem, IconLamp, IconRecord, IconSneaker } from "@/components/Icons";

const ICONS = {
  dametoej: IconDress,
  herretoej: IconSneaker,
  luksus: IconGem,
  skoenhed: IconBeauty,
  boernetoej: IconBear,
  bolig: IconLamp,
  samlerting: IconRecord,
  andet: IconBox,
} as const;

export default function CategoryIcon({ k, size = 22 }: { k: string; size?: number }) {
  const I = ICONS[k as keyof typeof ICONS] ?? IconBox;
  return <I width={size} height={size} />;
}
