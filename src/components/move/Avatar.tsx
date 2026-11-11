import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

/** A person's photo, or a plain silhouette when they haven't added one. */
export function Avatar({ src, alt = "", className }: { src: string | null | undefined; alt?: string; className?: string }) {
  return src ? (
    <img src={src} alt={alt} className={cn("object-cover", className)} />
  ) : (
    <span className={cn("flex items-center justify-center bg-secondary text-muted-foreground", className)} aria-label={alt || undefined}>
      <UserRound className="size-1/2" />
    </span>
  );
}
