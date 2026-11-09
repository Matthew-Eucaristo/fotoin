import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';

import { type BodyPose, LIMBS } from '@/features/pose/pose';

/**
 * Reference skeleton (target) and live skeleton, both normalised to the
 * viewport. Drawn in real pixels so strokes keep their width on any aspect.
 */
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
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h}>
          {target ? <Skeleton pose={target} color={targetColor} stroke={6} size={size} /> : null}
          {live ? <Skeleton pose={live} color={liveColor} stroke={4} size={size} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}

function Skeleton({
  pose,
  color,
  stroke,
  size,
}: {
  pose: BodyPose;
  color: string;
  stroke: number;
  size: { w: number; h: number };
}) {
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
            x1={pa.x * size.w}
            y1={pa.y * size.h}
            x2={pb.x * size.w}
            y2={pb.y * size.h}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
          />
        );
      })}
      {joints.nose ? (
        <Circle cx={joints.nose.x * size.w} cy={joints.nose.y * size.h} r={stroke * 1.4} fill={color} />
      ) : null}
    </>
  );
}
