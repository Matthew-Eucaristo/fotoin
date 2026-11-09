import { FotoinPose } from 'react-native-fotoin-pose';

import { type BodyPose, JOINTS } from './pose';

/** Joints below this confidence are treated as not visible. */
const MIN_CONFIDENCE = 0.4;

/**
 * Decodes the native flat array ([aspect, (x, y, conf) × 13]) into a pose.
 * Worklet-safe so it can run on the camera frame thread.
 */
export function decodePose(values: number[]): BodyPose | null {
  'worklet';
  if (values.length < 1 + JOINTS.length * 3) return null;
  const joints: BodyPose['joints'] = {};
  let found = 0;
  for (let i = 0; i < JOINTS.length; i++) {
    const conf = values[3 + i * 3];
    if (conf < MIN_CONFIDENCE) continue;
    joints[JOINTS[i]] = {
      x: Math.min(1, Math.max(0, values[1 + i * 3])),
      y: Math.min(1, Math.max(0, values[2 + i * 3])),
    };
    found++;
  }
  return found >= 4 ? { joints, aspect: values[0] } : null;
}

/** Reads the pose of the most prominent person in a still image. */
export async function detectPoseInImage(uri: string): Promise<{ pose: BodyPose | null; aspect: number | null }> {
  const values = await FotoinPose.detectInImage(uri);
  return { pose: decodePose(values), aspect: values.length > 0 ? values[0] : null };
}

export { FotoinPose };
