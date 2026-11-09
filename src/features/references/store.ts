import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

import { detectPoseInImage } from '../pose/native';
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

  let pose: BodyPose | null = null;
  let aspect = width > 0 && height > 0 ? width / height : 3 / 4;
  try {
    const result = await detectPoseInImage(new File(dir, file).uri);
    if (result.aspect) aspect = result.aspect;
    pose = result.pose;
  } catch {
    pose = null;
  }

  const ref: ReferencePhoto = { id, file, aspect, createdAt: Date.now(), pose };
  emit([ref, ...items]);
  return ref;
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
