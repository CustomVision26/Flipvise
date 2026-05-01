"use server";

import { getAccessContext } from "@/lib/access";
import { z } from "zod";
import { getCardsForDeckViewer } from "@/db/queries/cards";
import { getDeckWithViewerAccess } from "@/lib/team-deck-access";
import { deckHasTeamTierProFeatures } from "@/lib/team-deck-pro-features";
import {
  pickQuoteForPercent,
  type QuizQuote,
  type QuizTier,
} from "@/lib/quiz-quotes";
import { saveQuizResult } from "@/db/queries/quiz-results";
import { isQuizResultPdfAttachmentEnabled, loopsSendQuizResultEmail } from "@/lib/loops";
import { resolveAppUrl } from "@/lib/stripe";
import { getClerkUserFieldDisplayById } from "@/lib/clerk-user-display";
import { generateQuizResultPdfBuffer } from "@/lib/quiz-pdf-server";
import type { QuizResultRow } from "@/db/queries/quiz-results";
import type { PerCardSnapshot } from "@/db/schema";

const quizAnswerSchema = z.object({
  cardId: z.number().int().positive(),
  /**
   * The exact text of the option the user picked. Null means the question was
   * left unanswered (either skipped or timer ran out before the user got to it).
   */
  selectedText: z.string().nullable(),
});

const submitQuizResultSchema = z.object({
  deckId: z.number().int().positive(),
  answers: z.array(quizAnswerSchema).min(1),
  /** Seconds elapsed on the timer. Informational — surfaced back in the result. */
  elapsedSeconds: z.number().int().min(0).optional(),
  /** True when the server-side submission was triggered by the client timer hitting zero. */
  timedOut: z.boolean().optional(),
});

type SubmitQuizResultInput = z.infer<typeof submitQuizResultSchema>;

export type QuizResult = {
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  percent: number;
  tier: QuizTier;
  quote: QuizQuote;
  elapsedSeconds: number;
  timedOut: boolean;
  perCard: {
    cardId: number;
    correct: boolean;
    answered: boolean;
    correctText: string;
  }[];
};

/**
 * Server-side source of truth for what the correct answer to a given card
 * is. For multiple-choice cards we read `choices[correctChoiceIndex]`; for
 * standard cards we fall back to `back`. Whitespace is normalized so client-
 * side rendering/whitespace differences do not cause false negatives.
 */
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Validates a quiz submission on the server and returns the final score.
 * Does not persist — personal study flows opt in via `saveQuizResultAction` on the results screen;
 * team workspace study saves immediately after submit on the client.
 *
 * The client sends the text string the user picked for each card, and the
 * server re-derives the correct text from the database. This means the
 * client cannot lie about correctness even when options were generated or
 * shuffled client-side.
 */
export async function submitQuizResultAction(
  data: SubmitQuizResultInput,
): Promise<QuizResult> {
  const { userId, has75CardsPerDeck } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = submitQuizResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, answers, elapsedSeconds, timedOut } = parsed.data;

  const deckAccess = await getDeckWithViewerAccess(deckId, userId);
  if (!deckAccess) throw new Error("Deck not found");

  const teamTierPro = await deckHasTeamTierProFeatures(deckAccess.deck);
  if (!has75CardsPerDeck && !teamTierPro) {
    throw new Error(
      "Quiz study requires Pro. Upgrade your personal plan on the Pricing page.",
    );
  }

  const cards = await getCardsForDeckViewer(deckId, userId);
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  let correct = 0;
  let unanswered = 0;
  let total = 0;
  const perCard: QuizResult["perCard"] = [];

  for (const answer of answers) {
    const card = cardMap.get(answer.cardId);
    if (!card) continue;
    total++;

    // Must match the client-side check in `quiz-study.tsx#buildQuestions`
    // exactly, otherwise a card with borderline `choices` could be treated
    // as multiple-choice by one side and free-response by the other, which
    // would silently mis-score the user.
    const hasStoredChoices =
      Array.isArray(card.choices) &&
      card.choices.length >= 2 &&
      card.correctChoiceIndex !== null &&
      card.correctChoiceIndex !== undefined &&
      card.correctChoiceIndex >= 0 &&
      card.correctChoiceIndex < card.choices.length;

    const correctText = hasStoredChoices
      ? (card.choices as string[])[card.correctChoiceIndex as number] ?? ""
      : card.back ?? "";

    const isAnswered = answer.selectedText !== null;
    let wasCorrect = false;

    if (isAnswered && correctText) {
      wasCorrect = normalize(answer.selectedText as string) === normalize(correctText);
    }

    if (!isAnswered) unanswered++;
    if (wasCorrect) correct++;

    perCard.push({
      cardId: card.id,
      correct: wasCorrect,
      answered: isAnswered,
      correctText,
    });
  }

  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const seed = correct * 31 + deckId + total;
  const { tier, ...quote } = pickQuoteForPercent(percent, seed);

  return {
    correct,
    incorrect: total - correct - unanswered,
    unanswered,
    total,
    percent,
    tier,
    quote,
    elapsedSeconds: elapsedSeconds ?? 0,
    timedOut: timedOut ?? false,
    perCard,
  };
}

