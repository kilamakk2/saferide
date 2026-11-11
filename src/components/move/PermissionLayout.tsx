import type { ReactNode } from "react";
import { AppButton } from "./AppButton";
import { Screen } from "./Screen";

export function PermissionLayout({
  title,
  highlight,
  text,
  visual,
  cta,
  onAllow,
  onSkip,
  busy,
}: {
  title: string;
  highlight: string;
  text: string;
  visual: ReactNode;
  cta: string;
  onAllow: () => void;
  onSkip: () => void;
  busy?: boolean;
}) {
  return (
    <Screen>
      <div className="flex flex-1 flex-col px-5 pt-safe">
        <div className="mt-14 text-center animate-fade-up">
          <h1 className="text-[26px] font-extrabold leading-[1.15]">
            {title}
            <br />
            <span className="text-primary">{highlight}</span>
          </h1>
          <p className="mx-auto mt-2 max-w-[17rem] text-[13px] leading-snug text-muted-foreground">{text}</p>
        </div>
        <div className="relative mx-auto mt-6 w-[78%] flex-1 animate-fade-up [animation-delay:120ms]">{visual}</div>
        <div className="relative z-10 -mt-3 space-y-3 pb-safe">
          <AppButton onClick={onAllow} disabled={busy}>
            {cta}
          </AppButton>
          <AppButton variant="soft" onClick={onSkip}>
            Maybe later
          </AppButton>
          <p className="pb-3 text-center text-[11px] text-muted-foreground">You can change settings any time.</p>
        </div>
      </div>
    </Screen>
  );
}
