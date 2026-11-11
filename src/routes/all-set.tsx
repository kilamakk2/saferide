import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { useMemo } from "react";
import { AppButton } from "@/components/move/AppButton";
import { Screen } from "@/components/move/Screen";
import { useMove } from "@/lib/move-store";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/all-set")({
  head: () => pageHead("You're all set!", "Welcome aboard. Let's find your first ride."),
  component: AllSet,
});

const COLORS = ["bg-confetti-1", "bg-confetti-2", "bg-confetti-3", "bg-confetti-4", "bg-confetti-5"];

function AllSet() {
  const navigate = useNavigate();
  const name = useMove((s) => s.user.name);
  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: (i * 37) % 100,
        delay: -((i * 0.37) % 4),
        dur: 3 + ((i * 13) % 30) / 10,
        w: 3 + (i % 3) * 2,
        color: COLORS[i % COLORS.length],
      })),
    [],
  );

  return (
    <Screen>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {pieces.map((p, i) => (
          <span
            key={i}
            className={`absolute -top-4 h-2.5 rounded-[1px] opacity-80 confetti-piece ${p.color}`}
            style={{ left: `${p.left}%`, width: p.w, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
          />
        ))}
      </div>
      <div className="relative flex flex-1 flex-col items-center px-6 pt-safe text-center">
        <span className="mt-36 flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground animate-pop-in">
          <Check className="size-12" strokeWidth={3} />
        </span>
        <h1 className="mt-8 text-2xl font-bold animate-fade-up">You're all set!</h1>
        <p className="mt-1 max-w-[16rem] text-[13px] text-muted-foreground animate-fade-up">
          Welcome aboard, {name ? name.toUpperCase() : "friend"}! Let's find your first ride.
        </p>
        <AppButton className="mt-16" onClick={() => navigate({ to: "/home", replace: true })}>
          Go home
        </AppButton>
      </div>
    </Screen>
  );
}
