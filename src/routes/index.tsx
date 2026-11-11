import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/move/Logo";
import { getState } from "@/lib/move-store";
import { nextPath, useAuthStatus } from "@/lib/session";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/")({
  head: () => pageHead("Pay less. Ride more.", "Move — cheap shared bus, mini bus and taxi rides around Gulu."),
  component: Splash,
});

function Splash() {
  const navigate = useNavigate();
  const status = useAuthStatus();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShown(true), 1400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!shown || status === "loading") return;
    navigate({ to: status === "signed-in" ? nextPath(getState().user) : "/welcome", replace: true });
  }, [shown, status, navigate]);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background">
      <Logo className="w-28 animate-logo-in" />
    </div>
  );
}
