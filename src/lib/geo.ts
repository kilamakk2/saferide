/**
 * Pure geography helpers for Gulu City, Northern Uganda (no network calls).
 * Live Google search, place names and routes live in maps.ts.
 */

import { nameScore } from "./gulu-search";

export type LngLat = [number, number];

export const GULU: LngLat = [32.2995, 2.7724];
/** Gulu City plus the surrounding villages of Gulu District (minLng, minLat, maxLng, maxLat). Search never leaves it. */
export const GULU_BBOX: [number, number, number, number] = [32.05, 2.55, 32.55, 3.0];

export const inGulu = ([lng, lat]: LngLat) =>
  lng >= GULU_BBOX[0] && lng <= GULU_BBOX[2] && lat >= GULU_BBOX[1] && lat <= GULU_BBOX[3];

export type PlaceKind = "poi" | "road" | "area" | "address" | "city" | "pin" | "me";

export interface Place {
  id: string;
  short: string;
  name: string;
  area: string;
  lng: number;
  lat: number;
  kind?: PlaceKind;
}

export const lngLat = (p: Pick<Place, "lng" | "lat">): LngLat => [p.lng, p.lat];

/** Great-circle distance in metres. */
export function distanceM(a: LngLat, b: LngLat) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Compass bearing from a to b in degrees (0 = north, clockwise). */
export function bearing(a: LngLat, b: LngLat) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x =
    Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) -
    Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Point a given distance (m) from origin in a compass direction. */
export function offsetPoint(origin: LngLat, metres: number, deg: number): LngLat {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const br = toRad(deg);
  const lat1 = toRad(origin[1]);
  const lng1 = toRad(origin[0]);
  const d = metres / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(br));
  const lng2 = lng1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [(lng2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

/** Position and heading at fraction t (0–1) along a polyline. */
export function pointAlong(line: LngLat[], t: number): { at: LngLat; heading: number } {
  if (line.length < 2) return { at: line[0] ?? GULU, heading: 0 };
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < line.length; i++) {
    const d = distanceM(line[i - 1]!, line[i]!);
    seg.push(d);
    total += d;
  }
  let target = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < seg.length; i++) {
    const d = seg[i]!;
    const a = line[i]!;
    const b = line[i + 1]!;
    if (target <= d || i === seg.length - 1) {
      const f = d === 0 ? 0 : Math.min(1, target / d);
      return { at: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], heading: bearing(a, b) };
    }
    target -= d;
  }
  return { at: line[line.length - 1]!, heading: 0 };
}

export const formatDistance = (m: number) => (m < 950 ? `${Math.max(50, Math.round(m / 50) * 50)} m` : `${(m / 1000).toFixed(1)} km`);
export const formatMinutes = (s: number) => `${Math.max(1, Math.round(s / 60))} min`;

/* ------------------------------------------------------------------ */
/* Search results                                                      */
/* ------------------------------------------------------------------ */

/** Merge results from several sources: Gulu only, no duplicates, best name matches first, then nearest. */
export function rankPlaces(places: Place[], q: string, near: LngLat, limit = 25) {
  const out: Place[] = [];
  for (const p of places) {
    if (!inGulu(lngLat(p))) continue;
    const a = p.name.toLowerCase();
    const dup = out.some((o) => {
      const b = o.name.toLowerCase();
      const d = distanceM(lngLat(o), lngLat(p));
      if (o.kind === "road" || p.kind === "road") return (a === b || o.area.toLowerCase().startsWith(`${a} ·`)) && d < 15000;
      // "Bomah" next to "Bomah Hotel" is the same place.
      return (a === b || o.area.toLowerCase().startsWith(`${a} ·`) || ((a.includes(b) || b.includes(a)) && Math.min(a.length, b.length) >= 4)) && d < 150;
    });
    if (!dup) out.push(p);
  }
  return out
    .map((p, i) => ({ p, i, s: nameScore(p.name, q) ?? 9, d: distanceM(near, lngLat(p)) }))
    .sort((a, b) => a.s - b.s || a.d - b.d || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);
}

