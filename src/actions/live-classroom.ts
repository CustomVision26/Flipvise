"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCardsByDeckUnscoped } from "@/db/queries/cards";
import {
  bumpLiveOrganizationAnalytics,
  bumpLiveTeacherAnalytics,
  countConcurrentLiveSessions,
  createLiveClassroomSession,
  createLiveClassroomTeamsForSession,
  getLiveBattleAnswer,
  getLiveBattleReportBySession,
  getLiveClassroomParticipant,
  getLiveClassroomSessionById,
  getLiveClassroomSessionByJoinCode,
  getOrCreateLiveClassroomTeamSettings,
  insertLiveBattleAnswer,
  insertLiveBattleQuestions,
  insertLiveBattleStrategyCards,
  listActiveOrLobbySessionsForTeam,
  listLiveBattleAnswersForQuestion,
  listLiveBattleAnswersForSession,
  listLiveBattleQuestions,
  listLiveBattleStrategyCards,
  createLiveClassroomSavedGroup,
  deleteLiveClassroomSavedGroup,
  getLiveClassroomSavedGroup,
  listLiveClassroomParticipants,
  listLiveClassroomSavedGroups,
  listLiveClassroomTeams,
  getLiveClassroomDeckSummariesByIds,
  markStaleLiveClassroomParticipantsDisconnected,
  markStrategyCardUsed,
  returnLiveClassroomSessionToLobby,
  updateLiveBattleQuestion,
  updateLiveClassroomParticipant,
  updateLiveClassroomSavedGroup,
  updateLiveClassroomSession,
  updateLiveClassroomTeam,
  updateLiveClassroomTeamSettings,
  upsertLiveBattleReport,
  upsertLiveClassroomParticipant,
  grantLiveClassroomParticipant,
  grantLiveClassroomTeacher,
  revokeLiveClassroomParticipant,
  revokeLiveClassroomTeacher,
  type LiveBattleQuestionRow,
} from "@/db/queries/live-classroom";
import { getDeckRowById } from "@/db/queries/decks";
import { upsertLiveClassroomLobbyInboxMessage } from "@/db/queries/live-classroom-lobby-inbox";
import { getDecksForTeam, getTeamById, listTeamMembers } from "@/db/queries/teams";
import {
  liveClassroomRoleCanHost,
  liveClassroomRoleCanManageOrg,
  requireLiveClassroomAccess,
  requireLiveClassroomPollAccess,
  resolveLiveClassroomOrgRole,
  teamOwnsLiveClassroom,
} from "@/lib/live-classroom-access";
import { buildLiveClassroomLobbyInviteCopy } from "@/lib/live-classroom-lobby-inbox";
import { notifyNativeInboxPush } from "@/lib/notify-native-inbox-push";
import {
  generateLiveClassroomAiExplanation,
  generateLiveClassroomAiHint,
  generateLiveClassroomTeacherSummary,
  generateLiveClassroomWarmUpQuestions,
  questionsFromDeckCards,
} from "@/lib/live-classroom-ai";
import {
  canStartWithParticipantCount,
  distributeParticipantsRandomly,
  scoreLiveClassroomAnswer,
} from "@/lib/live-classroom-scoring";
import {
  DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG,
  LIVE_CLASSROOM_DEFAULT_TEAM_NAMES,
  LIVE_CLASSROOM_BATTLE_MODES,
  LIVE_CLASSROOM_DIFFICULTIES,
  LIVE_CLASSROOM_SESSION_TYPES,
  LIVE_CLASSROOM_STRATEGY_CARD_KINDS,
  LIVE_CLASSROOM_STRATEGY_CARD_POLICIES,
  LIVE_CLASSROOM_TEAM_ASSIGNMENT_MODES,
  LIVE_CLASSROOM_CAPTAIN_MODES,
  LIVE_CLASSROOM_BATTLE_START_DELAY_OPTIONS_SEC,
  isLiveClassroomPresenceFresh,
  type LiveClassroomReportStats,
  type LiveClassroomSessionConfig,
  type LiveClassroomStrategyCardKind,
} from "@/lib/live-classroom-types";
import {
  LIVE_CLASSROOM_ROOT_PATH,
  liveClassroomHostPath,
  liveClassroomLobbyPath,
} from "@/lib/live-classroom-url";
import {
  defaultMaxConcurrentLiveSessions,
  liveClassroomAllowsConcurrentOverride,
} from "@/lib/live-classroom-eligibility";
import {
  allEligibleParticipantsCompletedIndependentBattle,
  isIndependentLiveClassroomBattleMode,
  participantHasCompletedIndependentBattle,
  personalQuestionIndex,
  readParticipantBattleMap,
  withParticipantBattleStatus,
} from "@/lib/live-classroom-battle-progress";
import {
  isQuestionRevealedForAny,
  isQuestionRevealedForTeam,
  maxTimerBonusSeconds,
  readParticipantClockMap,
  remainingQuestionSeconds,
  timerBonusSecondsForTeam,
  withParticipantClock,
  withRevealTarget,
  withTimerBonus,
} from "@/lib/live-classroom-question-clock";
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";
import {
  analyzeLiveClassroomSavedGroup,
  assertSavedGroupTeamsValid,
  LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM,
} from "@/lib/live-classroom-saved-groups";

const teamIdSchema = z.number().int().positive();

const savedGroupTeamsSchema = z
  .array(
    z.object({
      teamName: z.string().trim().min(1).max(128),
      userIds: z.array(z.string().min(1)).min(LIVE_CLASSROOM_MIN_MEMBERS_PER_TEAM),
    }),
  )
  .min(1);

const createSessionSchema = z.object({
  teamId: teamIdSchema,
  name: z.string().trim().min(1).max(255),
  sessionType: z.enum(LIVE_CLASSROOM_SESSION_TYPES),
  battleMode: z.enum(LIVE_CLASSROOM_BATTLE_MODES),
  deckId: z.number().int().positive().nullable().optional(),
  questionCount: z.number().int().min(1).max(30),
  timePerQuestionSec: z.number().int().min(5).max(180),
  difficulty: z.enum(LIVE_CLASSROOM_DIFFICULTIES),
  allowAiExplanations: z.boolean(),
  allowStrategyCards: z.boolean(),
  allowMusic: z.boolean(),
  teamAssignment: z.enum(LIVE_CLASSROOM_TEAM_ASSIGNMENT_MODES),
  captainMode: z.enum(LIVE_CLASSROOM_CAPTAIN_MODES).optional(),
  survivalHearts: z.number().int().min(1).max(5).optional(),
  strategyCardPolicy: z.enum(LIVE_CLASSROOM_STRATEGY_CARD_POLICIES).optional(),
  enabledStrategyCards: z
    .array(z.enum(LIVE_CLASSROOM_STRATEGY_CARD_KINDS))
    .optional(),
  scheduledFor: z.string().datetime().nullable().optional(),
  /** When true, generate AI warm-up questions from the selected workspace deck. */
  warmUp: z.boolean().optional(),
  teamCount: z.number().int().min(2).max(4).optional(),
});

function revalidateLiveClassroom(teamId: number, sessionId?: number) {
  revalidatePath(LIVE_CLASSROOM_ROOT_PATH);
  revalidatePath(`/dashboard/live-classroom`);
  if (sessionId != null) {
    revalidatePath(liveClassroomLobbyPath(sessionId));
    revalidatePath(liveClassroomHostPath(sessionId));
  }
  void teamId;
}

export async function createLiveClassroomSessionAction(
  raw: z.infer<typeof createSessionSchema>,
) {
  const parsed = createSessionSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid session input");
  const data = parsed.data;

  const { access, licensedSeats, settings } = await requireLiveClassroomAccess({
    teamId: data.teamId,
    requireHost: true,
  });

  const concurrent = await countConcurrentLiveSessions(data.teamId);
  const maxConcurrent = Math.max(
    1,
    settings.maxConcurrentSessions ||
      defaultMaxConcurrentLiveSessions(
        (await teamOwnsLiveClassroom(data.teamId)).team?.planSlug ?? "",
      ),
  );
  if (concurrent >= maxConcurrent) {
    const open = await listActiveOrLobbySessionsForTeam(data.teamId);
    const existing = open[0];
    if (existing) {
      return {
        sessionId: existing.id,
        joinCode: existing.joinCode,
        alreadyOpen: true as const,
        status: existing.status,
      };
    }
    throw new Error(
      `Maximum concurrent Live Classroom sessions (${maxConcurrent}) reached.`,
    );
  }

  const config: LiveClassroomSessionConfig = {
    ...DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG,
    questionCount: data.questionCount,
    timePerQuestionSec: data.timePerQuestionSec,
    difficulty: data.difficulty,
    allowAiExplanations: data.allowAiExplanations,
    allowStrategyCards: data.allowStrategyCards && settings.allowStrategyCards,
    allowMusic: data.allowMusic && settings.allowMusic,
    teamAssignment: data.teamAssignment,
    captainMode: data.captainMode ?? "rotation",
    survivalHearts: data.survivalHearts ?? 3,
    strategyCardPolicy:
      data.strategyCardPolicy ?? settings.strategyCardPolicy,
    strategyCardLimitPerTeam: settings.strategyCardLimitPerTeam,
    enabledStrategyCards:
      data.enabledStrategyCards ??
      DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG.enabledStrategyCards,
  };

  const isScheduled = Boolean(data.scheduledFor);
  const session = await createLiveClassroomSession({
    teamId: data.teamId,
    hostUserId: access.userId,
    name: data.name,
    status: isScheduled ? "scheduled" : "lobby",
    sessionType: data.sessionType,
    battleMode: data.battleMode,
    deckId: data.deckId ?? null,
    config,
    scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
  });

  const teamCount = data.teamCount ?? 4;
  const colorKeys = ["blue", "red", "green", "yellow"] as const;
  await createLiveClassroomTeamsForSession(
    session.id,
    LIVE_CLASSROOM_DEFAULT_TEAM_NAMES.slice(0, teamCount).map((name, i) => ({
      name,
      colorKey: colorKeys[i] ?? "blue",
      sortOrder: i,
      hearts: config.survivalHearts,
    })),
  );

  // Build questions from deck and/or AI warm-up
  let questionRows: Array<{
    prompt: string;
    choices: string[];
    correctIndex: number;
    explanation: string;
    distractorExplanations: string[];
    topic: string;
    cardId?: number | null;
  }> = [];

  if (!data.deckId) {
    throw new Error("Select a deck linked to this workspace.");
  }

  const team = await getTeamById(data.teamId);
  if (!team) throw new Error("Workspace not found.");
  const workspaceDecks = await getDecksForTeam(data.teamId, team.ownerUserId);
  const workspaceDeck = workspaceDecks.find((d) => d.id === data.deckId);
  if (!workspaceDeck) {
    throw new Error("Deck is not linked to this workspace.");
  }

  if (data.warmUp || data.sessionType === "warm_up") {
    questionRows = await generateLiveClassroomWarmUpQuestions({
      userId: access.userId,
      teamId: data.teamId,
      subject: workspaceDeck.name,
      topic: workspaceDeck.description?.trim() || workspaceDeck.name,
      grade: workspaceDeck.gradeLevel?.trim() || "General",
      difficulty: data.difficulty,
      questionCount: data.questionCount,
    });
  } else {
    const cards = await getCardsByDeckUnscoped(data.deckId);
    if (cards.length === 0) throw new Error("Deck has no cards.");
    questionRows = questionsFromDeckCards(
      cards.map((c) => {
        const mcChoices = Array.isArray(c.choices) ? c.choices.filter(Boolean) : [];
        const correct =
          c.cardType === "multiple_choice" &&
          typeof c.correctChoiceIndex === "number" &&
          mcChoices[c.correctChoiceIndex]
            ? mcChoices[c.correctChoiceIndex]!
            : (c.back ?? "");
        const distractors =
          c.cardType === "multiple_choice"
            ? mcChoices.filter((ch) => ch !== correct)
            : mcChoices.filter((ch) => ch !== correct);
        return {
          id: c.id,
          front: c.front ?? "Question",
          back: correct || (c.back ?? "Answer"),
          distractors,
        };
      }),
      data.questionCount,
    );
  }

  await insertLiveBattleQuestions(
    session.id,
    questionRows.map((q, index) => ({
      sortOrder: index,
      prompt: q.prompt,
      choices: q.choices,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      distractorExplanations: q.distractorExplanations,
      topic: q.topic,
      cardId: q.cardId ?? null,
    })),
  );

  if (config.allowStrategyCards && config.strategyCardPolicy !== "disabled") {
    const teams = await listLiveClassroomTeams(session.id);
    const kinds = config.enabledStrategyCards;
    const perTeam =
      config.strategyCardPolicy === "unlimited"
        ? kinds.length
        : Math.min(config.strategyCardLimitPerTeam, kinds.length);
    const cards: Array<{ liveTeamId: number; kind: LiveClassroomStrategyCardKind }> =
      [];
    for (const team of teams) {
      for (let i = 0; i < perTeam; i++) {
        const kind = kinds[i % kinds.length];
        if (kind) cards.push({ liveTeamId: team.id, kind });
      }
    }
    if (cards.length) await insertLiveBattleStrategyCards(session.id, cards);
  }

  void licensedSeats;
  revalidateLiveClassroom(data.teamId, session.id);
  return { sessionId: session.id, joinCode: session.joinCode };
}

