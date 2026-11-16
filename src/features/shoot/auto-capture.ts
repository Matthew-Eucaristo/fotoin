export type AutoCaptureState = { matchedSince: number | null };

export type AutoCaptureTick = {
  fire: boolean;
  started: boolean;
};

export function autoCaptureTick(
  state: AutoCaptureState,
  {
    enabled,
    busy,
    score,
    now,
    threshold,
    holdMs,
  }: {
    enabled: boolean;
    busy: boolean;
    score: number;
    now: number;
    threshold: number;
    holdMs: number;
  },
): AutoCaptureTick {
  if (!enabled || busy) return { fire: false, started: false };
  if (score < threshold) {
    state.matchedSince = null;
    return { fire: false, started: false };
  }
  if (state.matchedSince === null) {
    state.matchedSince = now;
    return { fire: false, started: true };
  }
  if (now - state.matchedSince >= holdMs) {
    state.matchedSince = null;
    return { fire: true, started: false };
  }
  return { fire: false, started: false };
}
