import { useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("absolute inset-0 flex flex-col bg-background animate-screen-in", className)}>
      {children}
    </div>
  );
}

export function BackButton({ onClick }: { onClick?: () => void }) {
  const router = useRouter();
  return (
    <button
      aria-label="Go back"
      onClick={onClick ?? (() => router.history.back())}
      className="-ml-2 flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
    >
      <ArrowLeft className="size-5" />
    </button>
  );
}

/** Standard step layout: back arrow, title, subtitle, body and pinned footer. */
export function StepLayout({
  title,
  subtitle,
  children,
  footer,
  back = true,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  back?: boolean;
}) {
  return (
    <Screen>
      <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-5 pt-safe">
        <div className="mt-3 h-10">{back && <BackButton />}</div>
        <h1 className="mt-4 text-[22px] font-bold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{subtitle}</p>}
        <div className="mt-7 flex-1">{children}</div>
      </div>
      {footer && <div className="px-5 pb-safe pt-3">{footer}</div>}
    </Screen>
  );
}