export async function joinLiveClassroomSessionAction(raw: {
  sessionId: number;
  displayName?: string;
}) {
  const schema = z.object({
    sessionId: z.number().int().positive(),
    displayName: z.string().trim().max(255).optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid join input");

  const session = await getLiveClassroomSessionById(parsed.data.sessionId);
  if (!session) throw new Error("Session not found");
  if (!["lobby", "active", "paused"].includes(session.status)) {
    throw new Error("This session is not joinable.");
  }

  const { access, licensedSeats } = await requireLiveClassroomAccess({
    teamId: session.teamId,
  });

  const existing = await getLiveClassroomParticipant(
    session.id,
    access.userId,
  );
  if (!existing || existing.removed) {
    const participants = await listLiveClassroomParticipants(session.id);
    if (participants.length >= licensedSeats && !existing) {
      throw new Error(
        `Participant limit reached (${licensedSeats} licensed seats).`,
      );
    }
  }

  const displays = await getClerkUserFieldDisplaysByIds([access.userId]);
  const displayName =
    parsed.data.displayName?.trim() ||
    displays[access.userId]?.primaryLine ||
    "Participant";

  await upsertLiveClassroomParticipant({
    sessionId: session.id,
    userId: access.userId,
    displayName,
    connected: true,
  });

  revalidateLiveClassroom(session.teamId, session.id);
  return { ok: true as const };
}

/** Resolve a lobby join code and join the session (code-only — no lobby link). */
export async function joinLiveClassroomByCodeAction(raw: { joinCode: string }) {
  const schema = z.object({
    joinCode: z
      .string()
      .trim()
      .min(4)
      .max(16)
      .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "")),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Enter a valid join code.");

  const session = await getLiveClassroomSessionByJoinCode(parsed.data.joinCode);
  if (!session) throw new Error("No session found for that join code.");
  if (!["lobby", "active", "paused"].includes(session.status)) {
    throw new Error("This session is not joinable.");
  }

  await joinLiveClassroomSessionAction({ sessionId: session.id });
  return {
    sessionId: session.id,
    status: session.status,
    teamId: session.teamId,
  };
}

/** Avoid stampeding Neon with stale-presence UPDATEs on every 2–5s poll. */
const lastStaleSweepAtBySession = new Map<number, number>();
const STALE_SWEEP_THROTTLE_MS = 15_000;

async function maybeMarkStaleParticipants(sessionId: number) {
  const now = Date.now();
  const prev = lastStaleSweepAtBySession.get(sessionId) ?? 0;
  if (now - prev < STALE_SWEEP_THROTTLE_MS) return;
  lastStaleSweepAtBySession.set(sessionId, now);
  await markStaleLiveClassroomParticipantsDisconnected(sessionId);
  // After marking leavers offline, independent battles may be ready to complete.
  void maybeCompleteIndependentBattleIfEveryoneDone(sessionId).catch(
    () => undefined,
  );
}

export async function heartbeatLiveClassroomAction(sessionId: number) {
  const { userId } = await requireLiveClassroomPollAccess(sessionId);
  await upsertLiveClassroomParticipant({
    sessionId,
    userId,
    connected: true,
  });
  return { ok: true as const };
}

/** Mark the current user offline when they leave lobby / host / play. */
export async function leaveLiveClassroomPresenceAction(sessionId: number) {
  try {
    const { userId } = await requireLiveClassroomPollAccess(sessionId);
    const participant = await getLiveClassroomParticipant(sessionId, userId);
    if (participant) {
      await updateLiveClassroomParticipant(participant.id, {
        connected: false,
      });
    }
  } catch {
    // Best-effort leave — ignore if session already ended / unauthorized.
  }
  return { ok: true as const };
}

export async function getLiveClassroomRealtimeStateAction(sessionId: number) {
  const { userId, session } = await requireLiveClassroomPollAccess(sessionId);

  await maybeMarkStaleParticipants(sessionId);

  // Lobby only needs teams + participants; skip battle payloads to keep polls light.
  const lobbyOnly = session.status === "lobby";
  const [teams, participants, questions, answers, strategyCards, deckSummary] =
    await Promise.all([
      listLiveClassroomTeams(sessionId),
      listLiveClassroomParticipants(sessionId),
      lobbyOnly
        ? Promise.resolve([] as Awaited<
            ReturnType<typeof listLiveBattleQuestions>
          >)
        : listLiveBattleQuestions(sessionId),
      lobbyOnly
        ? Promise.resolve([] as Awaited<
            ReturnType<typeof listLiveBattleAnswersForSession>
          >)
        : listLiveBattleAnswersForSession(sessionId),
      lobbyOnly
        ? Promise.resolve([] as Awaited<
            ReturnType<typeof listLiveBattleStrategyCards>
          >)
        : listLiveBattleStrategyCards(sessionId),
      session.deckId != null
        ? getLiveClassroomDeckSummariesByIds([session.deckId]).then(
            (map) => map[session.deckId!] ?? null,
          )
        : Promise.resolve(null),
    ]);

  const independent = isIndependentLiveClassroomBattleMode(session.battleMode);
  const battleMap = readParticipantBattleMap(session.extensions);
  const answeredByUser = new Map<string, number>();
  const answeredQuestionIdsByUser = new Map<string, Set<number>>();
  for (const a of answers) {
    answeredByUser.set(a.userId, (answeredByUser.get(a.userId) ?? 0) + 1);
    const set = answeredQuestionIdsByUser.get(a.userId) ?? new Set<number>();
    set.add(a.questionId);
    answeredQuestionIdsByUser.set(a.userId, set);
  }

  const hostQuestion: LiveBattleQuestionRow | null =
    questions[session.currentQuestionIndex] ?? null;
  let viewerQuestion: LiveBattleQuestionRow | null = hostQuestion;
  let personalQuestionIndexValue = session.currentQuestionIndex;
  let personalFinished = false;
  let personalBattleStatus: "active" | "finished" | "opted_out" = "active";

  if (independent && !lobbyOnly) {
    const myStatus = battleMap[userId]?.status;
    personalBattleStatus =
      myStatus === "finished" || myStatus === "opted_out" ? myStatus : "active";
    const myAnsweredIds = answeredQuestionIdsByUser.get(userId) ?? new Set();
    const idx = personalQuestionIndex({
      questionIdsInOrder: questions.map((q) => q.id),
      answeredQuestionIds: myAnsweredIds,
    });
    if (
      personalBattleStatus === "opted_out" ||
      personalBattleStatus === "finished" ||
      idx < 0
    ) {
      viewerQuestion = null;
      personalFinished = true;
      personalQuestionIndexValue = questions.length;
      if (
        personalBattleStatus === "active" &&
        questions.length > 0 &&
        myAnsweredIds.size >= questions.length
      ) {
        personalBattleStatus = "finished";
      }
    } else {
      viewerQuestion = questions[idx] ?? null;
      personalQuestionIndexValue = idx;
      personalFinished = false;
    }
    // Host / projector monitor the shared index; students use personal progress.
    if (userId === session.hostUserId) {
      viewerQuestion = hostQuestion;
    }
  }

  const answeredForCurrent = viewerQuestion
    ? answers.filter((a) => a.questionId === viewerQuestion.id)
    : [];

  const nowMs = Date.now();
  const presence = participants.map((p) => ({
    ...p,
    present:
      p.connected && isLiveClassroomPresenceFresh(p.lastSeenAt, nowMs),
  }));

  const myLiveTeamId =
    presence.find((p) => p.userId === userId)?.liveTeamId ?? null;
  const viewerQuestionId = viewerQuestion?.id ?? null;
  const clockMap = readParticipantClockMap(session.extensions);
  const viewerClock = clockMap[userId];
  const effectiveStartedAt =
    independent &&
    viewerQuestionId != null &&
    viewerClock?.questionId === viewerQuestionId
      ? viewerClock.startedAt
      : (session.questionStartedAt?.toISOString() ?? null);

  const isHostViewer = userId === session.hostUserId;
  const timerBonusSec = isHostViewer
    ? maxTimerBonusSeconds(
        session.extensions,
        viewerQuestionId,
        teams.map((t) => t.id),
      )
    : timerBonusSecondsForTeam(
        session.extensions,
        viewerQuestionId,
        myLiveTeamId,
      );

  const effectivelyRevealed =
    Boolean(viewerQuestion?.revealed) ||
    (viewerQuestionId != null &&
      (isHostViewer
        ? isQuestionRevealedForAny(session.extensions, viewerQuestionId)
        : isQuestionRevealedForTeam(
            session.extensions,
            viewerQuestionId,
            myLiveTeamId,
          )));

  const pointsByUserId = new Map<string, number>();
  for (const a of answers) {
    pointsByUserId.set(
      a.userId,
      (pointsByUserId.get(a.userId) ?? 0) + a.pointsAwarded,
    );
  }

  const accuracyDenom = presence.reduce(
    (n, p) => n + p.correctCount + p.incorrectCount,
    0,
  );
  const accuracyNum = presence.reduce((n, p) => n + p.correctCount, 0);
  const avgAccuracy =
    accuracyDenom > 0 ? Math.round((accuracyNum / accuracyDenom) * 100) : 0;
  const avgResponseMs =
    presence.length > 0
      ? Math.round(
          presence.reduce((n, p) => n + p.totalResponseTimeMs, 0) /
            Math.max(
              1,
              presence.reduce((n, p) => n + p.answersSubmitted, 0),
            ),
        )
      : 0;

  const battleStartsAtRaw = session.extensions?.battleStartsAt;
  const battleStartsAt =
    typeof battleStartsAtRaw === "string" ? battleStartsAtRaw : null;

  const activeBattlersRemaining = independent
    ? presence.filter((p) => {
        if (p.liveTeamId == null) return false;
        if (!p.present) return false;
        return !participantHasCompletedIndependentBattle(
          p.userId,
          battleMap,
          answeredByUser.get(p.userId) ?? 0,
          questions.length,
        );
      }).length
    : presence.filter((p) => p.present && p.liveTeamId != null).length;

  return {
    session: {
      id: session.id,
      name: session.name,
      status: session.status,
      sessionType: session.sessionType,
      battleMode: session.battleMode,
      currentQuestionIndex: session.currentQuestionIndex,
      personalQuestionIndex: personalQuestionIndexValue,
      personalFinished,
      personalBattleStatus,
      independentBattle: independent,
      activeBattlersRemaining,
      questionStartedAt: effectiveStartedAt,
      battleStartsAt,
      musicMuted: session.musicMuted,
      teamsLocked: session.teamsLocked,
      joinCode: session.joinCode,
      config: session.config,
      hostUserId: session.hostUserId,
      teamId: session.teamId,
      deckId: session.deckId,
      deckName: deckSummary?.name ?? null,
      deckCardCount: deckSummary?.cardCount ?? null,
      timerBonusSec,
      remainingSec: remainingQuestionSeconds({
        timePerQuestionSec: session.config.timePerQuestionSec,
        bonusSec: timerBonusSec,
        startedAtIso: effectiveStartedAt,
        paused: session.status === "paused",
        nowMs,
      }),
    },
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      colorKey: t.colorKey,
      score: t.score,
      hearts: t.hearts,
      eliminated: t.eliminated,
      captainUserId: t.captainUserId,
      memberCount: presence.filter((p) => p.liveTeamId === t.id).length,
    })),
    participants: presence.map((p) => {
      const answered = answeredByUser.get(p.userId) ?? 0;
      const status =
        battleMap[p.userId]?.status ??
        (independent &&
        questions.length > 0 &&
        answered >= questions.length
          ? "finished"
          : "active");
      return {
        id: p.id,
        userId: p.userId,
        displayName: p.displayName,
        liveTeamId: p.liveTeamId,
        connected: p.present,
        correctCount: p.correctCount,
        incorrectCount: p.incorrectCount,
        score: pointsByUserId.get(p.userId) ?? 0,
        battleStatus: status as "active" | "finished" | "opted_out",
        answeredCount: answered,
      };
    }),
    currentQuestion: viewerQuestion
      ? {
          id: viewerQuestion.id,
          prompt: viewerQuestion.prompt,
          choices: viewerQuestion.choices,
          sortOrder: viewerQuestion.sortOrder,
          revealed: effectivelyRevealed,
          explanation: effectivelyRevealed
            ? viewerQuestion.explanation
            : null,
          correctIndex: effectivelyRevealed
            ? viewerQuestion.correctIndex
            : null,
          aiExplanationShown: viewerQuestion.aiExplanationShown,
          totalQuestions: questions.length,
        }
      : null,
    answeredCount: answeredForCurrent.length,
    connectedCount: presence.filter((p) => p.present).length,
    averageAccuracy: avgAccuracy,
    averageResponseTimeSec: Math.round((avgResponseMs / 1000) * 10) / 10,
    strategyCards: strategyCards.map((c) => ({
      id: c.id,
      liveTeamId: c.liveTeamId,
      kind: c.kind,
      usedAt: c.usedAt?.toISOString() ?? null,
    })),
    leaderboard: [...teams]
      .sort((a, b) => b.score - a.score)
      .map((t) => ({
        id: t.id,
        name: t.name,
        score: t.score,
        hearts: t.hearts,
        eliminated: t.eliminated,
        colorKey: t.colorKey,
      })),
  };
}

