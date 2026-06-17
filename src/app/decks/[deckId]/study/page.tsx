import { getAccessContext } from "@/lib/access";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getCardsForDeckViewer } from "@/db/queries/cards";
import {
  getDeckAssignmentStudyPrivilege,
  getMemberRecord,
  getTeamById,
  getTeamQuizDurationMinutes,
  isDeckLinkedToWorkspace,
} from "@/db/queries/teams";
import {
  resolveQuizSecurityContextForStudy,
  type QuizSecurityStudyContext,
} from "@/db/queries/quiz-security";
import {
  resolveQuizStartScheduleForStudy,
  type QuizScheduleStudyContext,
} from "@/db/queries/quiz-schedule";
import { teamQuizDurationSeconds } from "@/lib/team-quiz-duration";
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
import {
  buildTeamWorkspaceDashboardPath,
  withTeamWorkspaceQuery,
} from "@/lib/team-workspace-url";
import { StudySessionLoader } from "./study-session-loader";
import { getTeamDeckContext } from "@/lib/deck-team-heading";
import {
  CARDS_PER_DECK_LIMIT_FREE,
  resolveDeckCardCap,
} from "@/lib/deck-limits";
import { resolveQuizFormatsForStudy } from "@/db/queries/quiz-formats";

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

  const studyTeamId =
    fromTeamWorkspaceUrl && teamWorkspaceUrl
      ? teamWorkspaceUrl.teamId
      : access.kind === "team_member" || access.kind === "team_admin"
        ? access.teamId
        : deck.teamId ?? null;

  let quizDurationSeconds: number | undefined;
  if (studyTeamId != null) {
    const minutes = await getTeamQuizDurationMinutes(studyTeamId);
    quizDurationSeconds = teamQuizDurationSeconds(minutes);
  }

  let quizSecurity: QuizSecurityStudyContext | undefined;
  let quizSchedule: QuizScheduleStudyContext | undefined;
  if (studyTeamId != null) {
    const [securityContext, scheduleContext] = await Promise.all([
      resolveQuizSecurityContextForStudy(userId, id, studyTeamId),
      resolveQuizStartScheduleForStudy(id, studyTeamId),
    ]);
    quizSecurity = securityContext ?? undefined;
    quizSchedule = scheduleContext ?? undefined;
  }

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
  if (workspaceQs) {
    studyBackHref = teamDashboardHref;
    studyBackLabel = "← Dashboard";
  } else if (
    studyTeamId != null &&
    (access.kind === "team_member" ||
      access.kind === "team_admin" ||
      fromTeamWorkspaceUrl)
  ) {
    const team = await getTeamById(studyTeamId);
    if (team) {
      let teamMemberUrlParam = 0;
      if (team.ownerUserId !== userId) {
        const member = await getMemberRecord(studyTeamId, userId);
        teamMemberUrlParam = member?.id ?? 0;
      }
      studyBackHref = buildTeamWorkspaceDashboardPath({
        teamId: studyTeamId,
        ownerUserId: team.ownerUserId,
        planSlug: team.planSlug,
        teamMemberUrlParam,
      });
    } else {
      studyBackHref = "/dashboard";
    }
    studyBackLabel = "← Dashboard";
  } else if (access.kind === "team_member" || access.kind === "team_admin") {
    studyBackHref = "/dashboard";
    studyBackLabel = "← Dashboard";
  } else {
    studyBackHref = `/decks/${id}`;
    studyBackLabel = "← Back to Deck";
  }
  const studyExitLabel = studyBackLabel.replace(/^←\s*/, "");

  const ownerInboxAvailable =
    studyTeamId != null
      ? (await getTeamById(studyTeamId))?.ownerUserId !== userId
      : false;

  const quizFormats = await resolveQuizFormatsForStudy(
    id,
    studyTeamId ?? deck.teamId ?? null,
  );

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
        teamId={studyTeamId ?? deck.teamId ?? null}
        allowsQuizStudy={allowsQuizStudy}
        memberAllowReview={memberAllowReview}
        memberAllowQuiz={memberAllowQuiz}
        deckGradient={deck.gradient ?? null}
        autoSaveQuizResult={fromTeamWorkspaceUrl}
        quizDurationSeconds={quizDurationSeconds}
        hasAiReading={hasAiReading}
        quizSecurity={quizSecurity}
        quizSchedule={quizSchedule}
        exitHref={studyBackHref}
        exitLabel={studyExitLabel}
        ownerInboxAvailable={ownerInboxAvailable}
        quizFormats={quizFormats}
      />
    </div>
  );
}
