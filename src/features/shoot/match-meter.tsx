import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { copy, hintText } from '@/copy';
import type { MatchResult } from '@/features/pose/matcher';
import { colors, scoreColor, type } from '@/theme';
import { Glass } from '@/ui/glass';

const SIZE = 40;
const STROKE = 4;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

/** Glass pill: score ring + the one thing to fix next. */
export function MatchMeter({ result, enabled }: { result: MatchResult; enabled: boolean }) {
  const color = enabled ? scoreColor(result.score) : colors.inkMuted;
  const progress = enabled ? result.score : 0;
  return (
    <Glass style={styles.pill}>
      <View style={styles.ring}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(247,247,247,0.2)" strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke={color}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={CIRC * (1 - progress)}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <Text style={styles.percent}>{enabled ? Math.round(result.score * 100) : '–'}</Text>
      </View>
      <Text
        style={styles.hint}
        numberOfLines={2}
        accessibilityLiveRegion="polite"
        accessibilityRole="text"
      >
        {enabled ? hintText(result) : copy.holdToPeek}
      </Text>
    </Glass>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 6,
    paddingRight: 18,
    paddingVertical: 6,
    borderRadius: 999,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  ring: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  percent: {
    position: 'absolute',
    ...type.caption,
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  hint: { ...type.label, color: colors.ink, flexShrink: 1 },
});
