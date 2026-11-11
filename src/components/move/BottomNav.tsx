import { Link } from "@tanstack/react-router";
import { CarFront, CircleUserRound, House } from "lucide-react";

const ITEMS = [
  { to: "/home", label: "Home", Icon: House, fill: true },
  { to: "/rides", label: "Rides", Icon: CarFront, fill: true },
  { to: "/me", label: "Me", Icon: CircleUserRound, fill: false },
] as const;

export function BottomNav() {
  return (
    <nav className="relative z-20 grid grid-cols-3 border-t border-border bg-card pb-safe pt-2">
      {ITEMS.map(({ to, label, Icon, fill }) => (
        <Link
          key={to}
          to={to}
          className="group flex flex-col items-center gap-0.5 pb-1 text-[11px] text-muted-foreground"
          activeProps={{ className: "font-semibold text-primary" }}
        >
          {({ isActive }) => (
            <>
              <Icon className={isActive ? (fill ? "size-5 fill-primary/90 text-primary" : "size-5 text-primary") : "size-5"} strokeWidth={isActive ? 2.2 : 1.6} />
              {label}
            </>
          )}
        </Link>
      ))}
    </nav>
  );
}
