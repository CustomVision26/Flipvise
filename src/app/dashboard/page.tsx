import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { currentUser } from "@/lib/clerk-auth";
import { getAccessContext } from "@/lib/access";
import {
  formatSessionUserDisplayName,
  getClerkUserDisplayNameById,
} from "@/lib/clerk-user-display";
import Link from "next/link";
import { Layers, BookOpen } from "lucide-react";
import {
  buildResolvedTeamWorkspaceQueryString,
  canonicalDashboardPathRemovingSensitiveQuery,
  resolveTeamWorkspaceFromSearchParams,
  searchParamsLooksLikeTeamWorkspace,
  shouldRedirectUnauthorizedDashboardUseridParam,
} from "@/lib/resolve-team-workspace-url";
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
import { getFirstPreviewCardFrontByDeckIds } from "@/db/queries/cards";
import { getPersonalDecksByUserWithCardCount } from "@/db/queries/decks";
import {
  countTeamsForOwner,
  getAssignedDecksForMemberWithCardCount,
  getDecksForTeamWithCardCount,
  getTeamById,
  getTeamMembershipsForUser,
} from "@/db/queries/teams";
import { TeamInviteAcceptedBanner } from "@/components/team-invite-accepted-banner";
import { StripeCheckoutToast } from "@/components/stripe-checkout-toast";
import { AddDeckDialog } from "@/components/add-deck-dialog";
import { NativeAppBackButton } from "@/components/native-app-back-button";
import { OfflineAvailabilityButton } from "@/components/offline-availability-button";
import { TeamMemberDeckActions } from "@/components/team-member-deck-actions";
import { DeckGrid } from "./deck-grid";
import { DECKS_VIEW_COOKIE, resolveViewMode } from "@/lib/view-mode";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
import { syncTeamContextCookieForUser } from "@/lib/team-context-cookie-server";
import { tryTeamQuery } from "@/lib/team-query-fallback";
import { isTeamPlanId } from "@/lib/team-plans";
import {
  FREE_CARDS_PER_DECK_LIMIT,
  FREE_PERSONAL_DECK_LIMIT,
} from "@/lib/personal-plan-limits";
import { getPersonalDashboardPlanAccessPhrase } from "@/lib/personal-workspace-plan-label";
/** Team-tier deck extras (speech, images): own Clerk team plan or a subscriber’s team-tier workspace. */
function teamWorkspaceHasTierExtras(
  hasOwnTeamPlan: boolean,
  teamRow: { planSlug: string } | null,
) {
  return hasOwnTeamPlan || (teamRow != null && isTeamPlanId(teamRow.planSlug));
}

