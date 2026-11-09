import type { HybridObject } from 'react-native-nitro-modules'
import type { Frame } from 'react-native-vision-camera'

/**
 * On-device body pose and faces with each platform's first-party engines:
 * Apple Vision on iOS; Google MediaPipe (bodies) and ML Kit (faces) on Android.
 *
 * Every method returns a flat array for up to 4 people, largest first:
 *
 *   [aspect, count, ...person blocks]
 *
 * Body block (39 values): (x, y, confidence) for 13 joints in this order —
 * nose, leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist,
 * rightWrist, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle.
 * A missing joint has confidence 0.
 *
 * Face block (14 values): boxX, boxY, boxW, boxH, then (x, y) for eye A,
 * eye B, nose, mouth corner A, mouth corner B. Eye/mouth order is not
 * guaranteed; consumers sort by x.
 *
 * x/y are normalised to the upright image (origin top-left). `count` is 0
 * when nobody is found.
 */
export interface FotoinPose
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** Bodies in a live camera frame (expects physical buffer rotation on). */
  detect(frame: Frame): number[]
  /** Bodies in a still image at a file path or file:// URI (EXIF applied). */
  detectInImage(path: string): Promise<number[]>
  /** Faces in a live camera frame, for close-ups. */
  detectFace(frame: Frame): number[]
  /** Faces in a still image. */
  detectFaceInImage(path: string): Promise<number[]>
}
