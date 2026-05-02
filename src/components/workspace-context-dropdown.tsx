"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { setTeamContextCookieAction } from "@/actions/teams";
import {
  buildTeamWorkspaceDashboardPath,
  type TeamWorkspaceNavTeam,
} from "@/lib/team-workspace-url";
import { buildTeamAdminPath } from "@/lib/team-admin-url";
import { shouldHidePlatformAdminNav } from "@/lib/hide-platform-admin-nav";
import { cn } from "@/lib/utils";
import { isTeamPlanId } from "@/lib/team-plans";
import { FREE_PERSONAL_WORKSPACE_NAV_TEAM_LIMIT } from "@/lib/workspace-nav-limits";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type WorkspaceTeamOption = TeamWorkspaceNavTeam;

interface WorkspaceContextDropdownProps {
  teams: WorkspaceTeamOption[];
  /** Total eligible team workspaces (owner / co-admin / member). May exceed `teams` for free personal. */
  totalEligibleTeamCount?: number;
  /** Selected team workspace, or null for personal (no cookie). */
  activeTeamId: number | null;
  /** Personal `/dashboard` URL (no sensitive query string). */
  personalWorkspaceHref?: string;
  /** Plan label next to "Personal" (e.g. Team Gold, Pro, Free). */
  personalPlanLabel?: string;
}

