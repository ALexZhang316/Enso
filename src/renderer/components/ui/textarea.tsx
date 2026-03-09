import * as React from "react";
import { cn } from "@renderer/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[80px] w-full rounded-xl bg-black/[0.04] px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:bg-white resize-none disabled:cursor-not-allowed disabled:opacity-40",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
