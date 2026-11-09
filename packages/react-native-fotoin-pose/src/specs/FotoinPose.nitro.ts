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

  /**
   * Largest face, for close-ups where the body is not visible. Returns
   * [aspect, boxX, boxY, boxW, boxH, then (x, y) for: eye A, eye B, nose,
   * mouth corner A, mouth corner B] — 15 values, normalised to the upright
   * image (origin top-left) — or an empty array when no face is found.
   * Eye/mouth order is not guaranteed; consumers sort by x.
   */
  detectFace(frame: Frame): number[]
  /** Same as detectFace, for a still image. */
  detectFaceInImage(path: string): Promise<number[]>
}