function DashboardPersonalHeading({
  showTeamTierExtras,
  viewerName,
}: {
  showTeamTierExtras: boolean;
  viewerName: string | null;
}) {
  return (
    <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0 text-2xl sm:text-3xl font-bold tracking-tight">
      <span className="min-w-0 text-foreground">
        Personal Dashboard
        {showTeamTierExtras && viewerName ? (
          <>
            <span className="text-muted-foreground">{" "}:{" "}</span>
            <span className="font-semibold text-muted-foreground">{viewerName}</span>
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
            <span className="shrink-0 text-muted-foreground" aria-hidden>
              ·
            </span>
            <span className="min-w-0 truncate font-semibold text-muted-foreground">
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
  const {
    userId,
    hasUnlimitedDecks,
    maxPersonalDecks,
    maxCardsPerDeck,
    isPro,
    activeTeamPlan,
    isAdmin,
    hasAiReading,
  } = await getAccessContext();
  if (!userId) redirect("/");

  const sp = await searchParams;
  if (shouldRedirectUnauthorizedDashboardUseridParam(userId, sp)) {
    redirect("/dashboard");
  }
  const teamWorkspaceUrl = await resolveTeamWorkspaceFromSearchParams(userId, sp);

  if (searchParamsLooksLikeTeamWorkspace(sp) && !teamWorkspaceUrl) {
    redirect("/dashboard");
  }

  const canonicalDash = canonicalDashboardPathRemovingSensitiveQuery(sp, userId);
  if (canonicalDash) redirect(canonicalDash);

  if (teamWorkspaceUrl != null) {
    await tryTeamQuery(
      () => syncTeamContextCookieForUser(teamWorkspaceUrl.teamId, userId),
      undefined,
    );
  }

  const workspaceQueryString =
    teamWorkspaceUrl != null
      ? await buildResolvedTeamWorkspaceQueryString(userId, teamWorkspaceUrl)
      : "";

  const ownSubscriberTeamTierExtras = activeTeamPlan !== null;

  const cookieStore = await cookies();
  const teamCtxRaw = cookieStore.get(TEAM_CONTEXT_COOKIE)?.value;
  const teamCtxId = teamCtxRaw ? Number(teamCtxRaw) : NaN;

  const isTeamWorkspaceDeckViewer =
    teamWorkspaceUrl?.isTeamAdminWorkspaceViewer ||
    teamWorkspaceUrl?.canEditTeamDecks;

  if (isTeamWorkspaceDeckViewer && teamWorkspaceUrl != null) {
    const tw = teamWorkspaceUrl;
    const [workspaceHeadingRow, workspaceDecksRaw] = await Promise.all([
      tryTeamQuery(() => getTeamById(tw.teamId), null),
      tryTeamQuery(
        () =>
          getDecksForTeamWithCardCount(tw.teamId, tw.ownerUserId),
        [],
      ),
    ]);
    const teamWorkspaceTierExtras = teamWorkspaceHasTierExtras(
      ownSubscriberTeamTierExtras,
      workspaceHeadingRow,
    );
    const [workspaceDecks, workspaceHeadingOwnerName] = await Promise.all([
      teamWorkspaceTierExtras
        ? mergePreviewThumbsForDecks(workspaceDecksRaw)
        : Promise.resolve(workspaceDecksRaw),
      workspaceHeadingRow
        ? getClerkUserDisplayNameById(workspaceHeadingRow.ownerUserId)
        : Promise.resolve(null),
    ]);
    const workspaceHeadingGroupName = workspaceHeadingRow?.name ?? null;
    const initialView = resolveViewMode(cookieStore.get(DECKS_VIEW_COOKIE)?.value);
    return (
      <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-4 sm:p-8">
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
                Team workspace — open decks to edit cards or study
              </p>
            ) : (
              <DashboardTeamWorkspaceSubline
                teamName={workspaceHeadingGroupName}
                ownerName={workspaceHeadingOwnerName}
                tailText="Team workspace — open decks to edit cards or study"
              />
            )}
          </div>
        </div>
        {workspaceDecks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 sm:py-20 text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground text-sm">No decks in this workspace yet</p>
              <p className="text-muted-foreground text-xs max-w-xs">
                Use Deck Manager in Team Admin to link subscriber decks or assign them to members.
              </p>
            </div>
          </div>
        ) : (
          <DeckGrid
            decks={workspaceDecks}
            initialView={initialView}
            workspaceQueryString={workspaceQueryString}
            teamTierPreviewPromo={teamWorkspaceTierExtras}
            hasAiReading={hasAiReading}
          />
        )}
      </div>
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
      <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-4 sm:p-8">
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
        {assigned.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 sm:py-20 text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground text-sm">No decks assigned yet</p>
              <p className="text-muted-foreground text-xs max-w-xs">Your team admin hasn&apos;t assigned any decks to you yet. Check back soon.</p>
            </div>
          </div>
        ) : (
          <DeckGrid
            decks={assigned}
            initialView={initialView}
            workspaceQueryString={workspaceQueryString}
            deckPopoverVariant="team-preview"
            teamTierPreviewPromo={teamWorkspaceTierExtras}
            hasAiReading={hasAiReading}
          />
        )}
      </div>
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
    const cookieMembership = invitedTeamWorkspaceMemberships.find(
      (m) => m.teamId === teamCtxId,
    );

    /** Co-admins must use the canonical `?team=&userid=&plan=&teamMemberId=` URL — cookie-only context wrongly showed the member Study/Preview UI. */
    if (cookieMembership?.role === "team_admin") {
      const cookieTeam = await tryTeamQuery(() => getTeamById(teamCtxId), null);
      if (cookieTeam && isTeamPlanId(cookieTeam.planSlug)) {
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
      <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-4 sm:p-8">
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
        {assigned.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 sm:py-20 text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
              <BookOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="font-medium text-foreground text-sm">No decks assigned yet</p>
              <p className="text-muted-foreground text-xs max-w-xs">Your team admin hasn&apos;t assigned any decks to you yet. Check back soon.</p>
            </div>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {assigned.map((d) => (
              <li key={d.id}>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{d.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap justify-between items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
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
      </div>
    );
  }

  const [decksRaw, teamCount, dashboardSessionUser] = await Promise.all([
    getPersonalDecksByUserWithCardCount(userId),
    tryTeamQuery(() => countTeamsForOwner(userId), 0),
    currentUser(),
  ]);
  const decks = ownSubscriberTeamTierExtras
    ? await mergePreviewThumbsForDecks(decksRaw)
    : decksRaw;
  const initialView = resolveViewMode(cookieStore.get(DECKS_VIEW_COOKIE)?.value);
  const showTeamOnboarding = Boolean(
    activeTeamPlan && teamCount === 0 && !isAdmin,
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
  if (ownSubscriberTeamTierExtras && dashboardSessionUser) {
    personalViewerName = formatSessionUserDisplayName({
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

  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-4 sm:p-8">
      <Suspense fallback={null}>
        <TeamInviteAcceptedBanner />
        <StripeCheckoutToast />
      </Suspense>
      {showTeamOnboarding && (
        <Alert>
          <AlertTitle>Finish team setup</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2">
            Create your team name and invite members.
            <Link
              href="/onboarding/team"
              className={buttonVariants({ size: "sm" }) + " shrink-0"}
            >
              Continue setup
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {ownSubscriberTeamTierExtras ? (
            <DashboardPersonalHeading
              showTeamTierExtras
              viewerName={personalViewerName}
            />
          ) : (
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Personal Dashboard</h1>
          )}
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage your flashcard decks</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <NativeAppBackButton />
          <OfflineAvailabilityButton />
          <AddDeckDialog
            isAtLimit={isAtLimit}
            forPersonalWorkspace
            speechToTextEnabled={ownSubscriberTeamTierExtras}
            deckFrontImageUploadEnabled={isPro}
          />
        </div>
      </div>

      {/* Free plan usage banner */}
      {isFreePlan && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Usage card */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Free Plan Usage
                </CardTitle>
                <Badge variant="secondary" className="text-xs">Free</Badge>
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
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Upgrade to Pro
                </CardTitle>
                <Badge className="text-xs">Paid plans</Badge>
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
                className={buttonVariants({ size: "sm" }) + " w-full justify-center"}
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
      {decks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-14 sm:py-24 text-center px-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted/60">
            <Layers className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="font-medium text-foreground text-sm">No decks yet</p>
            <p className="text-muted-foreground text-xs max-w-xs">Create your first deck to start building your flashcard library.</p>
          </div>
          <AddDeckDialog
            triggerLabel="Create your first deck"
            isAtLimit={isAtLimit}
            forPersonalWorkspace
            speechToTextEnabled={ownSubscriberTeamTierExtras}
            deckFrontImageUploadEnabled={isPro}
          />
        </div>
      ) : (
        <DeckGrid
          decks={decks}
          initialView={initialView}
          teamTierPreviewPromo={ownSubscriberTeamTierExtras}
          hasAiReading={hasAiReading}
        />
      )}

      {/* Pro plan — already subscribed */}
      {isPro && planAccessPhrase && (
        <p className="text-xs text-muted-foreground text-center">
          You&apos;re on {planAccessPhrase.article}{" "}
          <span className="text-foreground font-medium">
            {planAccessPhrase.label}
          </span>{" "}
          — up to {maxPersonalDecks} personal deck
          {maxPersonalDecks === 1 ? "" : "s"} and {maxCardsPerDeck} cards per deck.
        </p>
      )}
    </div>
  );
}