const perCardSnapshotSchema = z.object({
  cardId: z.number().int(),
  question: z.string().nullable(),
  correctAnswer: z.string(),
  selectedAnswer: z.string().nullable(),
  correct: z.boolean(),
});

const saveQuizResultSchema = z.object({
  deckId: z.number().int().positive(),
  deckName: z.string().min(1),
  teamId: z.number().int().positive().nullable(),
  /**
   * True when the quiz was saved from a team-workspace study URL (resolved workspace matches deck team).
   * Drives Loops template: owner template on workspace team decks; taker template on personal-surface saves.
   */
  savedFromTeamWorkspace: z.boolean(),
  correct: z.number().int().min(0),
  incorrect: z.number().int().min(0),
  unanswered: z.number().int().min(0),
  total: z.number().int().min(1),
  percent: z.number().int().min(0).max(100),
  elapsedSeconds: z.number().int().min(0),
  perCard: z.array(perCardSnapshotSchema),
});

type SaveQuizResultInput = z.infer<typeof saveQuizResultSchema>;

/** Persists quiz results (inbox + email) — from the results screen in personal study, or right after submit in team workspace study. */
export async function saveQuizResultAction(data: SaveQuizResultInput): Promise<{ id: number }> {
  const { userId } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = saveQuizResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const d = parsed.data;

  return persistQuizResultAndNotify({
    userId,
    deckId: d.deckId,
    deckName: d.deckName,
    teamId: d.teamId,
    savedFromTeamWorkspace: d.savedFromTeamWorkspace,
    correct: d.correct,
    incorrect: d.incorrect,
    unanswered: d.unanswered,
    total: d.total,
    percent: d.percent,
    elapsedSeconds: d.elapsedSeconds,
    perCard: d.perCard,
  });
}

type QuizEmailContext = {
  userId: string;
  ownerUserId: string | null;
  teamName: string | null;
  result: QuizResultRow;
  /** Study opened/saved from team workspace URL — see `.cursor/rules/loops-quiz-result-email.mdc`. */
  savedFromTeamWorkspace: boolean;
};

/**
 * Resolves Clerk emails/names for the quiz-taker (and team owner when applicable),
 * generates a PDF attachment, then fires transactional Loops emails.
 *
 * Routing is driven by `savedFromTeamWorkspace` and team membership; see
 * `.cursor/rules/loops-quiz-result-email.mdc` for the full matrix.
 */
