# react-native-fotoin-pose

Local Nitro module for Fotoin: on-device body pose and face detection via Apple
Vision (iOS) and Google MediaPipe + ML Kit (Android). `detect`/`detectFace` run
on VisionCamera v5 frames; `detectInImage`/`detectFaceInImage` read stills.
Spec: `src/specs/FotoinPose.nitro.ts`; regenerate bindings with `npx nitrogen`.
