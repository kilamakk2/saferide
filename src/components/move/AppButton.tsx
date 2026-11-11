import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const appButton = cva(
  "inline-flex w-full items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 active:scale-[0.98] disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:brightness-110 disabled:bg-disabled disabled:text-disabled-foreground disabled:hover:brightness-100",
        soft: "bg-secondary text-secondary-foreground hover:brightness-95",
        ghost: "bg-muted text-muted-foreground hover:brightness-95",
        outline:
          "border border-border bg-card text-muted-foreground hover:bg-muted font-normal",
        danger: "bg-danger-soft text-destructive",
      },
      size: {
        lg: "h-12 text-[15px]",
        md: "h-10 text-sm",
        sm: "h-8 px-4 text-xs",
      },
    },
    defaultVariants: { variant: "primary", size: "lg" },
  },
);

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof appButton>;

export const AppButton = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(appButton({ variant, size }), className)} {...props} />
  ),
);
AppButton.displayName = "AppButton";
