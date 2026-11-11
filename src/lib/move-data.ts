import bodaTop from "@/assets/map-boda.png";
import carTop from "@/assets/map-car.png";
import tuktukTop from "@/assets/map-tuktuk.png";
import boda from "@/assets/vehicle-boda.png";
import car from "@/assets/vehicle-car.png";
import tuktuk from "@/assets/vehicle-tuktuk.png";

export type VehicleId = "boda" | "tuktuk" | "car";

export interface Vehicle {
  id: VehicleId;
  name: string;
  tagline: string;
  image: string;
  /** Seen-from-above picture used on the map. */
  mapIcon: string;
  /** Map icon width in px. */
  mapWidth: number;
  /** Most passengers it carries. */
  seats: number;
  /** Fare = base + perKm × road km, never below minimum, rounded to UGX 500. */
  base: number;
  perKm: number;
  minimum: number;
}

export const VEHICLES: Vehicle[] = [
  { id: "boda", name: "Boda Boda", tagline: "Motorcycle · quickest", image: boda, mapIcon: bodaTop, mapWidth: 11, seats: 1, base: 1000, perKm: 500, minimum: 1000 },
  { id: "tuktuk", name: "Tuk Tuk", tagline: "Up to 3 people", image: tuktuk, mapIcon: tuktukTop, mapWidth: 13, seats: 3, base: 1500, perKm: 700, minimum: 2000 },
  { id: "car", name: "Car", tagline: "Comfort · up to 4", image: car, mapIcon: carTop, mapWidth: 17, seats: 4, base: 4000, perKm: 1500, minimum: 6000 },
];

export const isVehicleId = (id: unknown): id is VehicleId => VEHICLES.some((v) => v.id === id);
export const vehicleById = (id: VehicleId | string) => VEHICLES.find((v) => v.id === id) ?? VEHICLES[0]!;

/** Fares move in steps of UGX 500 (the smallest note-and-coin step riders use). */
export const FARE_STEP = 500;
const roundFare = (n: number) => Math.max(FARE_STEP, Math.round(n / FARE_STEP) * FARE_STEP);

/** Roads in Gulu are ~30% longer than a straight line; used until Google's real route arrives. */
export const estimateRoadM = (straightM: number) => straightM * 1.3;

/** Recommended fare for a whole trip (not per seat) over a road distance in metres. */
export function recommendedFare(vehicle: VehicleId | string, roadM: number) {
  const v = vehicleById(vehicle);
  const km = Math.max(0, roadM) / 1000;
  return Math.max(v.minimum, roundFare(v.base + v.perKm * km));
}

/** Lowest fare a passenger may name: 70% of the recommended fare, never below the vehicle's minimum. */
export const lowestFare = (vehicle: VehicleId | string, recommended: number) =>
  Math.max(vehicleById(vehicle).minimum, roundFare(recommended * 0.7));

export type { Place } from "./geo";
import type { Place } from "./geo";

/** Common pickup points in Gulu City, Northern Uganda. */
export const PICKUPS: Place[] = [
  { id: "gulu-market", short: "Gulu Main Market", name: "Gulu Main Market", area: "Jomo Kenyatta Road, Gulu", lng: 32.3007, lat: 2.77249, kind: "poi" },
  { id: "gulu-buspark", short: "Gulu Bus Park", name: "Gulu Bus Park", area: "Queen's Lane, Gulu", lng: 32.29919, lat: 2.77096, kind: "poi" },
  { id: "gulu-referral", short: "Gulu Referral Hospital", name: "Gulu Regional Referral Hospital", area: "Awere Road, Gulu", lng: 32.29857, lat: 2.77734, kind: "poi" },
];

/** Popular destinations around Gulu, shown before the passenger types. */
export const PLACES: Place[] = [
  { id: "gulu-university", short: "Gulu University", name: "Gulu University", area: "Laroo-Pece, Gulu", lng: 32.3169, lat: 2.78898, kind: "poi" },
  { id: "lacor-hospital", short: "Lacor Hospital", name: "St. Mary's Hospital Lacor", area: "Gulu - Nimule Road, Lacor", lng: 32.2149, lat: 2.77458, kind: "poi" },
  { id: "pece-stadium", short: "Pece Stadium", name: "Pece War Memorial Stadium", area: "Lumumba Avenue, Gulu", lng: 32.30905, lat: 2.7702, kind: "poi" },
  { id: "layibi", short: "Layibi", name: "Layibi", area: "Layibi Division, Gulu", lng: 32.29671, lat: 2.74065, kind: "area" },
  { id: "unyama", short: "Unyama", name: "Unyama", area: "Gulu", lng: 32.33814, lat: 2.81699, kind: "area" },
  { id: "lacor", short: "Lacor", name: "Lacor", area: "Gulu", lng: 32.24775, lat: 2.76767, kind: "area" },
  ...PICKUPS,
];

/** Ugandan shillings, e.g. "UGX 3,500". */
export const ugx = (n: number) => `UGX ${Math.round(n).toLocaleString("en-US")}`;

/** How an offer compares to the passenger's named price. */
export function offerLabel(offer: number, myPrice: number) {
  const diff = offer - myPrice;
  if (diff === 0) return { tone: "match" as const, text: "Matches your offer" };
  if (diff > 0) return { tone: "above" as const, text: `${ugx(diff)} above your offer` };
  return { tone: "match" as const, text: `${ugx(-diff)} below your offer` };
}
