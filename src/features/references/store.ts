import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

import { faceAnchor, type FacePose } from '../pose/face';
import { bodyAnchor } from '../pose/matcher';
import { detectFacesInImage, detectPeopleInImage } from '../pose/native';
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
type LegacyReference = Omit<ReferencePhoto, 'people' | 'faces'> & {
  people?: BodyPose[];
  faces?: FacePose[];
  pose?: BodyPose | null;
  face?: FacePose | null;
};



const dir = new Directory(Paths.document, 'references');
const indexFile = new File(dir, 'index.json');

let items: ReferencePhoto[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function emit(next: ReferencePhoto[]) {
  items = next;
  indexFile.write(JSON.stringify(next));
  listeners.forEach((l) => l());
}

function load() {
  if (loaded) return;
  loaded = true;
  if (!dir.exists) dir.create({ intermediates: true });
  if (indexFile.exists) {
    try {
      items = (JSON.parse(indexFile.textSync()) as LegacyReference[]).map(migrate);
    } catch {
      items = [];
    }
  }
}

export function referenceUri(ref: ReferencePhoto): string {
  return new File(dir, ref.file).uri;
}

export function getReference(id: string): ReferencePhoto | undefined {
  load();
  return items.find((r) => r.id === id);
}

/** Copies the picked image into app storage and reads its pose once. */
export async function addReference(sourceUri: string, width: number, height: number): Promise<ReferencePhoto> {
  load();
  const id = Date.now().toString(36);
  const source = new File(sourceUri);
  const ext = source.extension || '.jpg';
  const file = `${id}${ext}`;
  source.copy(new File(dir, file));

  const fallbackAspect = width > 0 && height > 0 ? width / height : 3 / 4;
  const [{ people, aspect }, faces] = await Promise.all([readPeople(file, fallbackAspect), readFaces(file)]);
  const ref: ReferencePhoto = { id, file, aspect, createdAt: Date.now(), people, faces };
  emit([ref, ...items]);
  return ref;
}

/** Below this share of the largest subject, people/faces count as background. */
const BACKGROUND_RATIO = 0.4;

/**
 * Drops background subjects (posters, passers-by, people far behind) so the
 * reference only asks for the people who are actually the subject.
 */
function prominent<T>(items: T[], size: (t: T) => number): T[] {
  const largest = Math.max(0, ...items.map(size));
  return items.filter((t) => size(t) >= largest * BACKGROUND_RATIO);
}

function migrate(r: LegacyReference): ReferencePhoto {
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

/**
 * Reads everyone's pose, trying twice: the first detector run after launch can
 * come back empty while the model warms up.
 */
async function readPeople(file: string, fallbackAspect: number): Promise<{ people: BodyPose[]; aspect: number }> {
  let aspect = fallbackAspect;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await detectPeopleInImage(new File(dir, file).uri);
      aspect = result.aspect ?? aspect;
      if (result.people.length > 0) {
        return { people: prominent(result.people, (p) => bodyAnchor(p).size), aspect };
      }
    } catch (error) {
      console.warn('Pose detection failed', error);
    }
  }
  return { people: [], aspect };
}

async function readFaces(file: string): Promise<FacePose[]> {
  try {
    return prominent(await detectFacesInImage(new File(dir, file).uri), (f) => faceAnchor(f).size);
  } catch (error) {
    console.warn('Face detection failed', error);
    return [];
  }
}

/**
 * Fills in what a saved reference is missing: the body pose when none was
 * found, and the face when it was never read (older saves) or nothing at all
 * was found. Runs when a reference is opened.
 */
export async function retryPose(id: string): Promise<ReferencePhoto | undefined> {
  load();
  const ref = items.find((r) => r.id === id);
  if (!ref) return undefined;
  const needBody = ref.people.length === 0;
  const needFaces = ref.faces === undefined || (ref.faces.length === 0 && needBody);
  if (!needBody && !needFaces) return ref;

  const [body, faces] = await Promise.all([
    needBody ? readPeople(ref.file, ref.aspect) : { people: ref.people, aspect: ref.aspect },
    needFaces ? readFaces(ref.file) : (ref.faces ?? []),
  ]);
  const updated: ReferencePhoto = { ...ref, people: body.people, aspect: body.aspect, faces };
  emit(items.map((r) => (r.id === id ? updated : r)));
  return updated;
}

export function removeReference(id: string) {
  load();
  const ref = items.find((r) => r.id === id);
  if (!ref) return;
  const f = new File(dir, ref.file);
  if (f.exists) f.delete();
  emit(items.filter((r) => r.id !== id));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  load();
  return items;
}

export function useReferences(): ReferencePhoto[] {
  return useSyncExternalStore(subscribe, snapshot);
}

export function useReference(id: string): ReferencePhoto | undefined {
  const all = useReferences();
  return all.find((r) => r.id === id);
}