/** Ignore transient disconnects while clients leave lobby and open play/host. */
const INDEPENDENT_BATTLE_LEAVE_GRACE_MS = 60_000;

async function maybeCompleteIndependentBattleIfEveryoneDone(
  sessionId: number,
): Promise<boolean> {
  const session = await getLiveClassroomSessionById(sessionId);
  if (!session || session.status !== "active") return false;
  if (!isIndependentLiveClassroomBattleMode(session.battleMode)) return false;

  // Lobby→battle navigation marks presence offline briefly; do not treat that
  // as "everyone left" or the session completes while the UI still says Starting…
  const startedMs = session.startedAt?.getTime() ?? 0;
  if (
    !startedMs ||
    Date.now() - startedMs < INDEPENDENT_BATTLE_LEAVE_GRACE_MS
  ) {
    return false;
  }

  const [participants, questions, answers] = await Promise.all([
    listLiveClassroomParticipants(sessionId),
    listLiveBattleQuestions(sessionId),
    listLiveBattleAnswersForSession(sessionId),
  ]);
  const answeredByUser = new Map<string, number>();
  for (const a of answers) {
    answeredByUser.set(a.userId, (answeredByUser.get(a.userId) ?? 0) + 1);
  }
  const battleMap = readParticipantBattleMap(session.extensions);
  const nowMs = Date.now();
  const allDone = allEligibleParticipantsCompletedIndependentBattle({
    participants: participants.map((p) => ({
      ...p,
      connected:
        p.connected && isLiveClassroomPresenceFresh(p.lastSeenAt, nowMs),
    })),
    battleMap,
    answeredCountByUserId: answeredByUser,
    questionCount: questions.length,
  });
  if (!allDone) return false;

  await endLiveClassroomSessionAction(sessionId, { systemComplete: true });
  return true;
}

/** Advance (or complete) collaborative battle once every active captain answered. */
async function maybeAdvanceCollaborativeBattleAfterAnswer(input: {
  sessionId: number;
  questionId: number;
  currentQuestionIndex: number;
  questionCount: number;
  teams: Array<{
    id: number;
    eliminated: boolean;
    captainUserId: string | null;
  }>;
}): Promise<boolean> {
  const answers = await listLiveBattleAnswersForSession(input.sessionId);
  const answeredCaptainIds = new Set(
    answers
      .filter((a) => a.questionId === input.questionId)
      .map((a) => a.userId),
  );
  const activeTeams = input.teams.filter(
    (t) => !t.eliminated && t.captainUserId,
  );
  if (activeTeams.length === 0) return false;
  const allCaptainsAnswered = activeTeams.every(
    (t) => t.captainUserId != null && answeredCaptainIds.has(t.captainUserId),
  );
  if (!allCaptainsAnswered) return false;

  const next = input.currentQuestionIndex + 1;
  if (next >= input.questionCount) {
    await endLiveClassroomSessionAction(input.sessionId, {
      systemComplete: true,
    });
    return true;
  }

  await updateLiveClassroomSession(input.sessionId, {
    currentQuestionIndex: next,
    questionStartedAt: new Date(),
    status: "active",
  });
  return false;
}

export async function assignLiveClassroomTeamsAction(raw: {
  sessionId: number;
  mode: "random" | "manual";
  assignments?: Array<{ userId: string; liveTeamId: number }>;
}) {
  const schema = z.object({
    sessionId: z.number().int().positive(),
    mode: z.enum(["random", "manual"]),
    assignments: z
      .array(
        z.object({
          userId: z.string().min(1),
          liveTeamId: z.number().int().positive(),
        }),
      )
      .optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid assignment input");

  const session = await getLiveClassroomSessionById(parsed.data.sessionId);
  if (!session) throw new Error("Session not found");
  if (session.teamsLocked) {
    throw new Error("Teams are locked.");
  }
  await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireHost: true,
  });

  const teams = await listLiveClassroomTeams(session.id);
  const participants = await listLiveClassroomParticipants(session.id);

  if (parsed.data.mode === "random") {
    const buckets = distributeParticipantsRandomly(
      participants.map((p) => p.userId),
      teams.length,
    );
    for (let i = 0; i < buckets.length; i++) {
      const team = teams[i];
      if (!team) continue;
      for (const userId of buckets[i] ?? []) {
        const p = participants.find((x) => x.userId === userId);
        if (p) await updateLiveClassroomParticipant(p.id, { liveTeamId: team.id });
      }
      if (session.battleMode === "collaborative_team") {
        const captain = buckets[i]?.[0] ?? null;
        await updateLiveClassroomTeam(team.id, { captainUserId: captain });
      }
    }
  } else {
    for (const a of parsed.data.assignments ?? []) {
      const p = participants.find((x) => x.userId === a.userId);
      if (p) {
        await updateLiveClassroomParticipant(p.id, {
          liveTeamId: a.liveTeamId,
        });
      }
    }
  }

  revalidateLiveClassroom(session.teamId, session.id);
  return { ok: true as const };
}

