"use client";

import type { ReactElement } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type HeaderNavTooltipProps = {
  label: string;
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
};

/** Styled tooltip for top-header controls (not for dropdown triggers — use native `title` there). */
export function HeaderNavTooltip({
  label,
  children,
  side = "bottom",
}: HeaderNavTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
