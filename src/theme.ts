import { Platform } from 'react-native';

/**
 * Dark camera-app tokens: near-black surfaces and a single accent (iOS Camera
 * yellow). System fonts (SF Pro / Roboto) keep the app native.
 */
export const colors = {
  bg: '#0B0B0C',
  surface: '#1A1A1C',
  surfaceHigh: '#2A2A2D',
  ink: '#F5F5F7',
  inkMuted: '#A1A1A6',
  /** The one accent: iOS Camera yellow (shutter-adjacent controls, "on" states). */
  accent: '#FFD60A',
  onAccent: '#111111',
  danger: '#FF453A',
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

/** Score colour: white while improving, accent yellow once matched. */
export function scoreColor(score: number): string {
  'worklet';
  if (score >= 0.8) return colors.accent;
  const t = Math.max(0, Math.min(1, score / 0.8));
  // inkMuted (161,161,166) → white
  const mix = (a: number) => Math.round(a + (255 - a) * t);
  return `rgb(${mix(161)},${mix(161)},${mix(166)})`;
}
