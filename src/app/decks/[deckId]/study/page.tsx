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
  listLinkedWorkspaceTeamIdsForDeck,
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
import { isEducationTeamPlanId, canConfigurePersonalDeckQuizFormatsFromAccess } from "@/lib/education-plans";
import { resolveAiRecallAccess } from "@/lib/ai-recall-eligibility";
import { resolveEffectiveAiRecallSessionCardCount } from "@/lib/ai-recall-session-cards";
import { canEditDeckContent, getDeckWithViewerAccess } from "@/lib/team-deck-access";
import {
  teamWorkspaceDeckTitleLinkClass,
  teamWorkspaceNavLinkClass,
} from "@/components/team-admin-panel-styles";
import { cn } from "@/lib/utils";
import {
  buildResolvedTeamWorkspaceQueryString,
  inferTeamIdForDeckStudyUrl,
  resolveTeamWorkspaceCanonicalRedirectQueryString,
  resolveTeamWorkspaceFromSearchParams,
} from "@/lib/resolve-team-workspace-url";
import {
  buildTeamWorkspaceDashboardPath,
  withTeamWorkspaceQuery,
} from "@/lib/team-workspace-url";
import { personalDashboardHrefWithUserPlanQuery } from "@/lib/personal-dashboard-url";
import { StudySessionLoader } from "./study-session-loader";
import { LiveClassroomStudyJoinCard } from "@/components/live-classroom-study-join-card";
import {
  getLiveClassroomParticipantGrant,
  listActiveOrLobbySessionsForTeam,
} from "@/db/queries/live-classroom";
import { teamOwnsLiveClassroom } from "@/lib/live-classroom-access";
import { getTeamDeckContext } from "@/lib/deck-team-heading";
import {
  CARDS_PER_DECK_LIMIT_FREE,
  resolveDeckCardCap,
} from "@/lib/deck-limits";
import { resolveQuizFormatsForStudy, getDeckQuizFormatAssignmentsForStudy, getQuizFormatsDeckSnapshotForOwner } from "@/db/queries/quiz-formats";
import { getQuizCardOrderForViewer } from "@/db/queries/quiz-card-orders";

