"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function TeacherTooltipButton({
  tooltip,
  side = "top",
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & {
  tooltip: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const button = (
    <Button className={className} {...props}>
      {children}
    </Button>
  );

  if (props.disabled) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              className={cn("inline-flex", props.disabled && "cursor-not-allowed")}
            />
          }
        >
          {button}
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>{button}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
