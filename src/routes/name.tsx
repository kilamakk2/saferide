import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppButton } from "@/components/move/AppButton";
import { StepLayout } from "@/components/move/Screen";
import { getState } from "@/lib/move-store";
import { saveProfile } from "@/lib/session";
import { pageHead } from "@/lib/head";
import { isValidName } from "@/lib/validation";

export const Route = createFileRoute("/name")({
  head: () => pageHead("What's your name?", "Enter your name as it appears on your ID or passport."),
  component: NameStep,
});

function NameStep() {
  const navigate = useNavigate();
  const [name, setName] = useState(() => getState().user.name);
  const ok = isValidName(name);

  const submit = () => {
    if (!ok) return;
    void saveProfile({ name: name.trim() });
    navigate({ to: "/role" });
  };

  return (
    <StepLayout
      title="What's your name?"
      subtitle="Please enter name as it appears on your ID or passport."
      footer={
        <AppButton disabled={!ok} onClick={submit} className="mb-6">
          Continue
        </AppButton>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="full-name" className="text-[13px] font-semibold">
          Full Name
        </label>
        <input
          id="full-name"
          autoFocus
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g Aisha Monday"
          className="mt-2 h-11 w-full rounded-lg border border-input bg-card px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
        />
      </form>
    </StepLayout>
  );
}
