import { Suspense, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/clerk-auth";
import { accessHasAddon, getAccessContext } from "@/lib/access";
import { teamOwnsLiveClassroom } from "@/lib/live-classroom-access";
import { getLiveClassroomTeacherGrant } from "@/db/queries/live-classroom";
import { redirectIfAccountRecoveryIncomplete } from "@/lib/account-recovery-gate";
import {
  getClerkUserDisplayNameById,
} from "@/lib/clerk-user-display";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Layers } from "lucide-react";
import {
  buildResolvedTeamWorkspaceQueryString,
  canonicalDashboardPathRemovingSensitiveQuery,
  resolveTeamWorkspaceFromSearchParams,
  searchParamsLooksLikeTeamWorkspace,
  shouldRedirectUnauthorizedDashboardUseridParam,
} from "@/lib/resolve-team-workspace-url";
import { personalDashboardHrefWithUserPlanQuery } from "@/lib/personal-dashboard-url";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getFirstPreviewCardFrontByDeckIds, promoteCoverPlaceholderCardsForDeck } from "@/db/queries/cards";
import { getPersonalDecksByUserWithCardCount } from "@/db/queries/decks";
import { relocateOwnerLessonPlansOffTeamAdminDecks } from "@/db/queries/owner-lesson-plan-deck-placement";
import {
  countTeamsForOwner,
  getAssignedDecksForMemberWithCardCount,
  getEducationTeamAdminWorkspaceDecksWithCardCount,
  getTeamById,
  getTeamMembershipsForUser,
  getTeamsByOwner,
  teamWorkspaceAllowsViewerAccess,
} from "@/db/queries/teams";
import { resolveEducationTeamAdminCreateQuota } from "@/db/queries/education-team-admin-deck-quota";
import type { EducationTeamPlanId } from "@/lib/education-plans";
import { TeamInviteAcceptedBanner } from "@/components/team-invite-accepted-banner";
import { StripeCheckoutToast } from "@/components/stripe-checkout-toast";
import { AddDeckDialogLoader as AddDeckDialog } from "@/components/add-deck-dialog-loader";
import { TeamMemberDeckActions } from "@/components/team-member-deck-actions";
import { EducationOwnerWorkspaceDecks } from "@/components/education-owner-workspace-decks";
import { DeckGrid } from "./deck-grid";
import { PersonalDashboardBackground } from "@/components/illustrated/personal-dashboard-background";
import { AiDocumentStudioDashboardEntry } from "@/components/ai-document-studio-dashboard-entry";
import { LiveClassroomDashboardEntry } from "@/components/live-classroom-dashboard-entry";
import {
  hasAnyAiDocumentStudioAddon,
  LIVE_CLASSROOM_ADDON_KEY,
} from "@/lib/addon-keys";
import { DECKS_VIEW_COOKIE, resolveViewMode } from "@/lib/view-mode";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
import {
  dashboardPathFromSearchParams,
  resolveTeamContextCookieAction,
  teamContextCookieApiPath,
} from "@/lib/team-context-cookie-server";
import { tryTeamQuery } from "@/lib/team-query-fallback";
import { isEducationTeamPlanId, isWorkspaceSubscriptionPlanSlug } from "@/lib/education-plans";
import { isTeamPlanId } from "@/lib/team-plans";
import {
  FREE_CARDS_PER_DECK_LIMIT,
  FREE_PERSONAL_DECK_LIMIT,
} from "@/lib/personal-plan-limits";
import { getPersonalDashboardPlanAccessPhrase } from "@/lib/personal-workspace-plan-label";
import { redirectIfPlanReconciliationPending } from "@/lib/plan-reconciliation-gate";
import {
  isNativeShellRequest,
  nativeSignInPath,
} from "@/lib/native-auth-redirect";

/** Turbopack: load native-only client UI via dynamic from this RSC page. */
const DashboardNativeActions = dynamic(
  () =>
    import("@/components/dashboard-native-actions").then(
      (mod) => mod.DashboardNativeActions,
    ),
  { loading: () => null },
);

/** Team-tier deck extras (speech, images): own Clerk team plan or a subscriber’s team-tier workspace. */
function teamWorkspaceHasTierExtras(
  hasOwnTeamPlan: boolean,
  teamRow: { planSlug: string } | null,
) {
  return (
    hasOwnTeamPlan ||
    (teamRow != null &&
      (isTeamPlanId(teamRow.planSlug) || isEducationTeamPlanId(teamRow.planSlug)))
  );
}

function personalDashboardOwnerLabel(user: {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
}): string | null {
  const full = user.fullName?.trim();
  if (full) return full;
  const combined = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (combined) return combined;
  const email = user.primaryEmailAddress?.emailAddress?.trim();
  if (email) return email;
  const username = user.username?.trim();
  return username || null;
}

