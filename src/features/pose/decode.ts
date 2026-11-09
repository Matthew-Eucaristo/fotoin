import { type FacePose, faceFromBlock } from './face';
import { type BodyPose, JOINTS } from './pose';

/** Joints below this confidence are treated as not visible. */
const MIN_CONFIDENCE = 0.4;
const BODY_BLOCK = JOINTS.length * 3;
const FACE_BLOCK = 14;

// Native layout (see FotoinPose.nitro.ts): [aspect, count, ...blocks], largest
// person first. Worklet-safe so it can run on the camera frame thread.

function bodyFromBlock(v: number[], offset: number, aspect: number): BodyPose | null {
  'worklet';
  const joints: BodyPose['joints'] = {};
  let found = 0;
  for (let i = 0; i < JOINTS.length; i++) {
    const at = offset + i * 3;
    if (v[at + 2] < MIN_CONFIDENCE) continue;
    joints[JOINTS[i]] = { x: Math.min(1, Math.max(0, v[at])), y: Math.min(1, Math.max(0, v[at + 1])) };
    found++;
  }
  return found >= 4 ? { joints, aspect } : null;
}

/** All detected bodies, largest first. */
export function decodePeople(v: number[]): BodyPose[] {
  'worklet';
  const count = v.length >= 2 ? v[1] : 0;
  const people: BodyPose[] = [];
  for (let i = 0; i < count && 2 + (i + 1) * BODY_BLOCK <= v.length; i++) {
    const pose = bodyFromBlock(v, 2 + i * BODY_BLOCK, v[0]);
    if (pose) people.push(pose);
  }
  return people;
}

/** All detected faces, largest first. */
export function decodeFaces(v: number[]): FacePose[] {
  'worklet';
  const count = v.length >= 2 ? v[1] : 0;
  const faces: FacePose[] = [];
  for (let i = 0; i < count && 2 + (i + 1) * FACE_BLOCK <= v.length; i++) {
    faces.push(faceFromBlock(v, 2 + i * FACE_BLOCK, v[0]));
  }
  return faces;
}
