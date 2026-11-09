import { FotoinPose } from 'react-native-fotoin-pose';

import { decodeFaces, decodePeople } from './decode';
import type { FacePose } from './face';
import type { BodyPose } from './pose';

/** Bodies in a still image plus its upright aspect (null if unreadable). */
export async function detectPeopleInImage(uri: string): Promise<{ people: BodyPose[]; aspect: number | null }> {
  const values = await FotoinPose.detectInImage(uri);
  return { people: decodePeople(values), aspect: values.length > 0 ? values[0] : null };
}

/** Faces in a still image (for close-ups). */
export async function detectFacesInImage(uri: string): Promise<FacePose[]> {
  return decodeFaces(await FotoinPose.detectFaceInImage(uri));
}

export { decodeFaces, decodePeople, FotoinPose };
