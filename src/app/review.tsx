import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { copy } from '@/copy';
import { referenceUri, useReference } from '@/features/references/store';
import { colors, radii, type } from '@/theme';
import { PrimaryButton, SecondaryButton } from '@/ui/buttons';
import { Icon } from '@/ui/icon';

/** The shot next to the reference; save or retake. */
export default function Review() {
  const { shot, id } = useLocalSearchParams<{ shot: string; id: string }>();
  const reference = useReference(id);
  const insets = useSafeAreaInsets();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    try {
      // Write-only access: Fotoin never reads the user's library.
      const permission = await requestPermissionsAsync(true, ['photo']);
      if (!permission.granted) {
        Alert.alert(copy.saveDenied);
        return;
      }
      await Asset.create(shot.replace(/^file:\/\//, ''));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.photoSlot}>
        <Image source={{ uri: shot }} style={styles.photo} contentFit="contain" />
        {reference ? (
          <View style={styles.thumbWrap}>
            <Text style={styles.thumbLabel}>{copy.reference}</Text>
            <Image
              source={{ uri: referenceUri(reference) }}
              style={[styles.thumb, { aspectRatio: reference.aspect }]}
              contentFit="cover"
            />
          </View>
        ) : null}
      </View>
      <View style={styles.actions}>
        <View style={styles.retake}>
          <SecondaryButton label={copy.retake} onPress={() => router.back()} />
        </View>
        <View style={styles.save}>
          <PrimaryButton
            label={saved ? copy.saved : copy.save}
            loading={saving}
            disabled={saved}
            icon={
              <Icon
                name={saved ? { ios: 'checkmark', android: 'check' } : { ios: 'square.and.arrow.down', android: 'download' }}
                color={colors.onAmber}
              />
            }
            onPress={save}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  photoSlot: { flex: 1, paddingHorizontal: 12 },
  photo: { flex: 1, borderRadius: radii.panel },
  thumbWrap: { position: 'absolute', right: 24, bottom: 16, width: 96, alignItems: 'flex-end', gap: 4 },
  thumbLabel: { ...type.caption, color: colors.ink },
  thumb: { width: 96, borderRadius: 12, borderWidth: 2, borderColor: colors.ink },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  retake: { flex: 1 },
  save: { flex: 2 },
});
