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
  getOrCreateLiveClassroomTeamSettings,
  insertLiveBattleAnswer,
  insertLiveBattleQuestions,
  insertLiveBattleStrategyCards,
  listLiveBattleAnswersForQuestion,
  listLiveBattleAnswersForSession,
  listLiveBattleQuestions,
  listLiveBattleStrategyCards,
  listLiveClassroomParticipants,
  listLiveClassroomTeams,
  markStrategyCardUsed,
  updateLiveBattleQuestion,
  updateLiveClassroomParticipant,
  updateLiveClassroomSession,
  updateLiveClassroomTeam,
  updateLiveClassroomTeamSettings,
  upsertLiveBattleReport,
  upsertLiveClassroomParticipant,
  grantLiveClassroomTeacher,
  revokeLiveClassroomTeacher,
} from "@/db/queries/live-classroom";
import { getDeckById } from "@/db/queries/decks";
import {
  liveClassroomRoleCanHost,
  liveClassroomRoleCanManageOrg,
  requireLiveClassroomAccess,
  resolveLiveClassroomOrgRole,
  teamOwnsLiveClassroom,
} from "@/lib/live-classroom-access";
import {
  generateLiveClassroomAiExplanation,
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
import { getClerkUserFieldDisplaysByIds } from "@/lib/clerk-user-display";

const teamIdSchema = z.number().int().positive();

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
  warmUp: z
    .object({
      subject: z.string().min(1).max(255),
      topic: z.string().min(1).max(255),
      grade: z.string().min(1).max(64),
    })
    .optional(),
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

  if (data.warmUp) {
    questionRows = await generateLiveClassroomWarmUpQuestions({
      userId: access.userId,
      teamId: data.teamId,
      subject: data.warmUp.subject,
      topic: data.warmUp.topic,
      grade: data.warmUp.grade,
      difficulty: data.difficulty,
      questionCount: data.questionCount,
    });
  } else if (data.deckId) {
    const deck = await getDeckById(data.deckId, access.userId);
    if (!deck) throw new Error("Deck not found or not accessible.");
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
  } else {
    throw new Error("Select a deck or generate a warm-up.");
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

export async function heartbeatLiveClassroomAction(sessionId: number) {
  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  const { access } = await requireLiveClassroomAccess({ teamId: session.teamId });
  await upsertLiveClassroomParticipant({
    sessionId,
    userId: access.userId,
    connected: true,
  });
  return { ok: true as const };
}

export async function getLiveClassroomRealtimeStateAction(sessionId: number) {
  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  await requireLiveClassroomAccess({ teamId: session.teamId });

  const [teams, participants, questions, answers, strategyCards] =
    await Promise.all([
      listLiveClassroomTeams(sessionId),
      listLiveClassroomParticipants(sessionId),
      listLiveBattleQuestions(sessionId),
      listLiveBattleAnswersForSession(sessionId),
      listLiveBattleStrategyCards(sessionId),
    ]);

  const currentQuestion = questions[session.currentQuestionIndex] ?? null;
  const answeredForCurrent = currentQuestion
    ? answers.filter((a) => a.questionId === currentQuestion.id)
    : [];

  const accuracyDenom = participants.reduce(
    (n, p) => n + p.correctCount + p.incorrectCount,
    0,
  );
  const accuracyNum = participants.reduce((n, p) => n + p.correctCount, 0);
  const avgAccuracy =
    accuracyDenom > 0 ? Math.round((accuracyNum / accuracyDenom) * 100) : 0;
  const avgResponseMs =
    participants.length > 0
      ? Math.round(
          participants.reduce((n, p) => n + p.totalResponseTimeMs, 0) /
            Math.max(
              1,
              participants.reduce((n, p) => n + p.answersSubmitted, 0),
            ),
        )
      : 0;

  return {
    session: {
      id: session.id,
      name: session.name,
      status: session.status,
      sessionType: session.sessionType,
      battleMode: session.battleMode,
      currentQuestionIndex: session.currentQuestionIndex,
      questionStartedAt: session.questionStartedAt?.toISOString() ?? null,
      musicMuted: session.musicMuted,
      teamsLocked: session.teamsLocked,
      joinCode: session.joinCode,
      config: session.config,
      hostUserId: session.hostUserId,
      teamId: session.teamId,
    },
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      colorKey: t.colorKey,
      score: t.score,
      hearts: t.hearts,
      eliminated: t.eliminated,
      captainUserId: t.captainUserId,
      memberCount: participants.filter((p) => p.liveTeamId === t.id).length,
    })),
    participants: participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      displayName: p.displayName,
      liveTeamId: p.liveTeamId,
      connected: p.connected,
      correctCount: p.correctCount,
      incorrectCount: p.incorrectCount,
    })),
    currentQuestion: currentQuestion
      ? {
          id: currentQuestion.id,
          prompt: currentQuestion.prompt,
          choices: currentQuestion.choices,
          sortOrder: currentQuestion.sortOrder,
          revealed: currentQuestion.revealed,
          explanation: currentQuestion.revealed
            ? currentQuestion.explanation
            : null,
          correctIndex: currentQuestion.revealed
            ? currentQuestion.correctIndex
            : null,
          aiExplanationShown: currentQuestion.aiExplanationShown,
          totalQuestions: questions.length,
        }
      : null,
    answeredCount: answeredForCurrent.length,
    connectedCount: participants.filter((p) => p.connected).length,
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
  if (session.teamsLocked) throw new Error("Teams are locked.");
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
  liveTeamId: number;
  name?: string;
  lockTeams?: boolean;
  removeUserId?: string;
  moveUserId?: string;
  toLiveTeamId?: number;
}) {
  const schema = z.object({
    sessionId: z.number().int().positive(),
    liveTeamId: z.number().int().positive().optional(),
    name: z.string().trim().min(1).max(128).optional(),
    lockTeams: z.boolean().optional(),
    removeUserId: z.string().optional(),
    moveUserId: z.string().optional(),
    toLiveTeamId: z.number().int().positive().optional(),
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
    await updateLiveClassroomSession(session.id, {
      teamsLocked: parsed.data.lockTeams,
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
  if (parsed.data.moveUserId && parsed.data.toLiveTeamId) {
    const p = await getLiveClassroomParticipant(
      session.id,
      parsed.data.moveUserId,
    );
    if (p) {
      await updateLiveClassroomParticipant(p.id, {
        liveTeamId: parsed.data.toLiveTeamId,
      });
    }
  }

  revalidateLiveClassroom(session.teamId, session.id);
  return { ok: true as const };
}

export async function startLiveClassroomBattleAction(sessionId: number) {
  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  const { licensedSeats } = await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireHost: true,
  });

  const participants = await listLiveClassroomParticipants(sessionId);
  if (!canStartWithParticipantCount(participants.length, licensedSeats)) {
    throw new Error(
      `Need 1–${licensedSeats} participants (licensed seats) before starting.`,
    );
  }
  const unassigned = participants.filter((p) => p.liveTeamId == null);
  if (unassigned.length > 0) {
    await assignLiveClassroomTeamsAction({ sessionId, mode: "random" });
  }

  await updateLiveClassroomSession(sessionId, {
    status: "active",
    startedAt: new Date(),
    currentQuestionIndex: 0,
    questionStartedAt: new Date(),
    teamsLocked: true,
  });

  revalidateLiveClassroom(session.teamId, sessionId);
  return { ok: true as const };
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
      // Extends effective timer by shifting questionStartedAt backward.
      const extra = (parsed.data.extraSeconds ?? 15) * 1000;
      const started = session.questionStartedAt ?? new Date();
      await updateLiveClassroomSession(session.id, {
        questionStartedAt: new Date(started.getTime() - extra),
      });
      break;
    }
    case "reveal": {
      const q = questions[session.currentQuestionIndex];
      if (q) {
        await updateLiveBattleQuestion(q.id, { revealed: true });
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
      const next = session.currentQuestionIndex + 1;
      if (next >= questions.length) {
        await endLiveClassroomSessionAction(session.id);
        return { ok: true as const, ended: true };
      }
      await updateLiveClassroomSession(session.id, {
        currentQuestionIndex: next,
        questionStartedAt: new Date(),
        status: "active",
      });
      break;
    }
    case "end":
      await endLiveClassroomSessionAction(session.id);
      return { ok: true as const, ended: true };
  }

  revalidateLiveClassroom(session.teamId, session.id);
  return { ok: true as const, ended: false };
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

  // Collaborative / individual: award once; for individual every student contributes.
  revalidateLiveClassroom(session.teamId, session.id);
  return {
    correct,
    points: scored.points,
    speedBonus: scored.speedBonus,
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
  return { ok: true as const, kind: card.kind };
}

export async function endLiveClassroomSessionAction(sessionId: number) {
  const session = await getLiveClassroomSessionById(sessionId);
  if (!session) throw new Error("Session not found");
  const { access } = await requireLiveClassroomAccess({
    teamId: session.teamId,
    requireHost: true,
  });

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
    userId: access.userId,
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

export { resolveLiveClassroomOrgRole, listLiveBattleAnswersForQuestion };
