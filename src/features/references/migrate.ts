import { faceAnchor, type FacePose } from '../pose/face';
import { bodyAnchor } from '../pose/matcher';
import type { BodyPose } from '../pose/pose';

/**
 * A reference photo to recreate. Stored only on this device: Pinterest images
 * are someone else's work, used privately as a guide.
 */
export type ReferencePhoto = {
  id: string;
  /** File name inside the references directory (URIs change across installs). */
  file: string;
  /** Image width / height (upright). */
  aspect: number;
  createdAt: number;
  /** Everyone found, largest first (up to 4). Empty: ghost overlay only. */
  people: BodyPose[];
  /** Faces, largest first; for close-ups. Undefined until first read. */
  faces?: FacePose[];
};

/** Saves before multi-person support stored a single `pose` / `face`. */
export type LegacyReference = Omit<ReferencePhoto, 'people' | 'faces'> & {
  people?: BodyPose[];
  faces?: FacePose[];
  pose?: BodyPose | null;
  face?: FacePose | null;
};

/** Below this share of the largest subject, people/faces count as background. */
export const BACKGROUND_RATIO = 0.4;

/**
 * Drops background subjects (posters, passers-by, people far behind) so the
 * reference only asks for the people who are actually the subject.
 */
export function prominent<T>(items: T[], size: (t: T) => number): T[] {
  const largest = Math.max(0, ...items.map(size));
  return items.filter((t) => size(t) >= largest * BACKGROUND_RATIO);
}

export function migrate(r: LegacyReference): ReferencePhoto {
  const { pose, face, ...rest } = r;
  const people = r.people ?? (pose ? [pose] : []);
  // A legacy `face: null` means "read, none found"; undefined means never read.
  const faces = r.faces ?? (face ? [face] : face === null ? [] : undefined);
  return {
    ...rest,
    people: prominent(people, (p) => bodyAnchor(p).size),
    faces: faces && prominent(faces, (f) => faceAnchor(f).size),
  };
}
