import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { fb } from "./firebase";
import type { LngLat, Place } from "./geo";
import type { VehicleId } from "./move-data";
import type { DriverSnap, Ride, User } from "./move-store";
import type { RideStatus } from "./ride-logic";

export interface RideDoc {
  id: string;
  passengerId: string;
  passenger: { id: string; name: string; photo: string | null; phone?: string };
  pickup: Place;
  dropoff: Place;
  trip: { distance: number; duration: number } | null;
  vehicle: VehicleId;
  seats: number;
  price: number;
  recommended: number;
  payment: string;
  status: RideStatus;
  driverId: string | null;
  driver: DriverSnap | null;
  eta: number | null;
  driverAt: LngLat | null;
  /** Passenger's live position while the ride is active. */
  passengerAt: LngLat | null;
  rating: number;
  cancelledBy: "passenger" | "driver" | null;
  createdAt: number;
  updatedAt: number;
}

export interface Offer {
  driverId: string;
  driver: DriverSnap;
  price: number;
  /** The fare the passenger was asking when this offer was made. */
  base: number;
  eta: number;
  from: LngLat | null;
  at: number;
}

export interface OnlineDriver {
  id: string;
  name: string;
  photo: string | null;
  vehicle: VehicleId | null;
  at: LngLat | null;
  online: boolean;
  lastSeen: number;
}

const rides = () => collection(fb().db, "rides");
const rideRef = (id: string) => doc(fb().db, "rides", id);

const toRide = (id: string, d: Record<string, unknown>) => ({ id, rating: 0, cancelledBy: null, driverAt: null, passengerAt: null, ...d }) as RideDoc;

export async function createRide(ride: Ride, user: User) {
  if (!ride.dropoff) throw new Error("Choose where you're going first");
  const now = Date.now();
  const ref = await addDoc(rides(), {
    passengerId: user.id,
    passenger: { id: user.id, name: user.name, photo: user.photo, phone: user.phone },
    pickup: ride.pickup,
    dropoff: ride.dropoff,
    trip: ride.trip,
    vehicle: ride.vehicle,
    seats: ride.seats,
    price: ride.price,
    recommended: ride.recommended,
    payment: ride.payment,
    status: "finding",
    driverId: null,
    driver: null,
    eta: null,
    driverAt: null,
    passengerAt: ride.pickup.kind === "me" ? [ride.pickup.lng, ride.pickup.lat] : null,
    rating: 0,
    cancelledBy: null,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export const patchRide = (id: string, patch: Partial<Omit<RideDoc, "id">>) =>
  updateDoc(rideRef(id), { ...patch, updatedAt: Date.now() });

export function listenRide(id: string, cb: (r: RideDoc | null) => void) {
  return onSnapshot(
    rideRef(id),
    (s) => cb(s.exists() ? toRide(s.id, s.data()) : null),
    (e) => console.error("Ride sync failed", e),
  );
}

export function listenOffers(rideId: string, cb: (o: Offer[]) => void) {
  return onSnapshot(
    collection(fb().db, "rides", rideId, "offers"),
    (s) => cb(s.docs.map((d) => d.data() as Offer)),
    (e) => console.error("Offers sync failed", e),
  );
}

export async function clearOffers(rideId: string) {
  const s = await getDocs(collection(fb().db, "rides", rideId, "offers"));
  await Promise.all(s.docs.map((d) => deleteDoc(d.ref)));
}

export const sendOffer = (rideId: string, offer: Offer) =>
  setDoc(doc(fb().db, "rides", rideId, "offers", offer.driverId), offer);

export const withdrawOffer = (rideId: string, driverId: string) =>
  deleteDoc(doc(fb().db, "rides", rideId, "offers", driverId));

/** Passenger takes an offer — fails if another offer was taken or the ride was cancelled first. */
export async function acceptOffer(rideId: string, offer: Offer) {
  await runTransaction(fb().db, async (tx) => {
    const snap = await tx.get(rideRef(rideId));
    if (!snap.exists() || snap.data()["status"] !== "finding") throw new Error("This request is no longer open");
    tx.update(rideRef(rideId), {
      status: "accepted",
      driverId: offer.driverId,
      driver: offer.driver,
      price: offer.price,
      eta: offer.eta,
      driverAt: offer.from,
      updatedAt: Date.now(),
    });
  });
}

/** Open requests every online driver can see. */
export function listenOpenRides(cb: (r: RideDoc[]) => void) {
  return onSnapshot(
    query(rides(), where("status", "==", "finding")),
    (s) => cb(s.docs.map((d) => toRide(d.id, d.data()))),
    (e) => console.error("Requests sync failed", e),
  );
}

/** Rides a driver has been given. */
export function listenDriverRides(driverId: string, cb: (r: RideDoc[]) => void) {
  return onSnapshot(
    query(rides(), where("driverId", "==", driverId)),
    (s) => cb(s.docs.map((d) => toRide(d.id, d.data()))),
    (e) => console.error("Trips sync failed", e),
  );
}

export async function fetchMyRides(uid: string, role: "passenger" | "driver") {
  const s = await getDocs(query(rides(), where(role === "driver" ? "driverId" : "passengerId", "==", uid)));
  return s.docs.map((d) => toRide(d.id, d.data())).sort((a, b) => b.createdAt - a.createdAt);
}

export function listenOnlineDrivers(cb: (d: OnlineDriver[]) => void) {
  return onSnapshot(
    query(collection(fb().db, "users"), where("role", "==", "driver"), where("online", "==", true)),
    (s) =>
      cb(
        s.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            name: typeof x["name"] === "string" ? x["name"] : "",
            photo: typeof x["photo"] === "string" ? x["photo"] : null,
            vehicle: (x["driver"]?.vehicle as VehicleId | undefined) ?? null,
            at: Array.isArray(x["location"]) ? (x["location"] as LngLat) : null,
            online: true,
            lastSeen: typeof x["lastSeen"] === "number" ? x["lastSeen"] : 0,
          };
        }),
      ),
    (e) => console.error("Drivers sync failed", e),
  );
}

/** Driver check-in: online flag, last seen time and (if known) position. */
export const driverHeartbeat = (uid: string, online: boolean, at: LngLat | null) =>
  setDoc(doc(fb().db, "users", uid), { online, lastSeen: Date.now(), ...(at ? { location: at } : {}) }, { merge: true });
