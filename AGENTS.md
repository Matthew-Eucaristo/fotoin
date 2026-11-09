# AGENTS.md

Fotoin: Flutter app (iOS + Android) that helps someone photograph their partner
exactly like a reference photo (Pinterest, IG, or a sample). The reference shows
as a ghost overlay and pose skeleton over the live camera, with a match meter,
one coaching hint at a time, and auto-capture. Fully on-device: no backend, no
account, no network calls from app code.

## Identity

- Bundle/package `dev.matthew.fotoin`, display name "Fotoin". Personal project.

## Architecture

- Feature-first under `lib/features/` (`references`, `shoot`, `pose`);
  `lib/app/router.dart` (go_router), `lib/core/theme` (dark tokens: one amber
  CTA, teal accent, system fonts), `lib/core/copy` (all Indonesian UI copy).
- State: Riverpod 3 with generated providers; commit `.g.dart` files.
- Pose detection is first-party per platform through one in-app channel
  `fotoin/pose` (`lib/features/pose/data/native_pose_detector.dart`):
  Apple Vision on iOS (`ios/Runner/PosePlugin.swift`), Google ML Kit on Android
  (`android/app/src/main/kotlin/dev/matthew/fotoin/PosePlugin.kt`). Both return
  joints normalised to the upright image; keep the two contracts identical.
- Do not add `google_mlkit_*` plugins: their iOS build pulls third-party
  repackaged binaries and needs manually downloaded model bundles.
- Android ML Kit runs CPU-only: its acceleration mini-benchmark process crashed
  on Android 16 (Infinix X6855).
- Matching (`lib/features/pose/domain/pose_matcher.dart`) is pure Dart: limb
  directions for pose, torso anchor for placement (step back/closer, pan, tilt),
  phone roll from the accelerometer. Overlays and live pose are mapped into the
  viewport with `BodyPose.coverInto` (BoxFit.cover); viewport aspect follows the
  reference (clamped 9:16..1:1).
- Reference photos stay on device (app documents + `index.json`); never upload
  them. Pinterest images are someone else's work, used privately as a guide.
- App is portrait-locked; pose geometry assumes it.

## Commands

```bash
flutter analyze
dart format lib test
flutter test
dart run build_runner build    # after changing @riverpod providers
flutter run -d <device>
```

## Gotchas

- iOS Simulator has no camera: the shoot screen shows a placeholder; test the
  live camera on a device. Vision still runs on simulator for still images.
- SwiftPM is enabled in `pubspec.yaml`; iOS target 15.5.
- Native files added to Xcode must be in the Runner target's sources.
- The official `camera` plugin uses one resolution for preview, frame stream
  and photo (now `veryHigh`, ~2 MP photos). Full-resolution capture needs a
  separate photo output, which the plugin cannot do.
