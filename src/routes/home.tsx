import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DriverHome } from "@/components/driver/DriverHome";
import { BottomNav } from "@/components/move/BottomNav";
import { Arrived } from "@/components/ride/Arrived";
import { ChooseRide } from "@/components/ride/ChooseRide";
import { DriverAssigned } from "@/components/ride/DriverAssigned";
import { FindingDriver } from "@/components/ride/FindingDriver";
import { HomeSheet, HomeSheetSkeleton } from "@/components/ride/HomeSheet";
import { RideMap, type MapMode } from "@/components/ride/RideMap";
import { RoutePill } from "@/components/ride/parts";
import { SearchRoute } from "@/components/ride/SearchRoute";
import { PickOnMap } from "@/components/ride/PickOnMap";
import { lngLat, type LngLat } from "@/lib/geo";
import { vehicleById, type Place } from "@/lib/move-data";
import { getState, resetRide, updateRide, useMove } from "@/lib/move-store";
import { acceptOffer, createRide, listenRide, patchRide, type Offer } from "@/lib/rides";
import { stageFor } from "@/lib/ride-logic";
import { useOnlineDrivers } from "@/lib/use-drivers";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/home")({
  head: () => pageHead("Book a ride", "See nearby buses, mini buses and taxis in Gulu and name your own fare."),
  component: Home,
});

const TOP = 48;

function Home() {
  const role = useMove((s) => s.user.role);
  return role === "driver" ? <DriverHome /> : <PassengerHome />;
}