export function WorkspaceContextDropdown({
  teams,
  totalEligibleTeamCount = teams.length,
  activeTeamId,
  personalWorkspaceHref = "/dashboard",
  personalPlanLabel = "Free",
}: WorkspaceContextDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [pending, setPending] = React.useState(false);

  const selectedTeam = teams.find((t) => t.id === activeTeamId);
  const personalPrimaryLabel = "Personal";
  const triggerLabel =
    activeTeamId === null || selectedTeam === undefined
      ? `${personalPrimaryLabel} · ${personalPlanLabel}`
      : `${selectedTeam.name} · ${selectedTeam.planLabel}`;

  const teamsNavLimited =
    totalEligibleTeamCount > teams.length && teams.length > 0;

  const q = query.trim().toLowerCase();
  const personalMatches =
    q === "" ||
    "personal".includes(q) ||
    personalPlanLabel.toLowerCase().includes(q);
  const filteredTeams = React.useMemo(() => {
    if (q === "") return teams;
    return teams.filter((t) => {
      const hay = `${t.name} ${t.planLabel} ${t.ownerDisplayName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [teams, q]);

  /**
   * True when the signed-in user owns at least one team-tier workspace.
   * Uses the server-computed `isSubscriberOwned` flag rather than comparing
   * `ownerUserId` against the client-side `useAuth()` userId, which can be
   * null during SSR hydration and cause a structural mismatch (removeChild crash).
   */
  const subscriberOwnsTeamTierWorkspace = React.useMemo(() => {
    return teams.some(
      (t) => t.isSubscriberOwned && isTeamPlanId(t.planUrlValue),
    );
  }, [teams]);

  /** Team workspaces this session user owns (same subscriber as Personal), filtered — only used when {@link subscriberOwnsTeamTierWorkspace}. */
  const subscriberOwnTeamsFiltered = React.useMemo(() => {
    if (!subscriberOwnsTeamTierWorkspace) return [];
    return filteredTeams.filter((t) => t.isSubscriberOwned);
  }, [filteredTeams, subscriberOwnsTeamTierWorkspace]);

  /** Other subscribers’ workspaces, grouped by `ownerUserId` (dividers between owners). */
  const otherSubscriberWorkspaceGroups = React.useMemo(() => {
    const list =
      subscriberOwnsTeamTierWorkspace
        ? filteredTeams.filter((t) => !t.isSubscriberOwned)
        : filteredTeams;
    const map = new Map<string, TeamWorkspaceNavTeam[]>();
    const ownerOrder: string[] = [];
    for (const t of list) {
      if (!map.has(t.ownerUserId)) {
        ownerOrder.push(t.ownerUserId);
        map.set(t.ownerUserId, []);
      }
      map.get(t.ownerUserId)!.push(t);
    }
    return ownerOrder.map((ownerUserId) => ({
      ownerUserId,
      teams: map.get(ownerUserId)!,
    }));
  }, [filteredTeams, subscriberOwnsTeamTierWorkspace]);

  const otherSubscriberGroupsNonEmpty = otherSubscriberWorkspaceGroups.some(
    (g) => g.teams.length > 0,
  );
  const subscriberSectionHasRows =
    (personalMatches && subscriberOwnsTeamTierWorkspace) ||
    (subscriberOwnsTeamTierWorkspace && subscriberOwnTeamsFiltered.length > 0);

  async function selectPersonal() {
    setPending(true);
    try {
      await setTeamContextCookieAction(null);
      setOpen(false);
      setQuery("");
      router.push(personalWorkspaceHref);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function selectTeam(team: TeamWorkspaceNavTeam) {
    setPending(true);
    try {
      await setTeamContextCookieAction(team.id);
      setOpen(false);
      setQuery("");
      router.push(
        buildTeamWorkspaceDashboardPath({
          teamId: team.id,
        }),
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function onOpenChange(next: boolean) {
    if (!pending) {
      setOpen(next);
      if (!next) setQuery("");
    }
  }

  function teamWorkspaceMenuItem(t: TeamWorkspaceNavTeam) {
    const isActive = t.id === activeTeamId;
    const teamAdminHref = buildTeamAdminPath(t.id);
    return (
      <DropdownMenuItem
        key={t.id}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-team-admin-dash-link]")) return;
          void selectTeam(t);
        }}
        className="cursor-pointer gap-2 items-start py-2 pr-1.5"
        disabled={pending}
      >
        <Check
          className={cn(
            "mt-0.5 size-4 shrink-0",
            isActive ? "opacity-100" : "opacity-0",
          )}
          aria-hidden
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
          <span className="truncate text-sm font-medium leading-tight">
            Team: {t.name}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            <span>{t.planLabel}</span>
            <span className="mx-1" aria-hidden>
              ·
            </span>
            <span>{t.ownerDisplayName}</span>
          </span>
        </span>
        {t.canAccessTeamAdmin && !shouldHidePlatformAdminNav(pathname) ? (
          <Button
            nativeButton={false}
            variant="secondary"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs whitespace-nowrap"
            render={
              <Link
                data-team-admin-dash-link
                href={teamAdminHref}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  setQuery("");
                }}
              />
            }
          >
            To Admin Dash
          </Button>
        ) : null}
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        disabled={pending}
        render={(props) => (
          <Button
            {...props}
            variant="outline"
            size="sm"
            className="h-9 min-w-[9.5rem] max-w-[12rem] justify-between gap-1.5 px-2.5 font-normal sm:min-w-[10.5rem] sm:max-w-[14rem]"
            aria-label={`Workspace: ${triggerLabel}`}
          >
            <span
              className="truncate text-left"
              title={
                selectedTeam
                  ? `${selectedTeam.name} · ${selectedTeam.planLabel} · ${selectedTeam.ownerDisplayName}`
                  : triggerLabel
              }
            >
              {triggerLabel}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="w-72 p-0 sm:w-80">
        <div
          className="border-b border-border p-2"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workspaces…"
              className="h-9 bg-background pl-9"
              autoComplete="off"
              disabled={pending}
              aria-label="Search workspaces"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-scroll p-1 [scrollbar-width:thin] [scrollbar-color:hsl(var(--border))_transparent]">
          <DropdownMenuGroup>
            {teamsNavLimited && (
              <div className="px-2 pb-2">
                <Tooltip>
                  <TooltipTrigger
                    render={(props) => (
                      <button
                        type="button"
                        {...props}
                        className={cn(
                          "flex w-full items-start gap-2 rounded-md border border-border bg-muted/40 px-2 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/60",
                          props.className,
                        )}
                      >
                        <Info
                          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <span className="min-w-0 leading-snug">
                          Showing {teams.length} of {totalEligibleTeamCount} team workspaces (Free
                          personal shows up to {FREE_PERSONAL_WORKSPACE_NAV_TEAM_LIMIT}). Hover for
                          details — upgrade to Personal Pro to access every team linked to your
                          account.
                        </span>
                      </button>
                    )}
                  />
                  <TooltipContent side="left" className="max-w-xs flex flex-col gap-2 text-xs">
                    <p className="text-background">
                      Personal Pro unlocks the full list of team workspaces associated with your
                      email across Flipvise. Upgrade to switch among all your teams without this
                      limit.
                    </p>
                    <Link
                      href="/pricing"
                      className="font-medium text-background underline underline-offset-2 hover:opacity-90"
                    >
                      View Pro plans
                    </Link>
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
            <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Workspace
            </DropdownMenuLabel>
            {personalMatches && (
              <DropdownMenuItem
                onClick={() => void selectPersonal()}
                className="cursor-pointer gap-2"
                disabled={pending}
              >
                <Check
                  className={cn(
                    "size-4 shrink-0",
                    activeTeamId === null ? "opacity-100" : "opacity-0",
                  )}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="truncate">{personalPrimaryLabel}</span>
                  <span className="shrink-0 text-muted-foreground">·</span>
                  <span className="shrink-0 text-muted-foreground">{personalPlanLabel}</span>
                </span>
              </DropdownMenuItem>
            )}
            {subscriberOwnsTeamTierWorkspace &&
              subscriberOwnTeamsFiltered.map((t) => teamWorkspaceMenuItem(t))}
            {/* ── Divider + label before invited workspaces (user doesn't own team-tier) ── */}
            {!subscriberOwnsTeamTierWorkspace &&
              personalMatches &&
              filteredTeams.length > 0 && (
                <>
                  <div role="separator" className="-mx-1 my-1 h-px bg-border" />
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Invited workspaces
                  </div>
                </>
              )}
            {/* ── Divider + label before invited workspaces (user owns team-tier too) ── */}
            {subscriberOwnsTeamTierWorkspace &&
              otherSubscriberGroupsNonEmpty &&
              subscriberSectionHasRows && (
                <>
                  <div role="separator" className="-mx-1 my-1 h-px bg-border" />
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    Invited workspaces
                  </div>
                </>
              )}
            {otherSubscriberWorkspaceGroups.map((group, groupIndex) => (
              <React.Fragment key={group.ownerUserId}>
                {groupIndex > 0 && <DropdownMenuSeparator className="my-1" />}
                {group.teams.map((t) => teamWorkspaceMenuItem(t))}
              </React.Fragment>
            ))}
            {!personalMatches && filteredTeams.length === 0 && (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                No matching workspaces.
              </p>
            )}
            {personalMatches && filteredTeams.length === 0 && q !== "" && (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                No teams match. Try another search.
              </p>
            )}
          </DropdownMenuGroup>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
