import { Accelerometer } from 'expo-sensors';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

/** Phone roll in degrees (0 = upright portrait), smoothed, ~15 Hz. */
export function useRoll(onRoll?: (deg: number) => void): number {
  const [roll, setRoll] = useState(0);
  useEffect(() => {
    let smoothed = 0;
    Accelerometer.setUpdateInterval(66);
    const sub = Accelerometer.addListener(({ x, y }) => {
      // Sign conventions differ per platform; |y| keeps upright portrait ≈ 0°.
      const deg = (Math.atan2(x, Math.abs(y)) * 180) / Math.PI;
      smoothed = smoothed * 0.7 + deg * 0.3;
      setRoll(Math.round(smoothed * 2) / 2); // 0.5° steps: fewer renders
      onRoll?.(smoothed);
    });
    return () => sub.remove();
  }, [onRoll]);
  return roll;
}

const LEVEL_TOLERANCE_DEG = 1;

/**
 * iPhone-style viewfinder guides: a rule-of-thirds grid and a level line
 * that rotates with the phone and turns yellow when the shot is straight.
 */
export function ViewfinderGuides({ grid = true }: { grid?: boolean }) {
  const rollDegrees = useRoll();
  const level = Math.abs(rollDegrees) <= LEVEL_TOLERANCE_DEG;
  // Clamp so a strongly tilted phone does not draw a vertical bar.
  const angle = Math.max(-30, Math.min(30, -rollDegrees));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {grid ? (
        <>
          <View style={[styles.v, { left: '33.333%' }]} />
          <View style={[styles.v, { left: '66.666%' }]} />
          <View style={[styles.h, { top: '33.333%' }]} />
          <View style={[styles.h, { top: '66.666%' }]} />
        </>
      ) : null}
      <View style={styles.levelWrap}>
        {level ? (
          <View style={[styles.levelLine, styles.levelOn]} />
        ) : (
          <>
            <View style={[styles.levelRef, styles.levelRefLeft]} />
            <View style={[styles.levelLine, { transform: [{ rotate: `${angle}deg` }] }]} />
            <View style={[styles.levelRef, styles.levelRefRight]} />
          </>
        )}
      </View>
    </View>
  );
}

const LINE = 'rgba(255,255,255,0.35)';

const styles = StyleSheet.create({
  v: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: LINE },
  h: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: LINE },
  levelWrap: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    marginTop: -1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelLine: { width: 72, height: 1.5, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 1 },
  levelOn: { width: 120, backgroundColor: colors.level },
  levelRef: { width: 18, height: 1.5, backgroundColor: 'rgba(255,255,255,0.9)' },
  levelRefLeft: { marginRight: 14 },
  levelRefRight: { marginLeft: 14 },
});
