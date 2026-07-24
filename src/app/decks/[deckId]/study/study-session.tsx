"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ListChecks } from "lucide-react";
import type { QuizFormatsSettings } from "@/lib/quiz-formats";
import type { DeckQuizFormatAssignments } from "@/lib/quiz-format-assignments";
import type { CardQuizVariants } from "@/lib/card-quiz-variants";
import type { QuizSecuritySessionState } from "@/db/schema";
import {
  AI_RECALL_STUDY_MODE_STORAGE_KEY,
  type StudyModeTab,
} from "@/lib/ai-recall-types";
import { FlashcardStudy } from "./flashcard-study";
import { QuizStudy } from "./quiz-study";
import { AiRecallStudy } from "./ai-recall-study";

type CardData = {
  id: number;
  front: string | null;
  frontImageUrl: string | null;
  back: string | null;
  backImageUrl: string | null;
  choices: string[] | null;
  correctChoiceIndex: number | null;
  quizVariants?: CardQuizVariants | null;
};

export interface StudySessionProps {
  cards: CardData[];
  deckId: number;
  deckName: string;
  /** Deck topic / description shown under the name in quiz lobby and format dialog. */
  deckDescription?: string | null;
  teamId: number | null;
  /** Paid tiers — Free users cannot open Quiz mode in the UI. */
  allowsQuizStudy?: boolean;
  /** Team assignment — member may use Standard Review. */
  memberAllowReview?: boolean;
  /** Team assignment — member may use AI Recall™ (still subject to plan tier). */
  memberAllowAiRecall?: boolean;
  /** Team assignment — member may use Quiz (still subject to plan tier). */
  memberAllowQuiz?: boolean;
  deckGradient?: string | null;
  /** Team workspace study URL — quiz results are saved automatically after submit. */
  autoSaveQuizResult?: boolean;
  /** Team workspace timed-quiz limit in seconds (owner/co-admin configured). */
  quizDurationSeconds?: number;
  /** Pro Plus / team / platform admin — listen-to-card (TTS). Not available on Free or Pro. */
  hasAiReading?: boolean;
  /** Pro Plus / education / team tiers — AI Recall™. Not Free or Pro. */
  hasAiRecall?: boolean;
  /** Leave study — team workspace dashboard or deck detail. */
  exitHref: string;
  exitLabel: string;
  /** Team member quiz — owner inbox can be chosen when saving after timeout. */
  ownerInboxAvailable?: boolean;
  /** Workspace owner / team admin — can cancel out of the unanswered-submit dialog. */
  allowQuizCancelExit?: boolean;
  /** Scheduled quiz start — members cannot begin before this time. */
  quizSchedule?: {
    enabled: boolean;
    startAtIso: string;
    source: "deck" | "workspace";
  };
  /** Secured team-workspace quiz — prevents leaving the UI until submit. */
  quizSecurity?: {
    enabled: boolean;
    teamId: number;
    initialSession: {
      id: number;
      status: "active" | "locked" | "granted_resume" | "terminated" | "completed";
      sessionState: QuizSecuritySessionState | null;
    } | null;
  };
  /** Resolved quiz question formats for this study session. */
  quizFormats?: QuizFormatsSettings;
  /** Admin-applied per-card format map and target distribution for this deck. */
  quizFormatAssignmentPlan?: DeckQuizFormatAssignments | null;
  quizCardOrder?: number[] | null;
  quizCardOrderShuffledAt?: string | null;
  canReshuffleCardOrder?: boolean;
  /** Education Gold / Enterprise — secured quizzes auto-save to user, owner, and team admins. */
  isEducationTeamPlan?: boolean;
  /** Pro Plus / Education Plus — Format Quiz Question dialog on the quiz lobby. */
  quizFormatEditorSnapshot?: import("@/db/queries/quiz-formats").QuizFormatsDeckSnapshot | null;
}

function readStoredStudyMode(): StudyModeTab | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(AI_RECALL_STUDY_MODE_STORAGE_KEY);
    if (v === "review" || v === "ai_recall" || v === "quiz") return v;
  } catch {
    // ignore
  }
  return null;
}

