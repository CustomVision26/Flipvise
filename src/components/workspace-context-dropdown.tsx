"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "@clerk/nextjs";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, House, Info, Search } from "lucide-react";
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
import { buildTeacherPath } from "@/lib/teacher-url";
import { shouldHidePlatformAdminNav } from "@/lib/hide-platform-admin-nav";
import { cn } from "@/lib/utils";
import { isWorkspaceSubscriptionPlanSlug, hasEducationPlan } from "@/lib/education-plans";
import { FREE_PERSONAL_WORKSPACE_NAV_TEAM_LIMIT } from "@/lib/workspace-nav-limits";

export type WorkspaceTeamOption = TeamWorkspaceNavTeam;

export type TeamDashFallbackTarget = {
  teamId: number;
  planSlug: string;
  teamMemberUrlParam: number;
};

interface WorkspaceContextDropdownProps {
  teams: WorkspaceTeamOption[];
  /** Total eligible team workspaces (owner / co-admin / member). May exceed `teams` for free personal. */
  totalEligibleTeamCount?: number;
  /** Selected team workspace, or null for personal (no cookie). */
  activeTeamId: number | null;
  /** Personal dashboard URL. */
  personalWorkspaceHref?: string;
  /** Plan label next to "Personal" (e.g. Team Gold, Pro, Free). */
  personalPlanLabel?: string;
  /**
   * True when the signed-in user’s personal account has an active team-tier plan
   * (paid, affiliate, complimentary, admin-assigned, etc.). Pro / Pro Plus-only
   * subscribers who only co-admin invited teams must not see personal Team Admin Dash.
   */
  personalHasTeamTierPlan?: boolean;
  /**
   * When workspace nav omits owned team-tier rows, server still supplies a Team Admin Dash target.
   */
  teamDashFallback?: TeamDashFallbackTarget | null;
  /** Personal education plan (e.g. Education Plus) — show Teacher Dash on the personal row. */
  showTeacherDashboard?: boolean;
}

function workspaceArtSrc(team: TeamWorkspaceNavTeam): string {
  const name = team.name.toLowerCase();
  if (/class|college|university|study group|high school/.test(name)) {
    return "/artwork/home/workspace-class.png";
  }
  if (/corp|company|government|business|office/.test(name)) {
    return "/artwork/home/team-corp.png";
  }
  if (
    /elementary|school|academy|primary|kindergarten/.test(name) ||
    hasEducationPlan(team.planUrlValue)
  ) {
    return "/artwork/home/workspace-school.png";
  }
  return "/artwork/home/workspace-class.png";
}

