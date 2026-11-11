import { useEffect, useState } from "react";
import type { LngLat } from "./geo";

/** One shared GPS watch for the whole app, started while anything is listening. */
export interface Fix {
  at: LngLat;
  accuracy: number;
  time: number;
}

let last: Fix | null = null;
let error = "";
let watchId: number | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function start() {
  if (watchId !== null || typeof navigator === "undefined" || !("geolocation" in navigator)) return;
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      last = { at: [p.coords.longitude, p.coords.latitude], accuracy: p.coords.accuracy, time: Date.now() };
      error = "";
      emit();
    },
    (e) => {
      error = e.code === e.PERMISSION_DENIED ? "Location is turned off for this app." : "Couldn't find your location yet.";
      emit();
    },
    { enableHighAccuracy: true, maximumAge: 5_000, timeout: 30_000 },
  );
}

function stop() {
  if (watchId === null) return;
  navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

/** Live position of this phone while `enabled` (null until the first fix). */
export function useMyLocation(enabled = true) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const l = () => force((n) => n + 1);
    listeners.add(l);
    start();
    return () => {
      listeners.delete(l);
      if (!listeners.size) stop();
    };
  }, [enabled]);
  return { fix: enabled ? last : null, error: enabled ? error : "" };
}

/** A single position, reusing a fresh one if we already have it. */
export function locateOnce(maxAgeMs = 20_000): Promise<LngLat> {
  if (last && Date.now() - last.time < maxAgeMs) return Promise.resolve(last.at);
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("This device can't share its location"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        last = { at: [p.coords.longitude, p.coords.latitude], accuracy: p.coords.accuracy, time: Date.now() };
        emit();
        resolve(last.at);
      },
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? "Location is turned off for this app." : "Couldn't find your location.")),
      { enableHighAccuracy: true, maximumAge: maxAgeMs, timeout: 15_000 },
    );
  });
}

/**
 * Decide whether a new position is worth sending to the other person:
 * at least `minMs` since the last send and moved `minM` metres, or `maxMs` since the last send regardless.
 */
export function shouldSend(
  prev: { at: LngLat; time: number } | null,
  next: { at: LngLat; time: number },
  distance: (a: LngLat, b: LngLat) => number,
  { minMs = 3_000, minM = 8, maxMs = 30_000 } = {},
) {
  if (!prev) return true;
  const dt = next.time - prev.time;
  if (dt >= maxMs) return true;
  return dt >= minMs && distance(prev.at, next.at) >= minM;
}
