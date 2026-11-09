import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import type { FacePose } from '@/features/pose/face';

/** Close-up guides: face outline, eye line, nose and mouth, for targets and live faces. */
export function FaceOverlay({
  targets,
  live,
  targetColor,
  liveColor,
}: {
  targets: FacePose[];
  live: FacePose[];
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
          {targets.map((face, i) => (
            <FaceMarks key={`t${i}`} face={face} color={targetColor} stroke={3} size={size} dashed />
          ))}
          {live.map((face, i) => (
            <FaceMarks key={`l${i}`} face={face} color={liveColor} stroke={2.5} size={size} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

function FaceMarks({
  face,
  color,
  stroke,
  size,
  dashed = false,
}: {
  face: FacePose;
  color: string;
  stroke: number;
  size: { w: number; h: number };
  dashed?: boolean;
}) {
  const X = (x: number) => x * size.w;
  const Y = (y: number) => y * size.h;
  const { box, eyes, nose, mouth } = face;
  const r = Math.min(box.w * size.w, box.h * size.h) * 0.45;
  return (
    <>
      <Rect
        x={X(box.x)}
        y={Y(box.y)}
        width={box.w * size.w}
        height={box.h * size.h}
        rx={r}
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={dashed ? '10 8' : undefined}
        fill="none"
      />
      <Line x1={X(eyes[0].x)} y1={Y(eyes[0].y)} x2={X(eyes[1].x)} y2={Y(eyes[1].y)} stroke={color} strokeWidth={stroke} />
      <Circle cx={X(eyes[0].x)} cy={Y(eyes[0].y)} r={stroke * 1.6} fill={color} />
      <Circle cx={X(eyes[1].x)} cy={Y(eyes[1].y)} r={stroke * 1.6} fill={color} />
      <Circle cx={X(nose.x)} cy={Y(nose.y)} r={stroke * 1.4} fill={color} />
      <Line
        x1={X(mouth[0].x)}
        y1={Y(mouth[0].y)}
        x2={X(mouth[1].x)}
        y2={Y(mouth[1].y)}
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </>
  );
}