function PassengerHome() {
  const ride = useMove((s) => s.ride);
  const online = useOnlineDrivers(ride.stage === "idle");
  const driverMarkers = useMemo(
    () =>
      (online ?? []).flatMap((d) =>
        d.at ? [{ id: d.id, at: d.at, kind: (d.vehicle === "taxi" ? "car" : "bus") as "bus" | "car" }] : [],
      ),
    [online],
  );
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [search, setSearch] = useState<null | { all: boolean }>(null);
  const [tripDetails, setTripDetails] = useState(false);
  const [picking, setPicking] = useState<null | { hint?: string | undefined }>(null);
  const [pinAt, setPinAt] = useState<LngLat | null>(null);
  const pickRef = useRef<HTMLDivElement>(null);
  const [pickH, setPickH] = useState(240);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [rootH, setRootH] = useState(800);
  const [panelH, setPanelH] = useState(320);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (rootRef.current) setRootH(rootRef.current.clientHeight);
      if (panelRef.current) setPanelH(panelRef.current.clientHeight);
      if (pickRef.current) setPickH(pickRef.current.clientHeight);
    });
    if (rootRef.current) ro.observe(rootRef.current);
    if (panelRef.current) ro.observe(panelRef.current);
    if (pickRef.current) ro.observe(pickRef.current);
    return () => ro.disconnect();
  }, [ride.stage, picking]);

  const pickup = ride.pickup;
  const dropoff = ride.dropoff;

  const pick = (p: Place) => {
    setSearch(null);
    setPicking(null);
    const bus = vehicleById("bus");
    updateRide({ dropoff: p, stage: "choose", vehicle: "bus", price: bus.pricePerSeat, recommended: bus.pricePerSeat, seats: 1 });
  };

  // The live ride in the database drives the screens once a request is sent.
  useEffect(() => {
    if (!ride.rideId) return;
    return listenRide(ride.rideId, (doc) => {
      const cur = getState().ride;
      if (!doc || cur.rideId !== doc.id) return;
      const next = stageFor(doc.status, cur.stage);
      if (next === "reset") {
        if (doc.status === "cancelled" && doc.cancelledBy === "driver") toast("Your driver cancelled the trip. Please request again.");
        resetRide();
        return;
      }
      updateRide({ stage: next, price: doc.price, driverId: doc.driverId, driver: doc.driver, eta: doc.eta, driverAt: doc.driverAt });
    });
  }, [ride.rideId]);

  const find = async () => {
    updateRide({ stage: "finding", rideId: null });
    try {
      const s = getState();
      const id = await createRide(s.ride, s.user);
      updateRide({ rideId: id });
    } catch (e) {
      console.error(e);
      toast.error("Couldn't send your request. Check your connection and try again.");
      updateRide({ stage: "choose" });
    }
  };

  const cancel = async (who: "passenger" = "passenger") => {
    const id = getState().ride.rideId;
    resetRide();
    if (id) await patchRide(id, { status: "cancelled", cancelledBy: who }).catch((e) => console.error(e));
  };

  const editRequest = async () => {
    const id = getState().ride.rideId;
    updateRide({ stage: "choose", rideId: null });
    if (id) await patchRide(id, { status: "cancelled", cancelledBy: "passenger" }).catch((e) => console.error(e));
  };

  const accept = useCallback(async (offer: Offer) => {
    const id = getState().ride.rideId;
    if (!id) return;
    await acceptOffer(id, offer);
    updateRide({ stage: "arriving", driverId: offer.driverId, driver: offer.driver, price: offer.price, eta: offer.eta, driverAt: offer.from });
  }, []);

  const finish = async (rating: number) => {
    const id = ride.rideId;
    if (id) {
      try {
        await patchRide(id, { status: "completed", rating });
      } catch (e) {
        console.error(e);
        toast.error("Couldn't save your rating, but your trip is done.");
      }
    }
    setTripDetails(false);
    resetRide();
  };

  const stage = ride.stage;
  const withPanel = !picking && (stage === "idle" || stage === "tracking");
  const mapMode: MapMode = picking
    ? "pick"
    : stage === "arriving" ? "arriving" : stage === "here" || stage === "started" ? "here" : stage === "tracking" ? "tracking" : "idle";
  const sheetHeight = picking
    ? pickH
    : withPanel
    ? panelH
    : stage === "arriving" || stage === "here" || stage === "started"
      ? rootH - (TOP + 172)
      : rootH - (TOP + 62);

  return (
    <div ref={rootRef} className="absolute inset-0 overflow-hidden bg-map">
      <RideMap
        mode={mapMode}
        pickup={pickup}
        dropoff={dropoff}
        sheetHeight={sheetHeight}
        topInset={dropoff && (stage === "started" || stage === "tracking") ? TOP + 56 : TOP}
        arrivingMs={(ride.eta ?? 5) * 60_000}
        tripMs={ride.trip ? Math.max(20_000, ride.trip.duration * 1000) : 16_000}
        driverFrom={ride.driverAt}
        drivers={driverMarkers}
        pickStart={dropoff ? lngLat(dropoff) : lngLat(pickup)}
        onCenter={picking ? setPinAt : undefined}
        onPickupClick={() => setSearch({ all: false })}

      />

      {dropoff && !picking && (stage === "choose" || stage === "finding" || stage === "started" || stage === "tracking") && (
        <RoutePill pickup={pickup} dropoff={dropoff} onEdit={stage === "choose" ? () => setSearch({ all: false }) : undefined} />
      )}

      {withPanel && (
        <div ref={panelRef} className="absolute inset-x-0 bottom-0 z-20">
          <div className="rounded-t-3xl bg-card shadow-sheet">
            {loading && stage === "idle" ? (
              <HomeSheetSkeleton />
            ) : (
              <HomeSheet
                pickup={ride.pickup}
                onPickup={(p) => updateRide({ pickup: p })}
                onSearch={() => (stage === "tracking" ? setTripDetails(true) : setSearch({ all: false }))}
                onSeeAll={() => setSearch({ all: true })}
                onPlace={pick}
                driversOnline={online ? online.length : null}
                expanded={stage === "idle" && expanded}
                onToggle={setExpanded}
                onTrip={stage === "tracking" ? () => setTripDetails(true) : undefined}
              />
            )}
          </div>
          <BottomNav />
        </div>
      )}

      {stage === "choose" && !picking && <ChooseRide ride={ride} onFind={() => void find()} />}
      {stage === "finding" && (
        <FindingDriver ride={ride} onCancel={() => void cancel()} onEdit={() => void editRequest()} onAccept={accept} />
      )}
      {(stage === "arriving" || stage === "here" || stage === "started") && (
        <DriverAssigned ride={ride} onCancel={() => void cancel()} onTrack={() => updateRide({ stage: "tracking" })} />
      )}
      {stage === "tracking" && tripDetails && (
        <DriverAssigned ride={ride} onCancel={() => void cancel()} onTrack={() => setTripDetails(false)} onClose={() => setTripDetails(false)} />
      )}
      {stage === "arrived" && <Arrived ride={ride} onDone={finish} />}

      {picking && (
        <PickOnMap
          ref={pickRef}
          at={pinAt}
          hint={picking.hint}
          onBack={() => {
            setPicking(null);
            setSearch({ all: false });
          }}
          onConfirm={pick}
        />
      )}

      {search && !picking && (
        <SearchRoute
          pickup={ride.pickup}
          showAll={search.all}
          onBack={() => setSearch(null)}
          onPick={pick}
          onPickOnMap={(hint) => {
            setPinAt(null);
            setPicking({ hint: hint || undefined });
          }}
        />
      )}
    </div>
  );
}