export function WorkspaceContextDropdown({
  teams,
  totalEligibleTeamCount = teams.length,
  activeTeamId,
  personalWorkspaceHref = "/dashboard",
  personalPlanLabel = "Free",
  personalHasTeamTierPlan = false,
  teamDashFallback = null,
  showTeacherDashboard = false,
}: WorkspaceContextDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isLoaded: sessionLoaded } = useSession();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [pending, setPending] = React.useState(false);
  /** Invited workspace row expand — Team Admin / Teacher Dash actions. */
  const [expandedInvitedTeamId, setExpandedInvitedTeamId] = React.useState<number | null>(
    null,
  );

  const selectedTeam = teams.find((t) => t.id === activeTeamId);
  const personalPrimaryLabel = "Personal Dash";
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
    personalPrimaryLabel.toLowerCase().includes(q) ||
    personalPlanLabel.toLowerCase().includes(q);
  const filteredTeams = React.useMemo(() => {
    if (q === "") return teams;
    return teams.filter((t) => {
      const hay = `${t.name} ${t.planLabel} ${t.ownerDisplayName}`.toLowerCase();
      return hay.includes(q);
    });
  }, [teams, q]);

  /**
   * True when the signed-in user owns at least one team-tier workspace (any personal
   * plan access type — paid, affiliate, complimentary, admin-assigned, etc.).
   */
  const subscriberOwnsTeamTierWorkspace = React.useMemo(() => {
    if (!personalHasTeamTierPlan) return false;
    if (teamDashFallback != null) return true;
    return teams.some(
      (t) => t.isSubscriberOwned && isWorkspaceSubscriptionPlanSlug(t.planUrlValue),
    );
  }, [teams, personalHasTeamTierPlan, teamDashFallback]);

  const subscriberOwnedTeamTierWorkspaces = React.useMemo(() => {
    return teams.filter(
      (t) => t.isSubscriberOwned && isWorkspaceSubscriptionPlanSlug(t.planUrlValue),
    );
  }, [teams]);

  const subscriberOwnedAdminWorkspaces = React.useMemo(() => {
    return teams.filter((t) => t.isSubscriberOwned && t.canAccessTeamAdmin);
  }, [teams]);

  const teamDashTarget = React.useMemo(() => {
    if (!personalHasTeamTierPlan) return null;

    if (subscriberOwnedTeamTierWorkspaces.length > 0) {
      const activeOwned = activeTeamId
        ? subscriberOwnedTeamTierWorkspaces.find((t) => t.id === activeTeamId)
        : undefined;
      return activeOwned ?? subscriberOwnedTeamTierWorkspaces[0] ?? null;
    }

    if (subscriberOwnedAdminWorkspaces.length > 0) {
      const activeOwned = activeTeamId
        ? subscriberOwnedAdminWorkspaces.find((t) => t.id === activeTeamId)
        : undefined;
      return activeOwned ?? subscriberOwnedAdminWorkspaces[0] ?? null;
    }

    if (teamDashFallback != null) {
      return {
        id: teamDashFallback.teamId,
        teamMemberUrlParam: teamDashFallback.teamMemberUrlParam,
        name: "Team workspace",
        ownerUserId: "",
        planLabel: "",
        planUrlValue: teamDashFallback.planSlug,
        ownerDisplayName: "",
        canAccessTeamAdmin: true,
        isSubscriberOwned: true,
      } satisfies TeamWorkspaceNavTeam;
    }

    return null;
  }, [
    subscriberOwnedTeamTierWorkspaces,
    subscriberOwnedAdminWorkspaces,
    activeTeamId,
    personalHasTeamTierPlan,
    teamDashFallback,
  ]);

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
    subscriberOwnsTeamTierWorkspace &&
    (personalMatches || teamDashTarget != null);

  async function refreshSessionCookieForAction() {
    try {
      await session?.getToken();
    } catch {
      // Session may be stale; server action will fail and we recover in catch.
    }
  }

  async function selectPersonal() {
    if (!sessionLoaded) return;
    setPending(true);
    try {
      await refreshSessionCookieForAction();
      await setTeamContextCookieAction(null);
      setOpen(false);
      setQuery("");
      requestAnimationFrame(() => {
        router.push(personalWorkspaceHref);
        router.refresh();
      });
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") {
        router.push("/");
        return;
      }
      throw err;
    } finally {
      setPending(false);
    }
  }

  async function selectTeam(team: TeamWorkspaceNavTeam) {
    if (!sessionLoaded) return;
    setPending(true);
    try {
      await refreshSessionCookieForAction();
      await setTeamContextCookieAction(team.id);
      setOpen(false);
      setQuery("");
      requestAnimationFrame(() => {
        router.push(
          buildTeamWorkspaceDashboardPath({
            teamId: team.id,
            ownerUserId: team.ownerUserId,
            planSlug: team.planUrlValue,
            teamMemberUrlParam: team.teamMemberUrlParam,
          }),
        );
        router.refresh();
      });
    } catch (err) {
      if (err instanceof Error && err.message === "Unauthorized") {
        router.push("/");
        return;
      }
      throw err;
    } finally {
      setPending(false);
    }
  }

  function onOpenChange(next: boolean) {
    if (!pending) {
      setOpen(next);
      if (!next) {
        setQuery("");
        setExpandedInvitedTeamId(null);
      }
    }
  }

  function goToTeamAdmin(href: string) {
    setOpen(false);
    setQuery("");
    setExpandedInvitedTeamId(null);
    requestAnimationFrame(() => {
      router.push(href);
      router.refresh();
    });
  }

  function goToTeacherDash(teamId?: number, teamMemberUrlParam?: number) {
    setOpen(false);
    setQuery("");
    setExpandedInvitedTeamId(null);
    requestAnimationFrame(() => {
      router.push(buildTeacherPath(teamId, teamMemberUrlParam));
      router.refresh();
    });
  }

  function teamWorkspaceMenuItem(t: TeamWorkspaceNavTeam) {
    const isActive = t.id === activeTeamId;
    const teamAdminHref = buildTeamAdminPath(t.id, t.teamMemberUrlParam);
    const showAdminExpand =
      t.canAccessTeamAdmin &&
      !t.isSubscriberOwned &&
      isWorkspaceSubscriptionPlanSlug(t.planUrlValue) &&
      !shouldHidePlatformAdminNav(pathname);
    const showTeacherAction = showAdminExpand && hasEducationPlan(t.planUrlValue);
    const isExpanded = expandedInvitedTeamId === t.id;

    return (
      <div key={t.id} className="flex flex-col">
        <DropdownMenuItem
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("[data-invited-admin-expand]")) return;
            if ((e.target as HTMLElement).closest("[data-team-admin-dash-link]")) return;
            if ((e.target as HTMLElement).closest("[data-teacher-dash-link]")) return;
            void selectTeam(t);
          }}
          className={cn(
            "cursor-pointer items-center gap-2 py-2 pr-1.5 workspace-switcher-row",
            isActive && "is-active",
          )}
          disabled={pending || !sessionLoaded}
          // Native title — do not nest Tooltip inside DropdownMenuContent (portal teardown bug).
          title={`Opens Team Dashboard Decks for “${t.name}” — team flashcard decks for this workspace`}
          aria-label={`Team Dashboard Decks for ${t.name}`}
        >
          <Check
            className={cn(
              "workspace-switcher-check size-4 shrink-0",
              isActive ? "opacity-100" : "opacity-0",
            )}
            aria-hidden
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
            <span className="truncate text-sm font-semibold leading-tight">
              Team: {t.name}
            </span>
            <span className="workspace-switcher-meta truncate text-xs">
              <span>{t.planLabel}</span>
              <span className="mx-1" aria-hidden>
                ·
              </span>
              <span>{t.ownerDisplayName}</span>
            </span>
          </span>
          <Image
            src={workspaceArtSrc(t)}
            alt=""
            width={72}
            height={72}
            className="workspace-switcher-art"
          />
          {showAdminExpand ? (
            <Button
              data-invited-admin-expand
              type="button"
              variant="ghost"
              size="icon-sm"
              className={cn(
                "size-8 shrink-0 text-muted-foreground hover:text-foreground",
                !isExpanded && "animate-pulse motion-reduce:animate-none",
              )}
              disabled={pending || !sessionLoaded}
              title={
                isExpanded
                  ? "Hide dashboard links for this workspace"
                  : showTeacherAction
                    ? "Show links: Team Admin Dashboard and Teacher Dashboard"
                    : "Show link: Team Admin Dashboard"
              }
              aria-label={
                isExpanded
                  ? "Hide dashboard links for this workspace"
                  : showTeacherAction
                    ? "Show Team Admin Dashboard and Teacher Dashboard links"
                    : "Show Team Admin Dashboard link"
              }
              aria-expanded={isExpanded}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedInvitedTeamId((current) =>
                  current === t.id ? null : t.id,
                );
              }}
            >
              <ChevronRight
                className={cn(
                  "size-4 transition-transform",
                  isExpanded && "rotate-90",
                )}
                aria-hidden
              />
            </Button>
          ) : null}
        </DropdownMenuItem>
        {showAdminExpand && isExpanded ? (
          <div className="grid gap-1.5 px-2 pb-2 pl-10">
            <Button
              data-team-admin-dash-link
              type="button"
              variant="secondary"
              size="sm"
              className="workspace-switcher-action h-8 w-full text-xs font-medium"
              disabled={pending || !sessionLoaded}
              title={`Opens Team Admin Dashboard for “${t.name}” — members, decks, and quiz settings`}
              aria-label={`Team Admin Dashboard for ${t.name}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                goToTeamAdmin(teamAdminHref);
              }}
            >
              <Image
                src="/artwork/home/workspace-chart.png"
                alt=""
                width={40}
                height={40}
                className="workspace-switcher-action-art"
              />
              Team Admin Dash
            </Button>
            {showTeacherAction ? (
              <Button
                data-teacher-dash-link
                type="button"
                variant="secondary"
                size="sm"
                className="workspace-switcher-action h-8 w-full text-xs font-medium"
                disabled={pending || !sessionLoaded}
                title={`Opens Teacher Dashboard for “${t.name}” — AI lesson plans, quizzes, and classroom tools`}
                aria-label={`Teacher Dashboard for ${t.name}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  goToTeacherDash(t.id, t.teamMemberUrlParam);
                }}
              >
                <Image
                  src="/artwork/home/workspace-teacher.png"
                  alt=""
                  width={40}
                  height={40}
                  className="workspace-switcher-action-art"
                />
                Teacher Dash
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        disabled={pending || !sessionLoaded}
        render={(props) => (
          <Button
            {...props}
            variant="outline"
            size="sm"
            title="Switch workspace — open Personal Deck Dashboard or a Team Dashboard"
            className="workspace-switcher-trigger h-9 w-full min-w-0 max-w-none justify-start gap-2 px-3 font-semibold sm:min-w-[12rem] sm:max-w-[18rem]"
            aria-label={`Workspace: ${triggerLabel}. Switch between Personal Deck Dashboard and team dashboards.`}
          >
            <House className="workspace-switcher-home size-4 shrink-0" aria-hidden />
            <span
              className="workspace-context-trigger-label min-w-0 flex-1 truncate text-left"
              title={
                selectedTeam
                  ? `${selectedTeam.name} · ${selectedTeam.planLabel} · ${selectedTeam.ownerDisplayName}`
                  : triggerLabel
              }
            >
              {triggerLabel}
            </span>
            <ChevronDown className="workspace-switcher-chevron size-4 shrink-0" aria-hidden />
          </Button>
        )}
      />
      <DropdownMenuContent
        align="end"
        className="workspace-switcher-menu w-[22rem] max-w-[calc(100vw-1.5rem)] p-0 sm:w-[24rem]"
      >
        <div
          className="workspace-switcher-search-wrap p-2"
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <div className="relative">
            <Search
              className="workspace-switcher-search-icon pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workspaces..."
              className="workspace-switcher-search h-10 bg-background pl-9"
              autoComplete="off"
              disabled={pending || !sessionLoaded}
              aria-label="Search workspaces"
            />
          </div>
        </div>
        <div className="workspace-switcher-scroll max-h-80 overflow-y-scroll p-1">
          <DropdownMenuGroup>
            {teamsNavLimited && (
              <div className="space-y-2 px-2 pb-2">
                {/* Do not nest Tooltip inside DropdownMenuContent — dual portals tear down out of order → removeChild(null). */}
                <div
                  className="flex w-full items-start gap-2 rounded-md border border-border bg-muted/40 px-2 py-2 text-left text-xs text-muted-foreground"
                  title="Personal Pro unlocks the full list of team workspaces associated with your email across Flipvise. Upgrade to switch among all your teams without this limit."
                >
                  <Info
                    className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="min-w-0 leading-snug">
                    {`Showing ${teams.length} of ${totalEligibleTeamCount} team workspaces (Free personal shows up to ${FREE_PERSONAL_WORKSPACE_NAV_TEAM_LIMIT}). Upgrade to Personal Pro to access every team linked to your account.`}
                  </span>
                </div>
                <Link
                  href="/pricing"
                  className="block text-center text-xs font-medium text-primary underline underline-offset-4 hover:opacity-90"
                  title="Opens Pricing — view and upgrade Pro plans"
                  aria-label="Opens Pricing — view and upgrade Pro plans"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                >
                  View Pro plans
                </Link>
              </div>
            )}
            <DropdownMenuLabel className="workspace-switcher-label px-2 py-1.5 text-xs font-medium">
              Workspace
            </DropdownMenuLabel>
            {personalMatches && (
              <>
                <DropdownMenuItem
                  onClick={() => void selectPersonal()}
                  className={cn(
                    "cursor-pointer items-center gap-2 py-2 workspace-switcher-row",
                    activeTeamId === null && "is-active",
                  )}
                  disabled={pending || !sessionLoaded}
                  title="Opens Personal Deck Dashboard — your personal flashcard decks"
                  aria-label="Personal Deck Dashboard — your personal flashcard decks"
                >
                  <Check
                    className={cn(
                      "workspace-switcher-check size-4 shrink-0",
                      activeTeamId === null ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
                    <span className="text-sm font-semibold leading-tight">
                      {personalPrimaryLabel}
                    </span>
                    <span className="workspace-switcher-meta text-xs">
                      {personalPlanLabel}
                    </span>
                  </span>
                  <Image
                    src="/artwork/home/workspace-house.png"
                    alt=""
                    width={72}
                    height={72}
                    className="workspace-switcher-art"
                  />
                </DropdownMenuItem>
                {(showTeacherDashboard || teamDashTarget != null) && (
                  <div className="grid gap-1.5 px-2 pb-1.5">
                    {showTeacherDashboard ? (
                      <Button
                        data-teacher-dash-link
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="workspace-switcher-action h-8 w-full text-xs font-medium"
                        disabled={pending || !sessionLoaded}
                        title="Opens Teacher Dashboard — AI lesson plans, quizzes, and classroom tools"
                        aria-label="Teacher Dashboard — AI lesson plans, quizzes, and classroom tools"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          goToTeacherDash();
                        }}
                      >
                        <Image
                          src="/artwork/home/workspace-teacher.png"
                          alt=""
                          width={40}
                          height={40}
                          className="workspace-switcher-action-art"
                        />
                        Teacher Dash
                      </Button>
                    ) : null}
                    {teamDashTarget != null ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="workspace-switcher-action h-8 w-full text-xs font-medium"
                        disabled={pending || !sessionLoaded}
                        title="Opens Team Admin Dashboard — manage members, deck access, and quiz settings for your subscription"
                        aria-label="Team Admin Dashboard — manage members, deck access, and quiz settings"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => {
                          goToTeamAdmin(
                            buildTeamAdminPath(
                              teamDashTarget.id,
                              teamDashTarget.teamMemberUrlParam,
                            ),
                          );
                        }}
                      >
                        <Image
                          src="/artwork/home/workspace-chart.png"
                          alt=""
                          width={40}
                          height={40}
                          className="workspace-switcher-action-art"
                        />
                        Team Admin Dash
                      </Button>
                    ) : null}
                  </div>
                )}
              </>
            )}
            {!subscriberOwnsTeamTierWorkspace &&
              personalMatches &&
              filteredTeams.length > 0 && (
                <>
                  <div role="separator" className="-mx-1 my-1 h-px bg-border" />
                  <div className="workspace-switcher-label px-2 py-1.5 text-xs font-medium">
                    Invited workspaces
                  </div>
                </>
              )}
            {subscriberOwnsTeamTierWorkspace &&
              otherSubscriberGroupsNonEmpty &&
              subscriberSectionHasRows && (
                <>
                  <div role="separator" className="-mx-1 my-1 h-px bg-border" />
                  <div className="workspace-switcher-label px-2 py-1.5 text-xs font-medium">
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
