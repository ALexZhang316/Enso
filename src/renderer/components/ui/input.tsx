import * as React from "react";
import { cn } from "@renderer/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-9 w-full rounded-[10px] bg-black/[0.04] px-3 py-1 text-[13px] text-foreground placeholder:text-muted-foreground/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white disabled:cursor-not-allowed disabled:opacity-40",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
