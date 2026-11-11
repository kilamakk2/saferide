import type { RideStage } from "./move-store";

export type RideStatus = "finding" | "accepted" | "here" | "started" | "arrived" | "completed" | "cancelled";

export const ACTIVE_STATUSES: RideStatus[] = ["accepted", "here", "started", "arrived"];

/** Requests older than this stop showing to drivers. */
export const REQUEST_TTL_MS = 20 * 60_000;
/** Drivers who haven't checked in for this long no longer count as online. */
export const ONLINE_TTL_MS = 3 * 60_000;

/**
 * Where the passenger's screen should be for a ride status coming from the database.
 * "reset" means the ride is over and the home screen should start fresh.
 */
export function stageFor(status: RideStatus, current: RideStage): RideStage | "reset" {
  switch (status) {
    case "finding":
      return "finding";
    case "accepted":
      return "arriving";
    case "here":
      return "here";
    case "started":
      return current === "tracking" ? "tracking" : "started";
    case "arrived":
      return "arrived";
    case "completed":
      return current === "arrived" ? "arrived" : "reset";
    case "cancelled":
      return "reset";
  }
}

/** Minutes for a driver to reach the pickup in town traffic (~21 km/h), at least 1. */
export function etaMinutes(distanceM: number) {
  return Math.max(1, Math.round(distanceM / 350));
}

/** A driver's average rating (rated trips only) and number of completed trips. */
export function driverStats(rides: { status: RideStatus; rating: number }[]) {
  const done = rides.filter((r) => r.status === "completed");
  const rated = done.filter((r) => r.rating > 0);
  const rating = rated.length ? Math.round((rated.reduce((s, r) => s + r.rating, 0) / rated.length) * 10) / 10 : null;
  return { rating, rides: done.length };
}

export const isFreshRequest = (r: { status: RideStatus; createdAt: number }, now: number) =>
  r.status === "finding" && now - r.createdAt < REQUEST_TTL_MS;

export const isOnline = (d: { online?: boolean; lastSeen?: number }, now: number) =>
  !!d.online && typeof d.lastSeen === "number" && now - d.lastSeen < ONLINE_TTL_MS;
