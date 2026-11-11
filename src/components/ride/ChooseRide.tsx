import { Check, ChevronRight, UserRound } from "lucide-react";
import { useMemo } from "react";
import { AppButton } from "@/components/move/AppButton";
import { distanceM, formatDistance, formatMinutes, lngLat } from "@/lib/geo";
import { etaMinutes } from "@/lib/ride-logic";
import { useOnlineDrivers } from "@/lib/use-drivers";
import { FARE_STEP, VEHICLES, estimateRoadM, lowestFare, recommendedFare, ugx, vehicleById } from "@/lib/move-data";
import { updateRide, type Ride } from "@/lib/move-store";
import { cn } from "@/lib/utils";
import { PaymentPicker, SheetHandle, roundBtn } from "./parts";

export function ChooseRide({ ride, onFind }: { ride: Ride; onFind: () => void }) {
  const vehicle = vehicleById(ride.vehicle);
  const online = useOnlineDrivers();
  // Real road distance once Google's route is in, a careful estimate until then.
  const roadM = ride.trip?.distance ?? (ride.dropoff ? estimateRoadM(distanceM(lngLat(ride.pickup), lngLat(ride.dropoff))) : 0);
  /** Minutes away for the closest online driver of each vehicle type (with a known position). */
  const nearest = useMemo(() => {
    const out: Record<string, { count: number; eta: number | null }> = {};
    for (const d of online ?? []) {
      if (!d.vehicle) continue;
      const cur = out[d.vehicle] ?? { count: 0, eta: null };
      const eta = d.at ? etaMinutes(distanceM(d.at, lngLat(ride.pickup))) : null;
      out[d.vehicle] = { count: cur.count + 1, eta: eta === null ? cur.eta : cur.eta === null ? eta : Math.min(cur.eta, eta) };
    }
    return out;
  }, [online, ride.pickup]);
  const min = lowestFare(ride.vehicle, ride.recommended);

  return (
    <div className="absolute inset-x-0 bottom-0 top-safe z-20 mt-[62px] flex flex-col rounded-t-3xl bg-card shadow-sheet animate-sheet-up">
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-3">
        <SheetHandle />
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Choose your ride</h2>
            {ride.dropoff && (
              <p className="text-[11px] text-muted-foreground">
                {formatDistance(roadM)}
                {ride.trip ? ` · about ${formatMinutes(ride.trip.duration)}` : " · checking the road..."}
              </p>
            )}
          </div>
          {vehicle.seats > 1 && (
            <div className="flex items-center gap-3">
              <button className={roundBtn} aria-label="Fewer passengers" disabled={ride.seats <= 1} onClick={() => updateRide({ seats: ride.seats - 1 })}>
                −
              </button>
              <span className="flex items-center gap-1 text-sm font-semibold">
                <UserRound className="size-3.5" /> {ride.seats}
              </span>
              <button
                className={roundBtn}
                aria-label="More passengers"
                disabled={ride.seats >= vehicle.seats}
                onClick={() => updateRide({ seats: ride.seats + 1 })}
              >
                +
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 space-y-2.5">
          {VEHICLES.map((v) => {
            const active = v.id === ride.vehicle;
            const fare = recommendedFare(v.id, roadM);
            return (
              <button
                key={v.id}
                onClick={() =>
                  !active && updateRide({ vehicle: v.id, price: fare, recommended: fare, seats: Math.min(ride.seats, v.seats) })
                }
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border bg-card px-3 py-3 text-left transition-all",
                  active ? "border-primary ring-1 ring-primary" : "border-border",
                )}
              >
                <img src={v.image} alt="" className="h-9 w-14 object-contain" />
                <span className="flex-1">
                  <span className="block text-[13px] font-semibold">{v.name}</span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    {online === null
                      ? "Checking drivers..."
                      : !nearest[v.id]
                        ? "No drivers online"
                        : nearest[v.id]!.eta !== null
                          ? `${nearest[v.id]!.eta} min away`
                          : `${nearest[v.id]!.count} online`}
                    {" · "}
                    {v.tagline}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-[13px] font-semibold">{ugx(fare)}</span>
                  <span className="block text-[10px] text-muted-foreground">whole trip</span>
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => updateRide({ extraBags: !ride.extraBags })}
          className="mt-4 flex w-full items-center justify-between py-1 text-[13px] font-medium"
        >
          <span className="flex items-center gap-2">
            {ride.extraBags && (
              <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="size-3" />
              </span>
            )}
            {ride.extraBags ? "Extra bags added" : "Traveling with extra bags?"}
          </span>
          <ChevronRight className="size-4" />
        </button>

        <div className="mt-3 rounded-xl bg-muted px-3 py-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Name your price for the trip</span>
            <span className="font-semibold">
              {ride.seats} passenger{ride.seats > 1 ? "s" : ""}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button className={roundBtn} aria-label="Lower price" disabled={ride.price <= min} onClick={() => updateRide({ price: Math.max(min, ride.price - FARE_STEP) })}>
              −
            </button>
            <div className="text-center">
              <p className="text-xl font-bold">{ugx(ride.price)}</p>
              <p className="text-[10px] text-muted-foreground">Recommended fare: {ugx(ride.recommended)}</p>
            </div>
            <button className={roundBtn} aria-label="Raise price" onClick={() => updateRide({ price: ride.price + FARE_STEP })}>
              +
            </button>
          </div>
        </div>

        <div className="mt-2.5 mb-3 flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
          <PaymentPicker value={ride.payment} onChange={(payment) => updateRide({ payment })} />
          <span className="text-sm font-semibold">{ugx(ride.price)}</span>
        </div>
      </div>
      <div className="px-5 pb-safe pt-2">
        <AppButton onClick={onFind} className="mb-3">
          Find driver
        </AppButton>
      </div>
    </div>
  );
}
