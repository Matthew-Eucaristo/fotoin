import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { referenceMode, referencePeopleCount } from '@/features/pose/mode';
import {
  addReference,
  type ReferencePhoto,
  referenceUri,
  removeReference,
  useReferences,
} from '@/features/references/store';
import { colors, radii, type } from '@/theme';
import { PrimaryButton, SecondaryButton } from '@/ui/buttons';
import { Icon } from '@/ui/icon';

export default function Home() {
  const refs = useReferences();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tileWidth = (width - 16 * 2 - 12) / 2; // two columns, 16 pt margins, 12 pt gap
  const [adding, setAdding] = useState(false);

  async function add() {
    // System photo picker: no library permission needed.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      exif: false,
    });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset) return;
    setAdding(true);
    try {
      const ref = await addReference(asset.uri, asset.width, asset.height);
      if (referenceMode(ref) === 'none') Alert.alert(copy.noPersonFound);
      router.push({ pathname: '/shoot/[id]', params: { id: ref.id } });
    } finally {
      setAdding(false);
    }
  }

  function confirmDelete(ref: ReferencePhoto) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(copy.deleteReference, undefined, [
      { text: copy.cancel, style: 'cancel' },
      { text: copy.deleteReference, style: 'destructive', onPress: () => removeReference(ref.id) },
    ]);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title} accessibilityRole="header">
            {copy.homeTitle}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.about}
            hitSlop={10}
            onPress={() => router.push('/about')}
            style={({ pressed }) => [styles.infoButton, pressed && { opacity: 0.6 }]}
          >
            <Icon name={{ ios: 'info.circle', android: 'info' }} size={24} color={colors.inkMuted} />
          </Pressable>
        </View>
        {refs.length > 0 ? <Text style={styles.subtitle}>{copy.homeSubtitle}</Text> : null}
      </View>
      <FlatList
        data={refs}
        keyExtractor={(r) => r.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
        ListEmptyComponent={<Empty />}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.reference}
            onPress={() => router.push({ pathname: '/shoot/[id]', params: { id: item.id } })}
            onLongPress={() => confirmDelete(item)}
            style={({ pressed }) => [styles.tile, { width: tileWidth }, pressed && { opacity: 0.8 }]}
          >
            <Image source={{ uri: referenceUri(item) }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            {referenceMode(item) !== 'none' ? (
              <View style={styles.badge}>
                <Icon
                  name={
                    referenceMode(item) === 'face'
                      ? { ios: 'face.smiling', android: 'face' }
                      : { ios: 'figure.stand', android: 'accessibility_new' }
                  }
                  size={14}
                  color={colors.accent}
                />
                {referencePeopleCount(item) > 1 ? <Text style={styles.badgeCount}>{referencePeopleCount(item)}</Text> : null}
              </View>
            ) : null}
          </Pressable>
        )}
      />
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.bottomItem}>
          <SecondaryButton
            label={copy.takeExample}
            icon={<Icon name={{ ios: 'camera', android: 'photo_camera' }} />}
            onPress={() => router.push({ pathname: '/shoot/[id]', params: { id: 'new' } })}
          />
        </View>
        <View style={styles.bottomItem}>
          <PrimaryButton
            label={adding ? copy.readingPose : copy.fromGallery}
            loading={adding}
            icon={<Icon name={{ ios: 'photo.on.rectangle', android: 'photo_library' }} color={colors.onAccent} />}
            onPress={add}
          />
        </View>
      </View>
    </View>
  );
}

function Empty() {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
      {copy.steps.map((step, i) => (
        <View key={step.title} style={styles.step}>
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{i + 1}</Text>
          </View>
          <View style={styles.stepText}>
            <Text style={styles.stepTitle}>{step.title}</Text>
            <Text style={styles.stepBody}>{step.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: 16, gap: 12, flexGrow: 1 },
  row: { gap: 12 },
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, gap: 8 },
  title: { ...type.largeTitle, color: colors.ink },
  subtitle: { ...type.body, color: colors.inkMuted },
  tile: {
    aspectRatio: 3 / 4,
    borderRadius: radii.control,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  badgeCount: { ...type.caption, color: colors.accent, fontWeight: '800' },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    flexDirection: 'row',
    gap: 3,
    borderRadius: 13,
    backgroundColor: 'rgba(18,18,18,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1, justifyContent: 'center', gap: 18, paddingHorizontal: 8, paddingBottom: 40 },
  emptyTitle: { ...type.title, color: colors.ink, marginBottom: 4 },
  step: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { fontSize: 15, fontWeight: '800', color: colors.onAccent },
  stepText: { flex: 1, gap: 2 },
  stepTitle: { ...type.label, fontSize: 16, color: colors.ink },
  stepBody: { ...type.body, fontSize: 15, color: colors.inkMuted },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 16, right: 16, bottom: 0, paddingTop: 12, flexDirection: 'row', gap: 12 },
  bottomItem: { flex: 1 },
});
