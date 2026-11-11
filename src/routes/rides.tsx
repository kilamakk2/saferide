import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Star } from "lucide-react";
import { useState } from "react";
import emptyImg from "@/assets/empty-calendar.png";
import { AppButton } from "@/components/move/AppButton";
import { BottomNav } from "@/components/move/BottomNav";
import { Screen } from "@/components/move/Screen";
import { useQuery } from "@tanstack/react-query";
import { ugx, vehicleById } from "@/lib/move-data";
import { fetchMyRides } from "@/lib/rides";
import { useMove } from "@/lib/move-store";
import { pageHead } from "@/lib/head";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/rides")({
  head: () => pageHead("Your rides", "Ongoing and past trips on Move Naija."),
  component: Rides,
});

const ONGOING = new Set(["finding", "arriving", "here", "started", "tracking"]);

function Rides() {
  const [tab, setTab] = useState<"ongoing" | "past">("past");
  const user = useMove((s) => s.user);
  const role = user.role ?? "passenger";
  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-rides", user.id, role],
    queryFn: () => fetchMyRides(user.id, role),
    enabled: !!user.id,
  });
  const history = (data ?? []).filter((r) => r.status === "completed");
  const ride = useMove((s) => s.ride);
  const navigate = useNavigate();
  const active = ONGOING.has(ride.stage) && ride.dropoff;

  const empty = (title: string, text: string) => (
    <div className="flex flex-1 flex-col items-center px-8 pt-14 text-center animate-fade-up">
      <img src={emptyImg} alt="" width={575} height={481} className="w-48" />
      <p className="mt-3 text-[15px] font-semibold">{title}</p>
      <p className="text-xs text-muted-foreground">{text}</p>
      <AppButton className="mt-5" onClick={() => navigate({ to: "/home" })}>
        Book a ride
      </AppButton>
    </div>
  );

  return (
    <Screen>
      <div className="flex flex-1 flex-col overflow-hidden pt-safe">
        <div className="mx-5 mt-3 grid grid-cols-2 border-b border-border text-sm">
          {(["ongoing", "past"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px border-b-2 py-3 capitalize transition-colors",
                tab === t ? "border-foreground font-semibold" : "border-transparent text-muted-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar">
          {tab === "ongoing" ? (
            active ? (
              <Link to="/home" className="mx-5 mt-5 block rounded-xl bg-card p-4 shadow-float animate-fade-up">
                <p className="text-xs font-semibold text-primary">In progress</p>
                <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
                  {ride.pickup.short} <ArrowRight className="size-3.5" /> {ride.dropoff?.short}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {vehicleById(ride.vehicle).name} · {ride.seats} seat{ride.seats > 1 ? "s" : ""} · {ugx(ride.price)}
                </p>
              </Link>
            ) : (
              empty("No ongoing rides", "Trips you book will show up here.")
            )
          ) : isLoading ? (
            <div className="space-y-3 px-5 py-5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-xl skeleton-shimmer" />
              ))}
            </div>
          ) : isError ? (
            empty("Couldn't load your trips", "Check your connection and open this page again.")
          ) : history.length ? (
            <ul className="space-y-3 px-5 py-5">
              {history.map((h) => {
                const other = role === "driver" ? h.passenger?.name : h.driver?.name;
                const total = h.price;
                return (
                  <li key={h.id} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-float animate-fade-up">
                    <img src={vehicleById(h.vehicle).image} alt="" className="h-8 w-12 object-contain" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                        {h.pickup.short} <ArrowRight className="size-3" /> {h.dropoff.short}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(h.createdAt).toLocaleDateString("en-UG", { day: "numeric", month: "short" })}
                        {other ? ` · ${other}` : ""}
                        {h.rating > 0 && (
                          <span className="ml-1 inline-flex items-center gap-0.5">
                            · <Star className="size-3 fill-warning text-warning" /> {h.rating}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-sm font-bold">{ugx(total)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            empty("No rides yet", "Your completed trips will show up here.")
          )}
        </div>
      </div>
      <BottomNav />
    </Screen>
  );
}
