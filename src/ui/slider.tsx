import type { StyleProp, ViewStyle } from 'react-native';

export type SliderProps = {
  value: number;
  min: number;
  max: number;
  onValueChange: (value: number) => void;
};

/** Platform files (slider.ios.tsx / slider.android.tsx) provide the native slider. */
export function Slider(_props: SliderProps & { style?: StyleProp<ViewStyle> }): null {
  return null;
}
