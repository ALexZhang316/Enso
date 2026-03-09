import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@renderer/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-[10px] text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white shadow-[0_1px_2px_rgba(0,122,255,0.3)] hover:brightness-110 active:brightness-90 active:scale-[0.97]",
        outline:
          "border border-primary/25 bg-primary/[0.06] text-primary hover:bg-primary/[0.12] active:bg-primary/[0.18] active:scale-[0.97]",
        ghost:
          "text-primary hover:bg-black/[0.04] active:bg-black/[0.08] active:scale-[0.97]",
        muted:
          "bg-black/[0.04] text-muted-foreground hover:bg-black/[0.07] active:bg-black/[0.10] active:scale-[0.97]"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-[30px] rounded-lg px-3 text-xs",
        lg: "h-10 rounded-xl px-6",
        icon: "h-9 w-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
