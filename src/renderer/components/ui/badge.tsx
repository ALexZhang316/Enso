import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@renderer/lib/utils";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium", {
  variants: {
    variant: {
      default: "bg-primary/10 text-primary",
      muted: "bg-black/[0.04] text-muted-foreground",
      outline: "border border-black/[0.08] text-muted-foreground"
    }
  },
  defaultVariants: {
    variant: "default"
  }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...props }: BadgeProps): JSX.Element => (
  <div className={cn(badgeVariants({ variant }), className)} {...props} />
);
