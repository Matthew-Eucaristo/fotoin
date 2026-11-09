import { describe, expect, it } from '@jest/globals';

import { type FacePose, faceAngles, matchFace } from './face';
import { decodeFaces } from './decode';

function face({ dx = 0, scale = 1, noseDx = 0, tilt = 0, noseDy = 0 } = {}): FacePose {
  const cx = 0.5 + dx;
  const cy = 0.45;
  const s = scale;
  return {
    aspect: 3 / 4,
    box: { x: cx - 0.2 * s, y: cy - 0.25 * s, w: 0.4 * s, h: 0.5 * s },
    eyes: [
      { x: cx - 0.08 * s, y: cy - 0.08 * s - tilt },
      { x: cx + 0.08 * s, y: cy - 0.08 * s + tilt },
    ],
    nose: { x: cx + noseDx, y: cy + 0.02 * s + noseDy },
    mouth: [
      { x: cx - 0.06 * s, y: cy + 0.12 * s },
      { x: cx + 0.06 * s, y: cy + 0.12 * s },
    ],
  };
}

describe('matchFace', () => {
  it('holds when the face matches', () => {
    const r = matchFace(face(), face());
    expect(r.score).toBeGreaterThan(0.95);
    expect(r.hint).toBe('hold');
  });

  it('asks to step back when the face is too big', () => {
    expect(matchFace(face({ scale: 1.4 }), face()).hint).toBe('stepBack');
  });

  it('asks the subject to turn when the head is turned the wrong way', () => {
    // Reference looks to screen-right, subject looks straight: turn right.
    expect(matchFace(face(), face({ noseDx: 0.05 })).hint).toBe('turnRight');
  });

  it('asks to tilt the head when roll differs', () => {
    expect(matchFace(face({ tilt: 0.03 }), face()).hint).toBe('tiltHeadLeft');
  });

  it('asks to raise the chin when the head is lowered', () => {
    expect(matchFace(face({ noseDy: 0.05 }), face()).hint).toBe('chinUp');
  });

  it('returns findPerson without a live face', () => {
    expect(matchFace(null, face()).hint).toBe('findPerson');
  });
});

describe('decodeFaces', () => {
  const block = [0.3, 0.2, 0.4, 0.5, 0.6, 0.35, 0.4, 0.35, 0.5, 0.45, 0.58, 0.55, 0.42, 0.55];

  it('orders eyes and mouth corners left to right', () => {
    const [f] = decodeFaces([0.75, 1, ...block]);
    expect(f.eyes[0].x).toBeLessThan(f.eyes[1].x);
    expect(f.mouth[0].x).toBeLessThan(f.mouth[1].x);
    expect(faceAngles(f).yaw).toBeCloseTo(0, 5);
  });

  it('decodes several faces and ignores truncated blocks', () => {
    expect(decodeFaces([0.75, 2, ...block, ...block])).toHaveLength(2);
    expect(decodeFaces([0.75, 2, ...block])).toHaveLength(1);
    expect(decodeFaces([0.75, 0])).toHaveLength(0);
  });
});
