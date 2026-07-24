/**
 * Shared AI Recall™ types.
 * Designed so future voice / drawing / equation modalities can plug in
 * without changing session analytics or mastery update shapes.
 */

export type RecallAnswerModality = "text" | "voice" | "drawing" | "equation";

export type RecallAnswerInput = {
  modality: RecallAnswerModality;
  /** Primary text payload (typed answer, ASR transcript, OCR, etc.). */
  text: string;
  /** Reserved for future binary / structured payloads. */
  mediaRef?: string | null;
};

export type RecallEvaluationResult = {
  correct: boolean;
  score: number;
  confidence: number;
  feedback: string;
  explanation: string;
};

export type RecallCardOutcome =
  | "correct"
  | "incorrect"
  | "forced_unlock"
  | "skipped";

export type CardMasteryLevel = "new" | "learning" | "strong" | "mastered";

export type AiRecallPerCardSnapshot = {
  cardId: number;
  question: string;
  correctAnswer: string;
  studentAnswer: string | null;
  outcome: RecallCardOutcome;
  score: number | null;
  confidence: number | null;
  feedback: string | null;
  explanation: string | null;
  recallTimeMs: number;
  modality: RecallAnswerModality;
};

export type AiRecallSessionAnalytics = {
  cardsReviewed: number;
  correct: number;
  incorrect: number;
  forcedUnlocks: number;
  averageRecallTimeMs: number;
  averageAiScore: number | null;
  masteredCards: number;
  needsReview: number;
  sessionDurationMs: number;
};

export const AI_RECALL_STUDY_MODE_STORAGE_KEY = "flipvise.studyMode";

export type StudyModeTab = "review" | "ai_recall" | "quiz";
