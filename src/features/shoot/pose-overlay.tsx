import { StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { type BodyPose, LIMBS } from '@/features/pose/pose';

/** Reference skeleton (target) and live skeleton, both normalised to the viewport. */
export function PoseOverlay({
  target,
  live,
  targetColor,
  liveColor,
}: {
  target: BodyPose | null;
  live: BodyPose | null;
  targetColor: string;
  liveColor: string;
}) {
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none" pointerEvents="none">
      {target ? <Skeleton pose={target} color={targetColor} width={0.018} /> : null}
      {live ? <Skeleton pose={live} color={liveColor} width={0.011} /> : null}
    </Svg>
  );
}

function Skeleton({ pose, color, width }: { pose: BodyPose; color: string; width: number }) {
  const { joints } = pose;
  return (
    <>
      {LIMBS.map(([a, b]) => {
        const pa = joints[a];
        const pb = joints[b];
        if (!pa || !pb) return null;
        return (
          <Line
            key={`${a}-${b}`}
            x1={pa.x}
            y1={pa.y}
            x2={pb.x}
            y2={pb.y}
            stroke={color}
            strokeWidth={width}
            strokeLinecap="round"
          />
        );
      })}
      {joints.nose ? <Circle cx={joints.nose.x} cy={joints.nose.y} r={width * 2} fill={color} /> : null}
    </>
  );
}
