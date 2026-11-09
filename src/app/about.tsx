import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { links } from '@/links';
import { colors, radii, type } from '@/theme';
import { Icon } from '@/ui/icon';

/** About sheet: what Fotoin promises (free, no ads, on-device) and links. */
export default function About() {
  const insets = useSafeAreaInsets();
  const version = Constants.expoConfig?.version ?? '';
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      <View style={styles.hero}>
        <Image source={require('../../assets/images/icon.png')} style={styles.icon} />
        <Text style={styles.name}>{copy.appName}</Text>
        <Text style={styles.version}>{copy.version(version)}</Text>
      </View>

      <View style={styles.card}>
        {copy.promises.map((p) => (
          <View key={p.title} style={styles.promise}>
            <Icon name={p.icon} size={20} color={colors.accent} />
            <View style={styles.promiseText}>
              <Text style={styles.promiseTitle}>{p.title}</Text>
              <Text style={styles.promiseBody}>{p.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Row label={copy.privacyPolicy} onPress={() => Linking.openURL(links.privacy)} />
        <View style={styles.divider} />
        <Row label={copy.sourceCode} onPress={() => Linking.openURL(links.source)} />
      </View>
    </ScrollView>
  );
}

function Row({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Icon name={{ ios: 'arrow.up.right', android: 'open_in_new' }} size={16} color={colors.inkMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 16 },
  hero: { alignItems: 'center', gap: 6, paddingVertical: 12 },
  icon: { width: 88, height: 88, borderRadius: 20, marginBottom: 8 },
  name: { ...type.title, fontSize: 24, fontWeight: '800', color: colors.ink },
  version: { ...type.caption, color: colors.inkMuted },
  card: { backgroundColor: colors.surface, borderRadius: radii.control, padding: 16, gap: 14 },
  promise: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  promiseText: { flex: 1, gap: 2 },
  promiseTitle: { ...type.label, color: colors.ink },
  promiseBody: { ...type.body, fontSize: 14, lineHeight: 20, color: colors.inkMuted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32 },
  rowLabel: { ...type.body, color: colors.ink },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.surfaceHigh },
});
