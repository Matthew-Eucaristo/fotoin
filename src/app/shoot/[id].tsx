import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  CommonResolutions,
  useCameraDevice,
  useCameraPermission,
  useFrameOutput,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';

import { copy } from '@/copy';
import { matchPose, type MatchResult, NO_MATCH } from '@/features/pose/matcher';
import { decodePose, FotoinPose } from '@/features/pose/native';
import { type BodyPose, coverInto } from '@/features/pose/pose';
import { referenceUri, useReference } from '@/features/references/store';
import { MatchMeter } from '@/features/shoot/match-meter';
import { PoseOverlay } from '@/features/shoot/pose-overlay';
import { colors, radii, scoreColor, type } from '@/theme';
import { PrimaryButton } from '@/ui/buttons';
import { Glass } from '@/ui/glass';
import { Icon } from '@/ui/icon';
import { Slider } from '@/ui/slider';

const AUTO_THRESHOLD = 0.8;
const AUTO_HOLD_MS = 700;
const FRAME_INTERVAL_MS = 80; // ~12 pose reads per second is plenty for coaching
// Frame timestamps are seconds on iOS and nanoseconds on Android.
const FRAME_TS_TO_MS = Platform.OS === 'ios' ? 1000 : 1 / 1e6;

type Lens = { label: string; zoom: number };

export default function Shoot() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reference = useReference(id);
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const { hasPermission, requestPermission } = useCameraPermission();

  // Ultra-wide + wide virtual device where available (0.5× / 1×).
  const device = useCameraDevice('back', { physicalDevices: ['ultra-wide-angle', 'wide-angle'] });

  const [showGhost, setShowGhost] = useState(true);
  const [showPose, setShowPose] = useState(true);
  const [auto, setAuto] = useState(true);
  const [opacity, setOpacity] = useState(0.35);
  const [peek, setPeek] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [live, setLive] = useState<BodyPose | null>(null);
  const [match, setMatch] = useState<MatchResult>(NO_MATCH);
  const roll = useRef(0);
  const matchedSince = useRef<number | null>(null);

  // Viewport follows the reference shape so the shot is framed like it.
  const viewAspect = Math.min(1, Math.max(9 / 16, reference?.aspect ?? 3 / 4));
  // React Compiler memoizes this; no manual useMemo needed.
  const target = reference?.pose ? coverInto(reference.pose, viewAspect) : null;

  // Lenses: on iOS virtual devices zoom 1 is the ultra-wide and "1×" is the
  // first lens-switch factor; on Android "1×" is zoom 1 and minZoom < 1.
  const lenses = useMemo<Lens[]>(() => {
    if (!device) return [];
    const base = device.zoomLensSwitchFactors[0] ?? 1;
    const out: Lens[] = [];
    if (device.minZoom < base * 0.95) {
      const v = device.minZoom / base;
      out.push({ label: `.${Math.round(v * 10)}`, zoom: device.minZoom });
    }
    out.push({ label: '1', zoom: base });
    if (device.maxZoom >= base * 2) out.push({ label: '2', zoom: base * 2 });
    return out;
  }, [device]);
  const [lensIndex, setLensIndex] = useState<number | null>(null);
  const oneX = lenses.findIndex((l) => l.label === '1');
  const lens = lenses[lensIndex ?? oneX];

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Ask only when there is a camera to use (simulators have none).
    if (device && !hasPermission) requestPermission().catch(() => {});
  }, [device, hasPermission, requestPermission]);

  useEffect(() => {
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(({ x, y }) => {
      // Sign conventions differ per platform; |y| keeps upright portrait ≈ 0°.
      const deg = (Math.atan2(x, Math.abs(y)) * 180) / Math.PI;
      roll.current = roll.current * 0.7 + deg * 0.3;
    });
    return () => sub.remove();
  }, []);

  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.UHD_4_3, // ~12 MP
    qualityPrioritization: 'balanced',
  });

  const lastFrame = useMemo(() => createSynchronizable(0), []);

  function onPoseValues(values: number[], frameMs: number) {
    const pose = decodePose(values);
    setLive(pose);
    if (!target) return;
    const result = matchPose(pose ? coverInto(pose, viewAspect) : null, target, roll.current);
    setMatch(result);
    checkAuto(result, frameMs);
  }

  const frameOutput = useFrameOutput({
    targetResolution: CommonResolutions.VGA_4_3,
    pixelFormat: 'yuv',
    enablePhysicalBufferRotation: true, // frames arrive upright on both platforms
    enablePreviewSizedOutputBuffers: true,
    dropFramesWhileBusy: true,
    onFrame(frame) {
      'worklet';
      try {
        const frameMs = frame.timestamp * FRAME_TS_TO_MS;
        if (frameMs - lastFrame.getDirty() < FRAME_INTERVAL_MS) return;
        lastFrame.setBlocking(frameMs);
        const values = FotoinPose.detect(frame);
        scheduleOnRN(onPoseValues, values, frameMs);
      } catch {
        // A dropped frame is fine; the next one will be analysed.
      } finally {
        frame.dispose();
      }
    },
  });

  function checkAuto(result: MatchResult, now: number) {
    if (!auto || capturing) return;
    if (result.score < AUTO_THRESHOLD) {
      matchedSince.current = null;
      return;
    }
    if (matchedSince.current == null) {
      matchedSince.current = now;
      Haptics.selectionAsync();
    } else if (now - matchedSince.current >= AUTO_HOLD_MS) {
      matchedSince.current = null;
      capture();
    }
  }

  async function capture() {
    if (capturing) return;
    setCapturing(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const { filePath } = await photoOutput.capturePhotoToFile({}, {});
      router.push({ pathname: '/review', params: { shot: `file://${filePath}`, id } });
    } finally {
      setCapturing(false);
    }
  }

  if (!reference) return <View style={styles.screen} />;

  const enabled = !!reference.pose && !peek;
  const isActive = focused && appActive && hasPermission;
  const liveInView = live ? coverInto(live, viewAspect) : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.topBar}>
        <Glass style={styles.round} interactive>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.close} onPress={() => router.back()} style={styles.roundHit}>
            <Icon name={{ ios: 'xmark', android: 'close' }} size={18} />
          </Pressable>
        </Glass>
        <View style={styles.meterSlot}>
          <MatchMeter result={match} enabled={enabled} />
        </View>
      </View>

      <View style={styles.viewportSlot}>
        <Pressable
          onLongPress={() => {
            Haptics.selectionAsync();
            setPeek(true);
          }}
          onPressOut={() => setPeek(false)}
          delayLongPress={250}
          style={[styles.viewport, { aspectRatio: viewAspect }]}
        >
          {device && hasPermission ? (
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={isActive}
              outputs={[photoOutput, frameOutput]}
              constraints={[{ resolutionBias: photoOutput }]}
              zoom={lens?.zoom ?? 1}
              resizeMode="cover"
              orientationSource="interface"
            />
          ) : (
            <Placeholder
              message={!device ? copy.noCamera : !hasPermission ? copy.cameraDenied : null}
              onAllow={device && !hasPermission ? () => Linking.openSettings() : undefined}
            />
          )}
          {showGhost || peek ? (
            <Image
              source={{ uri: referenceUri(reference) }}
              style={[StyleSheet.absoluteFill, { opacity: peek ? 1 : opacity }]}
              contentFit="cover"
            />
          ) : null}
          {showPose && !peek ? (
            <PoseOverlay
              target={target}
              live={liveInView}
              targetColor="rgba(247,247,247,0.6)"
              liveColor={scoreColor(match.score)}
            />
          ) : null}
        </Pressable>
      </View>

      <View style={styles.controls}>
        {showGhost ? (
          <View style={styles.sliderRow}>
            <Icon name={{ ios: 'circle.lefthalf.filled', android: 'opacity' }} size={18} color={colors.inkMuted} />
            <Slider style={styles.slider} value={opacity} min={0.1} max={0.8} onValueChange={setOpacity} />
          </View>
        ) : null}
        <View style={styles.toggles}>
          <Toggle label={copy.ghost} on={showGhost} onPress={() => setShowGhost((v) => !v)} />
          {reference.pose ? (
            <>
              <Toggle label={copy.skeleton} on={showPose} onPress={() => setShowPose((v) => !v)} />
              <Toggle label={copy.autoShoot} on={auto} onPress={() => setAuto((v) => !v)} />
            </>
          ) : null}
        </View>
        <View style={styles.shutterRow}>
          <View style={styles.lensSlot}>
            {lenses.length > 1 ? (
              <Glass style={styles.lensPicker}>
                {lenses.map((l, i) => {
                  const selected = l === lens;
                  return (
                    <Pressable
                      key={l.label}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setLensIndex(i);
                      }}
                      style={[styles.lens, selected && styles.lensSelected]}
                    >
                      <Text style={[styles.lensText, selected && { color: colors.amber }]}>
                        {selected ? `${l.label}×` : l.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </Glass>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.shutter}
            disabled={!device || !hasPermission || capturing}
            onPress={capture}
            style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.94 }] }]}
          >
            <View style={[styles.shutterInner, (!device || !hasPermission) && { backgroundColor: colors.inkMuted }]} />
          </Pressable>
          <View style={styles.lensSlot} />
        </View>
      </View>
    </View>
  );
}

