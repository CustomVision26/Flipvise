"use server";

import { getAccessContext } from "@/lib/access";
import { z } from "zod";
import { getCardsForDeckViewer } from "@/db/queries/cards";
import { getDeckWithViewerAccess } from "@/lib/team-deck-access";
import { deckHasTeamTierProFeatures } from "@/lib/team-deck-pro-features";
import {
  CARDS_PER_DECK_LIMIT_FREE,
  resolveDeckCardCap,
} from "@/lib/deck-limits";
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
import {
  shouldSendQuizResultEmailToOwner,
  shouldSendQuizResultEmailToTeamAdmin,
  shouldSendQuizResultEmailToUser,
  type QuizResultInboxTarget,
} from "@/lib/quiz-result-inbox-targets";

import { parseCardQuizVariants } from "@/lib/card-quiz-variants";
import {
  gradeQuizAnswer,
  type QuizQuestionType,
} from "@/lib/quiz-questions";

const quizAnswerSchema = z.object({
  cardId: z.number().int().positive(),
  questionType: z.enum(["multiple_choice", "true_false", "fill_in_blank"]),
  /**
   * Selected option text for multiple-choice and true/false. Null when unanswered
   * or for fill-in-the-blank questions.
   */
  selectedText: z.string().nullable(),
  /** Typed response for fill-in-the-blank. Null for other formats. */
  typedAnswer: z.string().nullable(),
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
 * Validates a quiz submission on the server and returns the final score.
 * Does not persist — personal study flows opt in via `saveQuizResultAction` on the results screen;
 * team workspace study saves immediately after submit on the client.
 *
 * The client sends question type and answer payload per card; the server
 * re-grades from stored card content and quiz variants.
 */
export async function submitQuizResultAction(
  data: SubmitQuizResultInput,
): Promise<QuizResult> {
  const { userId, maxCardsPerDeck } = await getAccessContext();
  if (!userId) throw new Error("Unauthorized");

  const parsed = submitQuizResultSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid input");

  const { deckId, answers, elapsedSeconds, timedOut } = parsed.data;

  const deckAccess = await getDeckWithViewerAccess(deckId, userId);
  if (!deckAccess) throw new Error("Deck not found");

  const teamTierPro = await deckHasTeamTierProFeatures(deckAccess.deck);
  const deckCap = resolveDeckCardCap({
    teamTierProWorkspace: teamTierPro,
    personalMaxCardsPerDeck: maxCardsPerDeck,
  });
  if (deckCap <= CARDS_PER_DECK_LIMIT_FREE) {
    throw new Error(
      "Quiz study requires a paid plan. Upgrade your personal plan on the Pricing page.",
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

    const variants = parseCardQuizVariants(card.quizVariants);
    const cardInput = { ...card, quizVariants: variants };

    const { correctText, wasCorrect, isAnswered } = gradeQuizAnswer(
      cardInput,
      answer.questionType as QuizQuestionType,
      {
        selectedText: answer.selectedText,
        typedAnswer: answer.typedAnswer,
      },
    );

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
  questionType: z.enum(["multiple_choice", "true_false", "fill_in_blank"]).optional(),
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
  inboxTargets: z.array(z.enum(["user", "owner", "team_admin"])).min(1).optional(),
  /** When true, persist inbox rows only — no Loops email notifications. */
  inboxOnly: z.boolean().optional(),
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
    inboxTargets: d.inboxTargets,
    inboxOnly: d.inboxOnly,
  });
}

type QuizEmailContext = {
  userId: string;
  ownerUserId: string | null;
  teamName: string | null;
  result: QuizResultRow;
  /** Study opened/saved from team workspace URL — see `.cursor/rules/loops-quiz-result-email.mdc`. */
  savedFromTeamWorkspace: boolean;
  inboxTargets?: QuizResultInboxTarget[];
  teamAdminUserIds?: string[];
};

/**
 * Resolves Clerk emails/names for the quiz-taker (and team owner when applicable),
 * generates a PDF attachment, then fires transactional Loops emails.
 *
 * Routing is driven by `savedFromTeamWorkspace` and team membership; see
 * `.cursor/rules/loops-quiz-result-email.mdc` for the full matrix.
 */
async function sendQuizResultEmails(ctx: QuizEmailContext): Promise<void> {
  const {
    result,
    userId,
    ownerUserId,
    teamName,
    savedFromTeamWorkspace,
    inboxTargets,
    teamAdminUserIds = [],
  } = ctx;
  const emailUser = shouldSendQuizResultEmailToUser(inboxTargets);
  const emailOwner = shouldSendQuizResultEmailToOwner(inboxTargets);
  const emailTeamAdmins = shouldSendQuizResultEmailToTeamAdmin(inboxTargets);

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

  if (takerEmail && emailUser) {
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

  if (useOwnerLoopsTemplate && teamMemberNotOwner && ownerEmail && emailOwner) {
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

  if (
    savedFromTeamWorkspace &&
    teamDeck &&
    emailTeamAdmins &&
    teamAdminUserIds.length > 0
  ) {
    const adminIdsToEmail = teamAdminUserIds.filter(
      (adminId) => adminId !== userId && adminId !== ownerUserId,
    );
    if (adminIdsToEmail.length > 0) {
      const adminDisplays = await Promise.all(
        adminIdsToEmail.map((adminId) => getClerkUserFieldDisplayById(adminId)),
      );
      for (let i = 0; i < adminIdsToEmail.length; i++) {
        const adminEmail = adminDisplays[i]?.primaryEmail;
        if (!adminEmail) {
          console.warn(
            `[QuizEmail] Loops send skipped for team admin: Clerk user ${adminIdsToEmail[i]} has no email address on file.`,
          );
          continue;
        }
        await loopsSendQuizResultEmail(
          {
            ...sharedFields,
            email: adminEmail,
            userName: adminDisplays[i]?.primaryLine ?? adminEmail,
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
  inboxTargets?: QuizResultInboxTarget[];
  inboxOnly?: boolean;
}): Promise<{ id: number }> {
  const { result: saved, ownerUserId, teamName, teamAdminUserIds } = await saveQuizResult({
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
    inboxTargets: params.inboxTargets,
  });

  if (!params.inboxOnly) {
    await sendQuizResultEmails({
      userId: params.userId,
      ownerUserId,
      teamName,
      result: saved,
      savedFromTeamWorkspace: params.savedFromTeamWorkspace,
      inboxTargets: params.inboxTargets,
      teamAdminUserIds,
    });
  }

  return { id: saved.id };
}
