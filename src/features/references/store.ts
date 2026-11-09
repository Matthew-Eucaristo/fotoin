import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

import type { FacePose } from '../pose/face';
import { detectFaceInImage, detectPoseInImage } from '../pose/native';
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
  /** Null when nobody was found; the ghost overlay still works. */
  pose: BodyPose | null;
  /** Largest face, used for close-ups where the body is not visible. */
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
      items = JSON.parse(indexFile.textSync()) as ReferencePhoto[];
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
  const [{ pose, aspect }, face] = await Promise.all([readPose(file, fallbackAspect), readFace(file)]);
  const ref: ReferencePhoto = { id, file, aspect, createdAt: Date.now(), pose, face };
  emit([ref, ...items]);
  return ref;
}

/**
 * Reads the pose, trying twice: on Android the first ML Kit run after launch
 * can come back without confident joints while the model warms up.
 */
async function readPose(file: string, fallbackAspect: number): Promise<{ pose: BodyPose | null; aspect: number }> {
  let aspect = fallbackAspect;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await detectPoseInImage(new File(dir, file).uri);
      aspect = result.aspect ?? aspect;
      if (result.pose) return { pose: result.pose, aspect };
    } catch (error) {
      console.warn('Pose detection failed', error);
    }
  }
  return { pose: null, aspect };
}

async function readFace(file: string): Promise<FacePose | null> {
  try {
    return await detectFaceInImage(new File(dir, file).uri);
  } catch (error) {
    console.warn('Face detection failed', error);
    return null;
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
  const needBody = !ref.pose;
  const needFace = ref.face === undefined || (!ref.face && !ref.pose);
  if (!needBody && !needFace) return ref;

  const [body, face] = await Promise.all([
    needBody ? readPose(ref.file, ref.aspect) : { pose: ref.pose, aspect: ref.aspect },
    needFace ? readFace(ref.file) : (ref.face ?? null),
  ]);
  const updated: ReferencePhoto = { ...ref, pose: body.pose, aspect: body.aspect, face };
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
