import { cn } from "@/lib/utils";

/** Bold border around the visible content panel for a tab or sub-tab. */
export const tabPanelContentClass = cn(
  "rounded-xl border-2 border-primary bg-card/90 shadow-sm ring-1 ring-primary/20",
);

/** Tab panel with standard inner padding. */
export const tabPanelContentPadClass = cn(tabPanelContentClass, "p-4");