function writeStoredStudyMode(mode: StudyModeTab) {
  try {
    localStorage.setItem(AI_RECALL_STUDY_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
}

function resolveInitialTab(input: {
  showReviewTab: boolean;
  showQuizTab: boolean;
  showAiRecallTab: boolean;
}): StudyModeTab {
  const stored = readStoredStudyMode();
  if (stored === "review" && input.showReviewTab) return "review";
  if (stored === "quiz" && input.showQuizTab) return "quiz";
  if (stored === "ai_recall" && input.showAiRecallTab) return "ai_recall";
  if (input.showReviewTab) return "review";
  if (input.showQuizTab) return "quiz";
  if (input.showAiRecallTab) return "ai_recall";
  return "review";
}

export function StudySession({
  cards,
  deckId,
  deckName,
  deckDescription = null,
  teamId,
  allowsQuizStudy = true,
  memberAllowReview = true,
  memberAllowAiRecall = true,
  memberAllowQuiz = true,
  deckGradient,
  autoSaveQuizResult = false,
  quizDurationSeconds,
  hasAiReading = false,
  hasAiRecall = false,
  exitHref,
  exitLabel,
  ownerInboxAvailable = false,
  allowQuizCancelExit = false,
  quizSchedule,
  quizSecurity,
  quizFormats,
  quizFormatAssignmentPlan,
  quizCardOrder = null,
  quizCardOrderShuffledAt = null,
  canReshuffleCardOrder = false,
  isEducationTeamPlan = false,
  quizFormatEditorSnapshot = null,
}: StudySessionProps) {
  const showReviewTab = memberAllowReview;
  const showAiRecallTab = memberAllowAiRecall;
  const showQuizTab = memberAllowQuiz && allowsQuizStudy;
  const showQuizUpgradeHint = memberAllowQuiz && !allowsQuizStudy;

  const fallbackTab = useMemo<StudyModeTab>(
    () =>
      resolveInitialTab({
        showReviewTab,
        showQuizTab,
        showAiRecallTab,
      }),
    [showReviewTab, showQuizTab, showAiRecallTab],
  );

  // StudySession is loaded with ssr:false — safe to read localStorage in the
  // initializer so we do not remount TabsContent after first paint (removeChild crash).
  const [tab, setTab] = useState<StudyModeTab>(() =>
    resolveInitialTab({
      showReviewTab,
      showQuizTab,
      showAiRecallTab,
    }),
  );

  useEffect(() => {
    writeStoredStudyMode(tab);
  }, [tab]);

  useEffect(() => {
    setTab((current) => {
      if (current === "quiz" && !showQuizTab) return fallbackTab;
      if (current === "review" && !showReviewTab) return fallbackTab;
      if (current === "ai_recall" && !showAiRecallTab) return fallbackTab;
      return current;
    });
  }, [fallbackTab, showReviewTab, showQuizTab, showAiRecallTab]);

  const effectiveTab: StudyModeTab =
    tab === "quiz" && showQuizTab
      ? "quiz"
      : tab === "ai_recall" && showAiRecallTab
        ? "ai_recall"
        : tab === "review" && showReviewTab
          ? "review"
          : fallbackTab;

  if (!showReviewTab && !showQuizTab && !showQuizUpgradeHint && !showAiRecallTab) {
    return (
      <p className="text-sm text-muted-foreground">
        No study modes are enabled for your account on this deck. Contact your team admin to update
        your study privileges.
      </p>
    );
  }

  return (
    <TooltipProvider>
      <Tabs
        value={effectiveTab}
        onValueChange={(v) => {
          if (v === "quiz" && !showQuizTab) return;
          if (v === "review" && !showReviewTab) return;
          if (v === "ai_recall" && !showAiRecallTab) return;
          setTab(v as StudyModeTab);
        }}
        className="flex flex-1 flex-col gap-4 sm:gap-6"
      >
        <div className="flex flex-col items-center gap-1.5">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Study Mode
          </p>
          <TabsList className="h-auto flex-wrap justify-center gap-1">
            {showReviewTab ? (
              <TabsTrigger value="review" className="gap-1.5">
                <span aria-hidden>📖</span>
                Standard Review
              </TabsTrigger>
            ) : null}

            {showAiRecallTab ? (
              <TabsTrigger value="ai_recall" className="gap-1.5">
                <span aria-hidden>🤖</span>
                AI Recall™
              </TabsTrigger>
            ) : null}

            {showQuizTab ? (
              <TabsTrigger value="quiz" className="gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />
                Quiz
              </TabsTrigger>
            ) : showQuizUpgradeHint ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <TabsTrigger
                      value="quiz"
                      disabled
                      className="gap-1.5 opacity-40"
                    />
                  }
                >
                  <ListChecks className="h-3.5 w-3.5" />
                  Quiz
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs text-xs">
                  <p>
                    Quiz exercise is a Pro feature. Upgrade your personal plan to practice with timed
                    quizzes.
                  </p>
                  <Link
                    href="/pricing"
                    className="mt-2 inline-block font-medium text-primary underline underline-offset-2 hover:opacity-90"
                  >
                    View Pro plans
                  </Link>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </TabsList>
        </div>

        {/*
          Render mode bodies outside TabsContent panels. Base UI tab panels +
          heavy study trees were racing DOM deletions (removeChild on null)
          when switching modes / restoring the last mode from localStorage.
        */}
        <div className="flex flex-1 flex-col" role="tabpanel">
          {effectiveTab === "review" && showReviewTab ? (
            <FlashcardStudy
              key="study-mode-review"
              cards={cards}
              deckId={deckId}
              deckName={deckName}
              deckGradient={deckGradient ?? null}
              hasAiReading={hasAiReading}
            />
          ) : null}

          {effectiveTab === "ai_recall" && showAiRecallTab ? (
            <AiRecallStudy
              key="study-mode-ai-recall"
              cards={cards}
              deckId={deckId}
              deckName={deckName}
              deckDescription={deckDescription}
              teamId={teamId}
              deckGradient={deckGradient ?? null}
              hasAiRecall={hasAiRecall}
              onSwitchToStandardReview={() => setTab("review")}
            />
          ) : null}

          {effectiveTab === "quiz" && showQuizTab ? (
            <QuizStudy
              key="study-mode-quiz"
              cards={cards}
              deckId={deckId}
              deckName={deckName}
              deckDescription={deckDescription}
              teamId={teamId}
              deckGradient={deckGradient ?? null}
              autoSaveQuizResult={autoSaveQuizResult}
              quizDurationSeconds={quizDurationSeconds}
              hasAiReading={hasAiReading}
              exitHref={exitHref}
              exitLabel={exitLabel}
              ownerInboxAvailable={ownerInboxAvailable}
              allowQuizCancelExit={allowQuizCancelExit}
              quizSchedule={quizSchedule}
              quizSecurity={quizSecurity}
              quizFormats={quizFormats}
              quizFormatAssignmentPlan={quizFormatAssignmentPlan}
              quizCardOrder={quizCardOrder}
              quizCardOrderShuffledAt={quizCardOrderShuffledAt}
              canReshuffleCardOrder={canReshuffleCardOrder}
              isEducationTeamPlan={isEducationTeamPlan}
              quizFormatEditorSnapshot={quizFormatEditorSnapshot}
            />
          ) : null}
        </div>
      </Tabs>
    </TooltipProvider>
  );
}
