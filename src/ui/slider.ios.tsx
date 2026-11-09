import { Host, Slider as SwiftUISlider } from '@expo/ui/swift-ui';
import { tint } from '@expo/ui/swift-ui/modifiers';
import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '@/theme';

import type { SliderProps } from './slider';

/** Native SwiftUI slider tinted with the app's accent. */
export function Slider({ value, min, max, onValueChange, style }: SliderProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <Host style={style}>
      <SwiftUISlider value={value} min={min} max={max} onValueChange={onValueChange} modifiers={[tint(colors.accent)]} />
    </Host>
  );
}
