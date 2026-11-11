import { ArrowLeft, MapPin } from "lucide-react";
import { forwardRef, useEffect, useState } from "react";
import { AppButton } from "@/components/move/AppButton";
import { inGulu, type LngLat, type Place } from "@/lib/geo";
import { reverseGeocode } from "@/lib/maps";
import { SheetHandle } from "./parts";

/** Bottom panel for choosing a dropoff by moving the map under a fixed centre pin. */
export const PickOnMap = forwardRef<
  HTMLDivElement,
  { at: LngLat | null; hint?: string | undefined; onBack: () => void; onConfirm: (p: Place) => void }
>(function PickOnMap({ at, hint, onBack, onConfirm }, ref) {
  const [place, setPlace] = useState<Place | null>(null);
  const inside = at ? inGulu(at) : true;

  useEffect(() => {
    setPlace(null);
    if (!at || !inGulu(at)) return;
    let live = true;
    const t = setTimeout(() => {
      reverseGeocode(at)
        .then((p) => live && setPlace(p))
        .catch(() => undefined);
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [at?.[0], at?.[1]]);

  return (
    <div ref={ref} className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl bg-card px-5 pb-safe pt-3 shadow-sheet animate-sheet-up">
      <SheetHandle />
      <div className="relative flex items-center justify-center">
        <button aria-label="Back to search" onClick={onBack} className="absolute left-0 -ml-1 p-1">
          <ArrowLeft className="size-5" />
        </button>
        <h2 className="text-[17px] font-semibold tracking-tight">Set dropoff on map</h2>
      </div>
      <p className="mt-1 text-center text-xs text-muted-foreground">
        {hint ? `Move the map to put the pin on "${hint}"` : "Move the map to put the pin where you're going"}
      </p>

      <div className="mt-4 flex items-center gap-3 rounded-xl bg-muted px-3 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-card">
          <MapPin className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          {!inside ? (
            <p className="text-sm font-medium text-destructive">Outside Gulu — move the pin back into the city</p>
          ) : place ? (
            <>
              <p className="truncate text-sm font-medium">{place.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">{place.area}</p>
            </>
          ) : (
            <div className="space-y-1.5">
              <div className="h-3.5 w-2/3 rounded skeleton-shimmer" />
              <div className="h-2.5 w-1/3 rounded skeleton-shimmer" />
            </div>
          )}
        </div>
      </div>

      <AppButton
        className="mb-4 mt-4"
        disabled={!inside || !place}
        onClick={() => place && onConfirm({ ...place, kind: "pin", short: hint && place.name === "Pinned location" ? hint : place.short })}
      >
        Confirm dropoff
      </AppButton>
    </div>
  );
});
