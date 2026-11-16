import { describe, expect, it } from '@jest/globals';

import { bodyAnchor } from '../pose/matcher';
import type { BodyPose } from '../pose/pose';
import { migrate, prominent, type LegacyReference } from './migrate';

const pose = (size: number): BodyPose => ({
  aspect: 0.75,
  joints: {
    leftShoulder: { x: 0.4, y: 0.3 },
    rightShoulder: { x: 0.6, y: 0.3 },
    leftHip: { x: 0.4, y: 0.3 + size },
    rightHip: { x: 0.6, y: 0.3 + size },
  },
});

const base: LegacyReference = {
  id: 'abc',
  file: 'abc.jpg',
  aspect: 0.75,
  createdAt: 1,
};

describe('prominent', () => {
  it('keeps subjects at least 40% of the largest', () => {
    expect(prominent([1, 0.5, 0.39, 0.1], (n) => n)).toEqual([1, 0.5]);
  });

  it('keeps everything when the list is empty', () => {
    expect(prominent([], (n) => n)).toEqual([]);
  });
});

describe('migrate', () => {
  it('upgrades a single legacy pose and face', () => {
    const ref = migrate({ ...base, pose: pose(0.5), face: null });
    expect(ref.people).toHaveLength(1);
    expect(ref.faces).toEqual([]);
  });

  it('keeps "never read" faces undefined', () => {
    const ref = migrate({ ...base, pose: pose(0.5) });
    expect(ref.faces).toBeUndefined();
  });

  it('drops background people from a multi-person save', () => {
    const ref = migrate({ ...base, people: [pose(0.5), pose(0.1)] });
    expect(ref.people).toHaveLength(1);
  });

  it('prefers the current multi-person fields', () => {
    const ref = migrate({ ...base, people: [pose(0.5)], pose: pose(0.9), faces: undefined, face: null });
    expect(ref.people).toHaveLength(1);
    expect(bodySize(ref.people[0])).toBeCloseTo(0.5);
  });
});

function bodySize(p: BodyPose): number {
  return bodyAnchor(p).size;
}
