import { cn } from "@/lib/utils";

/** Primary team-admin section tabs (Members, Deck Manager, …). */
export function teamAdminTabClass(isActive: boolean) {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap border-b px-3 py-2.5 text-xs font-medium transition-colors sm:px-4 sm:text-sm",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    isActive
      ? "border-foreground text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground",
  );
}

/** Nested pill tabs (Send invite, Pending, …). */
export function teamAdminSubTabClass(isActive: boolean) {
  return cn(
    "inline-flex h-9 shrink-0 items-center justify-center rounded-md px-3 text-xs font-medium transition-colors sm:text-sm",
    isActive
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground",
  );
}

export const teamAdminCardClass = "border-border/80 bg-card/60 shadow-sm";

export const teamAdminTableWrapClass =
  "overflow-x-auto rounded-lg border border-border/80 bg-background/40";
