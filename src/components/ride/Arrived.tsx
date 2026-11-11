import { MapPin, Star } from "lucide-react";
import { useState } from "react";
import { AppButton } from "@/components/move/AppButton";
import { ugx } from "@/lib/move-data";
import type { Ride } from "@/lib/move-store";
import { cn } from "@/lib/utils";

export function Arrived({ ride, onDone }: { ride: Ride; onDone: (rating: number) => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  const [rating, setRating] = useState(0);
  const firstName = ride.driver?.name.split(" ")[0] || "your driver";
  const dropoff = ride.dropoff ?? ride.pickup;
  const total = ride.price;

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-background px-5 pt-safe animate-scrim-in">
      <div className="flex flex-1 flex-col items-center text-center">
        <span className="mt-24 flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground animate-pop-in">
          <MapPin className="size-9 fill-primary-foreground text-primary" strokeWidth={2.5} />
        </span>
        <h1 className="mt-5 text-2xl font-bold">You've arrived</h1>
        <p className="text-[12px] text-muted-foreground">
          {dropoff.name}, {dropoff.area}
        </p>
        <div className="mt-6 flex w-full items-center justify-between rounded-xl bg-muted px-4 py-3.5 text-[13px]">
          <span>{ride.payment === "Cash" ? `Pay ${firstName} in cash` : `Paid by ${ride.payment.toLowerCase()}`}</span>
          <span className="text-base font-bold">{ugx(total)}</span>
        </div>
        <p className="mt-6 text-sm font-medium">How was your ride?</p>
        <div className="mt-2 flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)}>
              <Star
                className={cn(
                  "size-7 transition-transform",
                  n <= rating ? "scale-110 fill-warning text-warning" : "text-muted-foreground",
                )}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>
      </div>
      <AppButton
        className="mb-4 pb-0"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onDone(rating);
          } finally {
            setBusy(false);
          }
        }}
      >
        Done
      </AppButton>
      <div className="pb-safe" />
    </div>
  );
}
