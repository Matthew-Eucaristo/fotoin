import { describe, expect, it } from '@jest/globals';

import type { FacePose } from './face';
import { referenceMode, referencePeopleCount } from './mode';
import type { BodyPose } from './pose';

const torso = (): BodyPose => ({
  aspect: 0.75,
  joints: {
    leftShoulder: { x: 0.4, y: 0.3 },
    rightShoulder: { x: 0.6, y: 0.3 },
    leftHip: { x: 0.4, y: 0.6 },
    rightHip: { x: 0.6, y: 0.6 },
  },
});

const partial = (): BodyPose => ({ aspect: 0.75, joints: { nose: { x: 0.5, y: 0.2 } } });

const face = (): FacePose => ({
  aspect: 0.75,
  box: { x: 0.3, y: 0.2, w: 0.4, h: 0.5 },
  eyes: [
    { x: 0.4, y: 0.4 },
    { x: 0.6, y: 0.4 },
  ],
  nose: { x: 0.5, y: 0.5 },
  mouth: [
    { x: 0.45, y: 0.6 },
    { x: 0.55, y: 0.6 },
  ],
});

describe('referenceMode', () => {
  it('uses bodies when every person has a torso', () => {
    const ref = { people: [torso(), torso()], faces: [face(), face()] };
    expect(referenceMode(ref)).toBe('body');
    expect(referencePeopleCount(ref)).toBe(2);
  });

  it('falls back to faces for close-ups without torsos', () => {
    const ref = { people: [partial()], faces: [face()] };
    expect(referenceMode(ref)).toBe('face');
    expect(referencePeopleCount(ref)).toBe(1);
  });

  it('uses any usable body when there are no faces', () => {
    const ref = { people: [partial(), torso()] };
    expect(referenceMode(ref)).toBe('body');
    expect(referencePeopleCount(ref)).toBe(2);
  });

  it('is none when there is nothing to match', () => {
    const ref = { people: [partial()] };
    expect(referenceMode(ref)).toBe('none');
    expect(referencePeopleCount(ref)).toBe(0);
  });
});
