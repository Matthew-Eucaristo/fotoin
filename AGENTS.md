# AGENTS.md

Fotoin: Expo / React Native app (iOS + Android) that helps someone photograph
their partner exactly like a reference photo (Pinterest, IG, or a sample). The
reference shows as a ghost overlay and pose skeleton over the live camera, with
a match meter, one coaching hint at a time, and auto-capture. Fully on-device:
no backend, no account, no network calls from app code. Personal project.
The earlier Flutter prototype is kept at tag `flutter-prototype`.

## Expo has changed — do not trust training data

Before touching an Expo / RN / VisionCamera API, read the installed types in
`node_modules` or the versioned docs (`https://docs.expo.dev/versions/v58.0.0/`,
`https://docs.expo.dev/llms.txt`, `https://visioncamera.margelo.com/llms.txt`).
VisionCamera is v5 (Nitro): `useFrameOutput`, `usePhotoOutput`, constraints —
not the v4 frame-processor API.

## Stack (SDK 58, New Architecture, React Compiler on)

- Expo SDK 58 · RN 0.88 · React 19.3 · TypeScript 6 · Expo Router (Stack).
- Camera: `react-native-vision-camera` v5 with two outputs — photo
  (`UHD_4_3`, ~12 MP) and a VGA 4:3 YUV frame output with
  `enablePhysicalBufferRotation` (frames arrive upright on both platforms).
  `constraints={[{ resolutionBias: photoOutput }]}`.
- Pose: local Nitro module `packages/react-native-fotoin-pose` — Apple Vision
  on iOS (`ios/HybridFotoinPose.swift`), Google ML Kit on Android
  (`android/.../HybridFotoinPose.kt`, CPU-only: its GPU benchmark process
  crashed on Android 16). Same flat-array contract in
  `src/specs/FotoinPose.nitro.ts`; run `npx nitrogen` in that package after
  changing the spec.
- Matching (`src/features/pose/matcher.ts`) is pure TS and worklet-safe:
  limb directions for pose, torso anchor for placement, phone roll from the
  accelerometer. Worklet closures capture functions at definition, so declare
  helpers before callers.
- UI: system fonts, `expo-symbols` (SF Symbols / Material Symbols),
  `expo-glass-effect` Liquid Glass on iOS 26+ with `expo-blur` fallback
  (`src/ui/glass.tsx`), `@expo/ui` Slider, `react-native-svg` for overlays,
  `expo-image`. Theme tokens in `src/theme.ts`; all Indonesian copy in
  `src/copy.ts`.
- Storage: references copied into `Paths.document/references` with an
  `index.json` (`src/features/references/store.ts`, `useSyncExternalStore`).
  Never upload them; Pinterest images are someone else's work.
- Saving: `expo-media-library` write-only permission, `Asset.create`.

## Commands

```bash
npx expo install <pkg>     # never npm add for Expo-managed packages
npm run typecheck && npm run lint && npm test
npx expo-doctor
npx expo prebuild --clean  # ios/ and android/ are generated (CNG); never edit them
npx expo run:ios -d <sim>  # dev build; Expo Go cannot load VisionCamera/Nitro
npx expo run:android -d <device>
npm start                  # Metro for the dev client
```

CocoaPods needs `LANG=en_US.UTF-8`.

## Gotchas

- iOS Simulator has no camera: the shoot screen shows a placeholder.
- Frame timestamps are seconds on iOS and nanoseconds on Android
  (`FRAME_TS_TO_MS`). Keep `<Camera>` mounted and toggle `isActive`
  (VisionCamera #4209); always `frame.dispose()` in `finally`.
- React Compiler lint (`react-hooks/purity`) rejects `Date.now()` in
  components; use frame timestamps.
- RN 0.88 removed `StyleSheet.absoluteFillObject`; use `{ position: 'absolute', inset: 0 }`.
- `react-dom` stays pinned (19.3.0) to satisfy optional peers; it is not bundled.