/** Google place types → how the app labels and ranks a result. */
export function googleKind(types: string[]): PlaceKind {
  if (types.includes("route")) return "road";
  if (types.includes("locality")) return "city";
  if (types.some((t) => t.startsWith("sublocality") || t === "neighborhood" || t === "political")) return "area";
  if (types.includes("street_address") || types.includes("premise")) return "address";
  return "poi";
}

export function fromGoogle(g: { id: string; name: string; address: string; type: string; types: string[]; lat: number; lng: number }): Place {
  const address = g.address
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && s.toLowerCase() !== g.name.toLowerCase() && s !== "Uganda")
    .join(", ");
  return {
    id: `g-${g.id}`,
    short: g.name,
    name: g.name,
    area: [g.type, address || "Gulu"].filter(Boolean).join(" · "),
    lng: g.lng,
    lat: g.lat,
    kind: googleKind(g.types),
  };
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

/** One turn-by-turn instruction from Google, e.g. "Turn left onto Juba Rd". */
export interface RouteStep {
  instruction: string;
  maneuver: string;
  distance: number;
  start: LngLat;
  end: LngLat;
}

export interface Route {
  coords: LngLat[];
  distance: number;
  duration: number;
  /** False when no road route was found and a straight line is drawn instead. */
  real: boolean;
  steps?: RouteStep[] | undefined;
}

/** Where a point sits relative to a route line. */
export interface AlongRoute {
  /** Metres from the start of the line to the closest point on it. */
  along: number;
  /** Metres from the point to the line (how far off the route). */
  off: number;
  /** Segment index of the closest point. */
  index: number;
  /** The closest point on the line. */
  at: LngLat;
  /** Total line length in metres. */
  total: number;
}

/** Project a point onto a polyline (flat-earth maths, accurate at town scale). */
export function alongRoute(line: LngLat[], p: LngLat): AlongRoute {
  if (line.length === 0) return { along: 0, off: 0, index: 0, at: p, total: 0 };
  if (line.length === 1) return { along: 0, off: distanceM(line[0]!, p), index: 0, at: line[0]!, total: 0 };
  const kx = 111320 * Math.cos((p[1] * Math.PI) / 180);
  const ky = 110540;
  let best = { along: 0, off: Infinity, index: 0, at: line[0]! };
  let run = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const ax = (a[0] - p[0]) * kx;
    const ay = (a[1] - p[1]) * ky;
    const dx = (b[0] - a[0]) * kx;
    const dy = (b[1] - a[1]) * ky;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len2));
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const off = Math.hypot(cx, cy);
    const seg = Math.sqrt(len2);
    if (off < best.off) best = { along: run + t * seg, off, index: i, at: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t] };
    run += seg;
  }
  return { ...best, total: run };
}

/** The part of a route still ahead of a vehicle at `p`, starting where the vehicle is. */
export function trimRoute(line: LngLat[], p: LngLat): LngLat[] {
  if (line.length < 2) return line;
  const a = alongRoute(line, p);
  return [p, a.at, ...line.slice(a.index + 1)];
}

/** Remaining distance and time on a route for a vehicle at `p`. */
export function remainingOn(route: Route, p: LngLat) {
  const a = alongRoute(route.coords, p);
  const left = Math.max(0, a.total - a.along) + a.off;
  const share = a.total > 0 ? Math.min(1, left / a.total) : 1;
  return { distance: left, duration: route.duration * share, off: a.off };
}

/** The next turn ahead of a vehicle at `p`, and how far away it is. */
export function nextStep(route: Route, p: LngLat): { step: RouteStep; in: number } | null {
  const steps = route.steps ?? [];
  if (!steps.length) return null;
  const me = alongRoute(route.coords, p).along;
  // Each step's turn happens where the step starts; the next one is the first still ahead (by 15 m).
  for (const step of steps) {
    const startAt = alongRoute(route.coords, step.start).along;
    if (startAt > me + 15) return { step, in: startAt - me };
  }
  return { step: steps[steps.length - 1]!, in: 0 };
}

/** Decode a Google encoded polyline into [lng, lat] pairs. */
export function decodePolyline(str: string): LngLat[] {
  const out: LngLat[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = str.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && i <= str.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    lat += next();
    lng += next();
    out.push([lng / 1e5, lat / 1e5]);
  }
  return out;
}
