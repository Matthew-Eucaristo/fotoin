import { Host, Slider as ComposeSlider } from '@expo/ui/jetpack-compose';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '@/theme';

import type { SliderProps } from './slider';

/** Native Material 3 (Compose) slider in the app's accent. */
export function Slider({ value, min, max, onValueChange, style }: SliderProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <Host style={style}>
      <ComposeSlider
        value={value}
        min={min}
        max={max}
        onValueChange={onValueChange}
        colors={{ thumbColor: colors.accent, activeTrackColor: colors.accent, inactiveTrackColor: colors.surfaceHigh }}
      />
    </Host>
  );
}
