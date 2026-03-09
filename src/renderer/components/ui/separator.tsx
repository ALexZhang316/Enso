import * as React from "react";
import { cn } from "@renderer/lib/utils";

export const Separator = ({ className, ...props }: React.HTMLAttributes<HTMLHRElement>): JSX.Element => (
  <hr className={cn("border-0 border-t border-black/[0.06] mx-4", className)} {...props} />
);
