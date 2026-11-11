import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { AppButton } from "@/components/move/AppButton";
import { AppleIcon, GoogleIcon } from "@/components/move/BrandIcons";
import { Screen } from "@/components/move/Screen";
import { authErrorMessage, signInWith } from "@/lib/session";
import { pageHead } from "@/lib/head";

export const Route = createFileRoute("/get-started")({
  head: () => pageHead("Get started", "Sign in with your email, Google or Apple to start riding."),
  component: GetStarted,
});

function GetStarted() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<null | "google" | "apple">(null);
  const [error, setError] = useState("");

  const social = async (which: "google" | "apple") => {
    setBusy(which);
    setError("");
    try {
      await signInWith(which);
    } catch (e) {
      console.error(e);
      setError(authErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <div className="flex flex-1 flex-col px-5 pt-safe">
        <h1 className="mt-16 text-[22px] font-bold">Let's get you started</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Pick a way in. We'll get you moving in seconds.</p>

        <div className="mt-9 space-y-3">
          <AppButton onClick={() => navigate({ to: "/email" })}>
            <Mail className="size-[18px]" /> Continue with Email
          </AppButton>
          <AppButton variant="outline" size="md" disabled={!!busy} onClick={() => social("google")}>
            {busy === "google" ? <Loader2 className="size-[18px] animate-spin" /> : <GoogleIcon />} Continue with Google
          </AppButton>
          <AppButton variant="outline" size="md" disabled={!!busy} onClick={() => social("apple")}>
            {busy === "apple" ? <Loader2 className="size-[18px] animate-spin" /> : <AppleIcon />} Continue with Apple
          </AppButton>
          {error && <p className="px-2 text-center text-xs text-destructive">{error}</p>}
        </div>

        <p className="mt-auto pb-safe pt-6 text-center text-[11px] leading-snug text-muted-foreground">
          By continuing, you agree to our{" "}
          <a href="#" className="text-foreground underline">
            Terms &amp; Privacy Policy
          </a>{" "}
          and
          <br />
          confirm you're 18+.
        </p>
      </div>
    </Screen>
  );
}
