import type { HybridObject } from 'react-native-nitro-modules'
import type { Frame } from 'react-native-vision-camera'

/**
 * Body pose detection with each platform's first-party engine:
 * Apple Vision on iOS, Google ML Kit on Android.
 *
 * Both methods return a flat array: [aspect, x, y, confidence] followed by
 * (x, y, confidence) for each of the 13 joints in this order:
 * nose, leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist,
 * rightWrist, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle.
 * x/y are normalised to the upright image (origin top-left); a missing joint
 * has confidence 0. An empty array means nobody was found.
 */
export interface FotoinPose
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /** Live camera frame. Expects an upright frame (physical buffer rotation on). */
  detect(frame: Frame): number[]
  /** Still image at a file path or file:// URI (EXIF orientation applied). */
  detectInImage(path: string): Promise<number[]>
}
