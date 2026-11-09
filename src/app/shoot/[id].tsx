import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { Accelerometer } from 'expo-sensors';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { decodeFaces, decodePeople } from '@/features/pose/decode';
import { coverFace, faceAnchor, type FacePose, matchFace } from '@/features/pose/face';
import { matchGroup } from '@/features/pose/group';
import { bodyAnchor, matchPose, type MatchResult, NO_MATCH } from '@/features/pose/matcher';
import { referenceMode } from '@/features/pose/mode';
import { FotoinPose } from '@/features/pose/native';
import { type BodyPose, coverInto } from '@/features/pose/pose';
import { addReference, referenceUri, retryPose, useReference } from '@/features/references/store';
import { FaceOverlay } from '@/features/shoot/face-overlay';
import { MatchMeter } from '@/features/shoot/match-meter';
import { PoseOverlay } from '@/features/shoot/pose-overlay';
import { ViewfinderGuides } from '@/features/shoot/viewfinder-guides';
import { colors, scoreColor, type } from '@/theme';
import { PrimaryButton } from '@/ui/buttons';
import { Glass } from '@/ui/glass';
import { Icon } from '@/ui/icon';
import { Slider } from '@/ui/slider';

const AUTO_THRESHOLD = 0.8;
const AUTO_HOLD_MS = 700;
const FRAME_INTERVAL_MS = 80; // ~12 pose reads per second is plenty for coaching
// Frame timestamps are seconds on iOS and nanoseconds on Android.
const FRAME_TS_TO_MS = Platform.OS === 'ios' ? 1000 : 1 / 1e6;
// What the frame thread analyses (numbers so they cross runtimes cheaply).
const ANALYZE_NONE = 0;
const ANALYZE_BODY = 1;
const ANALYZE_FACE = 2;

type Lens = { label: string; zoom: number };

/** `/shoot/new` captures an example photo that becomes a new reference. */
const NEW_REFERENCE = 'new';

