import { describe, expect, it } from '@jest/globals';

import { matchGroup } from './group';
import { bodyAnchor, matchPose } from './matcher';
import type { BodyPose } from './pose';

function person(cx: number, { scale = 0.6, raiseRightArm = false } = {}): BodyPose {
  const p = (x: number, y: number) => ({ x: cx + (x - 0.5) * scale, y: 0.5 + (y - 0.5) * scale });
  return {
    aspect: 3 / 4,
    joints: {
      nose: p(0.5, 0.2),
      leftShoulder: p(0.58, 0.3),
      rightShoulder: p(0.42, 0.3),
      leftElbow: p(0.62, 0.42),
      rightElbow: raiseRightArm ? p(0.36, 0.22) : p(0.38, 0.42),
      leftWrist: p(0.63, 0.52),
      rightWrist: raiseRightArm ? p(0.34, 0.12) : p(0.37, 0.52),
      leftHip: p(0.55, 0.55),
      rightHip: p(0.45, 0.55),
      leftKnee: p(0.56, 0.7),
      rightKnee: p(0.44, 0.7),
      leftAnkle: p(0.56, 0.85),
      rightAnkle: p(0.44, 0.85),
    },
  };
}

const couple = [person(0.3), person(0.7)];
const match = (live: BodyPose[], ref: BodyPose[]) => matchGroup(live, ref, matchPose, bodyAnchor);

describe('matchGroup', () => {
  it('holds when both people match', () => {
    const r = match([person(0.7), person(0.3)], couple);
    expect(r.score).toBeGreaterThan(0.95);
    expect(r.hint).toBe('hold');
    expect(r.people).toBe(2);
  });

  it('asks for more people when someone is missing', () => {
    expect(match([person(0.5)], couple).hint).toBe('needMorePeople');
  });

  it('asks them to spread apart when standing too close', () => {
    expect(match([person(0.42), person(0.58)], couple).hint).toBe('spreadApart');
  });

  it('names the person whose pose is off', () => {
    const r = match([person(0.3), person(0.7, { raiseRightArm: true })], couple);
    expect(r.hint).toBe('fixRightArm');
    expect(r.person).toBe(1);
  });

  it('ignores a small passer-by beyond the reference count', () => {
    const r = match([person(0.3), person(0.7), person(0.5, { scale: 0.2 })], couple);
    expect(r.hint).toBe('hold');
  });

  it('behaves like the single matcher for one person', () => {
    expect(match([person(0.5)], [person(0.5)]).hint).toBe('hold');
  });
});
