import { type MatchResult, NO_MATCH, placement, type ShotHint } from './matcher';
import type { Point } from './pose';

type Anchor = { center: Point; size: number };
type Matcher<T> = (live: T | null, ref: T, roll: number, poseOnly: boolean) => MatchResult;

const SPACING_TOLERANCE = 0.2;

function groupAnchor(anchors: Anchor[]): Anchor {
  let x = 0;
  let y = 0;
  let size = 0;
  for (const a of anchors) {
    x += a.center.x;
    y += a.center.y;
    size += a.size;
  }
  const n = anchors.length;
  return { center: { x: x / n, y: y / n }, size: size / n };
}

/** Average gap between neighbours (left → right), relative to body/face size. */
function spacing(anchors: Anchor[]): number {
  if (anchors.length < 2) return 0;
  let gap = 0;
  for (let i = 1; i < anchors.length; i++) gap += anchors[i].center.x - anchors[i - 1].center.x;
  const size = groupAnchor(anchors).size || 1e-6;
  return gap / (anchors.length - 1) / size;
}

function matchPairs<T>(
  live: T[],
  ref: T[],
  match: Matcher<T>,
  anchorOf: (t: T) => Anchor,
  roll: number,
): MatchResult {
  const results = live.map((l, i) => match(l, ref[i], roll, true));
  const poseScore = results.reduce((sum, r) => sum + r.poseScore, 0) / results.length;

  const liveAnchors = live.map(anchorOf);
  const refAnchors = ref.map(anchorOf);
  const place = placement(groupAnchor(liveAnchors), groupAnchor(refAnchors), roll);
  const score = Math.min(1, Math.max(0, 0.6 * poseScore + 0.4 * place.score - place.levelPenalty));

  const spacingRatio = spacing(liveAnchors) / (spacing(refAnchors) || 1e-6);
  let hint: ShotHint = 'hold';
  let person: number | undefined;
  if (place.hint) hint = place.hint;
  else if (spacingRatio < 1 - SPACING_TOLERANCE) hint = 'spreadApart';
  else if (spacingRatio > 1 + SPACING_TOLERANCE) hint = 'closeTogether';
  else {
    // The person furthest from their pose gets the hint.
    let worst = -1;
    for (let i = 0; i < results.length; i++) {
      if (results[i].hint === 'hold') continue;
      if (worst < 0 || results[i].poseScore < results[worst].poseScore) worst = i;
    }
    if (worst >= 0) {
      hint = results[worst].hint;
      person = worst;
    }
  }
  return { score, poseScore, placementScore: place.score, hint, person, people: ref.length };
}

/**
 * Matches every person in the reference. One person behaves exactly like the
 * single matchers (largest live person). For groups, the largest live people
 * are paired with the reference left → right (or mirrored, whichever fits),
 * framing is coached once for the whole group, then per person.
 */
export function matchGroup<T>(
  live: T[],
  reference: T[],
  match: Matcher<T>,
  anchorOf: (t: T) => Anchor,
  roll = 0,
): MatchResult {
  if (reference.length === 0) return NO_MATCH;
  if (reference.length === 1) return match(live[0] ?? null, reference[0], roll, false);
  if (live.length < reference.length) {
    return { ...NO_MATCH, hint: live.length === 0 ? 'findPerson' : 'needMorePeople', people: reference.length };
  }
  const byX = (a: T, b: T) => anchorOf(a).center.x - anchorOf(b).center.x;
  // Inputs are largest first: extra live people (passers-by) are dropped.
  const l = live.slice(0, reference.length).sort(byX);
  const r = [...reference].sort(byX);
  const straight = matchPairs(l, r, match, anchorOf, roll);
  // A flipped reference (common on Pinterest) also flips the order of people.
  const flipped = matchPairs(l, [...r].reverse(), match, anchorOf, roll);
  return flipped.poseScore > straight.poseScore ? flipped : straight;
}