export default function Shoot() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reference = useReference(id);
  const capturingReference = id === NEW_REFERENCE;
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const { hasPermission, requestPermission } = useCameraPermission();

  // Ultra-wide + wide virtual device where available (0.5× / 1×).
  const device = useCameraDevice('back', { physicalDevices: ['ultra-wide-angle', 'wide-angle'] });

  const [showGhost, setShowGhost] = useState(true);
  const [showPose, setShowPose] = useState(true);
  const [auto, setAuto] = useState(true);
  const [grid, setGrid] = useState(true);
  const [opacity, setOpacity] = useState(0.35);
  const [peek, setPeek] = useState(false);
  const [capturing, setCapturing] = useState(false);
  // CameraX rejects zoom changes before the session runs; only zoom once started.
  const [started, setStarted] = useState(false);
  const [livePeople, setLivePeople] = useState<BodyPose[]>([]);
  const [liveFaces, setLiveFaces] = useState<FacePose[]>([]);
  const [match, setMatch] = useState<MatchResult>(NO_MATCH);
  const roll = useRef(0);
  const matchedSince = useRef<number | null>(null);

  // Viewport follows the reference shape so the shot is framed like it.
  const viewAspect = Math.min(1, Math.max(9 / 16, reference?.aspect ?? 3 / 4));
  // Full/half body matches on the skeleton; close-ups match on the face.
  const mode = reference ? referenceMode(reference) : 'none';
  // React Compiler memoizes these; no manual useMemo needed.
  const targets = mode === 'body' && reference ? reference.people.map((p) => coverInto(p, viewAspect)) : [];
  const targetFaces = mode === 'face' && reference?.faces ? reference.faces.map((f) => coverFace(f, viewAspect)) : [];

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

  // A reference saved without a pose gets one more read when opened.
  useEffect(() => {
    if (reference && (reference.people.length === 0 || reference.faces === undefined)) retryPose(reference.id);
  }, [reference]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setAppActive(s === 'active'));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    // Ask only when there is a camera to use (simulators have none).
    if (device && !hasPermission) requestPermission().catch(() => {});
  }, [device, hasPermission, requestPermission]);

  useEffect(() => {
    const sub = Accelerometer.addListener(({ x, y }) => {
      // Sign conventions differ per platform; |y| keeps upright portrait ≈ 0°.
      const deg = (Math.atan2(x, Math.abs(y)) * 180) / Math.PI;
      roll.current = roll.current * 0.7 + deg * 0.3;
    });
    return () => sub.remove();
  }, []);

  const photoOutput = usePhotoOutput({
    targetResolution: CommonResolutions.UHD_4_3, // ~12 MP
    // 'quality' gives the iPhone Camera pipeline (Deep Fusion / Smart HDR).
    qualityPrioritization: 'quality',
  });

  const lastFrame = useMemo(() => createSynchronizable(0), []);
  // Analysis only runs when there is something to match, and only the
  // detector the reference needs (body or face).
  const analyze = useMemo(() => createSynchronizable(ANALYZE_NONE), []);
  useEffect(() => {
    analyze.setBlocking(mode === 'body' ? ANALYZE_BODY : mode === 'face' ? ANALYZE_FACE : ANALYZE_NONE);
  }, [analyze, mode]);

  function onPoseValues(values: number[], frameMs: number, kind: number) {
    let result: MatchResult = NO_MATCH;
    if (kind === ANALYZE_BODY && targets.length > 0) {
      const people = decodePeople(values).map((p) => coverInto(p, viewAspect));
      setLivePeople(people);
      result = matchGroup(people, targets, matchPose, bodyAnchor, roll.current);
    } else if (kind === ANALYZE_FACE && targetFaces.length > 0) {
      const faces = decodeFaces(values).map((f) => coverFace(f, viewAspect));
      setLiveFaces(faces);
      result = matchGroup(faces, targetFaces, matchFace, faceAnchor, roll.current);
    } else {
      return;
    }
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
        const kind = analyze.getDirty();
        if (kind === ANALYZE_NONE) return;
        const frameMs = frame.timestamp * FRAME_TS_TO_MS;
        if (frameMs - lastFrame.getDirty() < FRAME_INTERVAL_MS) return;
        lastFrame.setBlocking(frameMs);
        const values = kind === ANALYZE_FACE ? FotoinPose.detectFace(frame) : FotoinPose.detect(frame);
        scheduleOnRN(onPoseValues, values, frameMs, kind);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { filePath } = await photoOutput.capturePhotoToFile({}, {});
      if (capturingReference) {
        // The example photo becomes the reference; continue shooting with it.
        const ref = await addReference(`file://${filePath}`, 0, 0);
        router.replace({ pathname: '/shoot/[id]', params: { id: ref.id } });
        if (referenceMode(ref) === 'none') Alert.alert(copy.noPersonFound);
        return;
      }
      router.push({ pathname: '/review', params: { shot: `file://${filePath}`, id } });
    } finally {
      setCapturing(false);
    }
  }

  if (!reference && !capturingReference) return <View style={styles.screen} />;

  const enabled = mode !== 'none' && !peek;
  const isActive = focused && appActive && hasPermission;
  const cameraReady = !!device && hasPermission;

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Top bar: close + the one thing to fix next. */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.close}
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.close}
        >
          <Icon name={{ ios: 'xmark', android: 'close' }} size={18} />
        </Pressable>
        <View style={styles.meterSlot}>
          {capturingReference ? (
            <Glass style={styles.notice}>
              <Text style={styles.noticeText} numberOfLines={2}>
                {copy.exampleHint}
              </Text>
            </Glass>
          ) : (
            <MatchMeter result={match} enabled={enabled} />
          )}
        </View>
      </View>

      {/* Viewfinder */}
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
          {cameraReady ? (
            <Camera
              style={StyleSheet.absoluteFill}
              device={device}
              isActive={isActive}
              outputs={[photoOutput, frameOutput]}
              constraints={[{ resolutionBias: photoOutput }]}
              zoom={started ? (lens?.zoom ?? 1) : undefined}
              onStarted={() => setStarted(true)}
              onStopped={() => setStarted(false)}
              resizeMode="cover"
              orientationSource="interface"
            />
          ) : (
            <Placeholder
              message={!device ? copy.noCamera : copy.cameraDenied}
              onAllow={device && !hasPermission ? () => Linking.openSettings() : undefined}
            />
          )}
          {reference && (showGhost || peek) ? (
            <Image
              source={{ uri: referenceUri(reference) }}
              style={[StyleSheet.absoluteFill, { opacity: peek ? 1 : opacity }]}
              contentFit="cover"
            />
          ) : null}
          {!peek ? <ViewfinderGuides grid={grid} /> : null}
          {showPose && !peek && mode === 'body' ? (
            <PoseOverlay
              targets={targets}
              live={livePeople}
              targetColor="rgba(247,247,247,0.6)"
              liveColor={scoreColor(match.score)}
            />
          ) : null}
          {showPose && !peek && mode === 'face' ? (
            <FaceOverlay
              targets={targetFaces}
              live={liveFaces}
              targetColor="rgba(247,247,247,0.7)"
              liveColor={scoreColor(match.score)}
            />
          ) : null}
          {capturing ? <View style={styles.flash} /> : null}

          {/* Zoom pills, centred at the bottom of the viewfinder like iPhone Camera. */}
          {lenses.length > 1 ? (
            <View style={styles.zoomRow} pointerEvents="box-none">
              <View style={styles.zoomTrack}>
                {lenses.map((l, i) => {
                  const selected = l === lens;
                  return (
                    <Pressable
                      key={l.label}
                      accessibilityRole="button"
                      accessibilityLabel={`${l.label}×`}
                      accessibilityState={{ selected }}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setLensIndex(i);
                      }}
                      style={[styles.zoom, selected && styles.zoomSelected]}
                    >
                      <Text style={[styles.zoomText, selected && styles.zoomTextSelected]}>
                        {selected ? `${l.label}×` : l.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {reference && showGhost ? (
          <View style={styles.sliderRow}>
            <Icon name={{ ios: 'circle.lefthalf.filled', android: 'opacity' }} size={16} color={colors.inkMuted} />
            <Slider style={styles.slider} value={opacity} min={0.1} max={0.8} onValueChange={setOpacity} />
          </View>
        ) : null}

        <View style={styles.modes}>
          {reference ? <Mode label={copy.ghost} on={showGhost} onPress={() => setShowGhost((v) => !v)} /> : null}
          {mode !== 'none' ? (
            <>
              <Mode label={mode === 'face' ? copy.faceGuide : copy.skeleton} on={showPose} onPress={() => setShowPose((v) => !v)} />
              <Mode label={copy.autoShoot} on={auto} onPress={() => setAuto((v) => !v)} />
            </>
          ) : null}
          <Mode label={copy.grid} on={grid} onPress={() => setGrid((v) => !v)} />
        </View>

        <View style={styles.shutterRow}>
          <View style={styles.side}>
            {reference ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={copy.holdToPeek}
                onPressIn={() => setPeek(true)}
                onPressOut={() => setPeek(false)}
              >
                <Image source={{ uri: referenceUri(reference) }} style={styles.thumb} contentFit="cover" />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.shutter}
            disabled={!cameraReady || capturing}
            onPress={capture}
            style={({ pressed }) => [styles.shutter, pressed && styles.shutterPressed]}
          >
            <View style={[styles.shutterInner, !cameraReady && { backgroundColor: colors.inkMuted }]} />
          </Pressable>
          <View style={styles.side} />
        </View>
      </View>
    </View>
  );
}

/** iPhone Camera–style mode label: yellow when on. */
function Mode({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      hitSlop={10}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
    >
      <Text style={[styles.mode, on && styles.modeOn]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
}

function Placeholder({ message, onAllow }: { message: string; onAllow?: () => void }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{message}</Text>
      {onAllow ? <PrimaryButton label={copy.openSettings} onPress={onAllow} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meterSlot: { flex: 1 },
  notice: { borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, alignSelf: 'flex-start' },
  noticeText: { ...type.label, color: colors.ink },
  viewportSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewport: { width: '100%', maxHeight: '100%', overflow: 'hidden', backgroundColor: '#0b0b0b' },
  flash: { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  placeholder: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  placeholderText: { ...type.body, color: colors.inkMuted, textAlign: 'center' },
  zoomRow: { position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' },
  zoomTrack: {
    flexDirection: 'row',
    gap: 6,
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  zoom: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30,30,30,0.6)',
  },
  zoomSelected: { width: 42, height: 42, borderRadius: 21, margin: -3 },
  zoomText: { fontSize: 11, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] },
  zoomTextSelected: { fontSize: 13, color: colors.level },
  controls: { paddingHorizontal: 20, paddingTop: 10, gap: 14 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slider: { flex: 1, height: 32 },
  modes: { flexDirection: 'row', justifyContent: 'center', gap: 22 },
  mode: { fontSize: 13, fontWeight: '600', letterSpacing: 1.2, color: colors.ink, opacity: 0.85 },
  modeOn: { color: colors.level, opacity: 1 },
  shutterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  side: { width: 56, alignItems: 'center' },
  thumb: { width: 48, height: 48, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    padding: 4,
  },
  shutterPressed: { transform: [{ scale: 0.92 }] },
  shutterInner: { flex: 1, borderRadius: 999, backgroundColor: '#fff' },
});
