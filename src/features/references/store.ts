import { Directory, File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

import { faceAnchor, type FacePose } from '../pose/face';
import { bodyAnchor } from '../pose/matcher';
import { detectFacesInImage, detectPeopleInImage } from '../pose/native';
import type { BodyPose } from '../pose/pose';
import { type LegacyReference, migrate, prominent, type ReferencePhoto } from './migrate';

export type { ReferencePhoto } from './migrate';

const dir = new Directory(Paths.document, 'references');
const indexFile = new File(dir, 'index.json');
const indexTemp = new File(dir, 'index.json.tmp');

let items: ReferencePhoto[] = [];
let loaded = false;
const listeners = new Set<() => void>();
let persistChain: Promise<void> = Promise.resolve();
let lastId = 0;

function nextId(): string {
  lastId = Math.max(Date.now(), lastId + 1);
  return lastId.toString(36);
}

function persist(next: ReferencePhoto[]): void {
  const json = JSON.stringify(next);
  persistChain = persistChain
    .then(async () => {
      // File.move() mutates the source File's URI to the destination, so each write needs a fresh File.
      const temp = new File(dir, 'index.json.tmp');
      await temp.write(json);
      await temp.move(indexFile, { overwrite: true });
    })
    .catch((error) => console.warn('Failed to save references index', error));
}

function emit(next: ReferencePhoto[]) {
  items = next;
  listeners.forEach((l) => l());
  persist(next);
}

function load() {
  if (loaded) return;
  loaded = true;
  if (!dir.exists) dir.create({ intermediates: true });
  for (const file of [indexFile, indexTemp]) {
    if (!file.exists) continue;
    try {
      items = (JSON.parse(file.textSync()) as LegacyReference[]).map(migrate);
      return;
    } catch (error) {
      console.warn('Unreadable reference index', file.uri, error);
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
  const id = nextId();
  const source = new File(sourceUri);
  const ext = source.extension || '.jpg';
  const file = `${id}${ext}`;
  await source.copy(new File(dir, file));

  const fallbackAspect = width > 0 && height > 0 ? width / height : 3 / 4;
  const [{ people, aspect }, faces] = await Promise.all([readPeople(file, fallbackAspect), readFaces(file)]);
  const ref: ReferencePhoto = { id, file, aspect, createdAt: Date.now(), people, faces };
  emit([ref, ...items]);
  return ref;
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
