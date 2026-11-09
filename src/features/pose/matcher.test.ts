import { describe, expect, it } from '@jest/globals';

import { matchPose } from './matcher';
import { type BodyPose, coverInto, mirrored } from './pose';

function standing({ dx = 0, dy = 0, scale = 1 } = {}): BodyPose {
  const p = (x: number, y: number) => ({ x: 0.5 + (x - 0.5) * scale + dx, y: 0.5 + (y - 0.5) * scale + dy });
  return {
    aspect: 3 / 4,
    joints: {
      nose: p(0.5, 0.2),
      leftShoulder: p(0.58, 0.3),
      rightShoulder: p(0.42, 0.3),
      leftElbow: p(0.62, 0.42),
      rightElbow: p(0.38, 0.42),
      leftWrist: p(0.63, 0.52),
      rightWrist: p(0.37, 0.52),
      leftHip: p(0.55, 0.55),
      rightHip: p(0.45, 0.55),
      leftKnee: p(0.56, 0.7),
      rightKnee: p(0.44, 0.7),
      leftAnkle: p(0.56, 0.85),
      rightAnkle: p(0.44, 0.85),
    },
  };
}

describe('matchPose', () => {
  it('scores an identical pose ~1 and says hold', () => {
    const r = matchPose(standing(), standing());
    expect(r.score).toBeGreaterThan(0.95);
    expect(r.hint).toBe('hold');
  });

  it('asks to step back when the subject is too big', () => {
    expect(matchPose(standing({ scale: 1.4 }), standing()).hint).toBe('stepBack');
  });

  it('asks to pan right when the subject sits right of the target', () => {
    expect(matchPose(standing({ dx: 0.15 }), standing()).hint).toBe('panRight');
  });

  it('flags a raised arm without confusing it with distance', () => {
    const live = standing();
    live.joints.rightElbow = { x: 0.36, y: 0.22 };
    live.joints.rightWrist = { x: 0.34, y: 0.12 };
    const r = matchPose(live, standing());
    expect(r.hint).toBe('fixRightArm');
    expect(r.poseScore).toBeLessThan(0.9);
  });

  it('matches a mirrored reference', () => {
    expect(matchPose(mirrored(standing()), standing()).score).toBeGreaterThan(0.95);
  });

  it('asks to level the phone when rolled', () => {
    expect(matchPose(standing(), standing(), 9).hint).toBe('holdLevel');
  });

  it('returns findPerson without a live pose', () => {
    expect(matchPose(null, standing()).hint).toBe('findPerson');
  });
});

describe('coverInto', () => {
  it('crops the sides of a wider image', () => {
    const wide: BodyPose = { aspect: 16 / 9, joints: { nose: { x: 0.5, y: 0.5 }, leftWrist: { x: 0.05, y: 0.5 } } };
    const out = coverInto(wide, 3 / 4);
    expect(out.joints.nose).toEqual({ x: 0.5, y: 0.5 });
    expect(out.joints.leftWrist).toBeUndefined();
    expect(out.aspect).toBe(3 / 4);
  });
});
