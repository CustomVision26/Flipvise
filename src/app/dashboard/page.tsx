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
import {
  buildResolvedTeamWorkspaceQueryString,
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
import { AddDeckDialog } from "@/components/add-deck-dialog";
import { TeamMemberDeckActions } from "@/components/team-member-deck-actions";
import { DeckGrid } from "./deck-grid";
import { DECKS_VIEW_COOKIE, resolveViewMode } from "@/lib/view-mode";
import { TEAM_CONTEXT_COOKIE } from "@/lib/team-context-cookie";
import { syncTeamContextCookieForUser } from "@/lib/team-context-cookie-server";
import { tryTeamQuery } from "@/lib/team-query-fallback";
import { isTeamPlanId } from "@/lib/team-plans";

const DECK_LIMIT = 3;
const CARDS_PER_DECK_LIMIT = 8;

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
    has75CardsPerDeck,
    isPro,
    activeTeamPlan,
    isAdmin,
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

  if (teamWorkspaceUrl?.canEditTeamDecks) {
    const [teamHeadingRow, teamDecksRaw] = await Promise.all([
      tryTeamQuery(() => getTeamById(teamWorkspaceUrl.teamId), null),
      tryTeamQuery(
        () =>
          getDecksForTeamWithCardCount(
            teamWorkspaceUrl.teamId,
            teamWorkspaceUrl.ownerUserId,
          ),
        [],
      ),
    ]);
    const teamWorkspaceTierExtras = teamWorkspaceHasTierExtras(
      ownSubscriberTeamTierExtras,
      teamHeadingRow,
    );
    const [teamDecks, teamHeadingOwnerName] = await Promise.all([
      teamWorkspaceTierExtras
        ? mergePreviewThumbsForDecks(teamDecksRaw)
        : Promise.resolve(teamDecksRaw),
      teamHeadingRow
        ? getClerkUserDisplayNameById(teamHeadingRow.ownerUserId)
        : Promise.resolve(null),
    ]);
    const initialView = resolveViewMode(cookieStore.get(DECKS_VIEW_COOKIE)?.value);
    const teamHeadingGroupName = teamHeadingRow?.name ?? null;
    return (
      <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-4 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {teamWorkspaceTierExtras ? (
              <DashboardTeamHeading
                showTeamTierExtras
                ownerName={teamHeadingOwnerName}
                teamName={teamHeadingGroupName}
              />
            ) : (
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
            )}
            {teamWorkspaceTierExtras ? (
              <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                Team workspace — manage team decks
              </p>
            ) : (
              <DashboardTeamWorkspaceSubline
                teamName={teamHeadingGroupName}
                ownerName={teamHeadingOwnerName}
                tailText="Team workspace — manage team decks"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AddDeckDialog
              triggerLabel="Add new deck"
              triggerTooltip="New Team Deck"
              isAtLimit={false}
              teamId={teamWorkspaceUrl.teamId}
              forTeamWorkspace
              speechToTextEnabled={teamWorkspaceTierExtras}
              deckFrontImageUploadEnabled={teamWorkspaceTierExtras}
            />
          </div>
        </div>
        {teamDecks.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-12 sm:py-20 text-center px-4">
            <p className="text-muted-foreground text-sm">No team decks yet.</p>
            <AddDeckDialog
              triggerLabel="Create a team deck"
              isAtLimit={false}
              teamId={teamWorkspaceUrl.teamId}
              forTeamWorkspace
              speechToTextEnabled={teamWorkspaceTierExtras}
              deckFrontImageUploadEnabled={teamWorkspaceTierExtras}
            />
          </div>
        ) : (
          <DeckGrid
            decks={teamDecks}
            initialView={initialView}
            workspaceQueryString={workspaceQueryString}
            teamTierPreviewPromo={teamWorkspaceTierExtras}
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
          <p className="text-muted-foreground text-sm">
            No decks assigned yet. Ask your team admin to assign decks to you.
          </p>
        ) : (
          <DeckGrid
            decks={assigned}
            initialView={initialView}
            workspaceQueryString={workspaceQueryString}
            deckPopoverVariant="team-preview"
            teamTierPreviewPromo={teamWorkspaceTierExtras}
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
    const [cookieTeamHeadingRow, assigned] = await Promise.all([
      tryTeamQuery(() => getTeamById(teamCtxId), null),
      tryTeamQuery(
        () => getAssignedDecksForMemberWithCardCount(teamCtxId, userId),
        [],
      ),
    ]);
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
          <p className="text-muted-foreground text-sm">
            No decks assigned yet. Ask your team admin to assign decks to you.
          </p>
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
                      workspaceQueryString={workspaceQueryString}
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
  const isAtLimit = isFreePlan && decks.length >= DECK_LIMIT;
  const deckUsagePercent = isFreePlan
    ? Math.min((decks.length / DECK_LIMIT) * 100, 100)
    : 0;
  const cardsPerDeckLimit = has75CardsPerDeck ? 75 : CARDS_PER_DECK_LIMIT;

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

  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-4 sm:p-8">
      <Suspense fallback={null}>
        <TeamInviteAcceptedBanner />
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
        <div className="flex items-center gap-2 sm:gap-3">
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
                    {decks.length} / {DECK_LIMIT}
                  </span>
                </div>
                <Progress value={deckUsagePercent} />
              </div>
              <p className="text-xs text-muted-foreground">
                Each deck is limited to{" "}
                <span className="text-foreground font-semibold">
                  {cardsPerDeckLimit} cards
                </span>{" "}
                on the Free plan.
              </p>
              {isAtLimit && (
                <p className="text-xs text-destructive font-medium">
                  You&apos;ve reached the 3-deck limit. Upgrade to add more.
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
                <Badge className="text-xs">Pro</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-center gap-2 text-foreground">
                  <span className="text-primary">✓</span>
                  <span>Unlimited decks</span>
                </li>
                <li className="flex items-center gap-2 text-foreground">
                  <span className="text-primary">✓</span>
                  <span>75 cards per deck</span>
                </li>
                <li className="flex items-center gap-2 text-foreground">
                  <span className="text-primary">✓</span>
                  <span>AI flashcard generation</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Link
                href="/pricing"
                className={buttonVariants({ size: "sm" }) + " w-full justify-center"}
              >
                View Pro Plans
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
            <strong>{DECK_LIMIT} decks</strong> with{" "}
            <strong>{cardsPerDeckLimit} cards</strong> per deck.{" "}
            <Link href="/pricing" className="underline underline-offset-3 hover:text-foreground">
              Upgrade to Pro
            </Link>{" "}
            for unlimited decks and 75 cards per deck.
          </AlertDescription>
        </Alert>
      )}

      {/* Deck grid */}
      {decks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-12 sm:py-20 text-center px-4">
          <p className="text-muted-foreground text-sm">You have no decks yet.</p>
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
        />
      )}

      {/* Pro plan — already subscribed */}
      {isPro && (
        <p className="text-xs text-muted-foreground text-center">
          You&apos;re on the <span className="text-foreground font-medium">Pro plan</span> — enjoy unlimited decks and 75 cards per deck.
        </p>
      )}
    </div>
  );
}
