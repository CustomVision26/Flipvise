import { cn } from "@/lib/utils";

/** Scroll targets for team-admin section tabs — used in URLs (`#…`) and panel headings. */
export const TEAM_ADMIN_PANEL_IDS = {
  members: "team-admin-panel-members",
  deckManager: "team-admin-panel-deck-manager",
  workspaceHistory: "team-admin-panel-workspace-history",
  inviteMembers: "team-admin-panel-invite-members",
  quizResults: "team-admin-panel-quiz-results",
} as const;

export const teamAdminPanelScrollClass = "scroll-mt-24 sm:scroll-mt-28";

export function teamAdminPanelHref(href: string, panelId: string): string {
  const base = href.split("#")[0] ?? href;
  return `${base}#${panelId}`;
}

/** Primary team-admin section tabs (Members, Deck Manager, …). */
export function teamAdminTabClass(isActive: boolean) {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap px-3.5 py-2 text-xs transition-all duration-200 sm:px-4 sm:py-2.5 sm:text-sm",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "rounded-full sm:rounded-none sm:border-b",
    isActive
      ? "bg-primary font-bold text-primary-foreground shadow-sm sm:border-primary sm:bg-transparent sm:font-semibold sm:text-foreground"
      : "bg-muted/60 font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:border-transparent sm:bg-transparent sm:hover:bg-transparent sm:hover:text-foreground",
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

/** Open tab panel — primary border, bold presence, entrance motion. */
export const teamAdminActivePanelClass = cn(
  "border-2 border-primary bg-card/90 shadow-lg",
  "ring-2 ring-primary/20",
  "animate-in fade-in-0 slide-in-from-bottom-3 duration-300 fill-mode-both",
);

export const teamAdminActivePanelTitleClass =
  "text-base font-bold tracking-tight text-foreground sm:text-lg";

/** Bold primary links for team admins navigating workspace ↔ deck ↔ study. */
export const teamWorkspaceNavLinkClass = cn(
  "font-bold text-primary underline-offset-4",
  "transition-all duration-200 hover:text-primary/85 hover:underline",
  "animate-in fade-in-0 slide-in-from-left-1 duration-300 fill-mode-both",
);

export const teamWorkspaceDeckTitleLinkClass = cn(
  teamWorkspaceNavLinkClass,
  "inline-block break-words tracking-tight slide-in-from-bottom-1",
);

export const teamAdminTableWrapClass =
  "overflow-x-auto rounded-lg border border-border/80 bg-background/40";
