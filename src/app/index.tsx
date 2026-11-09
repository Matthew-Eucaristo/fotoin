import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { copy } from '@/copy';
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
      if (!ref.pose) Alert.alert(copy.noPersonFound);
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
        <Text style={styles.title} accessibilityRole="header">
          {copy.homeTitle}
        </Text>
        <Text style={styles.subtitle}>{copy.homeSubtitle}</Text>
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
            {item.pose ? (
              <View style={styles.badge}>
                <Icon name={{ ios: 'figure.stand', android: 'accessibility_new' }} size={14} color={colors.amber} />
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
            icon={<Icon name={{ ios: 'photo.on.rectangle', android: 'photo_library' }} color={colors.onAmber} />}
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
      <Icon name={{ ios: 'camera.viewfinder', android: 'photo_camera' }} size={52} color={colors.amber} />
      <Text style={styles.emptyTitle}>{copy.emptyTitle}</Text>
      <Text style={styles.emptyBody}>{copy.emptyBody}</Text>
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
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(18,18,18,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyTitle: { ...type.title, color: colors.ink, textAlign: 'center' },
  emptyBody: { ...type.body, color: colors.inkMuted, textAlign: 'center' },
  bottom: { position: 'absolute', left: 16, right: 16, bottom: 0, paddingTop: 12, flexDirection: 'row', gap: 12 },
  bottomItem: { flex: 1 },
});
