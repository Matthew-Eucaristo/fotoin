import { type BodyPose, isUsable, type Joint, LIMBS, mirrored, type Point } from './pose';

/** What the photographer should do next, most important first. */
export type ShotHint =
  | 'findPerson'
  | 'stepBack'
  | 'stepCloser'
  | 'panLeft'
  | 'panRight'
  | 'tiltUp'
  | 'tiltDown'
  | 'holdLevel'
  | 'fixLeftArm'
  | 'fixRightArm'
  | 'fixLeftLeg'
  | 'fixRightLeg'
  | 'fixTorso'
  | 'turnLeft'
  | 'turnRight'
  | 'tiltHeadLeft'
  | 'tiltHeadRight'
  | 'chinUp'
  | 'chinDown'
  | 'hold';

export type MatchResult = {
  /** 0..1 overall similarity. */
  score: number;
  poseScore: number;
  placementScore: number;
  hint: ShotHint;
};

export const NO_MATCH: MatchResult = { score: 0, poseScore: 0, placementScore: 0, hint: 'findPerson' };

const PLACEMENT_TOLERANCE = 0.07;
const SIZE_TOLERANCE = 0.12;
const LIMB_TOLERANCE_RAD = Math.PI / 3; // 60° → limb score 0
const LEVEL_TOLERANCE_DEG = 4;

// Worklet closures capture referenced functions when they are defined, so
// helpers must be declared before the functions that call them.

/**
 * Where the subject sits in the frame versus the reference, from the
 * photographer's side: move closer/back, pan, tilt, or level the phone.
 * Shared by the body and face matchers. `hint` is null when placement is fine.
 */
export function placement(
  live: { center: Point; size: number },
  ref: { center: Point; size: number },
  roll: number,
): { score: number; levelPenalty: number; hint: ShotHint | null } {
  'worklet';
  const dx = live.center.x - ref.center.x;
  const dy = live.center.y - ref.center.y;
  const sizeRatio = ref.size <= 0 ? 1 : live.size / ref.size;
  const error = Math.abs(dx) + Math.abs(dy) + Math.abs(Math.log(sizeRatio)) * 0.8;
  const score = Math.max(0, 1 - error / 0.6);
  const levelPenalty = Math.abs(roll) > LEVEL_TOLERANCE_DEG ? 0.1 : 0;
  let hint: ShotHint | null = null;
  if (sizeRatio > 1 + SIZE_TOLERANCE) hint = 'stepBack';
  else if (sizeRatio < 1 - SIZE_TOLERANCE) hint = 'stepCloser';
  // Subject sits right of the target → turn the phone right.
  else if (dx > PLACEMENT_TOLERANCE) hint = 'panRight';
  else if (dx < -PLACEMENT_TOLERANCE) hint = 'panLeft';
  // Subject sits lower than the target → aim lower.
  else if (dy > PLACEMENT_TOLERANCE) hint = 'tiltDown';
  else if (dy < -PLACEMENT_TOLERANCE) hint = 'tiltUp';
  else if (Math.abs(roll) > LEVEL_TOLERANCE_DEG) hint = 'holdLevel';
  return { score, levelPenalty, hint };
}

function limbHint(limb: readonly [Joint, Joint]): ShotHint {
  'worklet';
  const names = limb[0] + limb[1];
  const left = limb[0].startsWith('left') && limb[1].startsWith('left');
  const right = limb[0].startsWith('right') && limb[1].startsWith('right');
  const arm = names.includes('Elbow') || names.includes('Wrist');
  const leg = names.includes('Knee') || names.includes('Ankle');
  if (arm && left) return 'fixLeftArm';
  if (arm && right) return 'fixRightArm';
  if (leg && left) return 'fixLeftLeg';
  if (leg && right) return 'fixRightLeg';
  return 'fixTorso';
}

/** Torso centre and length; falls back to joint bounds without a torso. */
function anchor(pose: BodyPose): { center: Point; size: number } {
  'worklet';
  const { leftShoulder: ls, rightShoulder: rs, leftHip: lh, rightHip: rh } = pose.joints;
  if (ls && rs && lh && rh) {
    const sx = (ls.x + rs.x) / 2;
    const sy = (ls.y + rs.y) / 2;
    const hx = (lh.x + rh.x) / 2;
    const hy = (lh.y + rh.y) / 2;
    return { center: { x: (sx + hx) / 2, y: (sy + hy) / 2 }, size: Math.hypot(hx - sx, hy - sy) };
  }
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const p of Object.values(pose.joints)) {
    if (!p) continue;
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }, size: maxY - minY };
}

function vector(pose: BodyPose, limb: readonly [Joint, Joint]): Point | null {
  'worklet';
  const a = pose.joints[limb[0]];
  const b = pose.joints[limb[1]];
  if (!a || !b) return null;
  // Scale x by aspect so angles are measured in real proportions.
  return { x: (b.x - a.x) * pose.aspect, y: b.y - a.y };
}

function angleBetween(a: Point, b: Point): number {
  'worklet';
  const mag = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y);
  if (mag === 0) return Math.PI;
  return Math.acos(Math.min(1, Math.max(-1, (a.x * b.x + a.y * b.y) / mag)));
}

function matchOriented(live: BodyPose, ref: BodyPose, roll: number): MatchResult {
  'worklet';
  let sum = 0;
  let count = 0;
  let worstScore = 2;
  let worstLimb: readonly [Joint, Joint] | null = null;
  for (const limb of LIMBS) {
    const lv = vector(live, limb);
    const rv = vector(ref, limb);
    if (!lv || !rv) continue;
    const s = Math.max(0, 1 - angleBetween(lv, rv) / LIMB_TOLERANCE_RAD);
    sum += s;
    count++;
    if (s < worstScore) {
      worstScore = s;
      worstLimb = limb;
    }
  }
  const poseScore = count === 0 ? 0 : sum / count;

  const place = placement(anchor(live), anchor(ref), roll);
  const score = Math.min(1, Math.max(0, 0.6 * poseScore + 0.4 * place.score - place.levelPenalty));

  let hint: ShotHint;
  if (place.hint) hint = place.hint;
  else if (!worstLimb) hint = 'findPerson';
  else if (worstScore > 0.8) hint = 'hold';
  else hint = limbHint(worstLimb);

  return { score, poseScore, placementScore: place.score, hint };
}

/**
 * Compares a live pose with the reference. Pose similarity uses limb
 * directions (scale/position invariant); placement uses a torso anchor so the
 * photographer is told to move, not the subject. Worklet-safe.
 */
export function matchPose(live: BodyPose | null, reference: BodyPose, rollDegrees = 0): MatchResult {
  'worklet';
  if (!isUsable(live) || !isUsable(reference)) return NO_MATCH;
  // Pinterest images are often flipped; accept whichever side fits better.
  const a = matchOriented(live, reference, rollDegrees);
  const b = matchOriented(live, mirrored(reference), rollDegrees);
  return a.score >= b.score ? a : b;
}