function DashboardPersonalHeading({
  viewerName,
}: {
  viewerName: string | null;
}) {
  return (
    <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0 text-2xl sm:text-3xl font-semibold tracking-tight">
      <span className="min-w-0 text-foreground">
        Personal Dashboard
        {viewerName ? (
          <>
            <span className="text-muted-foreground">{" "}:{" "}</span>
            <span
              className="inline-block max-w-full truncate font-medium text-muted-foreground"
              title={viewerName}
            >
              {viewerName}
            </span>
          </>
        ) : null}
      </span>
    </h1>
  );
}

function DashboardTeamHeading({
  showTeamTierExtras,
  ownerName,
  teamName,
}: {
  showTeamTierExtras: boolean;
  ownerName: string | null;
  teamName: string | null;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0 text-2xl sm:text-3xl font-bold tracking-tight">
        <span className="shrink-0 text-foreground">Team Dashboard</span>
        {showTeamTierExtras && ownerName ? (
          <>
            <span className="shrink-0 text-foreground" aria-hidden>
              ·
            </span>
            <span className="min-w-0 truncate font-semibold text-foreground">
              {ownerName}
            </span>
          </>
        ) : null}
      </h1>
      {showTeamTierExtras && teamName ? (
        <p className="truncate text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          {teamName}
        </p>
      ) : null}
    </div>
  );
}

/** Invited workspace (no team-tier subscription): team + owner on the line under “Dashboard”. */
function DashboardTeamWorkspaceSubline({
  teamName,
  ownerName,
  tailText,
}: {
  teamName: string | null;
  ownerName: string | null;
  tailText: string;
}) {
  const hasMeta = teamName != null || ownerName != null;
  return (
    <p className="mt-1 min-w-0 text-sm text-muted-foreground sm:text-base">
      {hasMeta ? (
        <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5">
          {teamName ? (
            <span className="font-semibold text-foreground">{teamName}</span>
          ) : null}
          {teamName && ownerName ? (
            <span className="shrink-0 text-muted-foreground" aria-hidden>
              ·
            </span>
          ) : null}
          {ownerName ? (
            <span className="min-w-0 truncate text-foreground/90">{ownerName}</span>
          ) : null}
          <span className="shrink-0 text-muted-foreground" aria-hidden>
            —
          </span>
        </span>
      ) : null}
      {tailText}
    </p>
  );
}

function DashboardAtmosphere({
  children,
  personal = false,
  team = false,
}: {
  children: ReactNode;
  personal?: boolean;
  team?: boolean;
}) {
  return (
    <div
      className={
        personal
          ? "personal-dashboard-page relative flex min-h-0 flex-1 flex-col overflow-hidden"
          : team
            ? "team-dashboard-page relative flex min-h-0 flex-1 flex-col overflow-hidden"
            : "relative flex min-h-0 flex-1 flex-col overflow-hidden"
      }
    >
      {personal ? <PersonalDashboardBackground /> : null}
      <div className="personal-dashboard-orbs pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -right-24 -top-28 size-[22rem] rounded-full bg-cyan-500/15 blur-3xl animate-float-gentle" />
        <div className="absolute -left-16 top-1/3 size-[18rem] rounded-full bg-violet-500/15 blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-[-5rem] right-1/4 size-[16rem] rounded-full bg-fuchsia-500/12 blur-3xl animate-drift" />
        <div className="absolute left-1/3 top-10 size-[12rem] rounded-full bg-emerald-400/10 blur-3xl animate-float-gentle" />
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 sm:gap-7 sm:p-8">
        {children}
      </div>
    </div>
  );
}

const dashboardHeaderCardClass =
  "relative overflow-hidden rounded-2xl border border-white/10 bg-card/60 p-5 shadow-lg shadow-black/20 backdrop-blur-md animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both sm:p-7";

const dashboardDeckPanelClass =
  "flex flex-1 flex-col gap-5 rounded-2xl border border-white/10 bg-card/45 p-4 shadow-xl shadow-black/20 backdrop-blur-xl animate-in fade-in-0 slide-in-from-bottom-3 duration-700 fill-mode-both sm:p-6";

