import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { useState } from "react";
import city from "@/assets/aerial-city.jpg";
import { PermissionLayout } from "@/components/move/PermissionLayout";
import { setState } from "@/lib/move-store";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/enable-location")({
  head: () => pageHead("Enable location", "Share your location so we can match you with nearby rides instantly."),
  component: EnableLocation,
});

const PINS = [
  [8, 14], [78, 10], [88, 36], [36, 52], [18, 86], [84, 80], [56, 74],
];

function EnableLocation() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const next = () => navigate({ to: "/enable-notifications" });

  const allow = () => {
    if (!("geolocation" in navigator)) {
      next();
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setState((s) => ({ ...s, permissions: { ...s.permissions, location: true } }));
        next();
      },
      () => next(),
      { timeout: 8000 },
    );
  };

  return (
    <PermissionLayout
      title="Enable Location and"
      highlight="Find Rides Around You"
      text="Share your location so we can match you with nearby rides instantly."
      cta={busy ? "Locating…" : "Enable Location"}
      busy={busy}
      onAllow={allow}
      onSkip={next}
      visual={
        <div className="absolute inset-0 overflow-hidden rounded-t-[28px] border-[6px] border-b-0 border-card shadow-float">
          <img src={city} alt="Aerial view of the city" width={768} height={960} className="size-full object-cover" />
          <span className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-card px-3 py-1 text-[11px] font-semibold shadow-float">
            <span className="size-2 rounded-full bg-primary" /> 5 rides nearby
          </span>
          {PINS.map(([x, y], i) => (
            <MapPin
              key={i}
              className="absolute size-5 fill-primary text-card animate-pop-in"
              style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${300 + i * 120}ms` }}
            />
          ))}
        </div>
      }
    />
  );
}
