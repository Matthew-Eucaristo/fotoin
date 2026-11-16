import { Accelerometer } from 'expo-sensors';
import { useEffect, useSyncExternalStore } from 'react';

let smoothed = 0;
let rounded = 0;
let started = false;
let subscription: { remove: () => void } | null = null;
const listeners = new Set<() => void>();

function start() {
  if (started) return;
  started = true;
  Accelerometer.setUpdateInterval(66);
  subscription = Accelerometer.addListener(({ x, y }) => {
    const deg = (Math.atan2(x, Math.abs(y)) * 180) / Math.PI;
    smoothed = smoothed * 0.7 + deg * 0.3;
    const next = Math.round(smoothed * 2) / 2;
    if (next !== rounded) {
      rounded = next;
      listeners.forEach((l) => l());
    }
  });
}

export function getRollDegrees(): number {
  return smoothed;
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      subscription?.remove();
      subscription = null;
      started = false;
    }
  };
}

function snapshot(): number {
  return rounded;
}

export function useRollValue(): number {
  return useSyncExternalStore(subscribe, snapshot);
}

export function useRollSubscription(): void {
  useEffect(() => subscribe(() => {}), []);
}
