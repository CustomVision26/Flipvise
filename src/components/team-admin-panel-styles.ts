import { cn } from "@/lib/utils";
import { tabPanelContentClass } from "@/lib/tab-panel-styles";

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
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap border px-3.5 py-2 text-xs transition-all duration-200 sm:px-4 sm:py-2.5 sm:text-sm",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_16px_-12px_rgba(0,0,0,0.65)] sm:rounded-none sm:rounded-t-xl sm:border-b-2",
    isActive
      ? "border-sky-300/55 bg-primary font-bold text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_18px_-12px_rgba(56,189,248,0.85)] sm:border-sky-300 sm:bg-transparent sm:font-semibold sm:text-foreground sm:shadow-[inset_0_-2px_0_0_rgba(56,189,248,0.95)]"
      : "border-transparent bg-muted/70 font-medium text-muted-foreground hover:-translate-y-0.5 hover:bg-muted hover:text-foreground sm:bg-transparent sm:shadow-none sm:hover:translate-y-0 sm:hover:bg-transparent sm:hover:text-foreground",
      : "border-transparent bg-muted/70 font-medium text-muted-foreground hover:-translate-y-0.5 hover:bg-muted hover:text-foreground sm:bg-transparent sm:shadow-none sm:hover:translate-y-0 sm:hover:bg-transparent sm:hover:text-foreground",
  );
}

/** Nested pill tabs (Send invite, Pending, …). */
export function teamAdminSubTabClass(isActive: boolean) {
  return cn(
    "inline-flex h-9 shrink-0 items-center justify-center rounded-full border px-3 text-xs font-medium transition-all duration-200 sm:text-sm",
    isActive
      ? "border-emerald-300/45 bg-background font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_8px_16px_-12px_rgba(16,185,129,0.8)]"
      : "border-transparent text-muted-foreground hover:-translate-y-0.5 hover:bg-muted/70 hover:text-foreground",
  );
}

export const teamAdminCardClass =
  "border-border/80 bg-card/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_16px_32px_-22px_rgba(0,0,0,0.65)]";

/** Open tab panel — primary border, bold presence, entrance motion. */
export const teamAdminActivePanelClass = cn(
  tabPanelContentClass,
  "shadow-lg ring-2 ring-primary/20",
  "animate-in fade-in-0 slide-in-from-bottom-3 duration-300 fill-mode-both",
);

/** Nested sub-tab content (invite send / pending / history, etc.). */
export const teamAdminSubTabPanelClass = cn(tabPanelContentClass, "p-4");

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
