import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import type { ReactNode } from 'react';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

const liquidGlass = isLiquidGlassAvailable();

/**
 * Floating control surface over the camera: Liquid Glass on iOS 26+,
 * a dark blur elsewhere (HIG: glass only on the controls layer).
 */
export function Glass({
  children,
  style,
  interactive = false,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
}) {
  if (liquidGlass) {
    return (
      <GlassView glassEffectStyle="regular" colorScheme="dark" isInteractive={interactive} style={style}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[style, styles.clip]}>
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={styles.tint} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  tint: { position: 'absolute', inset: 0, backgroundColor: 'rgba(18,18,18,0.45)' },
});
