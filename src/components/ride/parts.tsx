import { ArrowRight, Banknote, ChevronDown, Flag, Pencil, PersonStanding } from "lucide-react";
import { useState } from "react";
import type { Place } from "@/lib/move-data";
import type { Ride } from "@/lib/move-store";
import { cn } from "@/lib/utils";

export function RoutePill({ pickup, dropoff, onEdit }: { pickup: Place; dropoff: Place; onEdit?: (() => void) | undefined }) {
  return (
    <div className="absolute inset-x-4 top-safe z-20 mt-2 flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-[11px] shadow-float animate-fade-up">
      <span className="max-w-[34%] truncate">
        {pickup.short}, {pickup.area}
      </span>
      <ArrowRight className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {dropoff.short}, {dropoff.area}
      </span>
      {onEdit && (
        <button aria-label="Edit route" onClick={onEdit} className="shrink-0">
          <Pencil className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function RouteCard({
  pickup,
  dropoff,
  action,
  muted,
}: {
  pickup: Place;
  dropoff: Place;
  action?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted px-3 py-3">
      <div className="flex flex-col items-center self-stretch py-0.5">
        <PersonStanding className="size-3.5" />
        <span className="my-0.5 w-px flex-1 border-l border-dashed border-foreground" />
        <Flag className="size-3 fill-foreground" />
      </div>
      <div className="min-w-0 flex-1 space-y-2.5 text-[12px]">
        <p className={cn("truncate", muted && "text-muted-foreground")}>
          {pickup.name}, {pickup.area}
        </p>
        <p className="truncate">
          {dropoff.name}, {dropoff.area}
        </p>
      </div>
      {action}
    </div>
  );
}

export function PaymentPicker({
  value,
  onChange,
}: {
  value: Ride["payment"];
  onChange?: (v: Ride["payment"]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => onChange && setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md bg-card px-2.5 py-1.5 text-[12px] font-medium shadow-[0_0_0_1px_var(--border)]"
      >
        <Banknote className="size-4 fill-primary text-card" />
        {value}
        {onChange && <ChevronDown className="size-3.5" />}
      </button>
      {open && onChange && (
        <div className="absolute bottom-full left-0 z-30 mb-1 w-36 overflow-hidden rounded-lg bg-card py-1 shadow-float animate-pop-in">
          {(["Cash", "Card", "Transfer"] as const).map((p) => (
            <button
              key={p}
              onClick={() => {
                onChange(p);
                setOpen(false);
              }}
              className={cn("block w-full px-3 py-2 text-left text-xs hover:bg-muted", p === value && "font-semibold text-primary")}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SheetHandle() {
  return <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-secondary" />;
}

export const roundBtn =
  "flex size-9 items-center justify-center rounded-full bg-card text-lg leading-none text-foreground shadow-[0_0_0_1px_var(--border)] transition-opacity disabled:opacity-40";
