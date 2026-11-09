import type { FacePose } from './face';
import { type BodyPose, isUsable } from './pose';

/** How a reference is matched: bodies, close-up faces, or ghost only. */
export type MatchMode = 'body' | 'face' | 'none';

function hasTorso(p: BodyPose): boolean {
  const j = p.joints;
  return !!(j.leftShoulder && j.rightShoulder && j.leftHip && j.rightHip);
}

/**
 * Body matching needs every person's torso (shoulders + hips); close-ups and
 * head-and-shoulders shots match on faces instead.
 */
export function referenceMode(ref: { people: BodyPose[]; faces?: FacePose[] }): MatchMode {
  const people = ref.people;
  const faces = ref.faces ?? [];
  if (people.length > 0 && people.every(hasTorso)) return 'body';
  if (faces.length > 0 && faces.length >= people.length) return 'face';
  if (people.some(isUsable)) return 'body';
  return 'none';
}

/** People the reference expects in frame. */
export function referencePeopleCount(ref: { people: BodyPose[]; faces?: FacePose[] }): number {
  const mode = referenceMode(ref);
  if (mode === 'face') return ref.faces?.length ?? 0;
  if (mode === 'body') return ref.people.length;
  return 0;
}
