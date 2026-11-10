# AGENTS.md

Fotoin: Expo / React Native app (iOS + Android) that helps someone photograph
their partner exactly like a reference photo (Pinterest, IG, or a sample). The
reference shows as a ghost overlay and pose skeleton over the live camera, with
a match meter, one coaching hint at a time, and auto-capture. Fully on-device:
no backend, no account, no ads, no network calls from app code. Open source
(MIT), free forever; keep it that way.
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
  on iOS (`ios/HybridFotoinPose.swift`); on Android
  (`android/.../HybridFotoinPose.kt`) Google MediaPipe Pose Landmarker for
  bodies (multi-person, VIDEO mode, CPU, model bundled in
  `android/src/main/assets/pose_landmarker_lite.task`, loaded from a buffer)
  and ML Kit Face Detection for faces. ML Kit Pose was dropped: single person
  only. Same flat-array contract (up to 4 people, largest first) in
  `src/specs/FotoinPose.nitro.ts`; run `npx nitrogen` in that package after
  changing the spec. Pure decoders live in `src/features/pose/decode.ts`.
- Two match modes, picked per reference by `src/features/pose/mode.ts`:
  body (torso visible: shoulders + hips) via `matcher.ts` (limb directions +
  torso anchor), and face for close-ups via `face.ts` (face box placement +
  yaw/roll/pitch from landmark geometry, so engine sign conventions don't
  matter; eyes/mouth are sorted by screen x). Both share `placement()` and are
  pure TS, worklet-safe, and unit-tested. Worklet closures capture functions at
  definition, so declare helpers before callers.
- Native module methods: `detect`/`detectInImage` (13 body joints per person)
  and `detectFace`/`detectFaceInImage` (box + eyes, nose, mouth corners per
  face). The frame thread runs only the detector the reference needs.
- Groups (`group.ts`): the largest live people are paired with the reference
  left → right (or flipped), framing and spacing are coached once for the
  group, then the worst person's pose ("Orang kiri: …"). References keep
  `people[]`/`faces[]`; subjects under 40% of the largest are dropped as
  background (posters, passers-by). Old saves with `pose`/`face` migrate on load.
- Brand: near-black surfaces and one accent, iOS Camera yellow `#FFD60A`
  (`src/theme.ts`). Icon sources in `assets/brand/` (SVG layers rendered to PNG
  with headless Chrome); iOS uses the layered Icon Composer bundle
  `assets/app.icon` (Liquid Glass), Android an adaptive + monochrome icon.
- Website (GitHub Pages from `docs/`): landing page with a working miniature of
  the viewfinder (`docs/app.js`, same placement maths and hint copy as the app)
  and `privacy.html`. App links live in `src/links.ts`. Archival photos are
  credited in the page footer and `docs/img/credits.json`.
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

## Android release

- `plugins/with-release-signing.js` signs release builds with the upload key
  when `FOTOIN_UPLOAD_*` exist in `~/.gradle/gradle.properties` (keystore lives
  outside the repo; never commit either); otherwise the debug key.
- `npx expo prebuild --clean --platform android`, then in `android/`:
  `./gradlew :app:bundleRelease` (Play AAB) or
  `./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a` (test APK).
- R8 is on: test the release build on a device before uploading. Nitro
  implementation classes need `@DoNotStrip @Keep`; keep rules for ML Kit,
  MediaPipe, protobuf and Flogger live in `app.json` (`expo-build-properties`).
- `android.blockedPermissions` keeps the manifest to camera/internet/vibrate;
  check the merged manifest after adding a library (photo permissions trigger
  a Play declaration).
- Store assets and listing copy live in `store/`; Play screenshots must be
  exactly 9:16.

## Gotchas

- iOS Simulator has no camera: the shoot screen shows a placeholder.
  Vision body pose also fails there ("Unable to setup request"); test on device.
- The first still-image run after launch can come back empty; `readPeople`
  tries twice and references are re-read when opened.
- ML Kit face detection ignores faces under ~8% of the image width
  (`setMinFaceSize`), so full-body references usually match on bodies.
- Nitro looks up the Kotlin class in `com.margelo.nitro.<namespace>`.
- Android installs over USB on XOS need "Install via USB" in Developer options.
- If several adb devices are connected, set `ANDROID_SERIAL`.
- Frame timestamps are seconds on iOS and nanoseconds on Android
  (`FRAME_TS_TO_MS`). Keep `<Camera>` mounted and toggle `isActive`
  (VisionCamera #4209); always `frame.dispose()` in `finally`.
- React Compiler lint (`react-hooks/purity`) rejects `Date.now()` in
  components; use frame timestamps.
- RN 0.88 removed `StyleSheet.absoluteFillObject`; use `{ position: 'absolute', inset: 0 }`.
- `react-dom` stays pinned (19.3.0) to satisfy optional peers; it is not bundled.
