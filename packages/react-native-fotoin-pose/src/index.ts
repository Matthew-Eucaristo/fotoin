import { NitroModules } from 'react-native-nitro-modules'
import type { FotoinPose as FotoinPoseSpec } from './specs/FotoinPose.nitro'

export type { FotoinPoseSpec }

export const FotoinPose =
  NitroModules.createHybridObject<FotoinPoseSpec>('FotoinPose')
