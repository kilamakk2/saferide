/**
 * Offline, typo-tolerant search over every named place in Gulu
 * (OpenStreetMap snapshot + a few well-known local names the maps lack).
 * Pure functions so it can be unit tested without the network.
 */
import type { LngLat, Place, PlaceKind } from "./geo";

/** [name, subtitle, kind, lng, lat, aliases?] */
export type GuluRow = [string, string, string, number, number, string[]?];

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Light stemming so "customs" finds "custom" and "hotels" finds "hotel". */
const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
const tokens = (s: string) => normalize(s).split(" ").filter(Boolean).map(stem);

function editDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length]!;
}

/** How well one query word matches one name word (lower is better, null = no match). */
function wordScore(q: string, w: string, last: boolean): number | null {
  if (w === q) return 0;
  if (w.startsWith(q) && (last || q.length >= 3)) return 1;
  const max = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  if (max && editDistance(q, w, max) <= max) return 2;
  // Typo while still typing: "kanyag" vs "kanyagoga" is a prefix, "kanyg" vs "kanyagoga" a near-prefix.
  if (max && last && w.length > q.length && editDistance(q, w.slice(0, q.length), max) <= max) return 2.5;
  if (q.length >= 4 && w.includes(q)) return 3;
  return null;
}

/** Score a name against a query; null when some query word is not found. */
export function nameScore(name: string, query: string): number | null {
  const qt = tokens(query);
  if (!qt.length) return null;
  const nt = tokens(name);
  const joined = nt.join("");
  let total = 0;
  for (let i = 0; i < qt.length; i++) {
    const q = qt[i]!;
    let best: number | null = null;
    for (const w of nt) {
      const s = wordScore(q, w, i === qt.length - 1);
      if (s !== null && (best === null || s < best)) best = s;
    }
    // "kanyagoga" vs "kanya goga", "tegwana" vs "te-gwana"
    if (best === null && q.length >= 4 && joined.includes(q)) best = 3;
    if (best === null) return null;
    total += best;
  }
  const nq = qt.join(" ");
  const nn = nt.join(" ");
  if (nn === nq) return -2;
  if (nn.startsWith(nq)) return total - 1;
  return total + Math.max(0, nt.length - qt.length) * 0.1;
}

const KINDS: PlaceKind[] = ["poi", "road", "area", "address", "city", "pin", "me"];
const asKind = (k: string): PlaceKind => (KINDS.includes(k as PlaceKind) ? (k as PlaceKind) : "poi");

export function rowToPlace(r: GuluRow, i: number): Place {
  return { id: `gulu-${i}`, short: r[0], name: r[0], area: r[1], lng: r[3], lat: r[4], kind: asKind(r[2]) };
}

const toRad = (d: number) => (d * Math.PI) / 180;
const fastDist = (a: LngLat, b: LngLat) =>
  Math.hypot((a[0] - b[0]) * 111320 * Math.cos(toRad(a[1])), (a[1] - b[1]) * 110540);

/** Best matching Gulu places for a query, nearest first among equal matches. */
export function searchRows(rows: GuluRow[], query: string, near: LngLat, limit = 25): Place[] {
  if (normalize(query).length < 2) return [];
  const hits: { i: number; s: number; d: number; alias?: string }[] = [];
  rows.forEach((r, i) => {
    let s = nameScore(r[0], query);
    let alias: string | undefined;
    for (const a of r[5] ?? []) {
      const sa = nameScore(a, query);
      if (sa !== null && (s === null || sa < s)) {
        s = sa;
        alias = a;
      }
    }
    if (s === null) return;
    // Areas and roads are what people type most; nudge them up a little.
    const bonus = r[2] === "area" || r[2] === "road" || r[2] === "city" ? -0.3 : 0;
    hits.push({ i, s: s + bonus, d: fastDist(near, [r[3], r[4]]), ...(alias ? { alias } : {}) });
  });
  return hits
    .sort((a, b) => a.s - b.s || a.d - b.d)
    .slice(0, limit)
    .map((h) => {
      const p = rowToPlace(rows[h.i]!, h.i);
      // Show the name the user typed ("Juba Road") with the map's name underneath.
      return h.alias ? { ...p, short: h.alias, name: h.alias, area: `${p.name} · ${p.area}` } : p;
    });
}

/** Named place closest to a point, if one is within `maxM` metres. */
export function nearestRow(rows: GuluRow[], at: LngLat, maxM = 60): Place | null {
  let best = -1;
  let bestD = maxM;
  rows.forEach((r, i) => {
    if (r[2] === "area" || r[2] === "city") return;
    const d = fastDist(at, [r[3], r[4]]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best >= 0 ? rowToPlace(rows[best]!, best) : null;
}
