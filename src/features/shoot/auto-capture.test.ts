import { describe, expect, it } from '@jest/globals';

import { autoCaptureTick, type AutoCaptureState } from './auto-capture';

type Options = Parameters<typeof autoCaptureTick>[1];
const opts = (over: Partial<Options> = {}): Options => ({
  enabled: true,
  busy: false,
  score: 0.9,
  now: 1000,
  threshold: 0.8,
  holdMs: 700,
  ...over,
});

describe('autoCaptureTick', () => {
  it('starts a hold on the first matched frame', () => {
    const state: AutoCaptureState = { matchedSince: null };
    expect(autoCaptureTick(state, opts())).toEqual({ fire: false, started: true });
    expect(state.matchedSince).toBe(1000);
  });

  it('waits for the full hold before firing', () => {
    const state: AutoCaptureState = { matchedSince: 1000 };
    expect(autoCaptureTick(state, opts({ now: 1699 })).fire).toBe(false);
    expect(autoCaptureTick(state, opts({ now: 1700 })).fire).toBe(true);
    expect(state.matchedSince).toBeNull();
  });

  it('cancels the hold when the score drops', () => {
    const state: AutoCaptureState = { matchedSince: 1000 };
    expect(autoCaptureTick(state, opts({ score: 0.5, now: 1700 }))).toEqual({ fire: false, started: false });
    expect(state.matchedSince).toBeNull();
  });

  it('does nothing while disabled or busy', () => {
    const state: AutoCaptureState = { matchedSince: null };
    expect(autoCaptureTick(state, opts({ enabled: false }))).toEqual({ fire: false, started: false });
    expect(autoCaptureTick(state, opts({ busy: true }))).toEqual({ fire: false, started: false });
    expect(state.matchedSince).toBeNull();
  });

  it('needs a fresh hold after firing again', () => {
    const state: AutoCaptureState = { matchedSince: 1000 };
    expect(autoCaptureTick(state, opts({ now: 1700 })).fire).toBe(true);
    expect(autoCaptureTick(state, opts({ now: 1701 }))).toEqual({ fire: false, started: true });
  });
});
