import { getAccessContext } from "@/lib/access";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCardsForDeckViewer } from "@/db/queries/cards";
import { getDeckAssignmentStudyPrivilege, isDeckLinkedToWorkspace } from "@/db/queries/teams";
import { resolveMemberStudyModes } from "@/lib/team-study-privilege";
import { canEditDeckContent, getDeckWithViewerAccess } from "@/lib/team-deck-access";
import {
  teamWorkspaceDeckTitleLinkClass,
  teamWorkspaceNavLinkClass,
} from "@/components/team-admin-panel-styles";
import { cn } from "@/lib/utils";
import {
  buildResolvedTeamWorkspaceQueryString,
  resolveTeamWorkspaceCanonicalRedirectQueryString,
  resolveTeamWorkspaceFromSearchParams,
} from "@/lib/resolve-team-workspace-url";
import { withTeamWorkspaceQuery } from "@/lib/team-workspace-url";
import { StudySessionLoader } from "./study-session-loader";
import { getTeamDeckContext } from "@/lib/deck-team-heading";
import {
  CARDS_PER_DECK_LIMIT_FREE,
  resolveDeckCardCap,
} from "@/lib/deck-limits";

interface StudyPageProps {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StudyPage({ params, searchParams }: StudyPageProps) {
  const { userId, maxCardsPerDeck, hasAiReading } = await getAccessContext();
  if (!userId) redirect("/");

  const { deckId } = await params;
  const id = Number(deckId);
  if (isNaN(id)) notFound();

  const sp = await searchParams;
  const teamWorkspaceUrl = await resolveTeamWorkspaceFromSearchParams(userId, sp);
  if (teamWorkspaceUrl != null) {
    const canonicalQs = await resolveTeamWorkspaceCanonicalRedirectQueryString(
      userId,
      sp,
      teamWorkspaceUrl,
    );
    if (canonicalQs != null) {
      redirect(withTeamWorkspaceQuery(`/decks/${id}/study`, canonicalQs));
    }
  }
  const workspaceQs =
    teamWorkspaceUrl != null
      ? await buildResolvedTeamWorkspaceQueryString(userId, teamWorkspaceUrl)
      : "";

  const bundle = await getDeckWithViewerAccess(id, userId);
  if (!bundle) notFound();

  const { deck, access } = bundle;
  const { heading: teamDeckHeading, teamTierPro } = await getTeamDeckContext(deck);
  const deckCap = resolveDeckCardCap({
    teamTierProWorkspace: teamTierPro,
    personalMaxCardsPerDeck: maxCardsPerDeck,
  });
  const allowsQuizStudy = deckCap > CARDS_PER_DECK_LIMIT_FREE;
  const cards = await getCardsForDeckViewer(id, userId);
  if (cards.length === 0) {
    if (access.kind === "team_member") {
      redirect(
        workspaceQs ? `/dashboard?${workspaceQs}` : "/dashboard",
      );
    }
    redirect(`/decks/${id}`);
  }

  const fromTeamWorkspaceUrl =
    teamWorkspaceUrl != null &&
    ((deck.teamId != null && deck.teamId === teamWorkspaceUrl.teamId) ||
      (await isDeckLinkedToWorkspace(teamWorkspaceUrl.teamId, deck.id)));

  const showTeamWorkspaceNavLinks =
    canEditDeckContent(access) && fromTeamWorkspaceUrl && Boolean(workspaceQs);
  const teamDashboardHref = workspaceQs ? `/dashboard?${workspaceQs}` : "/dashboard";
  const deckPageHref = workspaceQs
    ? withTeamWorkspaceQuery(`/decks/${id}`, workspaceQs)
    : `/decks/${id}`;

  let memberAllowReview = true;
  let memberAllowQuiz = true;
  if (access.kind === "team_member") {
    const privilege = await getDeckAssignmentStudyPrivilege(access.teamId, id, userId);
    const modes = resolveMemberStudyModes(privilege);
    memberAllowReview = modes.allowReview;
    memberAllowQuiz = modes.allowQuiz;
  }

  let studyBackHref: string;
  let studyBackLabel: string;
  if (fromTeamWorkspaceUrl && workspaceQs) {
    studyBackHref = teamDashboardHref;
    studyBackLabel = "← Dashboard";
  } else if (access.kind === "team_member") {
    studyBackHref = "/dashboard";
    studyBackLabel = "← Dashboard";
  } else {
    studyBackHref = `/decks/${id}`;
    studyBackLabel = "← Back to Deck";
  }

  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <Link
            href={studyBackHref}
            className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {studyBackLabel.replace("← ", "")}
          </Link>
          {teamDeckHeading && (
            <div className="mt-1 space-y-0.5">
              <p className="text-muted-foreground text-sm">
                Team:{" "}
                {showTeamWorkspaceNavLinks ? (
                  <Link href={teamDashboardHref} className={teamWorkspaceNavLinkClass}>
                    {teamDeckHeading.teamName}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">{teamDeckHeading.teamName}</span>
                )}
              </p>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Owner:{" "}
                <span className="text-foreground/90">{teamDeckHeading.ownerDisplayName}</span>
              </p>
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-words">
            {showTeamWorkspaceNavLinks ? (
              <Link
                href={deckPageHref}
                className={cn(teamWorkspaceDeckTitleLinkClass, "text-2xl sm:text-3xl")}
              >
                {deck.name}
              </Link>
            ) : (
              deck.name
            )}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">Study Session</span>
            <span className="text-muted-foreground text-xs" aria-hidden>·</span>
            <Badge variant="secondary" className="text-xs">
              {cards.length} card{cards.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </div>
      </div>

      <StudySessionLoader
        cards={cards}
        deckId={id}
        deckName={deck.name}
        teamId={deck.teamId ?? null}
        allowsQuizStudy={allowsQuizStudy}
        memberAllowReview={memberAllowReview}
        memberAllowQuiz={memberAllowQuiz}
        deckGradient={deck.gradient ?? null}
        autoSaveQuizResult={fromTeamWorkspaceUrl}
        hasAiReading={hasAiReading}
      />
    </div>
  );
}
