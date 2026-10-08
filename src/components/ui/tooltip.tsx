// SHADCN Tooltip implementation
import * as React from "react";
import * as RadixTooltip from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = RadixTooltip.Provider;
const TooltipRoot = RadixTooltip.Root;
const TooltipTrigger = RadixTooltip.Trigger;
const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof RadixTooltip.Content>
>(({ className, side = "top", align = "center", ...props }, ref) => (
  <RadixTooltip.Content
    ref={ref}
    side={side}
    align={align}
    className={cn(
      "z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = RadixTooltip.Content.displayName;

export {
  TooltipProvider,
  TooltipRoot as Tooltip,
  TooltipTrigger,
  TooltipContent
};
