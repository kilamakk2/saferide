import { ArrowRight, Loader2, MapPin, Navigation, Pencil } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppButton } from "@/components/move/AppButton";
import { Avatar } from "@/components/move/Avatar";
import { BottomNav } from "@/components/move/BottomNav";
import { RideMap, type MapMode } from "@/components/ride/RideMap";
import { Switch } from "@/components/ui/switch";
import { distanceM, formatDistance, lngLat, type LngLat, type Place } from "@/lib/geo";
import { PICKUPS, ugx, vehicleById } from "@/lib/move-data";
import { useMove, type DriverSnap } from "@/lib/move-store";
import {
  driverHeartbeat,
  fetchMyRides,
  listenDriverRides,
  listenOpenRides,
  patchRide,
  sendOffer,
  withdrawOffer,
  type RideDoc,
} from "@/lib/rides";
import { ACTIVE_STATUSES, driverStats, etaMinutes, isFreshRequest } from "@/lib/ride-logic";
import { cn } from "@/lib/utils";
import { DriverSetup } from "./DriverSetup";

const HEARTBEAT_MS = 60_000;

/** The driver's side of the app: go online, see real ride requests, send offers and run the trip. */
export function DriverHome() {
  const user = useMove((s) => s.user);
  const [me, setMe] = useState<LngLat | null>(null);
  const [requests, setRequests] = useState<RideDoc[]>([]);
  const [mine, setMine] = useState<RideDoc[]>([]);
  const [sent, setSent] = useState<Record<string, { price: number; base: number }>>({});
  const [stats, setStats] = useState<{ rating: number | null; rides: number }>({ rating: null, rides: 0 });
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [geoError, setGeoError] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelH, setPanelH] = useState(320);

  const online = user.online && !!user.driver;
  const job = mine.find((r) => ACTIVE_STATUSES.includes(r.status)) ?? null;
  const meRef = useRef(me);
  meRef.current = me;
  const jobRef = useRef(job);
  jobRef.current = job;

  useEffect(() => {
    const ro = new ResizeObserver(() => panelRef.current && setPanelH(panelRef.current.clientHeight));
    if (panelRef.current) ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Trips given to this driver, live.
  useEffect(() => {
    if (!user.id) return;
    return listenDriverRides(user.id, setMine);
  }, [user.id]);

  // Rating and trip count from the driver's own completed trips.
  const completed = mine.filter((r) => r.status === "completed").length;
  useEffect(() => {
    if (!user.id) return;
    void fetchMyRides(user.id, "driver")
      .then((r) => setStats(driverStats(r)))
      .catch(() => undefined);
  }, [user.id, completed]);

  // Open requests, only while online.
  useEffect(() => {
    if (!online) {
      setRequests([]);
      return;
    }
    return listenOpenRides(setRequests);
  }, [online]);

  // Real position while online; shared with the passenger during a trip.
  useEffect(() => {
    if (!online || !("geolocation" in navigator)) return;
    let last = 0;
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const at: LngLat = [p.coords.longitude, p.coords.latitude];
        setMe(at);
        setGeoError("");
        if (Date.now() - last < 15_000) return;
        last = Date.now();
        void driverHeartbeat(user.id, true, at).catch(() => undefined);
        const j = jobRef.current;
        if (j && (j.status === "accepted" || j.status === "here" || j.status === "started")) {
          void patchRide(j.id, { driverAt: at }).catch(() => undefined);
        }
      },
      () => setGeoError("Turn on location so passengers can see how far away you are."),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [online, user.id]);

  // Check in every minute so passengers only count drivers who are really there.
  useEffect(() => {
    if (!online) return;
    void driverHeartbeat(user.id, true, meRef.current).catch(() => undefined);
    const t = setInterval(() => void driverHeartbeat(user.id, true, meRef.current).catch(() => undefined), HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [online, user.id]);

  const setOnline = async (on: boolean) => {
    try {
      await driverHeartbeat(user.id, on, meRef.current);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't change your status. Check your connection.");
    }
  };

  const open = useMemo(
    () =>
      requests
        .filter((r) => r.passengerId !== user.id && r.vehicle === user.driver?.vehicle && isFreshRequest(r, now))
        .sort((a, b) => b.createdAt - a.createdAt),
    [requests, user.id, user.driver?.vehicle, now],
  );

  const snap = (): DriverSnap | null =>
    user.driver
      ? {
          id: user.id,
          name: user.name,
          photo: user.photo,
          phone: user.driver.phone,
          car: user.driver.car,
          color: user.driver.color,
          plate: user.driver.plate,
          vehicle: user.driver.vehicle,
          rating: stats.rating,
          rides: stats.rides,
        }
      : null;

  const offer = async (r: RideDoc, price: number) => {
    const driver = snap();
    if (!driver) return;
    setBusy(r.id);
    try {
      const eta = me ? etaMinutes(distanceM(me, lngLat(r.pickup))) : 5;
      await sendOffer(r.id, { driverId: user.id, driver, price, base: r.price, eta, from: me, at: Date.now() });
      setSent((s) => ({ ...s, [r.id]: { price, base: r.price } }));
    } catch (e) {
      console.error(e);
      toast.error("Couldn't send your offer. The request may have closed.");
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async (r: RideDoc) => {
    setSent(({ [r.id]: _, ...rest }) => rest);
    await withdrawOffer(r.id, user.id).catch(() => undefined);
  };

  const advance = async (r: RideDoc, status: RideDoc["status"], extra: Partial<RideDoc> = {}) => {
    setBusy(r.id);
    try {
      await patchRide(r.id, { status, ...extra });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't update the trip. Check your connection.");
    } finally {
      setBusy(null);
    }
  };

  const mePlace: Place = me
    ? { id: "me", short: "You", name: "Your location", area: "", lng: me[0], lat: me[1], kind: "me" }
    : PICKUPS[0]!;
  const mapMode: MapMode = job?.status === "started" ? "tracking" : "idle";

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden bg-map">
      <RideMap
        mode={mapMode}
        pickup={job ? job.pickup : mePlace}
        dropoff={job ? job.dropoff : null}
        pickupLabel={job ? "Pick up passenger" : me ? "You're here" : "Gulu"}
        sheetHeight={panelH}
        tripMs={job?.trip ? Math.max(20_000, job.trip.duration * 1000) : 16_000}
      />

      <div className="absolute inset-x-4 top-safe z-20 mt-3 flex items-center justify-between rounded-full bg-card px-4 py-2.5 shadow-float">
        <span className="flex items-center gap-2 text-[13px] font-semibold">
          <span className={cn("size-2.5 rounded-full", online ? "bg-primary" : "bg-muted-foreground")} />
          {online ? "You're online" : "You're offline"}
        </span>
        <Switch
          checked={online}
          disabled={!user.driver}
          onCheckedChange={(v) => void setOnline(v)}
          aria-label="Go online"
        />
      </div>

      <div ref={panelRef} className="absolute inset-x-0 bottom-0 z-20">
        <div className="max-h-[62vh] overflow-y-auto no-scrollbar rounded-t-3xl bg-card px-5 pb-4 pt-4 shadow-sheet">
          {!user.driver || editing ? (
            <DriverSetup initial={user.driver} onDone={() => setEditing(false)} />
          ) : job ? (
            <JobCard job={job} busy={busy === job.id} onAdvance={advance} />
          ) : !online ? (
            <div className="space-y-3 py-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[15px] font-semibold">Go online to get ride requests</h2>
                  <p className="text-[12px] text-muted-foreground">
                    {vehicleById(user.driver.vehicle).name} · {user.driver.color} {user.driver.car} · {user.driver.plate}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {stats.rating ? `★ ${stats.rating} · ` : ""}
                    {stats.rides} trip{stats.rides === 1 ? "" : "s"} completed
                  </p>
                </div>
                <button aria-label="Edit vehicle" onClick={() => setEditing(true)} className="rounded-full bg-muted p-2">
                  <Pencil className="size-3.5" />
                </button>
              </div>
              <AppButton onClick={() => void setOnline(true)}>Go online</AppButton>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-semibold">
                  {open.length ? `${open.length} ride request${open.length === 1 ? "" : "s"}` : "Waiting for ride requests"}
                </h2>
                <span className="text-[11px] text-muted-foreground">{vehicleById(user.driver.vehicle).name}</span>
              </div>
              {geoError && <p className="rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">{geoError}</p>}
              {open.length === 0 && (
                <p className="py-4 text-center text-[12px] text-muted-foreground">
                  New requests from passengers in Gulu will pop up here. Keep this screen open.
                </p>
              )}
              {open.map((r) => {
                const mine = sent[r.id];
                const offered = mine && mine.base === r.price;
                const away = me ? distanceM(me, lngLat(r.pickup)) : null;
                return (
                  <div key={r.id} className="rounded-xl bg-card p-3 shadow-[0_0_0_1px_var(--border)] animate-fade-up">
                    <div className="flex items-center gap-2">
                      <Avatar src={r.passenger.photo} className="size-8 rounded-full" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{r.passenger.name || "Passenger"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.seats} seat{r.seats > 1 ? "s" : ""} · {r.payment}
                          {away !== null && ` · ${formatDistance(away)} away`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[15px] font-bold">{ugx(r.price)}</p>
                        <p className="text-[10px] text-muted-foreground">{ugx(r.price)}/seat</p>
                      </div>
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-[12px]">
                      <MapPin className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate">{r.pickup.short}</span>
                      <ArrowRight className="size-3 shrink-0" />
                      <span className="truncate">{r.dropoff.short}</span>
                      {r.trip && <span className="shrink-0 text-muted-foreground">· {formatDistance(r.trip.distance)}</span>}
                    </p>
                    {offered ? (
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-primary-soft px-3 py-2 text-[12px] text-primary">
                        <span>Offer of {ugx(mine.price)} sent — waiting for passenger</span>
                        <button className="font-semibold underline" onClick={() => void withdraw(r)}>
                          Withdraw
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <AppButton size="md" disabled={busy === r.id} onClick={() => void offer(r, r.price)}>
                          {busy === r.id ? <Loader2 className="size-4 animate-spin" /> : `Accept ${ugx(r.price)}`}
                        </AppButton>
                        <AppButton size="md" variant="soft" disabled={busy === r.id} onClick={() => void offer(r, r.price + 100)}>
                          Offer {ugx(r.price + 100)}
                        </AppButton>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    </div>
  );
}

function JobCard({
  job,
  busy,
  onAdvance,
}: {
  job: RideDoc;
  busy: boolean;
  onAdvance: (r: RideDoc, status: RideDoc["status"], extra?: Partial<RideDoc>) => Promise<void>;
}) {
  const total = job.price;
  const target = job.status === "started" || job.status === "arrived" ? job.dropoff : job.pickup;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${target.lat},${target.lng}&travelmode=driving`;
  const step =
    job.status === "accepted"
      ? { title: `Pick up ${job.passenger.name || "your passenger"}`, action: "I've arrived at pickup", next: "here" as const }
      : job.status === "here"
        ? { title: "Waiting for your passenger", action: "Start trip", next: "started" as const }
        : job.status === "started"
          ? { title: `Driving to ${job.dropoff.short}`, action: "End trip", next: "arrived" as const }
          : { title: `Collect ${ugx(total)}${job.payment === "Cash" ? " in cash" : ""}`, action: "Finish", next: "completed" as const };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Avatar src={job.passenger.photo} className="size-11 rounded-full" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[15px] font-semibold">{step.title}</h2>
          <p className="text-[11px] text-muted-foreground">
            {job.seats} seat{job.seats > 1 ? "s" : ""} · {ugx(total)} · {job.payment}
          </p>
        </div>
      </div>
      <div className="space-y-1.5 rounded-xl bg-muted px-3 py-2.5 text-[12px]">
        <p className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" /> {job.pickup.name}
        </p>
        <p className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-ink" /> {job.dropoff.name}
        </p>
      </div>
      <a
        href={directions}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 rounded-full bg-muted py-2.5 text-[13px] font-semibold"
      >
        <Navigation className="size-4" /> Directions to {target.short}
      </a>
      <AppButton disabled={busy} onClick={() => void onAdvance(job, step.next)}>
        {busy && <Loader2 className="size-4 animate-spin" />} {step.action}
      </AppButton>
      {(job.status === "accepted" || job.status === "here") && (
        <AppButton variant="ghost" disabled={busy} onClick={() => void onAdvance(job, "cancelled", { cancelledBy: "driver" })}>
          Cancel trip
        </AppButton>
      )}
    </div>
  );
}
