import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, Bookmark, ChevronRight, CircleHelp, CreditCard, LogOut, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { BottomNav } from "@/components/move/BottomNav";
import { Screen } from "@/components/move/Screen";
import { useQuery } from "@tanstack/react-query";
import { resetAll, useMove } from "@/lib/move-store";
import { fetchMyRides } from "@/lib/rides";
import { saveProfile, signOut } from "@/lib/session";
import { pageHead } from "@/lib/head";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/me")({
  head: () => pageHead("My profile", "Your Move Naija profile, role and settings."),
  component: Me,
});

function Me() {
  const user = useMove((s) => s.user);
  const role = user.role ?? "passenger";
  const { data: rides } = useQuery({
    queryKey: ["my-rides", user.id, role],
    queryFn: () => fetchMyRides(user.id, role),
    enabled: !!user.id,
  });
  const done = rides?.filter((r) => r.status === "completed").length ?? 0;
  const perms = useMove((s) => s.permissions);
  const navigate = useNavigate();

  const items = [
    { label: "Edit profile photo", Icon: UserRound, onClick: () => navigate({ to: "/profile-photo" }) },
    { label: "Saved places", Icon: Bookmark },
    { label: "Payment methods", Icon: CreditCard },
    { label: "Location", Icon: MapPin, value: perms.location ? "On" : "Off", onClick: () => navigate({ to: "/enable-location" }) },
    { label: "Notifications", Icon: Bell, value: perms.notifications ? "On" : "Off", onClick: () => navigate({ to: "/enable-notifications" }) },
    { label: "Safety", Icon: ShieldCheck },
    { label: "Help & support", Icon: CircleHelp },
  ];

  return (
    <Screen>
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 pt-safe">
        <div className="mt-8 flex flex-col items-center text-center animate-fade-up">
          <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-secondary">
            {user.photo ? (
              <img src={user.photo} alt="Your profile" className="size-full object-cover" />
            ) : (
              <UserRound className="size-10 fill-muted-foreground text-muted-foreground" />
            )}
          </div>
          <h1 className="mt-3 text-xl font-bold">{user.name || "Your profile"}</h1>
          <p className="text-xs text-muted-foreground">{user.email || user.phone || "No contact added"}</p>
          <p className="mt-2 rounded-full bg-primary-soft px-3 py-1 text-[11px] font-semibold text-primary">
            {done} trip{done === 1 ? "" : "s"} completed
          </p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-sm">
          {(["passenger", "driver"] as const).map((r) => (
            <button
              key={r}
              onClick={() => void saveProfile({ role: r, ...(r === "passenger" ? { online: false } : {}) })}
              className={cn(
                "rounded-full py-2 capitalize transition-colors",
                user.role === r ? "bg-card font-semibold shadow-float" : "text-muted-foreground",
              )}
            >
              {r}
            </button>
          ))}
        </div>

        <ul className="mt-5 divide-y divide-border rounded-xl bg-card px-3 shadow-float">
          {items.map(({ label, Icon, value, onClick }) => (
            <li key={label}>
              <button onClick={onClick} className="flex w-full items-center gap-3 py-3.5 text-left text-sm">
                <Icon className="size-4 text-muted-foreground" />
                <span className="flex-1">{label}</span>
                {value && <span className="text-xs text-muted-foreground">{value}</span>}
                <ChevronRight className="size-4 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>

        <button
          onClick={async () => {
            await signOut();
            resetAll();
            navigate({ to: "/welcome", replace: true });
          }}
          className="mb-6 mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-danger-soft py-3 text-sm font-semibold text-destructive"
        >
          <LogOut className="size-4" /> Log out
        </button>
      </div>
      <BottomNav />
    </Screen>
  );
}
