import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { colors } from '@/theme';

/** SF Symbols on iOS, Material Symbols on Android — no icon font bundled. */
export function Icon({
  name,
  size = 22,
  color = colors.ink,
}: {
  name: SymbolViewProps['name'];
  size?: number;
  color?: string;
}) {
  return <SymbolView name={name} size={size} tintColor={color} type="monochrome" />;
}
