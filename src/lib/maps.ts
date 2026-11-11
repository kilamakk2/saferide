/**
 * Live map data for Gulu from Google (search, place names, driving routes),
 * plus the bundled Gulu place list as an instant/offline fallback.
 */
import { distanceM, decodePolyline, fromGoogle, GULU, rankPlaces, type LngLat, type Place, type Route } from "./geo";
import { nearestRow, searchRows, type GuluRow } from "./gulu-search";
import { driveRoute, nameSpot, searchGulu } from "./maps.functions";
import { idToken } from "./session";

let guluRows: Promise<GuluRow[]> | null = null;
/** Every named place in the bundled Gulu list, loaded once on first search. */
export function loadGulu(): Promise<GuluRow[]> {
  guluRows ??= import("./gulu-places.json")
    .then((m) => m.default as unknown as GuluRow[])
    .catch((e: unknown) => {
      guluRows = null;
      throw e;
    });
  return guluRows;
}

/** Instant search over the built-in Gulu place list (works offline). */
export async function searchLocal(q: string, near: LngLat = GULU): Promise<Place[]> {
  return searchRows(await loadGulu(), q, near);
}

const searchCache = new Map<string, Promise<Place[]>>();

/** Every Google place in Gulu matching the text. Cached per query to keep lookups low. */
export function searchOnline(q: string, near: LngLat = GULU): Promise<Place[]> {
  const query = q.trim().replace(/\s+/g, " ");
  if (query.length < 2) return Promise.resolve([]);
  const key = query.toLowerCase();
  const hit = searchCache.get(key);
  if (hit) return hit;
  const p = idToken()
    .then((t) => searchGulu({ data: { idToken: t, query, lat: near[1], lng: near[0] } }))
    .then((r) => {
      if (r.error && !r.places.length) throw new Error(r.error);
      return r.places.map(fromGoogle);
    })
    .catch((e: unknown) => {
      searchCache.delete(key);
      throw e;
    });
  searchCache.set(key, p);
  return p;
}

/** Search every place, road, area and village in Gulu. */
export async function searchPlaces(q: string, near: LngLat = GULU): Promise<Place[]> {
  const [online, local] = await Promise.all([
    searchOnline(q, near).catch(() => [] as Place[]),
    searchLocal(q, near).catch(() => [] as Place[]),
  ]);
  return rankPlaces([...online, ...local], q, near);
}

const spotCache = new Map<string, Promise<{ name: string; area: string } | null>>();

/** Name the spot at a coordinate (landmark, street or area). */
export async function reverseGeocode(at: LngLat): Promise<Place> {
  const fallback: Place = { id: `pin-${at[0].toFixed(5)},${at[1].toFixed(5)}`, short: "Pinned location", name: "Pinned location", area: "Gulu", lng: at[0], lat: at[1], kind: "pin" };
  try {
    const hit = nearestRow(await loadGulu(), at, 40);
    if (hit) return { ...hit, id: fallback.id, lng: at[0], lat: at[1], kind: "pin" };
  } catch {
    /* fall through to Google */
  }
  // ~20 m grid so small nudges of the map reuse the last answer.
  const key = `${at[0].toFixed(4)},${at[1].toFixed(4)}`;
  let p = spotCache.get(key);
  if (!p) {
    p = idToken()
      .then((t) => nameSpot({ data: { idToken: t, lat: at[1], lng: at[0] } }))
      .catch(() => null);
    spotCache.set(key, p);
  }
  const spot = await p;
  return spot ? { ...fallback, short: spot.name, name: spot.name, area: spot.area } : fallback;
}

const routeCache = new Map<string, Promise<Route>>();

/** Driving route on real Gulu roads from Google. */
export function getRoute(from: LngLat, to: LngLat): Promise<Route> {
  const key = `${from[0].toFixed(5)},${from[1].toFixed(5)};${to[0].toFixed(5)},${to[1].toFixed(5)}`;
  const hit = routeCache.get(key);
  if (hit) return hit;
  const straight = (): Route => {
    const d = distanceM(from, to);
    return { coords: [from, to], distance: d, duration: d / 8, real: false };
  };
  const p = idToken()
    .then((t) => driveRoute({ data: { idToken: t, from: { lng: from[0], lat: from[1] }, to: { lng: to[0], lat: to[1] } } }))
    .then((r) => {
      const coords = r ? decodePolyline(r.polyline) : [];
      if (!r || coords.length < 2) return straight();
      return { coords, distance: r.distance, duration: r.duration, real: true, steps: r.steps };
    })
    .catch(() => {
      routeCache.delete(key);
      return straight();
    });
  routeCache.set(key, p);
  return p;
}