interface StudyPageProps {
  params: Promise<{ deckId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function StudyPage({ params, searchParams }: StudyPageProps) {
  const {
    userId,
    maxCardsPerDeck,
    hasAiReading,
    hasAiRecall,
    effectivePlanSlug,
    hasClerkPersonalPro,
    hasClerkPersonalProPlus,
    canAccessTeacherTools,
    activeTeamPlan,
    activeEducationTeamPlan,
    isPro,
  } = await getAccessContext();
  if (!userId) redirect("/");

  const { deckId } = await params;
  const id = Number(deckId);
  if (isNaN(id)) notFound();

  const sp = await searchParams;
  const bundle = await getDeckWithViewerAccess(id, userId);
  if (!bundle) notFound();

  const { deck, access } = bundle;

  let teamWorkspaceUrl = await resolveTeamWorkspaceFromSearchParams(userId, sp);
  if (teamWorkspaceUrl == null) {
    // Prefer membership / decks.teamId, then deck_workspace_links (multi-workspace decks
    // often leave decks.teamId null — without this, owner bare /study skips quiz security).
    const candidateTeamIds: number[] = [];
    const inferredTeamId = inferTeamIdForDeckStudyUrl({
      access,
      deckTeamId: deck.teamId,
    });
    if (inferredTeamId != null) candidateTeamIds.push(inferredTeamId);
    for (const linkedTeamId of await listLinkedWorkspaceTeamIdsForDeck(id)) {
      if (!candidateTeamIds.includes(linkedTeamId)) {
        candidateTeamIds.push(linkedTeamId);
      }
    }
    for (const candidateTeamId of candidateTeamIds) {
      const resolved = await resolveTeamWorkspaceFromSearchParams(userId, {
        team: String(candidateTeamId),
      });
      if (resolved != null) {
        teamWorkspaceUrl = resolved;
        break;
      }
    }
  }

  if (teamWorkspaceUrl != null) {
    const deckAssociatedWithWorkspace =
      (deck.teamId != null && deck.teamId === teamWorkspaceUrl.teamId) ||
      access.kind === "team_member" ||
      access.kind === "team_admin" ||
      (await isDeckLinkedToWorkspace(teamWorkspaceUrl.teamId, deck.id));
    if (deckAssociatedWithWorkspace) {
      const canonicalQs = await resolveTeamWorkspaceCanonicalRedirectQueryString(
        userId,
        sp,
        teamWorkspaceUrl,
      );
      if (canonicalQs != null) {
        redirect(withTeamWorkspaceQuery(`/decks/${id}/study`, canonicalQs));
      }
    }
  }

  const workspaceQs =
    teamWorkspaceUrl != null
      ? await buildResolvedTeamWorkspaceQueryString(userId, teamWorkspaceUrl)
      : "";
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

  const isWorkspaceOwnerViewer = teamWorkspaceUrl?.ownerUserId === userId;
  const personalDashHref = personalDashboardHrefWithUserPlanQuery({
    userId,
    activeTeamPlan,
    activeEducationTeamPlan,
    isPro,
    hasClerkPersonalPro,
    hasClerkPersonalProPlus,
  });
  const showTeamWorkspaceNavLinks =
    canEditDeckContent(access) &&
    fromTeamWorkspaceUrl &&
    Boolean(workspaceQs) &&
    !isWorkspaceOwnerViewer;
  const teamDashboardHref = isWorkspaceOwnerViewer
    ? personalDashHref
    : workspaceQs
      ? `/dashboard?${workspaceQs}`
      : "/dashboard";
  const deckPageHref =
    workspaceQs && !isWorkspaceOwnerViewer
      ? withTeamWorkspaceQuery(`/decks/${id}`, workspaceQs)
      : `/decks/${id}`;

  const studyTeamId =
    fromTeamWorkspaceUrl && teamWorkspaceUrl
      ? teamWorkspaceUrl.teamId
      : access.kind === "team_member" || access.kind === "team_admin"
        ? access.teamId
        : deck.teamId ?? null;

  let quizDurationSeconds: number | undefined;
  // Per-deck timer wins when set; otherwise use workspace/subscriber effective minutes.
  if (deck.quizDurationMinutes != null) {
    quizDurationSeconds = teamQuizDurationSeconds(deck.quizDurationMinutes);
  } else if (studyTeamId != null) {
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
  let memberAllowAiRecall = true;
  let memberAllowQuiz = true;
  if (access.kind === "team_member" || access.kind === "team_admin") {
    const privilegeTeamId = access.teamId;
    const team = await getTeamById(privilegeTeamId);
    const applyStudyPrivileges =
      access.kind === "team_member" ||
      (team != null && isEducationTeamPlanId(team.planSlug));
    if (applyStudyPrivileges) {
      const privilege = await getDeckAssignmentStudyPrivilege(
        privilegeTeamId,
        id,
        userId,
      );
      const modes = resolveMemberStudyModes(privilege);
      memberAllowReview = modes.allowReview;
      memberAllowAiRecall = modes.allowAiRecall;
      memberAllowQuiz = modes.allowQuiz;
    }
  }

  let studyBackHref: string;
  let studyBackLabel: string;
  if (isWorkspaceOwnerViewer) {
    studyBackHref = personalDashHref;
    studyBackLabel = "← Dashboard";
  } else if (workspaceQs) {
    studyBackHref = teamDashboardHref;
    studyBackLabel = "← Dashboard";
  } else if (
    studyTeamId != null &&
    (access.kind === "team_member" ||
      access.kind === "team_admin" ||
      fromTeamWorkspaceUrl)
  ) {
    const team = await getTeamById(studyTeamId);
    if (team && team.ownerUserId === userId) {
      studyBackHref = personalDashHref;
    } else if (team) {
      const member = await getMemberRecord(studyTeamId, userId);
      studyBackHref = buildTeamWorkspaceDashboardPath({
        teamId: studyTeamId,
        ownerUserId: team.ownerUserId,
        planSlug: team.planSlug,
        teamMemberUrlParam: member?.id ?? 0,
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

  const studyTeam = studyTeamId != null ? await getTeamById(studyTeamId) : null;
  const ownerInboxAvailable =
    studyTeam != null ? studyTeam.ownerUserId !== userId : false;
  const isEducationTeamPlan =
    studyTeam != null && isEducationTeamPlanId(studyTeam.planSlug);
  const studyHasAiRecall =
    hasAiRecall ||
    resolveAiRecallAccess({
      personalPlanSlug: effectivePlanSlug,
      hasClerkProPlusPlan: hasClerkPersonalProPlus,
      activeTeamPlan,
      activeEducationTeamPlan,
      studyWorkspacePlanSlug: studyTeam?.planSlug ?? null,
    });

  const quizFormats = await resolveQuizFormatsForStudy(
    id,
    studyTeamId ?? deck.teamId ?? null,
  );
  const quizFormatAssignmentPlan = await getDeckQuizFormatAssignmentsForStudy(id);

  const cardOrderTeamId = studyTeamId ?? deck.teamId ?? null;
  const quizCardOrderContext =
    cardOrderTeamId != null
      ? await getQuizCardOrderForViewer(cardOrderTeamId, id, userId).catch(() => null)
      : null;
  const canReshuffleCardOrder =
    cardOrderTeamId != null &&
    (access.kind === "owner" || access.kind === "team_admin");

  const canEditFormats =
    canEditDeckContent(access) &&
    deck.userId === userId &&
    canConfigurePersonalDeckQuizFormatsFromAccess({
      effectivePlanSlug,
      hasClerkPersonalProPlus,
      canAccessTeacherTools,
      activeTeamPlan,
      activeEducationTeamPlan,
    });
  const quizFormatEditorSnapshot = canEditFormats
    ? await getQuizFormatsDeckSnapshotForOwner(id, userId)
    : null;

  // Join-with-code on study only for members who were granted LC access
  // (Session Settings → Members → Grant access to LC). Owners/hosts do not see it.
  let showLiveClassroomJoin = false;
  let liveClassroomSessionName: string | null = null;
  if (studyTeamId != null) {
    const [{ owns }, grant] = await Promise.all([
      teamOwnsLiveClassroom(studyTeamId),
      getLiveClassroomParticipantGrant(studyTeamId, userId),
    ]);
    if (owns && grant != null) {
      const openSessions = await listActiveOrLobbySessionsForTeam(studyTeamId);
      const linked =
        openSessions.find((s) => s.deckId === id) ?? openSessions[0] ?? null;
      if (linked != null) {
        showLiveClassroomJoin = true;
        liveClassroomSessionName = linked.name;
      }
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -right-24 -top-24 size-[20rem] rounded-full bg-primary/12 blur-3xl animate-float-gentle" />
        <div className="absolute -left-16 top-1/3 size-[16rem] rounded-full bg-violet-500/10 blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-[-4rem] right-1/4 size-[14rem] rounded-full bg-fuchsia-500/8 blur-3xl animate-drift" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 sm:gap-7 sm:p-8">
        <section className="animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both rounded-2xl border border-border/70 bg-card/55 p-5 shadow-lg shadow-black/10 backdrop-blur-md sm:p-7">
          <div className="flex flex-col gap-3">
            <Link
              href={studyBackHref}
              className="group inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              {studyBackLabel.replace("← ", "")}
            </Link>
            {teamDeckHeading && (
              <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs sm:text-sm">
                <p className="text-muted-foreground">
                  Team:{" "}
                  {showTeamWorkspaceNavLinks ? (
                    <Link href={teamDashboardHref} className={teamWorkspaceNavLinkClass}>
                      {teamDeckHeading.teamName}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">
                      {teamDeckHeading.teamName}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  Owner:{" "}
                  <span className="text-foreground/90">
                    {teamDeckHeading.ownerDisplayName}
                  </span>
                </p>
              </div>
            )}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Study session
                </Badge>
                <Badge variant="secondary" className="text-xs tabular-nums">
                  {cards.length} card{cards.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <h1 className="text-balance text-2xl font-semibold tracking-tight break-words sm:text-3xl">
                {showTeamWorkspaceNavLinks ? (
                  <Link
                    href={deckPageHref}
                    className={cn(
                      teamWorkspaceDeckTitleLinkClass,
                      "text-2xl sm:text-3xl",
                    )}
                  >
                    {deck.name}
                  </Link>
                ) : (
                  deck.name
                )}
              </h1>
              {deck.description?.trim() ? (
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
                  {deck.description.trim()}
                </p>
              ) : null}
              {showLiveClassroomJoin ? (
                <LiveClassroomStudyJoinCard
                  sessionName={liveClassroomSessionName}
                />
              ) : null}
            </div>
          </div>
        </section>

        <div className="animate-in fade-in-0 slide-in-from-bottom-3 duration-700 fill-mode-both flex flex-1 flex-col">
          <StudySessionLoader
            cards={cards}
            deckId={id}
            deckName={deck.name}
            deckDescription={deck.description ?? null}
            teamId={studyTeamId ?? deck.teamId ?? null}
            allowsQuizStudy={allowsQuizStudy}
            memberAllowReview={memberAllowReview}
            memberAllowAiRecall={memberAllowAiRecall}
            memberAllowQuiz={memberAllowQuiz}
            deckGradient={deck.gradient ?? null}
            autoSaveQuizResult={fromTeamWorkspaceUrl}
            quizDurationSeconds={quizDurationSeconds}
            hasAiReading={hasAiReading}
            hasAiRecall={studyHasAiRecall}
            aiRecallSessionCardLimit={resolveEffectiveAiRecallSessionCardCount({
              deckCardCount: deck.aiRecallSessionCardCount ?? null,
              workspaceCardCount: studyTeam?.aiRecallSessionCardCount ?? null,
            })}
            quizSecurity={quizSecurity}
            quizSchedule={quizSchedule}
            exitHref={studyBackHref}
            exitLabel={studyExitLabel}
            ownerInboxAvailable={ownerInboxAvailable}
            allowQuizCancelExit={
              access.kind === "owner" || access.kind === "team_admin"
            }
            isEducationTeamPlan={isEducationTeamPlan}
            quizFormats={quizFormats}
            quizFormatAssignmentPlan={quizFormatAssignmentPlan}
            quizCardOrder={
              quizCardOrderContext?.cardIds &&
              quizCardOrderContext.cardIds.length > 0
                ? quizCardOrderContext.cardIds
                : null
            }
            quizCardOrderShuffledAt={
              quizCardOrderContext?.deckShuffledAt ??
              quizCardOrderContext?.shuffledAt ??
              null
            }
            canReshuffleCardOrder={canReshuffleCardOrder}
            quizFormatEditorSnapshot={quizFormatEditorSnapshot}
          />
        </div>
      </div>
    </div>
  );
}
