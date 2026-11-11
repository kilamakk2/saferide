import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppButton } from "@/components/move/AppButton";
import { VEHICLES, isVehicleId, type VehicleId } from "@/lib/move-data";
import type { DriverInfo } from "@/lib/move-store";
import { saveProfile } from "@/lib/session";
import { cn } from "@/lib/utils";

const field =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

/** Vehicle details a driver must add before they can take requests. */
export function DriverSetup({ initial, onDone }: { initial: DriverInfo | null; onDone?: () => void }) {
  const [vehicle, setVehicle] = useState<VehicleId>(initial && isVehicleId(initial.vehicle) ? initial.vehicle : "boda");
  const [car, setCar] = useState(initial?.car ?? "");
  const [color, setColor] = useState(initial?.color ?? "");
  const [plate, setPlate] = useState(initial?.plate ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [busy, setBusy] = useState(false);
  const ok = car.trim().length > 1 && color.trim().length > 1 && plate.trim().length > 2 && phone.replace(/\D/g, "").length >= 9;

  const save = async () => {
    if (!ok) return;
    setBusy(true);
    try {
      await saveProfile({
        driver: { vehicle, car: car.trim(), color: color.trim(), plate: plate.trim().toUpperCase(), phone: phone.trim() },
        phone: phone.trim(),
      });
      toast.success("Vehicle saved");
      onDone?.();
    } catch (e) {
      console.error(e);
      toast.error("Couldn't save your vehicle. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div>
        <h2 className="text-[15px] font-semibold">Your vehicle</h2>
        <p className="text-[12px] text-muted-foreground">Passengers see this when you send an offer.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {VEHICLES.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setVehicle(v.id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-xl border bg-card px-2 py-2.5 text-[12px] transition-all",
              vehicle === v.id ? "border-primary ring-1 ring-primary" : "border-border",
            )}
          >
            <img src={v.image} alt="" className="h-7 w-12 object-contain" />
            {v.name}
          </button>
        ))}
      </div>
      <input className={field} aria-label="Make and model" placeholder="Make and model, e.g. Bajaj Boxer" value={car} onChange={(e) => setCar(e.target.value)} />
      <div className="grid grid-cols-2 gap-2">
        <input className={field} aria-label="Colour" placeholder="Colour" value={color} onChange={(e) => setColor(e.target.value)} />
        <input className={field} aria-label="Number plate" placeholder="Number plate" value={plate} onChange={(e) => setPlate(e.target.value)} />
      </div>
      <input className={field} type="tel" inputMode="tel" aria-label="Phone number" placeholder="Phone number passengers can call" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <AppButton type="submit" disabled={!ok || busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} Save vehicle
      </AppButton>
    </form>
  );
}