function Toggle({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={[styles.toggle, on && styles.toggleOn]}
    >
      <Text style={[styles.toggleText, on && { color: colors.onAmber }]}>{label}</Text>
    </Pressable>
  );
}

function Placeholder({ message, onAllow }: { message: string | null; onAllow?: () => void }) {
  return (
    <View style={styles.placeholder}>
      {message ? <Text style={styles.placeholderText}>{message}</Text> : null}
      {onAllow ? <PrimaryButton label={copy.openSettings} onPress={onAllow} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  round: { width: 44, height: 44, borderRadius: 22 },
  roundHit: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  meterSlot: { flex: 1 },
  viewportSlot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  viewport: {
    width: '100%',
    maxHeight: '100%',
    borderRadius: radii.panel,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  placeholder: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  placeholderText: { ...type.body, color: colors.inkMuted, textAlign: 'center' },
  controls: { paddingHorizontal: 16, paddingTop: 10, gap: 12 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slider: { flex: 1, height: 36 },
  toggles: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  toggle: {
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.surfaceHigh,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: colors.amber },
  toggleText: { ...type.label, color: colors.ink },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  lensSlot: { flex: 1, alignItems: 'flex-start' },
  lensPicker: { flexDirection: 'row', padding: 4, borderRadius: 999 },
  lens: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  lensSelected: { backgroundColor: 'rgba(255,255,255,0.12)' },
  lensText: { ...type.caption, fontWeight: '800', color: colors.ink },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: colors.ink,
    padding: 5,
  },
  shutterInner: { flex: 1, borderRadius: 999, backgroundColor: colors.ink },
});
