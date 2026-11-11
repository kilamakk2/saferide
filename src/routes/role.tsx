import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CarFront, UsersRound } from "lucide-react";
import { useState } from "react";
import { AppButton } from "@/components/move/AppButton";
import { StepLayout } from "@/components/move/Screen";
import { getState, type Role } from "@/lib/move-store";
import { saveProfile } from "@/lib/session";
import { pageHead } from "@/lib/head";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/role")({
  head: () => pageHead("Choose your role", "Ride around Gulu as a passenger, or drive and earn."),
  component: RoleStep,
});

const ROLES: { id: Role; title: string; text: string; Icon: typeof UsersRound }[] = [
  { id: "passenger", title: "Passenger", text: "I'm here to ride and travel around Gulu", Icon: UsersRound },
  { id: "driver", title: "Driver", text: "I'm here to drive and earn.", Icon: CarFront },
];

function RoleStep() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role | null>(() => getState().user.role);

  return (
    <StepLayout
      title="Welcome to Move Naija"
      subtitle="Choose your role to get started."
      footer={
        <div className="mb-3">
          <AppButton
            disabled={!role}
            onClick={() => {
              void saveProfile({ role });
              navigate({ to: "/profile-photo" });
            }}
          >
            Continue
          </AppButton>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            You can switch roles anytime in settings.
          </p>
        </div>
      }
    >
      <div className="-mt-2 space-y-3" role="radiogroup">
        {ROLES.map(({ id, title, text, Icon }) => {
          const active = role === id;
          return (
            <button
              key={id}
              role="radio"
              aria-checked={active}
              onClick={() => setRole(id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition-all",
                active ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                )}
              >
                <Icon className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-muted-foreground">{text}</span>
              </span>
            </button>
          );
        })}
      </div>
    </StepLayout>
  );
}