async function sendQuizResultEmails(ctx: QuizEmailContext): Promise<void> {
  const { result, userId, ownerUserId, teamName, savedFromTeamWorkspace } = ctx;

  const teamMemberNotOwner = Boolean(ownerUserId && ownerUserId !== userId);
  const teamDeck = ownerUserId !== null;
  /** Owner template only for invited member/admin saving from team workspace — workspace owner always uses taker template (same person; no third Loops template). */
  const useOwnerLoopsTemplate =
    savedFromTeamWorkspace && teamDeck && teamMemberNotOwner;

  const sharedFields = {
    deckName: result.deckName,
    teamName: teamName ?? "",
    correct: result.correct,
    incorrect: result.incorrect,
    unanswered: result.unanswered,
    total: result.total,
    percent: result.percent,
    elapsedSeconds: result.elapsedSeconds,
  } as const;

  // Resolve display info for quiz-taker (and owner in parallel when needed).
  const [takerDisplay, ownerDisplay] = await Promise.all([
    getClerkUserFieldDisplayById(userId),
    ownerUserId && ownerUserId !== userId
      ? getClerkUserFieldDisplayById(ownerUserId)
      : Promise.resolve(null),
  ]);

  const takerName = takerDisplay.primaryLine;
  const takerEmail = takerDisplay.primaryEmail;
  const ownerName = ownerDisplay?.primaryLine ?? null;
  const ownerEmail = ownerDisplay?.primaryEmail ?? null;

  // PDF attachment for Loops is opt-in (`LOOPS_QUIZ_RESULT_ATTACH_PDF=true`) — default skips generation.
  let pdfBuffer: Buffer | undefined;
  if (isQuizResultPdfAttachmentEnabled()) {
    try {
      pdfBuffer = await generateQuizResultPdfBuffer({
        deckName: result.deckName,
        savedAt: result.savedAt,
        correct: result.correct,
        incorrect: result.incorrect,
        unanswered: result.unanswered,
        total: result.total,
        percent: result.percent,
        elapsedSeconds: result.elapsedSeconds,
        perCard: result.perCard,
        userName: takerName,
        userEmail: takerEmail,
        teamName,
        ownerName,
        ownerEmail,
      });
    } catch (err) {
      console.error("[QuizEmail] PDF generation failed:", err);
    }
  }

  const viewUrl = `${resolveAppUrl()}/dashboard/quiz-results/${result.id}`;

  const teamLabel = teamName?.trim() ? ` · ${teamName}` : "";
  const subjectLineTaker = `${result.deckName} · ${result.percent}%${teamLabel}`;
  const subjectLineOwner = `${takerName} · ${result.deckName} · ${result.percent}%${teamLabel}`;

  const quoteSeed = result.correct * 31 + (result.deckId ?? 0) + result.total;
  const performanceMessage = pickQuoteForPercent(result.percent, quoteSeed).text;

  if (!takerEmail) {
    console.warn(
      `[QuizEmail] Loops send skipped for quiz-taker: Clerk user ${userId} has no email address on file.`,
    );
  }

  if (useOwnerLoopsTemplate && teamMemberNotOwner && !ownerEmail && ownerUserId) {
    console.warn(
      `[QuizEmail] Loops send skipped for workspace owner: Clerk user ${ownerUserId} has no email address on file.`,
    );
  }

  if (takerEmail) {
    if (useOwnerLoopsTemplate) {
      await loopsSendQuizResultEmail(
        {
          ...sharedFields,
          email: takerEmail,
          userName: takerName,
          memberName: takerName,
          isOwnerCopy: 0,
          loopsTemplateRole: "owner",
          viewUrl,
          subjectLine: subjectLineTaker,
          performanceMessage,
        },
        pdfBuffer,
      );
    } else {
      await loopsSendQuizResultEmail(
        {
          ...sharedFields,
          email: takerEmail,
          userName: takerName,
          memberName: takerName,
          isOwnerCopy: 0,
          loopsTemplateRole: "taker",
          viewUrl,
          subjectLine: subjectLineTaker,
          performanceMessage,
        },
        pdfBuffer,
      );
    }
  }

  if (useOwnerLoopsTemplate && teamMemberNotOwner && ownerEmail) {
    await loopsSendQuizResultEmail(
      {
        ...sharedFields,
        email: ownerEmail,
        userName: ownerName ?? ownerEmail,
        memberName: takerName,
        isOwnerCopy: 1,
        loopsTemplateRole: "owner",
        viewUrl,
        subjectLine: subjectLineOwner,
        performanceMessage,
      },
      pdfBuffer,
    );
  }
}

async function persistQuizResultAndNotify(params: {
  userId: string;
  deckId: number;
  deckName: string;
  teamId: number | null;
  savedFromTeamWorkspace: boolean;
  correct: number;
  incorrect: number;
  unanswered: number;
  total: number;
  percent: number;
  elapsedSeconds: number;
  perCard: PerCardSnapshot[];
}): Promise<{ id: number }> {
  const { result: saved, ownerUserId, teamName } = await saveQuizResult({
    userId: params.userId,
    deckId: params.deckId,
    deckName: params.deckName,
    teamId: params.teamId,
    correct: params.correct,
    incorrect: params.incorrect,
    unanswered: params.unanswered,
    total: params.total,
    percent: params.percent,
    elapsedSeconds: params.elapsedSeconds,
    perCard: params.perCard,
  });

  await sendQuizResultEmails({
    userId: params.userId,
    ownerUserId,
    teamName,
    result: saved,
    savedFromTeamWorkspace: params.savedFromTeamWorkspace,
  });

  return { id: saved.id };
}
