import { X } from "lucide-react";
import type { ReactNode } from "react";

/** A modal sheet that stays inside the phone frame. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-scrim animate-scrim-in" />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-card px-5 pb-safe pt-4 animate-sheet-up">
        {title && (
          <div className="relative mb-3 flex items-center justify-center">
            <h3 className="text-[15px] font-semibold">{title}</h3>
            <button
              aria-label="Close"
              onClick={onClose}
              className="absolute right-0 flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
