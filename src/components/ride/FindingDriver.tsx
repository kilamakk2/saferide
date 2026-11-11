import { Pencil, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppButton } from "@/components/move/AppButton";
import { Avatar } from "@/components/move/Avatar";
import { Switch } from "@/components/ui/switch";
import { FARE_STEP, lowestFare, ugx, offerLabel, vehicleById } from "@/lib/move-data";
import { updateRide, type Ride } from "@/lib/move-store";
import { clearOffers, listenOffers, patchRide, type Offer } from "@/lib/rides";
import { useOnlineDrivers } from "@/lib/use-drivers";
import { cn } from "@/lib/utils";
import { PaymentPicker, RouteCard, SheetHandle } from "./parts";

const OFFER_LIFE = 25;

const offerKey = (o: Offer) => `${o.driverId}-${o.at}`;

export function FindingDriver({
  ride,
  onCancel,
  onEdit,
  onAccept,
}: {
  ride: Ride;
  onCancel: () => void;
  onEdit: () => void;
  onAccept: (offer: Offer) => Promise<void> | void;
}) {
  const vehicle = vehicleById(ride.vehicle);
  const pickup = ride.pickup;
  const dropoff = ride.dropoff ?? ride.pickup;
  const [draft, setDraft] = useState(ride.price);
  const [seconds, setSeconds] = useState(59);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [auto, setAuto] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const online = useOnlineDrivers();
  const matching = useMemo(() => (online ?? []).filter((d) => d.vehicle === ride.vehicle), [online, ride.vehicle]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  // Real offers from drivers, live.
  useEffect(() => {
    if (!ride.rideId) return;
    return listenOffers(ride.rideId, setOffers);
  }, [ride.rideId]);

  const visible = offers.filter((o) => !dismissed.includes(offerKey(o))).sort((a, b) => a.at - b.at);

  const take = async (o: Offer) => {
    if (accepting) return;
    setAccepting(offerKey(o));
    try {
      await onAccept(o);
    } catch (e) {
      console.error(e);
      toast.error("That offer is no longer available.");
      setDismissed((d) => [...d, offerKey(o)]);
    } finally {
      setAccepting(null);
    }
  };
  const takeRef = useRef(take);
  takeRef.current = take;

  useEffect(() => {
    if (!auto) return;
    const match = visible.find((o) => o.price <= ride.price && o.eta <= 5);
    if (match) void takeRef.current(match);
  }, [auto, visible, ride.price]);

  const changeOffer = async () => {
    updateRide({ price: draft });
    setOffers([]);
    setSeconds(59);
    if (!ride.rideId) return;
    try {
      await patchRide(ride.rideId, { price: draft });
      await clearOffers(ride.rideId);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't update your offer. Check your connection.");
    }
  };

  const great = ride.price >= ride.recommended;
  const autoRow = (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted px-3 py-3 text-[12px]">
      <span>
        Auto-accept an offer of {ugx(ride.price)} up to
        <br />5 min away
      </span>
      <Switch checked={auto} onCheckedChange={setAuto} aria-label="Auto-accept offers" />
    </div>
  );

  if (visible.length > 0) {
    return (
      <div className="absolute inset-x-0 bottom-0 top-safe z-20 mt-[62px] flex flex-col rounded-t-3xl bg-card shadow-sheet animate-sheet-up">
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-3">
          <SheetHandle />
          <h2 className="text-[15px] font-semibold tracking-tight">
            {visible.length} driver{visible.length > 1 ? "s" : ""} sent an offer
          </h2>
          <div className="mt-2 flex items-center justify-between gap-3 text-[12px] text-muted-foreground">
            <span>
              Auto-accept an offer of {ugx(ride.price)} up to
              <br />5 min away
            </span>
            <Switch checked={auto} onCheckedChange={setAuto} aria-label="Auto-accept offers" />
          </div>
          <div className="mt-3 space-y-3 pb-3">
            {visible.map((o) => {
              const label = offerLabel(o.price, ride.price);
              return (
                <div key={offerKey(o)} className="overflow-hidden rounded-xl bg-card shadow-[0_0_0_1px_var(--border)] animate-fade-up">
                  <div className="h-1 bg-secondary">
                    <div
                      className="h-full bg-ink animate-bar-shrink"
                      style={{ animationDuration: `${OFFER_LIFE}s` }}
                      onAnimationEnd={() => setDismissed((d) => [...d, offerKey(o)])}
                    />
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[15px] font-bold">{ugx(o.price)}</p>
                        <p className={cn("text-[11px]", label.tone === "above" ? "text-above" : "text-primary")}>{label.text}</p>
                      </div>
                      <button aria-label="Decline offer" onClick={() => setDismissed((d) => [...d, offerKey(o)])}>
                        <X className="size-4" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Avatar src={o.driver.photo} className="size-6 rounded-full" />
                      <span className="font-semibold text-foreground">{o.driver.name}</span>
                      <span className="min-w-0 flex-1 truncate">
                        {o.driver.rating ? `★ ${o.driver.rating} ` : "New driver "}({o.driver.rides} rides) · {o.driver.color} {o.driver.car}
                      </span>
                      <span>· {o.eta} min</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1.5 text-[10px]">
                        <UserRound className="size-3" /> {o.driver.plate}
                      </span>
                      <AppButton size="md" className="flex-1" disabled={!!accepting} onClick={() => void take(o)}>
                        {accepting === offerKey(o) ? "Accepting..." : "Accept"}
                      </AppButton>
                    </div>
                  </div>
                </div>
              );
            })}
            {Array.from({ length: Math.max(0, 3 - visible.length) }).map((_, i) => (
              <div key={i} className="flex h-24 items-center justify-center rounded-xl text-[11px] text-muted-foreground shadow-[0_0_0_1px_var(--border)]">
                Waiting for more offers...
              </div>
            ))}
          </div>
        </div>
        <div className="px-5 pb-safe pt-2">
          <AppButton variant="ghost" className="mb-3" onClick={onCancel}>
            Cancel request
          </AppButton>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="absolute inset-x-0 top-safe z-10 mt-[62px] flex items-center justify-between rounded-t-3xl bg-card px-4 pb-6 pt-3 text-[12px] animate-fade-up">
        <span>
          {online === null
            ? "Sending your request to drivers..."
            : matching.length === 0
              ? `No ${vehicle.name.toLowerCase()} drivers online yet — we'll keep looking`
              : `${matching.length} ${vehicle.name.toLowerCase()} driver${matching.length === 1 ? "" : "s"} can see your request`}
        </span>
        <span className="flex -space-x-2">
          {matching.slice(0, 3).map((d) => (
            <Avatar key={d.id} src={d.photo} className="size-6 rounded-full ring-2 ring-card" />
          ))}
          {matching.length > 3 && (
            <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground ring-2 ring-card">
              {matching.length - 3}+
            </span>
          )}
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 top-safe z-20 mt-[104px] flex flex-col rounded-t-3xl bg-card shadow-sheet animate-sheet-up">
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-3">
          <SheetHandle />
          <div className="flex items-center justify-between text-[13px]">
            <span>{great ? "Great fare! Your request is prioritized." : "Low fare. Fewer drivers may respond."}</span>
            <span className="font-semibold tabular-nums">0:{String(seconds).padStart(2, "0")}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-ink transition-[width] duration-1000 ease-linear" style={{ width: `${(seconds / 59) * 100}%` }} />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button onClick={() => setDraft((d) => Math.max(lowestFare(ride.vehicle, ride.recommended), d - FARE_STEP))} className="rounded-full bg-muted px-3 py-1.5 text-[12px]">
              − 500
            </button>
            <span className="text-lg font-bold">{ugx(draft)}</span>
            <button onClick={() => setDraft((d) => d + FARE_STEP)} className="rounded-full bg-muted px-3 py-1.5 text-[12px]">
              + 500
            </button>
          </div>
          <AppButton
            variant={draft !== ride.price ? "primary" : "ghost"}
            size="md"
            className="mt-3 font-normal"
            disabled={draft === ride.price}
            onClick={() => void changeOffer()}
          >
            Change your offer
          </AppButton>

          <div className="mt-3 space-y-2.5 pb-3">
            {autoRow}
            <RouteCard
              pickup={pickup}
              dropoff={dropoff}
              action={
                <button aria-label="Edit route" onClick={onEdit}>
                  <Pencil className="size-3.5" />
                </button>
              }
            />
            <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
              <PaymentPicker value={ride.payment} />
              <span className="text-sm font-semibold">{ugx(ride.price)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-3 text-[12px]">
              <span>
                Vehicle type: {vehicle.name} · {ride.seats} passenger{ride.seats > 1 ? "s" : ""}
              </span>
              <button aria-label="Change vehicle" onClick={onEdit}>
                <Pencil className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
        <div className="px-5 pb-safe pt-2">
          <AppButton variant="ghost" className="mb-3" onClick={onCancel}>
            Cancel request
          </AppButton>
        </div>
      </div>
    </>
  );
}
