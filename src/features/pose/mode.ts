import type { FacePose } from './face';
import { type BodyPose, isUsable } from './pose';

/** How a reference is matched: full/half body, a close-up face, or ghost only. */
export type MatchMode = 'body' | 'face' | 'none';

/**
 * Body matching needs a visible torso (shoulders + hips); close-ups and
 * head-and-shoulders shots match on the face instead.
 */
export function referenceMode(ref: { pose: BodyPose | null; face?: FacePose | null }): MatchMode {
  const j = ref.pose?.joints;
  if (j?.leftShoulder && j.rightShoulder && j.leftHip && j.rightHip) return 'body';
  if (ref.face) return 'face';
  if (isUsable(ref.pose)) return 'body';
  return 'none';
}
