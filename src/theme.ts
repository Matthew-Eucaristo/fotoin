import { Platform } from 'react-native';

/**
 * Dark camera-app tokens: one amber call-to-action colour, teal accent,
 * near-black surfaces. System fonts (SF Pro / Roboto) keep the app native.
 */
export const colors = {
  bg: '#121212',
  surface: '#1E1E1E',
  surfaceHigh: '#2A2A2A',
  ink: '#F7F7F7',
  inkMuted: '#A8A8A8',
  amber: '#FFC045',
  onAmber: '#1A1A1A',
  teal: '#2FA7A1',
  danger: '#FF6B5E',
  scrim: 'rgba(0,0,0,0.35)',
} as const;

export const radii = { panel: 28, control: 18, pill: 999 } as const;

export const motion = { fast: 140, normal: 260, slow: 380 } as const;

export const type = {
  largeTitle: { fontSize: 34, fontWeight: '800', letterSpacing: Platform.OS === 'ios' ? 0.2 : 0 },
  title: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  label: { fontSize: 15, fontWeight: '700' },
  caption: { fontSize: 12, fontWeight: '600' },
} as const;

/** Score colour: muted → teal while improving, amber when matched. */
export function scoreColor(score: number): string {
  'worklet';
  if (score >= 0.8) return colors.amber;
  const t = Math.max(0, Math.min(1, score / 0.8));
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  // inkMuted (168,168,168) → teal (47,167,161)
  return `rgb(${mix(168, 47)},${mix(168, 167)},${mix(168, 161)})`;
}
