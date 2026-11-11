import { useSyncExternalStore } from "react";
import { PICKUPS, isVehicleId, type VehicleId } from "./move-data";
import type { LngLat, Place } from "./geo";

export type Role = "passenger" | "driver";

/** A driver's vehicle details, saved on their profile. */
export interface DriverInfo {
  vehicle: VehicleId;
  car: string;
  color: string;
  plate: string;
  phone: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role | null;
  photo: string | null;
  driver: DriverInfo | null;
  online: boolean;
}

/** What a passenger sees about the driver who took their ride. */
export interface DriverSnap {
  id: string;
  name: string;
  photo: string | null;
  phone: string;
  car: string;
  color: string;
  plate: string;
  vehicle: VehicleId;
  rating: number | null;
  rides: number;
}

export type RideStage =
  | "idle"
  | "choose"
  | "finding"
  | "arriving"
  | "here"
  | "started"
  | "tracking"
  | "arrived";

export interface Ride {
  stage: RideStage;
  /** The live ride request in the database, once sent. */
  rideId: string | null;
  pickup: Place;
  dropoff: Place | null;
  /** Real road distance (m) and driving time (s) once the route is known. */
  trip: { distance: number; duration: number } | null;
  vehicle: VehicleId;
  /** Passengers travelling (fare is for the whole trip, not per seat). */
  seats: number;
  /** Fare in UGX the passenger names for the whole trip. */
  price: number;
  recommended: number;
  payment: "Cash" | "Card" | "Transfer";
  driverId: string | null;
  driver: DriverSnap | null;
  /** Minutes the driver said they'd take to reach the pickup. */
  eta: number | null;
  /** Driver's last known position. */
  driverAt: LngLat | null;
  extraBags: boolean;
}

interface State {
  user: User;
  ride: Ride;
  permissions: { location: boolean; notifications: boolean };
}

const KEY = "move-naija:v2";

export const emptyRide = (pickup: Place = PICKUPS[0]!): Ride => ({
  stage: "idle",
  rideId: null,
  pickup,
  dropoff: null,
  trip: null,
  vehicle: "boda",
  seats: 1,
  price: 1000,
  recommended: 1000,
  payment: "Cash",
  driverId: null,
  driver: null,
  eta: null,
  driverAt: null,
  extraBags: false,
});

export const emptyUser: User = { id: "", name: "", email: "", phone: "", role: null, photo: null, driver: null, online: false };

const initial: State = {
  user: emptyUser,
  ride: emptyRide(),
  permissions: { location: false, notifications: false },
};

let state: State = initial;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<State>;
      state = { ...initial, ...saved, user: { ...emptyUser, ...saved.user }, ride: { ...emptyRide(), ...saved.ride } };
      if (typeof state.ride.pickup?.lng !== "number" || !isVehicleId(state.ride.vehicle)) state = { ...state, ride: emptyRide() };
    }
  } catch {
    /* ignore corrupt storage */
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full — keep in memory */
  }
}

export function getState() {
  load();
  return state;
}

export function setState(updater: (s: State) => State) {
  load();
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

/** Local-only profile update; use saveProfile() in session.ts to also save it to the account. */
export const setLocalUser = (patch: Partial<User>) =>
  setState((s) => ({ ...s, user: { ...s.user, ...patch } }));

export const updateRide = (patch: Partial<Ride>) =>
  setState((s) => ({ ...s, ride: { ...s.ride, ...patch } }));

export const resetRide = () => setState((s) => ({ ...s, ride: emptyRide(s.ride.pickup) }));

export const resetAll = () => setState(() => initial);

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useMove<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(getState()),
    () => selector(initial),
  );
}