function DashboardHeaderCard({
  children,
  team = false,
}: {
  children: ReactNode;
  team?: boolean;
}) {
  return (
    <section
      className={`${dashboardHeaderCardClass} personal-dash-panel${team ? " team-dash-header team-dash-panel" : ""}`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-violet-400 to-fuchsia-400"
      />
      {team ? (
        <Image
          src="/artwork/home/team-dash-owl.png"
          alt=""
          width={320}
          height={320}
          className="team-dash-owl"
        />
      ) : null}
      {children}
    </section>
  );
}

function TeamDashboardEmptyState({
  title,
  description,
  note,
}: {
  title: string;
  description: string;
  note?: ReactNode;
}) {
  return (
    <div className="team-dash-empty">
      <Image
        src="/artwork/home/team-telescope.png"
        alt=""
        width={360}
        height={360}
        className="team-dash-telescope"
      />
      <Image
        src="/artwork/home/team-lightbulb.png"
        alt=""
        width={360}
        height={360}
        className="team-dash-bulb"
      />
      <div className="team-dash-empty-body">
        <Image
          src="/artwork/home/team-empty-robot.png"
          alt=""
          width={420}
          height={420}
          className="team-dash-robot"
        />
        <div className="space-y-1">
          <p className="team-dash-empty-title">{title}</p>
          <p className="team-dash-empty-note text-muted-foreground">{description}</p>
          {note}
        </div>
      </div>
    </div>
  );
}

async function mergePreviewThumbsForDecks<T extends { id: number }>(
  list: T[],
): Promise<(T & { firstPreviewCardFrontImageUrl: string | null })[]> {
  if (list.length === 0) return [];
  const map = await tryTeamQuery(
    () => getFirstPreviewCardFrontByDeckIds(list.map((d) => d.id)),
    new Map<number, string | null>(),
  );
  return list.map((d) => ({
    ...d,
    firstPreviewCardFrontImageUrl: map.get(d.id) ?? null,
  }));
}

interface DashboardPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const access = await getAccessContext();
  const {
    userId,
    hasUnlimitedDecks,
    maxPersonalDecks,
    maxCardsPerDeck,
    isPro,
    activeTeamPlan,
    activeEducationTeamPlan,
    canAccessTeacherTools,
    isAdmin,
    hasAiReading,
    hasClerkPersonalPro,
    hasClerkPersonalProPlus,
  } = access;
  if (!userId) {
    if (await isNativeShellRequest()) {
      redirect(nativeSignInPath("/dashboard"));
    }
    redirect("/");
  }

  const detailedDeleteWarning =
    canAccessTeacherTools || activeEducationTeamPlan != null;

  await redirectIfAccountRecoveryIncomplete(userId, "/dashboard");
  await redirectIfPlanReconciliationPending(userId);

  const personalDashboardHref = personalDashboardHrefWithUserPlanQuery({
    userId,
    activeTeamPlan,
    activeEducationTeamPlan,
    isPro,
    hasClerkPersonalPro,
    hasClerkPersonalProPlus,
  });

  const sp = await searchParams;
  if (shouldRedirectUnauthorizedDashboardUseridParam(userId, sp)) {
    redirect(personalDashboardHref);
  }
  const teamWorkspaceUrl = await resolveTeamWorkspaceFromSearchParams(userId, sp);

  if (searchParamsLooksLikeTeamWorkspace(sp) && !teamWorkspaceUrl) {
    redirect(personalDashboardHref);
  }

  // Plan owners use Personal Dash (+ Team Admin) — Team Dashboard is for invited members only.
  if (teamWorkspaceUrl?.canEditTeamDecks) {
    redirect(personalDashboardHref);
  }

  const canonicalDash = canonicalDashboardPathRemovingSensitiveQuery(sp, userId);
  if (canonicalDash) redirect(canonicalDash);

  if (teamWorkspaceUrl != null) {
    const returnPath = dashboardPathFromSearchParams(sp);
    const cookieAction = await tryTeamQuery(
      () => resolveTeamContextCookieAction(teamWorkspaceUrl.teamId, userId),
      "noop" as const,
    );
    if (cookieAction === "clear") {
      redirect(teamContextCookieApiPath({ action: "clear", redirectPath: returnPath }));
    }
    if (cookieAction === "set") {
      redirect(
        teamContextCookieApiPath({
          action: "sync",
          teamId: teamWorkspaceUrl.teamId,
          redirectPath: returnPath,
        }),
      );
    }
  }

  const workspaceQueryString =
    teamWorkspaceUrl != null
      ? await buildResolvedTeamWorkspaceQueryString(userId, teamWorkspaceUrl)
      : "";

  const ownSubscriberTeamTierExtras =
    activeTeamPlan !== null || activeEducationTeamPlan !== null;

  const cookieStore = await cookies();
  const teamCtxRaw = cookieStore.get(TEAM_CONTEXT_COOKIE)?.value;
  const teamCtxId = teamCtxRaw ? Number(teamCtxRaw) : NaN;

  if (teamWorkspaceUrl?.isTeamAdminWorkspaceViewer) {
    const tw = teamWorkspaceUrl;
    const workspaceHeadingRow = await tryTeamQuery(
      () => getTeamById(tw.teamId),
      null,
    );
    if (
      workspaceHeadingRow &&
      isEducationTeamPlanId(workspaceHeadingRow.planSlug)
    ) {
      await relocateOwnerLessonPlansOffTeamAdminDecks(
        workspaceHeadingRow.ownerUserId,
        tw.teamId,
      );
    }
    const workspaceDecksRaw = await tryTeamQuery(async () => {
      const teamRow = workspaceHeadingRow ?? (await getTeamById(tw.teamId));
      if (teamRow && isEducationTeamPlanId(teamRow.planSlug)) {
        return getEducationTeamAdminWorkspaceDecksWithCardCount(
          tw.teamId,
          tw.ownerUserId,
          userId,
        );
      }
      return getAssignedDecksForMemberWithCardCount(tw.teamId, userId);
    }, []);
    const isEducationTeamAdminViewer =
      workspaceHeadingRow != null &&
      isEducationTeamPlanId(workspaceHeadingRow.planSlug);
    const teamWorkspaceTierExtras = teamWorkspaceHasTierExtras(
      ownSubscriberTeamTierExtras,
      workspaceHeadingRow,
    );
    const [workspaceDecks, workspaceHeadingOwnerName, teamAdminCreateQuota] =
      await Promise.all([
        teamWorkspaceTierExtras
          ? mergePreviewThumbsForDecks(workspaceDecksRaw)
          : Promise.resolve(workspaceDecksRaw),
        workspaceHeadingRow
          ? getClerkUserDisplayNameById(workspaceHeadingRow.ownerUserId)
          : Promise.resolve(null),
        isEducationTeamAdminViewer && workspaceHeadingRow
          ? resolveEducationTeamAdminCreateQuota(
              tw.teamId,
              tw.ownerUserId,
              userId,
              workspaceHeadingRow.planSlug as EducationTeamPlanId,
            )
          : Promise.resolve(null),
      ]);
    const createQuotaDisplay =
      teamAdminCreateQuota != null
        ? {
            used: teamAdminCreateQuota.createdCount,
            max: teamAdminCreateQuota.maxCreateDecks,
          }
        : null;
    const workspaceHeadingGroupName = workspaceHeadingRow?.name ?? null;
    const initialView = resolveViewMode(cookieStore.get(DECKS_VIEW_COOKIE)?.value);
    const hostTokenGrant = await getLiveClassroomTeacherGrant(tw.teamId, userId);
    const showLiveClassroom =
      hostTokenGrant != null &&
      (await teamOwnsLiveClassroom(tw.teamId)).owns;

    return (
      <DashboardAtmosphere team>
        {showLiveClassroom ? (
          <div className="flex flex-wrap items-center gap-2">
            <LiveClassroomDashboardEntry />
          </div>
        ) : null}
        <DashboardHeaderCard team>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {teamWorkspaceTierExtras ? (
              <DashboardTeamHeading
                showTeamTierExtras
                ownerName={workspaceHeadingOwnerName}
                teamName={workspaceHeadingGroupName}
              />
            ) : (
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
            )}
            {teamWorkspaceTierExtras ? (
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                {isEducationTeamAdminViewer
                  ? "Team workspace — edit decks you created; preview and study assigned decks"
                  : "Team workspace — preview and study assigned decks"}
              </p>
            ) : (
              <DashboardTeamWorkspaceSubline
                teamName={workspaceHeadingGroupName}
                ownerName={workspaceHeadingOwnerName}
                tailText={
                  isEducationTeamAdminViewer
                    ? "Team workspace — edit decks you created; preview and study assigned decks"
                    : "Team workspace — preview and study assigned decks"
                }
              />
            )}
          </div>
        </div>
        </DashboardHeaderCard>
        <section className={`${dashboardDeckPanelClass}${workspaceDecks.length === 0 ? " team-dash-panel" : ""}`}>
        {workspaceDecks.length === 0 ? (
          <TeamDashboardEmptyState
            title={isEducationTeamAdminViewer ? "No decks yet" : "No decks assigned yet"}
            description={
              isEducationTeamAdminViewer
                ? "Create decks from Teacher tools or wait for your workspace owner to assign decks to you."
                : "Your workspace owner has not assigned any decks to you yet. Check back soon."
            }
            note={
              createQuotaDisplay != null ? (
                <p className="text-muted-foreground text-xs tabular-nums">
                  Created {createQuotaDisplay.used} / {createQuotaDisplay.max}
                </p>
              ) : null
            }
          />
        ) : (
          <DeckGrid
            decks={workspaceDecks}
            initialView={initialView}
            workspaceQueryString={workspaceQueryString}
            deckPopoverVariant="team-preview"
            allowCoverUpload={teamWorkspaceTierExtras}
            teamTierPreviewPromo={teamWorkspaceTierExtras}
            hasAiReading={hasAiReading}
            detailedDeleteWarning={
              detailedDeleteWarning || isEducationTeamAdminViewer
            }
            createQuota={createQuotaDisplay}
            groupOwnerAssignedFromCreated={isEducationTeamAdminViewer}
          />
        )}
        </section>
      </DashboardAtmosphere>
    );
  }

  if (teamWorkspaceUrl?.isAssignedMemberPreview) {
    const [assignedHeadingRow, assignedRaw] = await Promise.all([
      tryTeamQuery(() => getTeamById(teamWorkspaceUrl.teamId), null),
      tryTeamQuery(
        () =>
          getAssignedDecksForMemberWithCardCount(
            teamWorkspaceUrl.teamId,
            userId,
          ),
        [],
      ),
    ]);
    const teamWorkspaceTierExtras = teamWorkspaceHasTierExtras(
      ownSubscriberTeamTierExtras,
      assignedHeadingRow,
    );
    const [assigned, assignedHeadingOwnerName] = await Promise.all([
      teamWorkspaceTierExtras
        ? mergePreviewThumbsForDecks(assignedRaw)
        : Promise.resolve(assignedRaw),
      assignedHeadingRow
        ? getClerkUserDisplayNameById(assignedHeadingRow.ownerUserId)
        : Promise.resolve(null),
    ]);
    const initialView = resolveViewMode(cookieStore.get(DECKS_VIEW_COOKIE)?.value);
    const assignedHeadingGroupName = assignedHeadingRow?.name ?? null;
    return (
      <DashboardAtmosphere team>
        <DashboardHeaderCard team>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {teamWorkspaceTierExtras ? (
              <DashboardTeamHeading
                showTeamTierExtras
                ownerName={assignedHeadingOwnerName}
                teamName={assignedHeadingGroupName}
              />
            ) : (
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
            )}
            {teamWorkspaceTierExtras ? (
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Team workspace — preview and study assigned decks
              </p>
            ) : (
              <DashboardTeamWorkspaceSubline
                teamName={assignedHeadingGroupName}
                ownerName={assignedHeadingOwnerName}
                tailText="Team workspace — preview and study assigned decks"
              />
            )}
          </div>
        </div>
        </DashboardHeaderCard>
        <section className={`${dashboardDeckPanelClass}${assigned.length === 0 ? " team-dash-panel" : ""}`}>
        {assigned.length === 0 ? (
          <TeamDashboardEmptyState
            title="No decks assigned yet"
            description="Your team admin hasn't assigned any decks to you yet. Check back soon."
          />
        ) : (
          <DeckGrid
            decks={assigned}
            initialView={initialView}
            workspaceQueryString={workspaceQueryString}
            deckPopoverVariant="team-preview"
            allowCoverUpload={teamWorkspaceTierExtras}
            teamTierPreviewPromo={teamWorkspaceTierExtras}
            hasAiReading={hasAiReading}
            detailedDeleteWarning={detailedDeleteWarning}
          />
        )}
        </section>
      </DashboardAtmosphere>
    );
  }

  const memberships = await tryTeamQuery(
    () => getTeamMembershipsForUser(userId),
    [],
  );
  const invitedTeamWorkspaceMemberships = memberships.filter(
    (m) => m.role === "team_member" || m.role === "team_admin",
  );

  const isTeamMemberWorkspace =
    !Number.isNaN(teamCtxId) &&
    invitedTeamWorkspaceMemberships.some((m) => m.teamId === teamCtxId);

  if (isTeamMemberWorkspace) {
    const cookieWorkspaceLive = await tryTeamQuery(
      () => teamWorkspaceAllowsViewerAccess(teamCtxId, userId),
      false,
    );
    if (!cookieWorkspaceLive) {
      redirect(
        teamContextCookieApiPath({
          action: "clear",
          redirectPath: dashboardPathFromSearchParams(sp),
        }),
      );
    } else {
    const cookieMembership = invitedTeamWorkspaceMemberships.find(
      (m) => m.teamId === teamCtxId,
    );

    /** Co-admins must use the canonical `?team=` URL — cookie-only context wrongly showed the member Study/Preview UI. */
    if (cookieMembership?.role === "team_admin") {
      const cookieTeam = await tryTeamQuery(() => getTeamById(teamCtxId), null);
      if (cookieTeam && isWorkspaceSubscriptionPlanSlug(cookieTeam.planSlug)) {
        if (cookieTeam.ownerUserId === userId) {
          redirect(personalDashboardHref);
        }
        const canonicalQs = await buildResolvedTeamWorkspaceQueryString(userId, {
          teamId: teamCtxId,
          ownerUserId: cookieTeam.ownerUserId,
          canEditTeamDecks: false,
          isAssignedMemberPreview: false,
          isTeamAdminWorkspaceViewer: true,
          workspacePlanQuery: cookieTeam.planSlug,
        });
        const redirectParams = new URLSearchParams(canonicalQs);
        const ti = sp.team_invite;
        const inviteRaw = Array.isArray(ti) ? ti[0] : ti;
        if (typeof inviteRaw === "string" && inviteRaw.trim() !== "") {
          redirectParams.set("team_invite", inviteRaw.trim());
        }
        redirect(`/dashboard?${redirectParams.toString()}`);
      }
    }

    const [cookieTeamHeadingRow, assigned] = await Promise.all([
      tryTeamQuery(() => getTeamById(teamCtxId), null),
      tryTeamQuery(
        () => getAssignedDecksForMemberWithCardCount(teamCtxId, userId),
        [],
      ),
    ]);
    const cookieWorkspaceQueryString =
      cookieTeamHeadingRow != null
        ? await buildResolvedTeamWorkspaceQueryString(userId, {
            teamId: teamCtxId,
            ownerUserId: cookieTeamHeadingRow.ownerUserId,
            canEditTeamDecks: false,
            isAssignedMemberPreview: cookieMembership?.role === "team_member",
            isTeamAdminWorkspaceViewer: cookieMembership?.role === "team_admin",
            workspacePlanQuery: cookieTeamHeadingRow.planSlug,
          })
        : "";
    const teamWorkspaceTierExtras = teamWorkspaceHasTierExtras(
      ownSubscriberTeamTierExtras,
      cookieTeamHeadingRow,
    );
    const cookieTeamHeadingOwnerName = cookieTeamHeadingRow
      ? await getClerkUserDisplayNameById(cookieTeamHeadingRow.ownerUserId)
      : null;
    const cookieTeamHeadingGroupName = cookieTeamHeadingRow?.name ?? null;

    return (
      <DashboardAtmosphere team>
        <DashboardHeaderCard team>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {teamWorkspaceTierExtras ? (
              <DashboardTeamHeading
                showTeamTierExtras
                ownerName={cookieTeamHeadingOwnerName}
                teamName={cookieTeamHeadingGroupName}
              />
            ) : (
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
            )}
            {teamWorkspaceTierExtras ? (
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Team workspace — study assigned decks
              </p>
            ) : (
              <DashboardTeamWorkspaceSubline
                teamName={cookieTeamHeadingGroupName}
                ownerName={cookieTeamHeadingOwnerName}
                tailText="Team workspace — study assigned decks"
              />
            )}
          </div>
        </div>
        </DashboardHeaderCard>
        <section className={`${dashboardDeckPanelClass}${assigned.length === 0 ? " team-dash-panel" : ""}`}>
        {assigned.length === 0 ? (
          <TeamDashboardEmptyState
            title="No decks assigned yet"
            description="Your team admin hasn't assigned any decks to you yet. Check back soon."
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assigned.map((d, index) => (
              <li
                key={d.id}
                className="animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500"
                style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
              >
                <Card className="h-full border-violet-400/25 bg-gradient-to-br from-violet-500/15 via-card to-cyan-500/10 shadow-lg shadow-violet-950/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-base">{d.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {d.cardCount} cards
                    </span>
                    <TeamMemberDeckActions
                      deckId={d.id}
                      deckName={d.name}
                      cardCount={d.cardCount}
                      workspaceQueryString={cookieWorkspaceQueryString}
                      hasAiReading={hasAiReading}
                    />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
        </section>
      </DashboardAtmosphere>
    );
    }
  }

  const [decksPreview, teamCount, dashboardSessionUser] = await Promise.all([
    getPersonalDecksByUserWithCardCount(userId),
    tryTeamQuery(() => countTeamsForOwner(userId), 0),
    currentUser(),
  ]);
  await Promise.all(
    decksPreview.map((deck) => promoteCoverPlaceholderCardsForDeck(deck.id)),
  );
  const decksRaw = await getPersonalDecksByUserWithCardCount(userId);
  const decks = ownSubscriberTeamTierExtras
    ? await mergePreviewThumbsForDecks(decksRaw)
    : decksRaw;
  const initialView = resolveViewMode(cookieStore.get(DECKS_VIEW_COOKIE)?.value);
  const showTeamOnboarding = Boolean(
    (activeTeamPlan ?? activeEducationTeamPlan) && teamCount === 0 && !isAdmin,
  );
  const isFreePlan = !hasUnlimitedDecks;
  const isAtLimit = isFreePlan && decks.length >= FREE_PERSONAL_DECK_LIMIT;
  const deckUsagePercent = isFreePlan
    ? Math.min((decks.length / FREE_PERSONAL_DECK_LIMIT) * 100, 100)
    : 0;
  const cardsPerDeckLimitDisplay = isFreePlan
    ? FREE_CARDS_PER_DECK_LIMIT
    : maxCardsPerDeck;

  let personalViewerName: string | null = null;
  if (dashboardSessionUser) {
    personalViewerName = personalDashboardOwnerLabel({
      fullName: dashboardSessionUser.fullName,
      firstName: dashboardSessionUser.firstName,
      lastName: dashboardSessionUser.lastName,
      username: dashboardSessionUser.username,
      primaryEmailAddress: dashboardSessionUser.primaryEmailAddress,
    });
  }

  const planAccessPhrase = isPro
    ? await getPersonalDashboardPlanAccessPhrase()
    : null;

  const showEducationWorkspaceSections = activeEducationTeamPlan != null;
  const ownedEducationTeams = showEducationWorkspaceSections
    ? await tryTeamQuery(
        () =>
          getTeamsByOwner(userId).then((teams) =>
            teams.filter((team) => isEducationTeamPlanId(team.planSlug)),
          ),
        [],
      )
    : [];
  let educationDeckSource = decks;
  if (showEducationWorkspaceSections && ownedEducationTeams.length > 0) {
    const moved = (
      await Promise.all(
        ownedEducationTeams.map((team) =>
          relocateOwnerLessonPlansOffTeamAdminDecks(userId, team.id),
        ),
      )
    ).some((count) => count > 0);
    if (moved) {
      const refreshed = await getPersonalDecksByUserWithCardCount(userId);
      educationDeckSource = ownSubscriberTeamTierExtras
        ? await mergePreviewThumbsForDecks(refreshed)
        : refreshed;
    }
  }
  const personalOnlyDecks = showEducationWorkspaceSections
    ? decks.filter((deck) => deck.teamId == null)
    : decks;
  const educationWorkspaces = showEducationWorkspaceSections
    ? ownedEducationTeams.map((team) => ({
        id: team.id,
        name: team.name,
        decks: educationDeckSource.filter((deck) => deck.teamId === team.id),
      }))
    : [];
  const creatorIds = [
    ...new Set(
      educationWorkspaces.flatMap((workspace) =>
        workspace.decks
          .map((deck) => deck.createdByUserId?.trim() ?? "")
          .filter((id) => id.length > 0 && id !== userId),
      ),
    ),
  ];
  const creatorNames = Object.fromEntries(
    await Promise.all(
      creatorIds.map(async (id) => {
        const name = (await getClerkUserDisplayNameById(id)).trim();
        return [id, name && name !== "Subscriber" ? name : "Team admin"] as const;
      }),
    ),
  );
  const hasGroupedEducationDecks =
    showEducationWorkspaceSections &&
    (personalOnlyDecks.length > 0 || educationWorkspaces.length > 0);
  const showAiDocumentStudio = hasAnyAiDocumentStudioAddon(
    access.activeAddonKeys,
  );
  const showLiveClassroom = accessHasAddon(access, LIVE_CLASSROOM_ADDON_KEY);

  return (
    <DashboardAtmosphere personal>
      {showAiDocumentStudio || showLiveClassroom ? (
        <div className="flex flex-wrap items-center gap-2">
          {showAiDocumentStudio ? <AiDocumentStudioDashboardEntry /> : null}
          {showLiveClassroom ? <LiveClassroomDashboardEntry /> : null}
        </div>
      ) : null}
      <Suspense fallback={null}>
        <TeamInviteAcceptedBanner />
        <StripeCheckoutToast />
      </Suspense>
      {showTeamOnboarding && (
        <Alert className="team-setup-banner animate-in fade-in-0 slide-in-from-top-2 duration-500 fill-mode-both">
          <div className="team-setup-copy">
            <AlertTitle>Finish team setup</AlertTitle>
            <AlertDescription>
              Create your first workspace and invite members.
            </AlertDescription>
          </div>
          <Link href="/onboarding/team" className="team-setup-continue">
            Continue setup
            <ChevronRight className="size-4" aria-hidden />
          </Link>
          <Image
            src="/artwork/home/setup-robot.png"
            alt=""
            width={180}
            height={180}
            className="team-setup-robot"
          />
        </Alert>
      )}

      {/* Page header */}
      <DashboardHeaderCard>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Badge variant="outline" className="personal-dash-badge gap-1 text-[10px] uppercase tracking-[0.14em]">
            <Layers className="size-3" />
            Workspace
          </Badge>
          <DashboardPersonalHeading viewerName={personalViewerName} />
          <p className="text-sm sm:text-base">
            Manage your flashcard decks
          </p>
        </div>
        <Image
          src="/artwork/home/dash-grad-books.png"
          alt=""
          width={220}
          height={220}
          className="personal-dash-books"
        />
        <div className="personal-dash-actions flex flex-wrap items-center gap-2 sm:gap-3">
          <DashboardNativeActions />
          <AddDeckDialog
            isAtLimit={isAtLimit}
            forPersonalWorkspace
            speechToTextEnabled={ownSubscriberTeamTierExtras}
          />
        </div>
      </div>
      </DashboardHeaderCard>

      {/* Free plan usage banner */}
      {isFreePlan && (
        <div className="grid animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-75 fill-mode-both gap-4 sm:grid-cols-2">
          {/* Usage card */}
          <Card className="personal-dash-panel border-border/70">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium uppercase tracking-wide">
                  Free Plan Usage
                </CardTitle>
                <Badge variant="secondary" className="personal-dash-badge text-xs">Free</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Decks</span>
                  <span className="text-muted-foreground tabular-nums">
                    {decks.length} / {FREE_PERSONAL_DECK_LIMIT}
                  </span>
                </div>
                <Progress value={deckUsagePercent} />
              </div>
              <p className="text-xs text-muted-foreground">
                Each deck is limited to{" "}
                <span className="text-foreground font-semibold">
                  {cardsPerDeckLimitDisplay} cards
                </span>{" "}
                on the Free plan.
              </p>
              {isAtLimit && (
                <p className="text-xs text-destructive font-medium">
                  You&apos;ve reached the free deck limit. Upgrade to add more.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Pro upgrade card */}
          <Card className="personal-dash-panel personal-dash-upgrade">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium uppercase tracking-wide">
                  Upgrade to Pro
                </CardTitle>
                <Badge className="personal-dash-badge text-xs">Paid plans</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-center gap-2 text-foreground">
                  <span className="text-primary">✓</span>
                  <span>From 10 decks (Pro) — up to 15 with Pro Plus</span>
                </li>
                <li className="flex items-center gap-2 text-foreground">
                  <span className="text-primary">✓</span>
                  <span>30–52 cards per deck by tier</span>
                </li>
                <li className="flex items-center gap-2 text-foreground">
                  <span className="text-primary">✓</span>
                  <span>AI flashcard generation · AI Reading on Pro Plus</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Link
                href="/pricing"
                className={buttonVariants({ size: "sm" }) + " personal-dash-action w-full justify-center"}
              >
                View plans
              </Link>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* At limit alert */}
      {isAtLimit && (
          <Alert>
          <AlertTitle>Deck limit reached</AlertTitle>
          <AlertDescription>
            Free plan allows up to{" "}
            <strong>{FREE_PERSONAL_DECK_LIMIT} decks</strong> with{" "}
            <strong>{FREE_CARDS_PER_DECK_LIMIT} cards</strong> per deck.{" "}
            <Link href="/pricing" className="underline underline-offset-3 hover:text-foreground">
              Upgrade
            </Link>{" "}
            for higher limits.
          </AlertDescription>
        </Alert>
      )}

      {/* Deck grid */}
      <section className={`${dashboardDeckPanelClass} dashboard-deck-panel personal-dash-panel`}>
      {decks.length === 0 ? (
        <div className="personal-dash-empty flex flex-1 flex-col items-center justify-center gap-4 px-4 py-10 text-center sm:py-14">
          <Image
            src="/artwork/home/empty-deck-owl.png"
            alt=""
            width={280}
            height={280}
            className="personal-dash-empty-owl"
          />
          <div className="space-y-1">
            <p className="text-2xl font-bold">No decks yet</p>
            <p className="text-sm max-w-sm">Create your first deck to start building your flashcard library.</p>
          </div>
          <div className="personal-dash-actions">
          <AddDeckDialog
            triggerLabel="Create your first deck"
            isAtLimit={isAtLimit}
            forPersonalWorkspace
            speechToTextEnabled={ownSubscriberTeamTierExtras}
          />
          </div>
        </div>
      ) : hasGroupedEducationDecks ? (
        <div className="space-y-8">
          {personalOnlyDecks.length > 0 ? (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-foreground">
                <span className="size-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.85)]" aria-hidden />
                Personal
              </h2>
              <DeckGrid
                decks={personalOnlyDecks}
                initialView={initialView}
                allowCoverUpload={ownSubscriberTeamTierExtras}
                teamTierPreviewPromo={ownSubscriberTeamTierExtras}
                hasAiReading={hasAiReading}
                detailedDeleteWarning={detailedDeleteWarning}
              />
            </section>
          ) : null}
          {educationWorkspaces.length > 0 ? (
            <EducationOwnerWorkspaceDecks
              workspaces={educationWorkspaces}
              ownerUserId={userId}
              creatorNames={creatorNames}
              initialView={initialView}
              allowCoverUpload={ownSubscriberTeamTierExtras}
              teamTierPreviewPromo={ownSubscriberTeamTierExtras}
              hasAiReading={hasAiReading}
              detailedDeleteWarning={detailedDeleteWarning}
            />
          ) : null}
        </div>
      ) : (
        <DeckGrid
          decks={decks}
          initialView={initialView}
          allowCoverUpload={ownSubscriberTeamTierExtras}
          teamTierPreviewPromo={ownSubscriberTeamTierExtras}
          hasAiReading={hasAiReading}
          detailedDeleteWarning={detailedDeleteWarning}
        />
      )}

      {/* Pro plan — already subscribed */}
      {isPro && planAccessPhrase && (
        <p className="border-t border-border/60 pt-4 text-center text-xs text-muted-foreground">
          You&apos;re on {planAccessPhrase.article}{" "}
          <span className="text-foreground font-medium">
            {planAccessPhrase.label}
          </span>{" "}
          — up to {maxPersonalDecks} personal deck
          {maxPersonalDecks === 1 ? "" : "s"} and {maxCardsPerDeck} cards per deck.
        </p>
      )}
      </section>
    </DashboardAtmosphere>
  );
}
