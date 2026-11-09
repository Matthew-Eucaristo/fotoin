import { type MatchResult, NO_MATCH, placement, type ShotHint } from './matcher';
import type { Point } from './pose';

/**
 * A face for close-up shots, normalised to the upright image (0..1, origin
 * top-left). Eyes and mouth corners are ordered left → right on screen, so no
 * engine-specific "left/right" convention leaks in.
 */
export type FacePose = {
  aspect: number;
  box: { x: number; y: number; w: number; h: number };
  eyes: [Point, Point];
  nose: Point;
  mouth: [Point, Point];
};

const FACE_VALUES = 15;
const YAW_TOLERANCE = 0.12; // nose offset / eye distance
const ROLL_TOLERANCE_DEG = 6;
const PITCH_TOLERANCE = 0.1; // nose position between eyes and mouth

// Worklet closures capture functions at definition: helpers first.

function sortX(a: Point, b: Point): [Point, Point] {
  'worklet';
  return a.x <= b.x ? [a, b] : [b, a];
}

/** Decodes the native flat array (see FotoinPose.nitro.ts). */
export function decodeFace(v: number[]): FacePose | null {
  'worklet';
  if (v.length < FACE_VALUES) return null;
  const p = (i: number): Point => ({ x: v[i], y: v[i + 1] });
  return {
    aspect: v[0],
    box: { x: v[1], y: v[2], w: v[3], h: v[4] },
    eyes: sortX(p(5), p(7)),
    nose: p(9),
    mouth: sortX(p(11), p(13)),
  };
}

/** Same centre-crop mapping as `coverInto` for body poses. */
export function coverFace(face: FacePose, targetAspect: number): FacePose {
  'worklet';
  let fx = 1;
  let fy = 1;
  if (face.aspect > targetAspect) fx = targetAspect / face.aspect;
  else fy = face.aspect / targetAspect;
  const ox = (1 - fx) / 2;
  const oy = (1 - fy) / 2;
  const m = (p: Point): Point => ({ x: (p.x - ox) / fx, y: (p.y - oy) / fy });
  return {
    aspect: targetAspect,
    box: { x: (face.box.x - ox) / fx, y: (face.box.y - oy) / fy, w: face.box.w / fx, h: face.box.h / fy },
    eyes: [m(face.eyes[0]), m(face.eyes[1])],
    nose: m(face.nose),
    mouth: [m(face.mouth[0]), m(face.mouth[1])],
  };
}

export function mirroredFace(face: FacePose): FacePose {
  'worklet';
  const m = (p: Point): Point => ({ x: 1 - p.x, y: p.y });
  return {
    aspect: face.aspect,
    box: { x: 1 - face.box.x - face.box.w, y: face.box.y, w: face.box.w, h: face.box.h },
    eyes: sortX(m(face.eyes[0]), m(face.eyes[1])),
    nose: m(face.nose),
    mouth: sortX(m(face.mouth[0]), m(face.mouth[1])),
  };
}

/**
 * Head angles from landmark geometry (engine-independent, screen frame):
 * yaw > 0 → nose towards screen-right; roll > 0 → head tipped clockwise;
 * pitch ≈ 0.5 neutral, larger → chin down.
 */
export function faceAngles(face: FacePose): { yaw: number; roll: number; pitch: number } {
  'worklet';
  const [a, b] = face.eyes;
  const ex = (b.x - a.x) * face.aspect;
  const ey = b.y - a.y;
  const eyeDist = Math.hypot(ex, ey) || 1e-6;
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  const mouthY = (face.mouth[0].y + face.mouth[1].y) / 2;
  const span = mouthY - midY;
  return {
    yaw: ((face.nose.x - midX) * face.aspect) / eyeDist,
    roll: (Math.atan2(ey, ex) * 180) / Math.PI,
    pitch: Math.abs(span) < 1e-6 ? 0.5 : (face.nose.y - midY) / span,
  };
}

function faceAnchor(face: FacePose): { center: Point; size: number } {
  'worklet';
  return { center: { x: face.box.x + face.box.w / 2, y: face.box.y + face.box.h / 2 }, size: face.box.h };
}

function matchFaceOriented(live: FacePose, ref: FacePose, roll: number): MatchResult {
  'worklet';
  const l = faceAngles(live);
  const r = faceAngles(ref);
  const dYaw = l.yaw - r.yaw;
  const dRoll = l.roll - r.roll;
  const dPitch = l.pitch - r.pitch;
  const poseScore =
    (Math.max(0, 1 - Math.abs(dYaw) / 0.5) +
      Math.max(0, 1 - Math.abs(dRoll) / 25) +
      Math.max(0, 1 - Math.abs(dPitch) / 0.4)) /
    3;

  const place = placement(faceAnchor(live), faceAnchor(ref), roll);
  const score = Math.min(1, Math.max(0, 0.5 * poseScore + 0.5 * place.score - place.levelPenalty));

  // Largest head difference relative to its tolerance wins.
  const yawErr = Math.abs(dYaw) / YAW_TOLERANCE;
  const rollErr = Math.abs(dRoll) / ROLL_TOLERANCE_DEG;
  const pitchErr = Math.abs(dPitch) / PITCH_TOLERANCE;
  let hint: ShotHint;
  if (place.hint) hint = place.hint;
  else if (Math.max(yawErr, rollErr, pitchErr) <= 1) hint = 'hold';
  else if (yawErr >= rollErr && yawErr >= pitchErr) hint = dYaw > 0 ? 'turnLeft' : 'turnRight';
  else if (rollErr >= pitchErr) hint = dRoll > 0 ? 'tiltHeadLeft' : 'tiltHeadRight';
  else hint = dPitch > 0 ? 'chinUp' : 'chinDown';

  return { score, poseScore, placementScore: place.score, hint };
}

/** Close-up counterpart of `matchPose`. Worklet-safe. */
export function matchFace(live: FacePose | null, reference: FacePose, rollDegrees = 0): MatchResult {
  'worklet';
  if (!live) return NO_MATCH;
  const a = matchFaceOriented(live, reference, rollDegrees);
  const b = matchFaceOriented(live, mirroredFace(reference), rollDegrees);
  return a.score >= b.score ? a : b;
}
