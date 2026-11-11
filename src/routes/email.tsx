import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { AppButton } from "@/components/move/AppButton";
import { StepLayout } from "@/components/move/Screen";
import { authErrorMessage, emailSignIn, emailSignUp, resetPassword } from "@/lib/session";
import { pageHead } from "@/lib/head";
import { isValidEmail } from "@/lib/validation";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/email")({
  head: () => pageHead("Continue with email", "Sign in or create your account with your email and a password."),
  component: EmailStep,
});

const field =
  "h-11 w-full rounded-lg border border-input bg-card px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary";

function EmailStep() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setNote("");
    if (!isValidEmail(email)) return setError("Enter a valid email address");
    if (password.length < 6) return setError("Use a password with at least 6 characters");
    setBusy(true);
    setError("");
    try {
      if (mode === "signin") await emailSignIn(email, password);
      else await emailSignUp(email, password);
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setNote("");
    if (!isValidEmail(email)) return setError("Enter your email above first");
    setError("");
    try {
      await resetPassword(email);
      setNote(`We sent a password reset link to ${email.trim()}.`);
    } catch (e) {
      setError(authErrorMessage(e));
    }
  };

  return (
    <StepLayout
      title={mode === "signin" ? "Welcome back" : "Create your account"}
      subtitle={mode === "signin" ? "Sign in with your email and password." : "Use your email and pick a password."}
    >
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-sm">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError("");
            }}
            className={cn("rounded-full py-2 transition-colors", mode === m ? "bg-card font-semibold shadow-float" : "text-muted-foreground")}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          type="email"
          autoFocus
          autoComplete="email"
          aria-label="Email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          placeholder="e.g. johndoe@gmail.com"
          className={field}
        />
        <input
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          aria-label="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          placeholder={mode === "signin" ? "Password" : "Choose a password (6+ characters)"}
          className={field}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        {note && <p className="text-xs text-primary">{note}</p>}
        <AppButton type="submit" className="mt-1" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </AppButton>
        {mode === "signin" && (
          <button type="button" onClick={forgot} className="w-full pt-1 text-center text-xs font-semibold text-primary">
            Forgot password?
          </button>
        )}
      </form>
    </StepLayout>
  );
}
