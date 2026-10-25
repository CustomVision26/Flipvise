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
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap border px-3.5 py-2 text-xs transition-all duration-200 sm:px-4 sm:py-2.5 sm:text-sm",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_8px_16px_-12px_rgba(0,0,0,0.65)] sm:rounded-none sm:rounded-t-xl sm:border-b-2",
    isActive
      ? "border-violet-200 bg-violet-100 font-semibold text-violet-800 shadow-none"
      : "border-transparent bg-transparent font-medium text-slate-500 hover:bg-violet-50 hover:text-violet-800",
  );
}

/** Nested pill tabs (Send invite, Pending, Quiz Mode, …). */
export function teamAdminSubTabClass(isActive: boolean) {
  return cn(
    "team-admin-subtab inline-flex h-9 shrink-0 items-center justify-center rounded-full border px-3.5 text-xs font-medium transition-colors sm:text-sm",
    isActive
      ? "team-admin-subtab-active border-violet-200 bg-violet-100 font-semibold text-violet-800"
      : "border-transparent text-slate-500 hover:bg-violet-50 hover:text-violet-800",
  );
}

export const teamAdminCardClass =
  "team-admin-surface rounded-2xl border border-stone-200 bg-white text-slate-900 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]";

/** Open tab panel — primary border, bold presence, entrance motion. */
export const teamAdminActivePanelClass = cn(
  "team-admin-surface rounded-2xl border border-stone-200 bg-white text-slate-900 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)]",
  "animate-in fade-in-0 slide-in-from-bottom-3 duration-300 fill-mode-both",
);

/** Nested sub-tab content (invite send / pending / history, etc.). */
export const teamAdminSubTabPanelClass = "rounded-2xl p-1 sm:p-2";

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
  "overflow-x-auto rounded-lg border border-stone-200 bg-white";
