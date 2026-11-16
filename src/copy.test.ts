import { describe, expect, it } from '@jest/globals';

import { hintText } from './copy';
import type { MatchResult } from './features/pose/matcher';

const result = (over: Partial<MatchResult>): MatchResult => ({
  score: 0,
  poseScore: 0,
  placementScore: 0,
  hint: 'hold',
  ...over,
});

describe('hintText', () => {
  it('names the left and right person in a pair', () => {
    expect(hintText(result({ hint: 'fixRightArm', person: 0, people: 2 }))).toBe('Orang kiri: tangan kanan belum pas');
    expect(hintText(result({ hint: 'fixRightArm', person: 1, people: 2 }))).toBe('Orang kanan: tangan kanan belum pas');
  });

  it('names the middle person in a trio', () => {
    expect(hintText(result({ hint: 'chinUp', person: 1, people: 3 }))).toBe('Orang tengah: angkat dagu sedikit');
  });

  it('uses an ordinal for larger groups', () => {
    expect(hintText(result({ hint: 'spreadApart', person: 3, people: 4 }))).toBe('Orang ke-4: minta mereka berdiri lebih berjauhan');
  });

  it('formats the missing-people hint with the expected count', () => {
    expect(hintText(result({ hint: 'needMorePeople', people: 3 }))).toBe('Perlu 3 orang di frame');
  });

  it('returns the plain hint for a single person', () => {
    expect(hintText(result({ hint: 'stepBack' }))).toBe('Mundur sedikit');
  });
});