export async function updateLobbyTeamAction(raw: {
  sessionId: number;
  liveTeamId?: number;
  name?: string;
  lockTeams?: boolean;
  removeUserId?: string;
  moveUserId?: string;
  /** Target team id, or null to move to Unassigned. */
  toLiveTeamId?: number | null;
}) {
  const schema = z.object({
    sessionId: z.number().int().positive(),
    liveTeamId: z.number().int().positive().optional(),
    name: z.string().trim().min(1).max(128).optional(),
    lockTeams: z.boolean().optional(),
    removeUserId: z.string().optional(),
    moveUserId: z.string().optional(),
    toLiveTeamId: z.number().int().positive().nullable().optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid lobby update");

  const session = await getLiveClassroomSessionById(parsed.data.sessionId);
  if (!session) throw new Error("Session not found");
  await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireHost: true,
  });

  if (typeof parsed.data.lockTeams === "boolean") {
    const { battleStartsAt: _drop, ...restExtensions } =
      session.extensions ?? {};
    void _drop;
    await updateLiveClassroomSession(session.id, {
      teamsLocked: parsed.data.lockTeams,
      // Unlocking cancels any in-progress start countdown.
      ...(parsed.data.lockTeams
        ? {}
        : { extensions: restExtensions }),
    });
  }
  if (parsed.data.liveTeamId && parsed.data.name) {
    await updateLiveClassroomTeam(parsed.data.liveTeamId, {
      name: parsed.data.name,
    });
  }
  if (parsed.data.removeUserId) {
    const p = await getLiveClassroomParticipant(
      session.id,
      parsed.data.removeUserId,
    );
    if (p) {
      await updateLiveClassroomParticipant(p.id, {
        removed: true,
        connected: false,
        liveTeamId: null,
      });
    }
  }
  if (
    parsed.data.moveUserId &&
    Object.prototype.hasOwnProperty.call(parsed.data, "toLiveTeamId")
  ) {
    if (session.teamsLocked) throw new Error("Teams are locked.");
    const p = await getLiveClassroomParticipant(
      session.id,
      parsed.data.moveUserId,
    );
    if (p) {
      await updateLiveClassroomParticipant(p.id, {
        liveTeamId: parsed.data.toLiveTeamId ?? null,
      });
    }
  }

  revalidateLiveClassroom(session.teamId, session.id);
  return { ok: true as const };
}

async function workspaceUserIdSet(teamId: number): Promise<Set<string>> {
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Workspace not found");
  const members = await listTeamMembers(teamId);
  return new Set([team.ownerUserId, ...members.map((m) => m.userId)]);
}

export async function listLiveClassroomSavedGroupsAction(teamId: number) {
  const parsed = teamIdSchema.safeParse(teamId);
  if (!parsed.success) throw new Error("Invalid team");
  await requireLiveClassroomAccess({
    teamId: parsed.data,
    requireOrgManage: true,
  });
  const rows = await listLiveClassroomSavedGroups(parsed.data);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    groups: r.groups,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Save current lobby team assignments as a reusable group (owner / team admin). */
export async function saveLiveClassroomLobbyGroupAction(raw: {
  sessionId: number;
  name: string;
}) {
  const schema = z.object({
    sessionId: z.number().int().positive(),
    name: z.string().trim().min(1).max(255),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid saved group input");

  const session = await getLiveClassroomSessionById(parsed.data.sessionId);
  if (!session) throw new Error("Session not found");
  if (session.status !== "lobby" && session.status !== "scheduled") {
    throw new Error("Groups can only be saved from the lobby.");
  }
  const { access } = await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireOrgManage: true,
  });

  const [teams, participants] = await Promise.all([
    listLiveClassroomTeams(session.id),
    listLiveClassroomParticipants(session.id),
  ]);

  const groups = teams
    .map((t) => ({
      teamName: t.name,
      userIds: participants
        .filter((p) => p.liveTeamId === t.id)
        .map((p) => p.userId),
    }))
    .filter((g) => g.userIds.length > 0);

  assertSavedGroupTeamsValid(groups);

  const workspaceIds = await workspaceUserIdSet(session.teamId);
  for (const g of groups) {
    for (const userId of g.userIds) {
      if (!workspaceIds.has(userId)) {
        throw new Error(
          "Every assigned member must still belong to this workspace.",
        );
      }
    }
  }

  const row = await createLiveClassroomSavedGroup({
    teamId: session.teamId,
    name: parsed.data.name,
    groups,
    createdByUserId: access.userId,
  });

  revalidateLiveClassroom(session.teamId, session.id);
  return {
    ok: true as const,
    savedGroup: {
      id: row.id,
      name: row.name,
      groups: row.groups,
      updatedAt: row.updatedAt.toISOString(),
    },
  };
}

export async function updateLiveClassroomSavedGroupAction(raw: {
  savedGroupId: number;
  name?: string;
  groups: Array<{ teamName: string; userIds: string[] }>;
}) {
  const schema = z.object({
    savedGroupId: z.number().int().positive(),
    name: z.string().trim().min(1).max(255).optional(),
    groups: savedGroupTeamsSchema,
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid saved group update");

  const existing = await getLiveClassroomSavedGroup(parsed.data.savedGroupId);
  if (!existing) throw new Error("Saved group not found");
  await requireLiveClassroomAccess({
    teamId: existing.teamId,
    requireOrgManage: true,
  });

  assertSavedGroupTeamsValid(parsed.data.groups);

  const workspaceIds = await workspaceUserIdSet(existing.teamId);
  for (const g of parsed.data.groups) {
    for (const userId of g.userIds) {
      if (!workspaceIds.has(userId)) {
        throw new Error(
          "Every assigned member must still belong to this workspace.",
        );
      }
    }
  }

  const row = await updateLiveClassroomSavedGroup(existing.id, {
    name: parsed.data.name,
    groups: parsed.data.groups,
  });
  if (!row) throw new Error("Could not update saved group");

  revalidateLiveClassroom(existing.teamId);
  return {
    ok: true as const,
    savedGroup: {
      id: row.id,
      name: row.name,
      groups: row.groups,
      updatedAt: row.updatedAt.toISOString(),
    },
  };
}

export async function deleteLiveClassroomSavedGroupAction(savedGroupId: number) {
  const parsed = z.number().int().positive().safeParse(savedGroupId);
  if (!parsed.success) throw new Error("Invalid saved group");
  const existing = await getLiveClassroomSavedGroup(parsed.data);
  if (!existing) throw new Error("Saved group not found");
  await requireLiveClassroomAccess({
    teamId: existing.teamId,
    requireOrgManage: true,
  });
  await deleteLiveClassroomSavedGroup(existing.id);
  revalidateLiveClassroom(existing.teamId);
  return { ok: true as const };
}

/**
 * Apply a saved group onto the lobby teams (match by team name).
 * Returns `needsRepair` when workspace removals leave a team under 2 members.
 */
export async function applyLiveClassroomSavedGroupAction(raw: {
  sessionId: number;
  savedGroupId: number;
}) {
  const schema = z.object({
    sessionId: z.number().int().positive(),
    savedGroupId: z.number().int().positive(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid apply input");

  const session = await getLiveClassroomSessionById(parsed.data.sessionId);
  if (!session) throw new Error("Session not found");
  if (session.teamsLocked) throw new Error("Unlock teams before applying a saved group.");
  if (session.status !== "lobby" && session.status !== "scheduled") {
    throw new Error("Saved groups can only be applied in the lobby.");
  }
  await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireOrgManage: true,
  });

  const saved = await getLiveClassroomSavedGroup(parsed.data.savedGroupId);
  if (!saved || saved.teamId !== session.teamId) {
    throw new Error("Saved group not found");
  }

  const workspaceIds = await workspaceUserIdSet(session.teamId);
  const integrity = analyzeLiveClassroomSavedGroup(saved.groups, workspaceIds);
  if (!integrity.isValid) {
    return {
      ok: false as const,
      needsRepair: true as const,
      savedGroup: {
        id: saved.id,
        name: saved.name,
        groups: saved.groups,
        updatedAt: saved.updatedAt.toISOString(),
      },
      integrity: {
        missingUserIds: integrity.missingUserIds,
        undersizedTeamNames: integrity.undersizedTeamNames,
        teams: integrity.teams,
      },
    };
  }

  const [teams, participants] = await Promise.all([
    listLiveClassroomTeams(session.id),
    listLiveClassroomParticipants(session.id),
  ]);

  const teamByName = new Map(
    teams.map((t) => [t.name.trim().toLowerCase(), t]),
  );
  for (const g of saved.groups) {
    if (!teamByName.has(g.teamName.trim().toLowerCase())) {
      throw new Error(
        `Lobby has no team named “${g.teamName}”. Rename lobby teams to match, or update the saved group.`,
      );
    }
  }

  const assignedUserIds = new Set(saved.groups.flatMap((g) => g.userIds));
  const displays = await getClerkUserFieldDisplaysByIds([...assignedUserIds]);

  // Clear current assignments for everyone still in the lobby.
  for (const p of participants) {
    if (p.liveTeamId != null) {
      await updateLiveClassroomParticipant(p.id, { liveTeamId: null });
    }
  }

  for (const g of saved.groups) {
    const liveTeam = teamByName.get(g.teamName.trim().toLowerCase());
    if (!liveTeam) continue;
    for (const userId of g.userIds) {
      const displayName = displays[userId]?.primaryLine ?? "Participant";
      await upsertLiveClassroomParticipant({
        sessionId: session.id,
        userId,
        displayName,
        liveTeamId: liveTeam.id,
        connected: false,
      });
    }
  }

  await updateLiveClassroomSession(session.id, {
    savedGroupId: saved.id,
  });

  revalidateLiveClassroom(session.teamId, session.id);
  return {
    ok: true as const,
    needsRepair: false as const,
    savedGroup: {
      id: saved.id,
      name: saved.name,
      groups: saved.groups,
      updatedAt: saved.updatedAt.toISOString(),
    },
  };
}

/** Update per-session lobby settings (name, type, mode, config) before battle starts. */
export async function updateLiveClassroomSessionSettingsAction(raw: {
  sessionId: number;
  name?: string;
  sessionType?: (typeof LIVE_CLASSROOM_SESSION_TYPES)[number];
  battleMode?: (typeof LIVE_CLASSROOM_BATTLE_MODES)[number];
  questionCount?: number;
  timePerQuestionSec?: number;
  difficulty?: (typeof LIVE_CLASSROOM_DIFFICULTIES)[number];
  battleStartDelaySec?: number;
  allowAiExplanations?: boolean;
  allowStrategyCards?: boolean;
  allowMusic?: boolean;
  teamAssignment?: (typeof LIVE_CLASSROOM_TEAM_ASSIGNMENT_MODES)[number];
  strategyCardPolicy?: (typeof LIVE_CLASSROOM_STRATEGY_CARD_POLICIES)[number];
  strategyCardLimitPerTeam?: number;
  enabledStrategyCards?: (typeof LIVE_CLASSROOM_STRATEGY_CARD_KINDS)[number][];
  survivalHearts?: number;
}) {
  const schema = z.object({
    sessionId: z.number().int().positive(),
    name: z.string().trim().min(1).max(255).optional(),
    sessionType: z.enum(LIVE_CLASSROOM_SESSION_TYPES).optional(),
    battleMode: z.enum(LIVE_CLASSROOM_BATTLE_MODES).optional(),
    questionCount: z.number().int().min(1).max(30).optional(),
    timePerQuestionSec: z.number().int().min(5).max(180).optional(),
    difficulty: z.enum(LIVE_CLASSROOM_DIFFICULTIES).optional(),
    battleStartDelaySec: z
      .number()
      .int()
      .refine((n) =>
        (LIVE_CLASSROOM_BATTLE_START_DELAY_OPTIONS_SEC as readonly number[]).includes(
          n,
        ),
      )
      .optional(),
    allowAiExplanations: z.boolean().optional(),
    allowStrategyCards: z.boolean().optional(),
    allowMusic: z.boolean().optional(),
    teamAssignment: z.enum(LIVE_CLASSROOM_TEAM_ASSIGNMENT_MODES).optional(),
    strategyCardPolicy: z.enum(LIVE_CLASSROOM_STRATEGY_CARD_POLICIES).optional(),
    strategyCardLimitPerTeam: z.number().int().min(0).max(20).optional(),
    enabledStrategyCards: z
      .array(z.enum(LIVE_CLASSROOM_STRATEGY_CARD_KINDS))
      .optional(),
    survivalHearts: z.number().int().min(1).max(5).optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid session settings");

  const session = await getLiveClassroomSessionById(parsed.data.sessionId);
  if (!session) throw new Error("Session not found");
  if (!["lobby", "scheduled"].includes(session.status)) {
    throw new Error("Session settings can only be changed before the battle starts.");
  }

  const { settings } = await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireHost: true,
  });

  const {
    sessionId: _id,
    name,
    sessionType,
    battleMode,
    ...configPatch
  } = parsed.data;

  const allowStrategyCards =
    (configPatch.allowStrategyCards ?? session.config.allowStrategyCards) &&
    settings.allowStrategyCards;
  const enabledStrategyCards = allowStrategyCards
    ? (configPatch.enabledStrategyCards ??
      session.config.enabledStrategyCards ??
      DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG.enabledStrategyCards)
    : [];

  const nextConfig: LiveClassroomSessionConfig = {
    ...DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG,
    ...session.config,
    ...configPatch,
    allowStrategyCards,
    enabledStrategyCards,
    allowMusic:
      (configPatch.allowMusic ?? session.config.allowMusic) &&
      settings.allowMusic,
    allowAiExplanations:
      configPatch.allowAiExplanations ?? session.config.allowAiExplanations,
  };

  await updateLiveClassroomSession(session.id, {
    ...(name ? { name } : {}),
    ...(sessionType ? { sessionType } : {}),
    ...(battleMode ? { battleMode } : {}),
    config: nextConfig,
  });

  revalidateLiveClassroom(session.teamId, session.id);
  return { ok: true as const };
}

/**
 * Begin the pre-battle countdown (does not activate questions yet).
 * All lobby clients see `session.battleStartsAt` and show the countdown UI.
 */
export async function scheduleLiveClassroomBattleCountdownAction(
  sessionId: number,
) {
  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  const { licensedSeats } = await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireHost: true,
    requireOrgManage: true,
  });

  if (session.status === "active") {
    return {
      ok: true as const,
      alreadyActive: true as const,
      battleStartsAt: null as string | null,
    };
  }
  if (!["lobby", "scheduled"].includes(session.status)) {
    throw new Error("Battle can only be started from the lobby.");
  }
  if (!session.teamsLocked) {
    throw new Error("Lock teams before starting the battle.");
  }

  const participants = await listLiveClassroomParticipants(sessionId);
  const assigned = participants.filter((p) => p.liveTeamId != null);
  if (assigned.length === 0) {
    throw new Error(
      "Assign at least one member to a team before starting the battle.",
    );
  }
  if (!canStartWithParticipantCount(assigned.length, licensedSeats)) {
    throw new Error(
      `Need 1–${licensedSeats} team members (licensed seats) before starting.`,
    );
  }
  // Locked teams are frozen: unassigned participants stay unassigned and are
  // not auto-placed when the battle starts.

  const delaySec =
    session.config.battleStartDelaySec ??
    DEFAULT_LIVE_CLASSROOM_SESSION_CONFIG.battleStartDelaySec;
  const battleStartsAt = new Date(Date.now() + delaySec * 1000).toISOString();

  await updateLiveClassroomSession(sessionId, {
    extensions: {
      ...(session.extensions ?? {}),
      battleStartsAt,
    },
  });

  revalidateLiveClassroom(session.teamId, sessionId);
  return {
    ok: true as const,
    alreadyActive: false as const,
    battleStartsAt,
    delaySec,
  };
}

/** Clear a stuck / cancelled pre-battle countdown without starting. */
export async function clearLiveClassroomBattleCountdownAction(
  sessionId: number,
) {
  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireHost: true,
    requireOrgManage: true,
  });

  if (session.status === "active" || session.status === "paused") {
    return { ok: true as const };
  }

  const { battleStartsAt: _drop, ...restExtensions } = session.extensions ?? {};
  void _drop;
  await updateLiveClassroomSession(sessionId, {
    extensions: restExtensions,
  });
  revalidateLiveClassroom(session.teamId, sessionId);
  return { ok: true as const };
}

