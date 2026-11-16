import { describe, expect, it } from '@jest/globals';

import { decodePeople } from './decode';
import { JOINTS } from './pose';

function bodyBlock(lowConfidenceJoints: number[] = []): number[] {
  const out: number[] = [];
  for (let i = 0; i < JOINTS.length; i++) {
    out.push(0.1 + i * 0.02, 0.2 + i * 0.01, lowConfidenceJoints.includes(i) ? 0.2 : 0.9);
  }
  return out;
}

describe('decodePeople', () => {
  it('drops joints below the confidence threshold', () => {
    const [person] = decodePeople([0.75, 1, ...bodyBlock([12])]);
    expect(Object.keys(person.joints)).toHaveLength(JOINTS.length - 1);
    expect(person.joints.rightAnkle).toBeUndefined();
    expect(person.aspect).toBe(0.75);
  });

  it('clamps joint coordinates into 0..1', () => {
    const block = bodyBlock();
    block[0] = -0.5;
    block[1] = 1.7;
    const [person] = decodePeople([0.75, 1, ...block]);
    expect(person.joints.nose).toEqual({ x: 0, y: 1 });
  });

  it('reads several people and ignores truncated blocks', () => {
    expect(decodePeople([0.75, 2, ...bodyBlock(), ...bodyBlock()])).toHaveLength(2);
    expect(decodePeople([0.75, 2, ...bodyBlock()])).toHaveLength(1);
    expect(decodePeople([0.75, 0])).toHaveLength(0);
    expect(decodePeople([])).toHaveLength(0);
  });

  it('drops a block with fewer than four confident joints', () => {
    const low = bodyBlock([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(decodePeople([0.75, 1, ...low])).toHaveLength(0);
  });
});
