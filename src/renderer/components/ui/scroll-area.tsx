import * as React from "react";
import { cn } from "@renderer/lib/utils";

export const ScrollArea = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): JSX.Element => (
  <div className={cn("overflow-y-auto", className)} {...props} />
);
