import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, type } from '@/theme';

/** The one prominent action per screen (HIG: a single tinted button). */
export function PrimaryButton({
  label,
  icon,
  onPress,
  loading = false,
  disabled = false,
}: {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.primary, (pressed || inactive) && styles.dimmed]}
    >
      {loading ? <ActivityIndicator color={colors.onAmber} /> : icon}
      <Text style={styles.primaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, pressed && styles.dimmed]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

/** Round icon-only control, at least 44×44 pt. */
export function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.icon, pressed && styles.dimmed]}
    >
      <View>{icon}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    minHeight: 56,
    borderRadius: radii.control,
    backgroundColor: colors.amber,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  primaryLabel: { ...type.label, fontSize: 16, color: colors.onAmber },
  secondary: {
    minHeight: 56,
    borderRadius: radii.control,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.inkMuted,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  secondaryLabel: { ...type.label, fontSize: 16, color: colors.ink },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dimmed: { opacity: 0.6 },
});