export async function startLiveClassroomBattleAction(sessionId: number) {
  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) throw new Error("Session not found");

  // Idempotent: countdown completion may fire from multiple clients.
  if (session.status === "active") {
    return { ok: true as const, alreadyActive: true as const };
  }

  if (session.status === "completed" || session.status === "cancelled") {
    throw new Error(
      "This session has already ended. Restart it from Live Classroom to battle again.",
    );
  }

  if (!["lobby", "scheduled"].includes(session.status)) {
    throw new Error("Battle can only be started from the lobby.");
  }

  const startsAtRaw = session.extensions?.battleStartsAt;
  const startsAt =
    typeof startsAtRaw === "string" ? Date.parse(startsAtRaw) : NaN;
  const countdownReady =
    Number.isFinite(startsAt) && Date.now() >= startsAt - 1500;

  if (countdownReady) {
    await requireLiveClassroomAccess({ teamId: session.teamId });
  } else {
    await requireLiveClassroomAccess({
      teamId: session.teamId,
      requireHost: true,
      requireOrgManage: true,
    });
  }

  if (!session.teamsLocked) {
    throw new Error("Lock teams before starting the battle.");
  }

  const { battleStartsAt: _drop, participantBattle: _pb, ...restExtensions } =
    session.extensions ?? {};
  void _drop;
  void _pb;

  const startedAt = new Date();
  const [participants, questions] = await Promise.all([
    listLiveClassroomParticipants(sessionId),
    listLiveBattleQuestions(sessionId),
  ]);
  const firstQuestion = questions[0] ?? null;
  let extensions: Record<string, unknown> = restExtensions;
  if (firstQuestion) {
    for (const p of participants) {
      if (p.removed || p.liveTeamId == null) continue;
      extensions = withParticipantClock(
        extensions,
        p.userId,
        firstQuestion.id,
        startedAt,
      );
    }
  }

  await updateLiveClassroomSession(sessionId, {
    status: "active",
    startedAt,
    currentQuestionIndex: 0,
    questionStartedAt: startedAt,
    teamsLocked: true,
    extensions,
  });

  revalidateLiveClassroom(session.teamId, sessionId);
  return { ok: true as const, alreadyActive: false as const };
}

export async function controlLiveClassroomBattleAction(raw: {
  sessionId: number;
  action:
    | "pause"
    | "resume"
    | "add_time"
    | "skip"
    | "reveal"
    | "end"
    | "mute_music"
    | "unmute_music"
    | "next_question";
  extraSeconds?: number;
  /** "all" or a live classroom team id — used by add_time / reveal. */
  target?: "all" | number;
}) {
  const schema = z.object({
    sessionId: z.number().int().positive(),
    action: z.enum([
      "pause",
      "resume",
      "add_time",
      "skip",
      "reveal",
      "end",
      "mute_music",
      "unmute_music",
      "next_question",
    ]),
    extraSeconds: z.number().int().min(5).max(120).optional(),
    target: z
      .union([z.literal("all"), z.number().int().positive()])
      .optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid control action");

  const session = await getLiveClassroomSessionById(parsed.data.sessionId);
  if (!session) throw new Error("Session not found");
  const { access } = await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireHost: true,
  });

  const questions = await listLiveBattleQuestions(session.id);
  const boardQuestion = questions[session.currentQuestionIndex] ?? null;
  const target = parsed.data.target ?? "all";

  if (
    (parsed.data.action === "add_time" || parsed.data.action === "reveal") &&
    target !== "all"
  ) {
    const liveTeams = await listLiveClassroomTeams(session.id);
    if (!liveTeams.some((t) => t.id === target)) {
      throw new Error("That battle team is not in this session.");
    }
  }

  switch (parsed.data.action) {
    case "pause":
      await updateLiveClassroomSession(session.id, { status: "paused" });
      break;
    case "resume":
      await updateLiveClassroomSession(session.id, {
        status: "active",
        questionStartedAt: new Date(),
      });
      break;
    case "mute_music":
      await updateLiveClassroomSession(session.id, { musicMuted: true });
      break;
    case "unmute_music":
      await updateLiveClassroomSession(session.id, { musicMuted: false });
      break;
    case "add_time": {
      const extra = parsed.data.extraSeconds ?? 15;
      if (!boardQuestion) {
        throw new Error("No active question to extend.");
      }
      // Per-team / all-teams bonus — students see it on their play timers.
      await updateLiveClassroomSession(session.id, {
        extensions: withTimerBonus(
          session.extensions,
          boardQuestion.id,
          target,
          extra,
        ),
      });
      break;
    }
    case "reveal": {
      const q = boardQuestion;
      if (q) {
        await updateLiveClassroomSession(session.id, {
          extensions: withRevealTarget(session.extensions, q.id, target),
        });
        // Global reveal flag only when targeting every team; per-team reveal
        // is gated by questionRevealTargets in realtime state.
        if (target === "all") {
          await updateLiveBattleQuestion(q.id, { revealed: true });
        }
        if (session.config.allowAiExplanations && !q.aiExplanationShown) {
          try {
            const ai = await generateLiveClassroomAiExplanation({
              userId: access.userId,
              teamId: session.teamId,
              prompt: q.prompt,
              choices: q.choices,
              correctIndex: q.correctIndex,
            });
            await updateLiveBattleQuestion(q.id, {
              explanation: ai.correctExplanation,
              distractorExplanations: ai.distractorExplanations,
              aiExplanationShown: true,
            });
          } catch {
            await updateLiveBattleQuestion(q.id, { aiExplanationShown: true });
          }
        }
      }
      break;
    }
    case "skip":
    case "next_question": {
      // Shared classroom index (projector / host board). Does not force
      // independent players forward — they advance on their own play screens.
      const next = session.currentQuestionIndex + 1;
      if (next >= questions.length) {
        revalidateLiveClassroom(session.teamId, session.id);
        return {
          ok: true as const,
          ended: false,
          returnedToLobby: false as const,
          atEnd: true as const,
        };
      }
      await updateLiveClassroomSession(session.id, {
        currentQuestionIndex: next,
        questionStartedAt: new Date(),
        status: "active",
      });
      break;
    }
    case "end": {
      // Keep the session — return everyone to the lobby (do not complete/delete).
      await returnLiveClassroomSessionToLobby(session.id, {
        survivalHearts: session.config.survivalHearts,
      });
      revalidateLiveClassroom(session.teamId, session.id);
      return {
        ok: true as const,
        ended: false,
        returnedToLobby: true as const,
      };
    }
  }

  revalidateLiveClassroom(session.teamId, session.id);
  return { ok: true as const, ended: false, returnedToLobby: false as const };
}

