"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getAccessContext } from "@/lib/access";
import {
  createQuizSecuritySession,
  getLatestQuizSecuritySessionForUserDeck,
  getQuizSecuritySessionById,
  clearQuizSecuritySessionsOnDisable,
  grantQuizSecuritySessionRestart,
  grantQuizSecuritySessionResume,
  isTeamQuizSecurityEnabled,
  terminateQuizSecuritySession,
  updateQuizSecuritySession,
  updateTeamQuizSecurityEnabled,
} from "@/db/queries/quiz-security";
import type { QuizSecuritySessionState } from "@/db/schema";

async function assertCanManageTeam(userId: string, teamId: number) {
  const { getTeamById, getMemberRecord } = await import("@/db/queries/teams");
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Workspace not found");
  if (team.ownerUserId === userId) return team;
  const member = await getMemberRecord(teamId, userId);
  if (member?.role === "team_admin") return team;
  throw new Error("Forbidden");
}

const sessionStateSchema = z.object({
  questions: z
    .array(
      z.object({
        cardId: z.number().int().positive(),
        question: z.string().nullable(),
        questionImageUrl: z.string().nullable(),
        options: z.array(z.string()).min(2),
        correctIndex: z.number().int().min(0),
      }),
    )
    .min(1),
  selectedByIndex: z.array(z.number().int().min(0).nullable()),
  currentIndex: z.number().int().min(0),
  remainingSeconds: z.number().int().min(0),
});

const startSessionSchema = z.object({
  teamId: z.number().int().positive(),
  deckId: z.number().int().positive(),
  deckName: z.string().min(1),
  sessionState: sessionStateSchema,
});

export async function startQuizSecuritySessionAction(data: z.infer<typeof startSessionSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = startSessionSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const enabled = await isTeamQuizSecurityEnabled(parsed.data.teamId);
  if (!enabled) throw new Error("Quiz security is not enabled for this workspace.");

  const existing = await getLatestQuizSecuritySessionForUserDeck(
    userId,
    parsed.data.teamId,
    parsed.data.deckId,
  );
  if (existing?.status === "terminated") {
    throw new Error(
      "This quiz was terminated. Wait for your team admin to grant access before starting again.",
    );
  }
  if (existing?.status === "completed") {
    throw new Error("You cannot start a new quiz for this deck. Contact your team admin.");
  }
  if (existing?.status === "locked") {
    throw new Error("Your quiz is locked. Wait for your team admin to grant access.");
  }
  if (existing?.status === "granted_resume") {
    const [activated] = await Promise.all([
      updateQuizSecuritySession(existing.id, userId, {
        status: "active",
        sessionState: parsed.data.sessionState as QuizSecuritySessionState,
        lockedAt: null,
      }),
    ]);
    return activated;
  }
  if (existing?.status === "active") {
    return updateQuizSecuritySession(existing.id, userId, {
      sessionState: parsed.data.sessionState as QuizSecuritySessionState,
    });
  }

  return createQuizSecuritySession({
    userId,
    teamId: parsed.data.teamId,
    deckId: parsed.data.deckId,
    deckName: parsed.data.deckName,
    sessionState: parsed.data.sessionState as QuizSecuritySessionState,
  });
}

const lockSessionSchema = z.object({
  sessionId: z.number().int().positive(),
  sessionState: sessionStateSchema,
});

export async function lockQuizSecuritySessionAction(data: z.infer<typeof lockSessionSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = lockSessionSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const session = await getQuizSecuritySessionById(parsed.data.sessionId);
  if (!session || session.userId !== userId) throw new Error("Session not found");
  if (session.status !== "active") return session;

  const row = await updateQuizSecuritySession(session.id, userId, {
    status: "locked",
    sessionState: parsed.data.sessionState as QuizSecuritySessionState,
    lockedAt: new Date(),
  });

  revalidatePath("/dashboard/team-admin/quiz-results", "layout");
  revalidatePath("/decks", "layout");
  return row;
}

const resumeSessionSchema = z.object({
  sessionId: z.number().int().positive(),
});

export async function resumeQuizSecuritySessionAction(data: z.infer<typeof resumeSessionSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = resumeSessionSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const session = await getQuizSecuritySessionById(parsed.data.sessionId);
  if (!session || session.userId !== userId) throw new Error("Session not found");
  if (session.status !== "granted_resume") {
    throw new Error("Resume is not available for this session.");
  }

  return updateQuizSecuritySession(session.id, userId, {
    status: "active",
    lockedAt: null,
  });
}

const completeSessionSchema = z.object({
  sessionId: z.number().int().positive(),
});

export async function completeQuizSecuritySessionAction(
  data: z.infer<typeof completeSessionSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = completeSessionSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const session = await getQuizSecuritySessionById(parsed.data.sessionId);
  if (!session || session.userId !== userId) throw new Error("Session not found");

  return updateQuizSecuritySession(session.id, userId, {
    status: "completed",
    completedAt: new Date(),
  });
}

const updateTeamSecuritySchema = z.object({
  teamId: z.number().int().positive(),
  enabled: z.boolean(),
});

export async function updateTeamQuizSecurityAction(data: z.infer<typeof updateTeamSecuritySchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = updateTeamSecuritySchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await assertCanManageTeam(userId, parsed.data.teamId);
  await updateTeamQuizSecurityEnabled(parsed.data.teamId, parsed.data.enabled);
  if (!parsed.data.enabled) {
    await clearQuizSecuritySessionsOnDisable(parsed.data.teamId);
  }

  revalidatePath("/dashboard/team-admin", "layout");
  revalidatePath("/dashboard/team-admin/quiz-results", "layout");
  revalidatePath("/decks", "layout");
}

const grantResumeSchema = z.object({
  teamId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
});

export async function grantQuizSecurityResumeAction(data: z.infer<typeof grantResumeSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = grantResumeSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await assertCanManageTeam(userId, parsed.data.teamId);
  const row = await grantQuizSecuritySessionResume(parsed.data.sessionId, parsed.data.teamId);
  if (!row) throw new Error("Session not found or not locked.");

  revalidatePath("/dashboard/team-admin/quiz-results", "layout");
  revalidatePath("/decks", "layout");
}

const grantRestartSchema = z.object({
  teamId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
});

export async function grantQuizSecurityRestartAction(data: z.infer<typeof grantRestartSchema>) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = grantRestartSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await assertCanManageTeam(userId, parsed.data.teamId);
  const row = await grantQuizSecuritySessionRestart(parsed.data.sessionId, parsed.data.teamId);
  if (!row) throw new Error("Session not found or cannot be restarted.");

  revalidatePath("/dashboard/team-admin/quiz-results", "layout");
  revalidatePath("/decks", "layout");
}

const terminateSessionSchema = z.object({
  teamId: z.number().int().positive(),
  sessionId: z.number().int().positive(),
});

export async function terminateQuizSecuritySessionAction(
  data: z.infer<typeof terminateSessionSchema>,
) {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = terminateSessionSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  await assertCanManageTeam(userId, parsed.data.teamId);
  const result = await terminateQuizSecuritySession(
    parsed.data.sessionId,
    parsed.data.teamId,
  );
  if (!result) throw new Error("Session not found or already ended.");

  revalidatePath("/dashboard/team-admin/quiz-results", "layout");
  revalidatePath("/dashboard/inbox");
}
