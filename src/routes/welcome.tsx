import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import slide1 from "@/assets/onboarding-1.jpg";
import slide2 from "@/assets/onboarding-2.jpg";
import slide3 from "@/assets/onboarding-3.jpg";
import { AppButton } from "@/components/move/AppButton";
import { pageHead } from "@/lib/head";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/welcome")({
  head: () => pageHead("Welcome", "Lower fares, shared rides, and the freedom to ride or drive."),
  component: Welcome,
});

const SLIDES = [
  { img: slide1, title: "Pay less. Ride more.", text: "Lower fares than your usual ride app.\nNo surge wahala." },
  { img: slide2, title: "Share rides. Split fares.", text: "Hop in with someone heading your\nway. Easy match, safe trip." },
  { img: slide3, title: "Ride or drive, your call.", text: "Earn behind the wheel or ride in\ncomfort. Switch anytime." },
];

function Welcome() {
  const [i, setI] = useState(0);
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const navigate = useNavigate();
  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i]!;

  const next = () => (last ? navigate({ to: "/get-started" }) : setI(i + 1));

  return (
    <div
      className="statusbar-light absolute inset-0 touch-pan-y overflow-hidden bg-ink"
      onPointerDown={(e) => (start.current = e.clientX)}
      onPointerMove={(e) => start.current !== null && setDrag(e.clientX - start.current)}
      onPointerUp={() => {
        if (drag < -50 && i < SLIDES.length - 1) setI(i + 1);
        if (drag > 50 && i > 0) setI(i - 1);
        start.current = null;
        setDrag(0);
      }}
      onPointerLeave={() => {
        start.current = null;
        setDrag(0);
      }}
    >
      <div
        className={cn("flex h-full", drag === 0 && "transition-transform duration-500 ease-out")}
        style={{ transform: `translateX(calc(${-i * 100}% + ${drag}px))` }}
      >
        {SLIDES.map((s, idx) => (
          <div key={s.title} className="relative h-full w-full shrink-0">
            <img
              src={s.img}
              alt=""
              width={768}
              height={1344}
              draggable={false}
              loading={idx === 0 ? "eager" : "lazy"}
              className="absolute inset-0 size-full select-none object-cover"
            />
            <div className="absolute inset-0 bg-photo-fade" />
          </div>
        ))}
      </div>

      <Link
        to="/get-started"
        className="absolute right-5 top-safe mt-3 z-10 text-sm font-medium text-on-photo"
      >
        Skip
      </Link>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-5 pb-safe">
        <div key={i} className="text-center animate-fade-up">
          <h1 className="text-[28px] font-extrabold text-on-photo">{slide.title}</h1>
          <p className="mt-1 whitespace-pre-line text-[15px] leading-snug text-on-photo-muted">
            {slide.text}
          </p>
        </div>
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {SLIDES.map((s, idx) => (
            <span
              key={s.title}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                idx === i ? "w-7 bg-primary" : "w-1.5 bg-on-photo-dot",
              )}
            />
          ))}
        </div>
        <AppButton className="pointer-events-auto mt-6 mb-4" onClick={next}>
          {last ? "Let's go!" : "Continue"}
        </AppButton>
      </div>
    </div>
  );
}