export async function submitLiveClassroomAnswerAction(raw: {
  sessionId: number;
  questionId: number;
  choiceIndex: number;
}) {
  const schema = z.object({
    sessionId: z.number().int().positive(),
    questionId: z.number().int().positive(),
    choiceIndex: z.number().int().min(0).max(10),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid answer");

  const session = await getLiveClassroomSessionById(parsed.data.sessionId);
  if (!session) throw new Error("Session not found");
  if (session.status !== "active") throw new Error("Battle is not active.");

  const { access } = await requireLiveClassroomAccess({
    teamId: session.teamId,
  });

  const participant = await getLiveClassroomParticipant(
    session.id,
    access.userId,
  );
  if (!participant || participant.removed) {
    throw new Error("Join the session before answering.");
  }

  const existing = await getLiveBattleAnswer(
    parsed.data.questionId,
    access.userId,
  );
  if (existing) throw new Error("Already answered.");

  const questions = await listLiveBattleQuestions(session.id);
  const question = questions.find((q) => q.id === parsed.data.questionId);
  if (!question) throw new Error("Question not found.");

  const teams = await listLiveClassroomTeams(session.id);
  const team = teams.find((t) => t.id === participant.liveTeamId);
  if (team?.eliminated) throw new Error("Your team has been eliminated.");

  if (session.battleMode === "collaborative_team") {
    if (!team?.captainUserId || team.captainUserId !== access.userId) {
      throw new Error("Only the team captain can submit in Collaborative mode.");
    }
  }

  const strategyCards = await listLiveBattleStrategyCards(session.id);
  const activeForTeam = strategyCards.filter(
    (c) =>
      c.liveTeamId === participant.liveTeamId &&
      c.usedAt &&
      c.questionId === question.id,
  );
  const doublePoints = activeForTeam.some((c) => c.kind === "double_points");
  const shielded = activeForTeam.some((c) => c.kind === "shield");
  const scoreBoost = activeForTeam.some((c) => c.kind === "score_boost")
    ? 50
    : 0;

  const started = session.questionStartedAt?.getTime() ?? Date.now();
  const responseTimeMs = Math.max(0, Date.now() - started);
  const correct = parsed.data.choiceIndex === question.correctIndex;

  const scored = scoreLiveClassroomAnswer({
    battleMode: session.battleMode,
    correct,
    responseTimeMs,
    timeLimitSec: session.config.timePerQuestionSec,
    doublePoints,
    scoreBoostBonus: scoreBoost,
    shielded,
  });

  await insertLiveBattleAnswer({
    sessionId: session.id,
    questionId: question.id,
    userId: access.userId,
    liveTeamId: participant.liveTeamId,
    choiceIndex: parsed.data.choiceIndex,
    correct,
    pointsAwarded: scored.points,
    speedBonus: scored.speedBonus,
    responseTimeMs,
    submittedAsCaptain: session.battleMode === "collaborative_team",
  });

  await updateLiveClassroomParticipant(participant.id, {
    correctCount: participant.correctCount + (correct ? 1 : 0),
    incorrectCount: participant.incorrectCount + (correct ? 0 : 1),
    totalResponseTimeMs: participant.totalResponseTimeMs + responseTimeMs,
    answersSubmitted: participant.answersSubmitted + 1,
  });

  if (team && scored.points > 0) {
    await updateLiveClassroomTeam(team.id, {
      score: team.score + scored.points,
    });
  }

  if (session.battleMode === "survival" && team && scored.eliminated) {
    const hearts = Math.max(0, team.hearts - 1);
    await updateLiveClassroomTeam(team.id, {
      hearts,
      eliminated: hearts <= 0,
    });
  }

  let personalFinished = false;
  let sessionCompleted = false;
  if (isIndependentLiveClassroomBattleMode(session.battleMode)) {
    const answeredNow = participant.answersSubmitted + 1;
    if (questions.length > 0 && answeredNow >= questions.length) {
      personalFinished = true;
      await updateLiveClassroomSession(session.id, {
        extensions: withParticipantBattleStatus(
          session.extensions,
          access.userId,
          "finished",
        ),
      });
      sessionCompleted =
        await maybeCompleteIndependentBattleIfEveryoneDone(session.id);
    }
  } else if (session.battleMode === "collaborative_team") {
    sessionCompleted = await maybeAdvanceCollaborativeBattleAfterAnswer({
      sessionId: session.id,
      questionId: question.id,
      currentQuestionIndex: session.currentQuestionIndex,
      questionCount: questions.length,
      teams,
    });
  }

  // Collaborative / individual: award once; for individual every student contributes.
  revalidateLiveClassroom(session.teamId, session.id);
  return {
    correct,
    points: scored.points,
    speedBonus: scored.speedBonus,
    personalFinished,
    sessionCompleted,
  };
}

/** Opt out of an independent battle without answering remaining questions. */
export async function optOutLiveClassroomBattleAction(sessionId: number) {
  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.status !== "active") {
    throw new Error("Battle is not active.");
  }
  if (!isIndependentLiveClassroomBattleMode(session.battleMode)) {
    throw new Error("Opt out is only available in Individual / Survival modes.");
  }

  const { access } = await requireLiveClassroomAccess({
    teamId: session.teamId,
  });
  const participant = await getLiveClassroomParticipant(
    session.id,
    access.userId,
  );
  if (!participant || participant.removed) {
    throw new Error("Join the session before opting out.");
  }

  await updateLiveClassroomSession(session.id, {
    extensions: withParticipantBattleStatus(
      session.extensions,
      access.userId,
      "opted_out",
    ),
  });

  const sessionCompleted =
    await maybeCompleteIndependentBattleIfEveryoneDone(session.id);

  revalidateLiveClassroom(session.teamId, session.id);
  return { ok: true as const, sessionCompleted };
}

const LIVE_BATTLE_SKIP_CHOICE_INDEX = -1;

/**
 * Player navigation: Individual/Survival — every member; Collaborative — captain only.
 * Skip/Next without an answer records a zero-point skip so progress can continue.
 */
export async function advanceLiveClassroomPlayerQuestionAction(raw: {
  sessionId: number;
  questionId: number;
  action: "skip" | "next";
}) {
  const schema = z.object({
    sessionId: z.number().int().positive(),
    questionId: z.number().int().positive(),
    action: z.enum(["skip", "next"]),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid navigation action");

  const session = await getLiveClassroomSessionById(parsed.data.sessionId);
  if (!session) throw new Error("Session not found");
  if (session.status !== "active") throw new Error("Battle is not active.");

  const { access } = await requireLiveClassroomAccess({
    teamId: session.teamId,
  });

  const participant = await getLiveClassroomParticipant(
    session.id,
    access.userId,
  );
  if (!participant || participant.removed) {
    throw new Error("Join the session before navigating.");
  }
  if (participant.liveTeamId == null) {
    throw new Error("You must be on a team to navigate questions.");
  }

  const teams = await listLiveClassroomTeams(session.id);
  const team = teams.find((t) => t.id === participant.liveTeamId);
  if (team?.eliminated) throw new Error("Your team has been eliminated.");

  const independent = isIndependentLiveClassroomBattleMode(session.battleMode);
  const collaborative = session.battleMode === "collaborative_team";

  if (collaborative) {
    if (!team?.captainUserId || team.captainUserId !== access.userId) {
      throw new Error("Only the team captain can skip or next in Collaborative mode.");
    }
  } else if (!independent) {
    throw new Error("Question navigation is not available in this mode.");
  }

  const questions = await listLiveBattleQuestions(session.id);
  const question = questions.find((q) => q.id === parsed.data.questionId);
  if (!question) throw new Error("Question not found.");

  if (collaborative && question.id !== questions[session.currentQuestionIndex]?.id) {
    throw new Error("That question is not the current battle question.");
  }

  const existing = await getLiveBattleAnswer(
    parsed.data.questionId,
    access.userId,
  );

  let personalFinished = false;
  let sessionCompleted = false;
  let skipped = false;

  if (!existing) {
    skipped = true;
    await insertLiveBattleAnswer({
      sessionId: session.id,
      questionId: question.id,
      userId: access.userId,
      liveTeamId: participant.liveTeamId,
      choiceIndex: LIVE_BATTLE_SKIP_CHOICE_INDEX,
      correct: false,
      pointsAwarded: 0,
      speedBonus: 0,
      responseTimeMs: 0,
      submittedAsCaptain: collaborative,
    });
    await updateLiveClassroomParticipant(participant.id, {
      incorrectCount: participant.incorrectCount + 1,
      answersSubmitted: participant.answersSubmitted + 1,
    });

    if (independent) {
      const answeredNow = participant.answersSubmitted + 1;
      if (questions.length > 0 && answeredNow >= questions.length) {
        personalFinished = true;
        await updateLiveClassroomSession(session.id, {
          extensions: withParticipantBattleStatus(
            session.extensions,
            access.userId,
            "finished",
          ),
        });
        sessionCompleted =
          await maybeCompleteIndependentBattleIfEveryoneDone(session.id);
      } else {
        const answeredIds = new Set(
          (
            await listLiveBattleAnswersForSession(session.id)
          )
            .filter((a) => a.userId === access.userId)
            .map((a) => a.questionId),
        );
        answeredIds.add(question.id);
        const nextIdx = personalQuestionIndex({
          questionIdsInOrder: questions.map((q) => q.id),
          answeredQuestionIds: answeredIds,
        });
        const nextQ = nextIdx >= 0 ? questions[nextIdx] : null;
        if (nextQ) {
          const latest = await getLiveClassroomSessionById(session.id);
          await updateLiveClassroomSession(session.id, {
            extensions: withParticipantClock(
              latest?.extensions ?? session.extensions,
              access.userId,
              nextQ.id,
            ),
          });
        }
      }
    } else if (collaborative) {
      sessionCompleted = await maybeAdvanceCollaborativeBattleAfterAnswer({
        sessionId: session.id,
        questionId: question.id,
        currentQuestionIndex: session.currentQuestionIndex,
        questionCount: questions.length,
        teams,
      });
    }
  } else if (collaborative) {
    // Already answered — Next tries to advance when every captain is done.
    sessionCompleted = await maybeAdvanceCollaborativeBattleAfterAnswer({
      sessionId: session.id,
      questionId: question.id,
      currentQuestionIndex: session.currentQuestionIndex,
      questionCount: questions.length,
      teams,
    });
  } else if (independent) {
    const answeredNow = participant.answersSubmitted;
    if (questions.length > 0 && answeredNow >= questions.length) {
      personalFinished = true;
      sessionCompleted =
        await maybeCompleteIndependentBattleIfEveryoneDone(session.id);
    }
  }

  revalidateLiveClassroom(session.teamId, session.id);
  return {
    ok: true as const,
    action: parsed.data.action,
    skipped,
    personalFinished,
    sessionCompleted,
  };
}

/**
 * Time ran out on a question — lock it (skip) and advance, or end when last.
 * Idempotent if the player already moved on.
 */
export async function expireLiveClassroomQuestionTimeoutAction(raw: {
  sessionId: number;
  questionId: number;
}) {
  const schema = z.object({
    sessionId: z.number().int().positive(),
    questionId: z.number().int().positive(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid timeout payload");

  const session = await getLiveClassroomSessionById(parsed.data.sessionId);
  if (!session) throw new Error("Session not found");
  if (session.status !== "active") {
    return { ok: true as const, ignored: true as const, sessionCompleted: false };
  }

  const { access } = await requireLiveClassroomAccess({
    teamId: session.teamId,
  });
  const participant = await getLiveClassroomParticipant(
    session.id,
    access.userId,
  );
  if (!participant || participant.removed || participant.liveTeamId == null) {
    return { ok: true as const, ignored: true as const, sessionCompleted: false };
  }

  const questions = await listLiveBattleQuestions(session.id);
  const question = questions.find((q) => q.id === parsed.data.questionId);
  if (!question) {
    return { ok: true as const, ignored: true as const, sessionCompleted: false };
  }

  const clockMap = readParticipantClockMap(session.extensions);
  const independent = isIndependentLiveClassroomBattleMode(session.battleMode);
  const startedAtIso = independent
    ? clockMap[access.userId]?.questionId === question.id
      ? clockMap[access.userId]!.startedAt
      : session.questionStartedAt?.toISOString() ?? null
    : session.questionStartedAt?.toISOString() ?? null;

  const remaining = remainingQuestionSeconds({
    timePerQuestionSec: session.config.timePerQuestionSec,
    bonusSec: timerBonusSecondsForTeam(
      session.extensions,
      question.id,
      participant.liveTeamId,
    ),
    startedAtIso,
    paused: false,
  });
  if (remaining > 1) {
    return {
      ok: true as const,
      ignored: true as const,
      sessionCompleted: false,
      remaining,
    };
  }

  const result = await advanceLiveClassroomPlayerQuestionAction({
    sessionId: parsed.data.sessionId,
    questionId: parsed.data.questionId,
    action: "skip",
  });

  return {
    ok: true as const,
    ignored: false as const,
    skipped: result.skipped,
    personalFinished: result.personalFinished,
    sessionCompleted: result.sessionCompleted,
  };
}

export async function useLiveClassroomStrategyCardAction(raw: {
  sessionId: number;
  strategyCardId: number;
  questionId: number;
}) {
  const schema = z.object({
    sessionId: z.number().int().positive(),
    strategyCardId: z.number().int().positive(),
    questionId: z.number().int().positive(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid strategy card use");

  const session = await getLiveClassroomSessionById(parsed.data.sessionId);
  if (!session) throw new Error("Session not found");
  if (!session.config.allowStrategyCards) {
    throw new Error("Strategy cards are disabled.");
  }
  const { access } = await requireLiveClassroomAccess({
    teamId: session.teamId,
  });

  const cards = await listLiveBattleStrategyCards(session.id);
  const card = cards.find((c) => c.id === parsed.data.strategyCardId);
  if (!card || card.usedAt) throw new Error("Card unavailable.");

  const participant = await getLiveClassroomParticipant(
    session.id,
    access.userId,
  );
  if (!participant || participant.liveTeamId !== card.liveTeamId) {
    throw new Error("This card belongs to another team.");
  }

  await markStrategyCardUsed(card.id, {
    usedByUserId: access.userId,
    questionId: parsed.data.questionId,
  });

  let hint: string | null = null;

  if (card.kind === "ai_hint") {
    const questions = await listLiveBattleQuestions(session.id);
    const question = questions.find((q) => q.id === parsed.data.questionId);
    if (!question) throw new Error("Question not found.");
    try {
      hint = await generateLiveClassroomAiHint({
        userId: access.userId,
        teamId: session.teamId,
        prompt: question.prompt,
        choices: question.choices,
        correctIndex: question.correctIndex,
      });
    } catch {
      hint =
        "Think about the main idea in the question and eliminate choices that don’t fit the time, place, or concept being asked.";
    }
  }

  if (card.kind === "extra_time") {
    const started = session.questionStartedAt ?? new Date();
    await updateLiveClassroomSession(session.id, {
      questionStartedAt: new Date(started.getTime() - 15_000),
    });
  }
  if (card.kind === "recovery") {
    const team = (await listLiveClassroomTeams(session.id)).find(
      (t) => t.id === card.liveTeamId,
    );
    if (team && team.hearts < session.config.survivalHearts) {
      await updateLiveClassroomTeam(team.id, {
        hearts: team.hearts + 1,
        eliminated: false,
      });
    }
  }

  revalidateLiveClassroom(session.teamId, session.id);
  return { ok: true as const, kind: card.kind, hint };
}

export async function endLiveClassroomSessionAction(
  sessionId: number,
  options?: { systemComplete?: boolean },
) {
  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) throw new Error("Session not found");

  let summaryUserId = session.hostUserId;
  if (!options?.systemComplete) {
    const { access } = await requireLiveClassroomAccess({
      teamId: session.teamId,
      requireHost: true,
    });
    summaryUserId = access.userId;
  } else {
    // Auto-complete when every independent battler finished/opted out.
    await requireLiveClassroomAccess({ teamId: session.teamId });
  }

  if (session.status === "completed") {
    const existing = await getLiveBattleReportBySession(sessionId);
    return { reportId: existing?.id ?? null };
  }

  const [participants, teams, questions, answers, strategyCards] =
    await Promise.all([
      listLiveClassroomParticipants(sessionId),
      listLiveClassroomTeams(sessionId),
      listLiveBattleQuestions(sessionId),
      listLiveBattleAnswersForSession(sessionId),
      listLiveBattleStrategyCards(sessionId),
    ]);

  const totalAnswers = answers.length;
  const correctAnswers = answers.filter((a) => a.correct).length;
  const accuracyPercent =
    totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
  const avgResponseMs =
    totalAnswers > 0
      ? Math.round(
          answers.reduce((n, a) => n + a.responseTimeMs, 0) / totalAnswers,
        )
      : 0;

  const topicStats = new Map<string, { correct: number; total: number }>();
  for (const q of questions) {
    const qAnswers = answers.filter((a) => a.questionId === q.id);
    const key = q.topic || "General";
    const cur = topicStats.get(key) ?? { correct: 0, total: 0 };
    cur.total += qAnswers.length;
    cur.correct += qAnswers.filter((a) => a.correct).length;
    topicStats.set(key, cur);
  }
  let strongestTopic: string | null = null;
  let weakestTopic: string | null = null;
  let best = -1;
  let worst = 101;
  for (const [topic, s] of topicStats) {
    if (s.total === 0) continue;
    const pct = (s.correct / s.total) * 100;
    if (pct > best) {
      best = pct;
      strongestTopic = topic;
    }
    if (pct < worst) {
      worst = pct;
      weakestTopic = topic;
    }
  }

  let mostMissedQuestion: string | null = null;
  let missRate = -1;
  for (const q of questions) {
    const qAnswers = answers.filter((a) => a.questionId === q.id);
    if (!qAnswers.length) continue;
    const rate =
      qAnswers.filter((a) => !a.correct).length / qAnswers.length;
    if (rate > missRate) {
      missRate = rate;
      mostMissedQuestion = q.prompt;
    }
  }

  const ai = await generateLiveClassroomTeacherSummary({
    userId: summaryUserId,
    teamId: session.teamId,
    sessionName: session.name,
    accuracyPercent,
    attendance: participants.length,
    strongestTopic,
    weakestTopic,
    mostMissedQuestion,
  }).catch(() => ({
    summary: `Class accuracy was ${accuracyPercent}% with ${participants.length} participants.`,
    recommendations: [
      "Review the most missed question together.",
      "Assign a short remediation deck before the next lesson.",
    ],
    strongestTopic,
    weakestTopic,
    suggestedReviewMinutes: 8,
  }));

  const stats: LiveClassroomReportStats = {
    attendance: participants.length,
    accuracyPercent,
    averageResponseTimeSec: Math.round((avgResponseMs / 1000) * 10) / 10,
    strongestTopic: ai.strongestTopic ?? strongestTopic,
    weakestTopic: ai.weakestTopic ?? weakestTopic,
    mostMissedQuestion,
    recommendations: ai.recommendations,
    teamStats: teams.map((t) => {
      const members = participants.filter((p) => p.liveTeamId === t.id);
      const denom = members.reduce(
        (n, p) => n + p.correctCount + p.incorrectCount,
        0,
      );
      const num = members.reduce((n, p) => n + p.correctCount, 0);
      const resp = members.reduce((n, p) => n + p.totalResponseTimeMs, 0);
      const submitted = members.reduce((n, p) => n + p.answersSubmitted, 0);
      return {
        teamName: t.name,
        score: t.score,
        accuracyPercent: denom > 0 ? Math.round((num / denom) * 100) : 0,
        avgResponseTimeSec:
          submitted > 0
            ? Math.round((resp / submitted / 1000) * 10) / 10
            : 0,
      };
    }),
    individualStats: participants.map((p) => {
      const denom = p.correctCount + p.incorrectCount;
      return {
        userId: p.userId,
        displayName: p.displayName,
        correct: p.correctCount,
        incorrect: p.incorrectCount,
        accuracyPercent: denom > 0 ? Math.round((p.correctCount / denom) * 100) : 0,
        avgResponseTimeSec:
          p.answersSubmitted > 0
            ? Math.round((p.totalResponseTimeMs / p.answersSubmitted / 1000) * 10) /
              10
            : 0,
      };
    }),
    questionAnalysis: questions.map((q) => {
      const qAnswers = answers.filter((a) => a.questionId === q.id);
      const correctCount = qAnswers.filter((a) => a.correct).length;
      return {
        questionId: String(q.id),
        prompt: q.prompt,
        correctCount,
        incorrectCount: qAnswers.length - correctCount,
        accuracyPercent:
          qAnswers.length > 0
            ? Math.round((correctCount / qAnswers.length) * 100)
            : 0,
      };
    }),
    aiTeacherSummary: ai.summary,
    suggestedReviewMinutes: ai.suggestedReviewMinutes,
  };

  const winner = [...teams].sort((a, b) => b.score - a.score)[0] ?? null;

  await updateLiveClassroomSession(sessionId, {
    status: "completed",
    endedAt: new Date(),
  });

  const report = await upsertLiveBattleReport({
    sessionId,
    teamId: session.teamId,
    hostUserId: session.hostUserId,
    sessionName: session.name,
    stats,
    winnerTeamName: winner?.name ?? null,
  });

  const usedCards = strategyCards.filter((c) => c.usedAt).length;
  await bumpLiveTeacherAnalytics({
    teamId: session.teamId,
    teacherUserId: session.hostUserId,
    sessionsHostedDelta: 1,
    totalAttendanceDelta: participants.length,
    averageAccuracyPercent: accuracyPercent,
    battleWinsDelta: 1,
    strategyCardsUsedDelta: usedCards,
    lastSessionAt: new Date(),
  });
  await bumpLiveOrganizationAnalytics({
    teamId: session.teamId,
    totalSessionsDelta: 1,
    totalAttendanceDelta: participants.length,
    averageAccuracyPercent: accuracyPercent,
    averageResponseTimeSec: Math.round(avgResponseMs / 1000),
    averageAttendance: participants.length,
    mostActiveTeacherUserId: session.hostUserId,
    strategyCardsUsedDelta: usedCards,
  });

  revalidateLiveClassroom(session.teamId, sessionId);
  return { reportId: report.id, winnerTeamName: winner?.name ?? null, stats };
}

export async function updateLiveClassroomSettingsAction(raw: {
  teamId: number;
  enabled?: boolean;
  defaultBattleType?: (typeof LIVE_CLASSROOM_SESSION_TYPES)[number];
  allowMusic?: boolean;
  allowStrategyCards?: boolean;
  allowAiExplanations?: boolean;
  defaultTeamAssignment?: (typeof LIVE_CLASSROOM_TEAM_ASSIGNMENT_MODES)[number];
  maxConcurrentSessions?: number;
  strategyCardPolicy?: (typeof LIVE_CLASSROOM_STRATEGY_CARD_POLICIES)[number];
  strategyCardLimitPerTeam?: number;
}) {
  const schema = z.object({
    teamId: teamIdSchema,
    enabled: z.boolean().optional(),
    defaultBattleType: z.enum(LIVE_CLASSROOM_SESSION_TYPES).optional(),
    allowMusic: z.boolean().optional(),
    allowStrategyCards: z.boolean().optional(),
    allowAiExplanations: z.boolean().optional(),
    defaultTeamAssignment: z
      .enum(LIVE_CLASSROOM_TEAM_ASSIGNMENT_MODES)
      .optional(),
    maxConcurrentSessions: z.number().int().min(1).max(20).optional(),
    strategyCardPolicy: z.enum(LIVE_CLASSROOM_STRATEGY_CARD_POLICIES).optional(),
    strategyCardLimitPerTeam: z.number().int().min(0).max(20).optional(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid settings");

  const { role } = await requireLiveClassroomAccess({
    teamId: parsed.data.teamId,
    requireOrgManage: true,
  });
  void role;

  const ownership = await teamOwnsLiveClassroom(parsed.data.teamId);
  const planSlug = ownership.team?.planSlug ?? "";
  if (
    parsed.data.maxConcurrentSessions != null &&
    parsed.data.maxConcurrentSessions > 1 &&
    !liveClassroomAllowsConcurrentOverride(planSlug)
  ) {
    throw new Error(
      "Only Enterprise organizations can raise concurrent session limits.",
    );
  }

  await getOrCreateLiveClassroomTeamSettings(parsed.data.teamId);
  const { teamId: _t, ...patch } = parsed.data;
  await updateLiveClassroomTeamSettings(parsed.data.teamId, patch);
  revalidateLiveClassroom(parsed.data.teamId);
  return { ok: true as const };
}

export async function setLiveClassroomParticipantGrantAction(raw: {
  teamId: number;
  memberUserId: string;
  enabled: boolean;
}) {
  const schema = z.object({
    teamId: teamIdSchema,
    memberUserId: z.string().min(1),
    enabled: z.boolean(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid Live Classroom assignment");

  const { access } = await requireLiveClassroomAccess({
    teamId: parsed.data.teamId,
    requireOrgManage: true,
  });

  const team = await getTeamById(parsed.data.teamId);
  if (!team) throw new Error("Workspace not found.");

  const members = await listTeamMembers(parsed.data.teamId);
  const isOwner = parsed.data.memberUserId === team.ownerUserId;
  const isMember = members.some((m) => m.userId === parsed.data.memberUserId);
  if (!isOwner && !isMember) {
    throw new Error("That person is not a member of this workspace.");
  }

  if (parsed.data.enabled) {
    await grantLiveClassroomParticipant(
      parsed.data.teamId,
      parsed.data.memberUserId,
      access.userId,
    );
  } else {
    await revokeLiveClassroomTeacher(
      parsed.data.teamId,
      parsed.data.memberUserId,
    );
    await revokeLiveClassroomParticipant(
      parsed.data.teamId,
      parsed.data.memberUserId,
    );
  }
  revalidateLiveClassroom(parsed.data.teamId);
  return { ok: true as const };
}

export async function setLiveClassroomTeacherGrantAction(raw: {
  teamId: number;
  memberUserId: string;
  enabled: boolean;
}) {
  const schema = z.object({
    teamId: teamIdSchema,
    memberUserId: z.string().min(1),
    enabled: z.boolean(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid teacher grant");

  const { access } = await requireLiveClassroomAccess({
    teamId: parsed.data.teamId,
    requireOrgManage: true,
  });

  if (parsed.data.enabled) {
    // Host permission requires roster assignment.
    await grantLiveClassroomParticipant(
      parsed.data.teamId,
      parsed.data.memberUserId,
      access.userId,
    );
    await grantLiveClassroomTeacher(
      parsed.data.teamId,
      parsed.data.memberUserId,
      access.userId,
    );
  } else {
    await revokeLiveClassroomTeacher(
      parsed.data.teamId,
      parsed.data.memberUserId,
    );
  }
  revalidateLiveClassroom(parsed.data.teamId);
  return { ok: true as const };
}

export async function generateWarmUpPreviewAction(raw: {
  teamId: number;
  subject: string;
  topic: string;
  grade: string;
  difficulty: (typeof LIVE_CLASSROOM_DIFFICULTIES)[number];
  questionCount: number;
}) {
  const schema = z.object({
    teamId: teamIdSchema,
    subject: z.string().min(1).max(255),
    topic: z.string().min(1).max(255),
    grade: z.string().min(1).max(64),
    difficulty: z.enum(LIVE_CLASSROOM_DIFFICULTIES),
    questionCount: z.number().int().min(1).max(20),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid warm-up input");

  const { access } = await requireLiveClassroomAccess({
    teamId: parsed.data.teamId,
    requireHost: true,
  });

  return generateLiveClassroomWarmUpQuestions({
    userId: access.userId,
    teamId: parsed.data.teamId,
    subject: parsed.data.subject,
    topic: parsed.data.topic,
    grade: parsed.data.grade,
    difficulty: parsed.data.difficulty,
    questionCount: parsed.data.questionCount,
  });
}

export async function resolveLiveClassroomViewerRoleAction(teamId: number) {
  const { access, role, licensedSeats } = await requireLiveClassroomAccess({
    teamId,
    mode: "action",
  });
  return {
    userId: access.userId,
    role,
    canHost: liveClassroomRoleCanHost(role),
    canManage: liveClassroomRoleCanManageOrg(role),
    licensedSeats,
  };
}

export async function setLiveClassroomSessionMemberLcAccessAction(raw: {
  sessionId: number;
  memberUserId: string;
  enabled: boolean;
}) {
  const schema = z.object({
    sessionId: z.number().int().positive(),
    memberUserId: z.string().min(1),
    enabled: z.boolean(),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid Live Classroom access update");

  const session = await getLiveClassroomSessionById(parsed.data.sessionId);
  if (!session) throw new Error("Session not found.");

  const { access } = await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireHost: true,
  });

  const team = await getTeamById(session.teamId);
  if (!team) throw new Error("Workspace not found.");

  const members = await listTeamMembers(session.teamId);
  const isOwner = parsed.data.memberUserId === team.ownerUserId;
  const isMember = members.some((m) => m.userId === parsed.data.memberUserId);
  if (!isOwner && !isMember) {
    throw new Error("That person is not a member of this workspace.");
  }

  if (parsed.data.enabled) {
    await grantLiveClassroomParticipant(
      session.teamId,
      parsed.data.memberUserId,
      access.userId,
    );
  } else {
    await revokeLiveClassroomParticipant(
      session.teamId,
      parsed.data.memberUserId,
    );
  }

  revalidateLiveClassroom(session.teamId, session.id);
  revalidatePath(`/decks`);
  return { ok: true as const };
}

export async function sendLiveClassroomLobbyCodeInboxAction(raw: {
  sessionId: number;
  memberUserId: string;
}) {
  const schema = z.object({
    sessionId: z.number().int().positive(),
    memberUserId: z.string().min(1),
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid lobby code invite");

  const session = await getLiveClassroomSessionById(parsed.data.sessionId);
  if (!session) throw new Error("Session not found.");
  if (session.status !== "lobby" && session.status !== "active") {
    throw new Error("Lobby codes can only be sent while the session is open.");
  }

  const { access } = await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireHost: true,
  });

  const team = await getTeamById(session.teamId);
  if (!team) throw new Error("Workspace not found.");

  const isOwner = parsed.data.memberUserId === team.ownerUserId;
  if (!isOwner) {
    const members = await listTeamMembers(session.teamId);
    const isMember = members.some((m) => m.userId === parsed.data.memberUserId);
    if (!isMember) {
      throw new Error("That person is not a member of this workspace.");
    }
    await grantLiveClassroomParticipant(
      session.teamId,
      parsed.data.memberUserId,
      access.userId,
    );
  }

  const displays = await getClerkUserFieldDisplaysByIds([
    parsed.data.memberUserId,
    access.userId,
  ]);
  let deckName: string | null = null;
  if (session.deckId != null) {
    const deck = await getDeckRowById(session.deckId);
    deckName = deck?.name ?? null;
  }

  const copy = buildLiveClassroomLobbyInviteCopy({
    recipientDisplayName:
      displays[parsed.data.memberUserId]?.primaryLine ?? null,
    hostDisplayName: displays[access.userId]?.primaryLine ?? null,
    sessionName: session.name,
    sessionType: session.sessionType,
    battleMode: session.battleMode,
    joinCode: session.joinCode,
    deckName,
    deckId: session.deckId,
    teamId: session.teamId,
  });

  await upsertLiveClassroomLobbyInboxMessage({
    recipientUserId: parsed.data.memberUserId,
    teamId: session.teamId,
    sessionId: session.id,
    title: copy.title,
    description: copy.description,
    joinCode: session.joinCode,
  });

  notifyNativeInboxPush({
    recipientUserId: parsed.data.memberUserId,
    category: "live_classroom_lobby",
    body: copy.title,
  });

  revalidateLiveClassroom(session.teamId, session.id);
  revalidatePath("/dashboard/inbox");
  if (session.deckId != null) {
    revalidatePath(`/decks/${session.deckId}/study`);
  }
  return { ok: true as const };
}

export { resolveLiveClassroomOrgRole, listLiveBattleAnswersForQuestion };
