"use server";

import { z } from "zod";
import { getAccessContext } from "@/lib/access";
import { resolveAiRecallAccess } from "@/lib/ai-recall-eligibility";
import { evaluateAiRecallAnswer } from "@/lib/evaluate-ai-recall-answer";
import {
  applyMasteryUpdatesForSession,
  computeSessionAnalytics,
  getDeckSubjectContext,
  saveAiRecallSession,
} from "@/db/queries/ai-recall";
import { getDeckWithViewerAccess } from "@/lib/team-deck-access";
import { getTeamById } from "@/db/queries/teams";
import type {
  AiRecallPerCardSnapshot,
  RecallEvaluationResult,
} from "@/lib/ai-recall-types";

const evaluateSchema = z.object({
  deckId: z.number().int().positive(),
  cardId: z.number().int().positive(),
  question: z.string().min(1).max(8000),
  correctAnswer: z.string().min(1).max(8000),
  studentAnswer: z.string().max(8000),
  modality: z.enum(["text", "voice", "drawing", "equation"]).default("text"),
  teamId: z.number().int().positive().nullable().optional(),
});

export type EvaluateAiRecallActionResult =
  | { ok: true; evaluation: RecallEvaluationResult }
  | { ok: false; error: "unauthorized" | "forbidden" | "offline_or_unavailable" | "invalid" };

export async function evaluateAiRecallAnswerAction(
  data: z.infer<typeof evaluateSchema>,
): Promise<EvaluateAiRecallActionResult> {
  const parsed = evaluateSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const access = await getAccessContext();
  if (!access.userId) return { ok: false, error: "unauthorized" };

  let studyWorkspacePlanSlug: string | null = null;
  if (parsed.data.teamId != null) {
    const team = await getTeamById(parsed.data.teamId);
    studyWorkspacePlanSlug = team?.planSlug ?? null;
  }

  const eligible =
    access.hasAiRecall ||
    resolveAiRecallAccess({
      isPlatformAdmin: access.isAdmin || access.isSuperadmin,
      activeTeamPlan: access.activeTeamPlan,
      activeEducationTeamPlan: access.activeEducationTeamPlan,
      personalPlanSlug: access.effectivePlanSlug,
      hasClerkProPlusPlan: access.hasClerkPersonalProPlus,
      studyWorkspacePlanSlug,
    });

  if (!eligible) return { ok: false, error: "forbidden" };

  const bundle = await getDeckWithViewerAccess(
    parsed.data.deckId,
    access.userId,
  );
  if (!bundle) return { ok: false, error: "forbidden" };

  const deckCtx = await getDeckSubjectContext(parsed.data.deckId);

  try {
    const evaluation = await evaluateAiRecallAnswer({
      question: parsed.data.question,
      correctAnswer: parsed.data.correctAnswer,
      studentAnswer: parsed.data.studentAnswer,
      deckSubject: deckCtx?.description ?? deckCtx?.name ?? null,
      difficulty: deckCtx?.difficultyLevel ?? null,
      cardMetadata: `cardId=${parsed.data.cardId}; modality=${parsed.data.modality}`,
    });
    return { ok: true, evaluation };
  } catch (err) {
    console.error("[evaluateAiRecallAnswerAction]", err);
    return { ok: false, error: "offline_or_unavailable" };
  }
}

const saveSessionSchema = z.object({
  deckId: z.number().int().positive(),
  deckName: z.string().min(1).max(255),
  teamId: z.number().int().positive().nullable().optional(),
  sessionDurationMs: z.number().int().min(0).max(86_400_000),
  perCard: z.array(
    z.object({
      cardId: z.number().int().positive(),
      question: z.string(),
      correctAnswer: z.string(),
      studentAnswer: z.string().nullable(),
      outcome: z.enum([
        "correct",
        "incorrect",
        "forced_unlock",
        "skipped",
      ]),
      score: z.number().min(0).max(100).nullable(),
      confidence: z.number().min(0).max(100).nullable(),
      feedback: z.string().nullable(),
      explanation: z.string().nullable(),
      recallTimeMs: z.number().int().min(0),
      modality: z.enum(["text", "voice", "drawing", "equation"]),
    }),
  ),
});

export type SaveAiRecallSessionActionResult =
  | { ok: true; sessionId: number }
  | { ok: false; error: "unauthorized" | "forbidden" | "invalid" };

export async function saveAiRecallSessionAction(
  data: z.infer<typeof saveSessionSchema>,
): Promise<SaveAiRecallSessionActionResult> {
  const parsed = saveSessionSchema.safeParse(data);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const access = await getAccessContext();
  if (!access.userId) return { ok: false, error: "unauthorized" };

  if (!access.hasAiRecall) {
    let studyWorkspacePlanSlug: string | null = null;
    if (parsed.data.teamId != null) {
      const team = await getTeamById(parsed.data.teamId);
      studyWorkspacePlanSlug = team?.planSlug ?? null;
    }
    const eligible = resolveAiRecallAccess({
      isPlatformAdmin: access.isAdmin || access.isSuperadmin,
      activeTeamPlan: access.activeTeamPlan,
      activeEducationTeamPlan: access.activeEducationTeamPlan,
      personalPlanSlug: access.effectivePlanSlug,
      hasClerkProPlusPlan: access.hasClerkPersonalProPlus,
      studyWorkspacePlanSlug,
    });
    if (!eligible) return { ok: false, error: "forbidden" };
  }

  const bundle = await getDeckWithViewerAccess(
    parsed.data.deckId,
    access.userId,
  );
  if (!bundle) return { ok: false, error: "forbidden" };

  const perCard = parsed.data.perCard as AiRecallPerCardSnapshot[];
  const mastery = await applyMasteryUpdatesForSession({
    userId: access.userId,
    deckId: parsed.data.deckId,
    perCard,
  });

  const analytics = computeSessionAnalytics({
    perCard,
    sessionDurationMs: parsed.data.sessionDurationMs,
    masteredCards: mastery.masteredCards,
    needsReview: mastery.needsReview,
  });

  const row = await saveAiRecallSession({
    userId: access.userId,
    deckId: parsed.data.deckId,
    deckName: parsed.data.deckName,
    teamId: parsed.data.teamId ?? null,
    analytics,
    perCard,
  });

  return { ok: true, sessionId: row.id };
}
