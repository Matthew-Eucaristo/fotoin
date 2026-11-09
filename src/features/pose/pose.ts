/**
 * Body pose model shared by the native detectors and the matcher.
 * Joints are normalised to the upright image: x, y in 0..1, origin top-left.
 */
export const JOINTS = [
  'nose',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle',
] as const;

export type Joint = (typeof JOINTS)[number];
export type Point = { x: number; y: number };

export type BodyPose = {
  joints: Partial<Record<Joint, Point>>;
  /** Image width / height, so angles compare without distortion. */
  aspect: number;
};

/** Limbs drawn as the skeleton and compared by direction. */
export const LIMBS: readonly (readonly [Joint, Joint])[] = [
  ['leftShoulder', 'rightShoulder'],
  ['leftHip', 'rightHip'],
  ['leftShoulder', 'leftHip'],
  ['rightShoulder', 'rightHip'],
  ['leftShoulder', 'leftElbow'],
  ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'],
  ['rightElbow', 'rightWrist'],
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightAnkle'],
];

export function jointCount(pose: BodyPose | null | undefined): number {
  'worklet';
  if (!pose) return 0;
  let n = 0;
  for (const j of JOINTS) if (pose.joints[j]) n++;
  return n;
}

export function isUsable(pose: BodyPose | null | undefined): pose is BodyPose {
  'worklet';
  return jointCount(pose) >= 4;
}

function mirrorJoint(j: Joint): Joint {
  'worklet';
  if (j.startsWith('left')) return ('right' + j.slice(4)) as Joint;
  if (j.startsWith('right')) return ('left' + j.slice(5)) as Joint;
  return j;
}

/** Horizontal flip; left and right swap so limbs still compare. */
export function mirrored(pose: BodyPose): BodyPose {
  'worklet';
  const joints: BodyPose['joints'] = {};
  for (const j of JOINTS) {
    const p = pose.joints[j];
    if (p) joints[mirrorJoint(j)] = { x: 1 - p.x, y: p.y };
  }
  return { joints, aspect: pose.aspect };
}

/**
 * Re-expresses the pose inside a viewport of `targetAspect` that shows the
 * image with cover fit (centre crop). Joints outside the crop are dropped.
 */
export function coverInto(pose: BodyPose, targetAspect: number): BodyPose {
  'worklet';
  let fx = 1;
  let fy = 1;
  if (pose.aspect > targetAspect) fx = targetAspect / pose.aspect;
  else fy = pose.aspect / targetAspect;
  const ox = (1 - fx) / 2;
  const oy = (1 - fy) / 2;
  const joints: BodyPose['joints'] = {};
  for (const j of JOINTS) {
    const p = pose.joints[j];
    if (!p) continue;
    const x = (p.x - ox) / fx;
    const y = (p.y - oy) / fy;
    if (x < 0 || x > 1 || y < 0 || y > 1) continue;
    joints[j] = { x, y };
  }
  return { joints, aspect: targetAspect };
}
