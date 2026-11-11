import { BadgeCheck, ChevronRight, PhoneCall, Share, ShieldCheck, Siren, TriangleAlert, UserRound, CarFront, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AppButton } from "@/components/move/AppButton";
import { Avatar } from "@/components/move/Avatar";
import { BottomSheet } from "@/components/move/BottomSheet";
import { ugx, vehicleById } from "@/lib/move-data";
import type { DriverSnap, Ride } from "@/lib/move-store";
import { PaymentPicker, RouteCard, SheetHandle } from "./parts";

const NO_DRIVER: DriverSnap = { id: "", name: "Your driver", photo: null, phone: "", car: "", color: "", plate: "", vehicle: "boda", rating: null, rides: 0 };

export function arrivalTime(minutes = 12) {
  const d = new Date(Date.now() + minutes * 60_000);
  return d.toLocaleTimeString("en-UG", { hour: "numeric", minute: "2-digit", hour12: false });
}

const SAFETY = [
  "Confirm the plate number before you get in.",
  "Wear your seatbelt for the whole trip.",
  "Share your trip with someone you trust.",
  "In an emergency, tap Call 112.",
];
const ISSUES = ["Driver took a wrong route", "Driver was rude", "Vehicle was unsafe", "I left something behind", "Something else"];

export function DriverAssigned({
  ride,
  onCancel,
  onTrack,
  onClose,
  live,
}: {
  ride: Ride;
  /** Real remaining time from the driver's live position, when known. */
  live?: { duration: number; distance: number } | null | undefined;
  onCancel: () => void;
  onTrack: () => void;
  /** Close button when shown as an overlay during a trip. */
  onClose?: () => void;
}) {
  const driver = ride.driver ?? NO_DRIVER;
  const firstName = driver.name.split(" ")[0] ?? driver.name;
  const vehicle = vehicleById(ride.vehicle);
  const pickup = ride.pickup;
  const dropoff = ride.dropoff ?? ride.pickup;
  const [mins, setMins] = useState(ride.eta ?? 5);
  const [sheet, setSheet] = useState<null | "safety" | "profile" | "cancel" | "issue" | "shared">(null);
  const [modal, setModal] = useState(ride.stage === "started" && !onClose);
  const [eta] = useState(() => arrivalTime(ride.trip ? Math.max(1, Math.round(ride.trip.duration / 60)) : 12));
  const started = ride.stage === "started" || ride.stage === "tracking";

  // Count down the driver's own estimate, a minute at a time; the driver moves the ride on from their phone.
  useEffect(() => {
    if (ride.stage !== "arriving" || mins <= 1) return;
    const t = setTimeout(() => setMins((m) => m - 1), 60_000);
    return () => clearTimeout(t);
  }, [ride.stage, mins]);

  useEffect(() => {
    if (ride.stage === "started" && !onClose) setModal(true);
  }, [ride.stage, onClose]);

  const share = async () => {
    const text = `I'm riding with ${driver.name} (${driver.plate}) from ${pickup.name} to ${dropoff.name} on Move Naija.`;
    try {
      if (navigator.share) await navigator.share({ title: "My Move Naija trip", text });
      else {
        await navigator.clipboard.writeText(text);
        setSheet("shared");
      }
    } catch {
      /* user dismissed */
    }
  };

  const liveMin = live ? Math.max(1, Math.round(live.duration / 60)) : null;
  const title = started
    ? `You'll arrive ${liveMin !== null ? arrivalTime(liveMin) : eta}`
    : ride.stage === "here"
      ? "Your ride is here"
      : `Arriving in ${liveMin ?? mins} min`;

  return (
    <>
      <div className="absolute inset-x-0 bottom-0 top-safe z-20 mt-[172px] flex flex-col rounded-t-3xl bg-card shadow-sheet animate-sheet-up">
        <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-3 pb-safe">
          <SheetHandle />
          {onClose && (
            <button aria-label="Close trip details" onClick={onClose} className="absolute right-4 top-4 flex size-7 items-center justify-center rounded-full bg-muted">
              <X className="size-4" />
            </button>
          )}
          {started ? (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold">{title}</h2>
                <p className="text-[14px] font-semibold leading-tight">
                  {dropoff.name}, {dropoff.area}
                </p>
              </div>
              <img src={vehicle.image} alt="" className="mt-6 h-6 w-auto" />
            </div>
          ) : (
            <>
              <h2 key={title} className="text-xl font-bold animate-fade-up">
                {title}
              </h2>
              <p className="text-[13px]">
                <span className="font-bold">{driver.plate}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {driver.color} {driver.car}
                </span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {vehicle.name} · {ride.seats} passenger{ride.seats > 1 ? "s" : ""}
              </p>
            </>
          )}

          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[10px]">
            <button onClick={() => setSheet("profile")} className="flex flex-col items-center gap-1.5">
              <span className="relative">
                <Avatar src={driver.photo} alt={driver.name} className="size-12 rounded-lg" />
                <BadgeCheck className="absolute -bottom-1 -right-1 size-4 fill-primary text-card" />
              </span>
              {driver.name}
            </button>
            <a href={driver.phone ? `tel:${driver.phone}` : undefined} className="flex flex-col items-center gap-1.5">
              <span className="flex size-12 items-center justify-center rounded-lg bg-muted">
                <PhoneCall className="size-5" />
              </span>
              Contact driver
            </a>
            <button onClick={() => setSheet("safety")} className="flex flex-col items-center gap-1.5">
              <span className="flex size-12 items-center justify-center rounded-lg bg-muted">
                <ShieldCheck className="size-5 fill-foreground text-muted" />
              </span>
              Safety rules
            </button>
            <button onClick={share} className="flex flex-col items-center gap-1.5">
              <span className="flex size-12 items-center justify-center rounded-lg bg-muted">
                <Share className="size-5" />
              </span>
              Share trip
            </button>
          </div>

          <div className="mt-4 space-y-2.5 pb-3">
            <RouteCard pickup={pickup} dropoff={dropoff} muted action={<ChevronRight className="size-4" />} />
            <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2.5">
              <PaymentPicker value={ride.payment} />
              <span className="text-sm font-semibold">{ugx(ride.price)}</span>
            </div>
            <Row icon={<UserRound className="size-4" />} label="View driver's profile" onClick={() => setSheet("profile")} />
            <a href="tel:112" className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-3.5 text-[13px] text-destructive">
              <Siren className="size-4" /> Call 112
            </a>
            {started ? (
              <Row icon={<TriangleAlert className="size-4" />} label="Report an issue" onClick={() => setSheet("issue")} />
            ) : (
              <Row icon={<CarFront className="size-4" />} label="Cancel ride" onClick={() => setSheet("cancel")} />
            )}
            {started && !modal && !onClose && (
              <AppButton onClick={onTrack} className="mt-2">
                Track your ride
              </AppButton>
            )}
          </div>
        </div>
      </div>

      {modal && (
        <div className="absolute inset-0 z-40 flex items-center justify-center px-5">
          <div className="absolute inset-0 bg-scrim animate-scrim-in" />
          <div className="relative w-full rounded-2xl bg-card px-5 pb-5 pt-6 text-center animate-pop-in">
            <button aria-label="Close" onClick={() => setModal(false)} className="absolute right-4 top-4">
              <X className="size-4" />
            </button>
            <img src={vehicle.image} alt="" className="mx-auto h-12 w-auto" />
            <h3 className="mt-4 text-lg font-bold">Your ride has started</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              You're on your way to {dropoff.name} with {firstName}.
            </p>
            <AppButton className="mt-5" onClick={onTrack}>
              Track your ride
            </AppButton>
          </div>
        </div>
      )}

      <BottomSheet open={sheet === "safety"} onClose={() => setSheet(null)} title="Safety rules">
        <ul className="mb-4 space-y-3 text-sm">
          {SAFETY.map((s) => (
            <li key={s} className="flex gap-2">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" /> {s}
            </li>
          ))}
        </ul>
      </BottomSheet>

      <BottomSheet open={sheet === "profile"} onClose={() => setSheet(null)} title="Driver's profile">
        <div className="mb-4 flex flex-col items-center text-center">
          <Avatar src={driver.photo} alt={driver.name} className="size-20 rounded-full" />
          <p className="mt-3 font-semibold">{driver.name}</p>
          <p className="text-xs text-muted-foreground">
            {driver.rating ? `★ ${driver.rating} · ` : "New driver · "}
            {driver.rides} rides
          </p>
          <div className="mt-4 grid w-full grid-cols-2 gap-2 text-left text-xs">
            <div className="rounded-xl bg-muted p-3">
              <p className="text-muted-foreground">Vehicle</p>
              <p className="font-semibold">
                {driver.color} {driver.car}
              </p>
            </div>
            <div className="rounded-xl bg-muted p-3">
              <p className="text-muted-foreground">Plate</p>
              <p className="font-semibold">{driver.plate}</p>
            </div>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "cancel"} onClose={() => setSheet(null)} title="Cancel this ride?">
        <p className="text-center text-sm text-muted-foreground">{firstName} is already on the way to pick you up.</p>
        <div className="mb-4 mt-5 space-y-2.5">
          <AppButton variant="danger" onClick={onCancel}>
            Yes, cancel ride
          </AppButton>
          <AppButton variant="soft" onClick={() => setSheet(null)}>
            Keep my ride
          </AppButton>
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "issue"} onClose={() => setSheet(null)} title="Report an issue">
        <div className="mb-4 divide-y divide-border">
          {ISSUES.map((i) => (
            <button key={i} onClick={() => setSheet("shared")} className="flex w-full items-center justify-between py-3 text-sm">
              {i} <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === "shared"} onClose={() => setSheet(null)} title="Done">
        <p className="mb-5 text-center text-sm text-muted-foreground">Thanks — we've got it.</p>
      </BottomSheet>
    </>
  );
}

function Row({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-xl bg-muted px-3 py-3.5 text-[13px]">
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight className="size-4" />
    </button>
  );
}
