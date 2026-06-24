"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeaderNavTooltip } from "@/components/header-nav-tooltip";
import { openHelpCenter } from "@/lib/help-center-open";

/** Header icon that opens the in-app Help Center sheet. */
export function HelpCenterNavIconButton() {
  return (
    <HeaderNavTooltip label="Help Center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        aria-label="Open Help Center"
        onClick={() => openHelpCenter()}
      >
        <HelpCircle className="size-[18px]" aria-hidden />
      </Button>
    </HeaderNavTooltip>
  );
}
