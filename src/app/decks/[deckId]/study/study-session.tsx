"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BookOpen, ListChecks } from "lucide-react";
import type { QuizFormatsSettings } from "@/lib/quiz-formats";
import type { DeckQuizFormatAssignments } from "@/lib/quiz-format-assignments";
import type { CardQuizVariants } from "@/lib/card-quiz-variants";
import type { QuizSecuritySessionState } from "@/db/schema";
import { FlashcardStudy } from "./flashcard-study";
import { QuizStudy } from "./quiz-study";

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
  teamId: number | null;
  /** Paid tiers — Free users cannot open Quiz mode in the UI. */
  allowsQuizStudy?: boolean;
  /** Team assignment — member may use Standard Review. */
  memberAllowReview?: boolean;
  /** Team assignment — member may use Quiz (still subject to plan tier). */
  memberAllowQuiz?: boolean;
  deckGradient?: string | null;
  /** Team workspace study URL — quiz results are saved automatically after submit. */
  autoSaveQuizResult?: boolean;
  /** Team workspace timed-quiz limit in seconds (owner/co-admin configured). */
  quizDurationSeconds?: number;
  /** Pro Plus / team / platform admin — listen-to-card (TTS). Not available on Free or Pro. */
  hasAiReading?: boolean;
  /** Leave study — team workspace dashboard or deck detail. */
  exitHref: string;
  exitLabel: string;
  /** Team member quiz — owner inbox can be chosen when saving after timeout. */
  ownerInboxAvailable?: boolean;
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
  /** Education Gold / Enterprise — secured quizzes auto-save to user, owner, and team admins. */
  isEducationTeamPlan?: boolean;
  /** Pro Plus / Education Plus — Format Quiz Question dialog on the quiz lobby. */
  quizFormatEditorSnapshot?: import("@/db/queries/quiz-formats").QuizFormatsDeckSnapshot | null;
}

export function StudySession({
  cards,
  deckId,
  deckName,
  teamId,
  allowsQuizStudy = true,
  memberAllowReview = true,
  memberAllowQuiz = true,
  deckGradient,
  autoSaveQuizResult = false,
  quizDurationSeconds,
  hasAiReading = false,
  exitHref,
  exitLabel,
  ownerInboxAvailable = false,
  quizSchedule,
  quizSecurity,
  quizFormats,
  quizFormatAssignmentPlan,
  isEducationTeamPlan = false,
  quizFormatEditorSnapshot = null,
}: StudySessionProps) {
  const showReviewTab = memberAllowReview;
  const showQuizTab = memberAllowQuiz && allowsQuizStudy;
  const showQuizUpgradeHint = memberAllowQuiz && !allowsQuizStudy;

  const initialTab = useMemo<"review" | "quiz">(() => {
    if (showReviewTab) return "review";
    if (showQuizTab) return "quiz";
    return "review";
  }, [showReviewTab, showQuizTab]);

  const [tab, setTab] = useState<"review" | "quiz">(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const effectiveTab =
    tab === "quiz" && showQuizTab
      ? "quiz"
      : tab === "review" && showReviewTab
        ? "review"
        : showReviewTab
          ? "review"
          : showQuizTab
            ? "quiz"
            : "review";

  const showModeSwitcher =
    showReviewTab && (showQuizTab || showQuizUpgradeHint);

  if (!showReviewTab && !showQuizTab && !showQuizUpgradeHint) {
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
          setTab(v as "review" | "quiz");
        }}
        className="flex flex-1 flex-col gap-4 sm:gap-6"
      >
        {showModeSwitcher ? (
          <TabsList className="self-center">
            {showReviewTab ? (
              <TabsTrigger value="review" className="gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                Standard Review
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
                  render={(props) => (
                    <span
                      {...props}
                      className={cn(
                        "inline-flex min-h-9 min-w-0 cursor-not-allowed items-stretch rounded-md",
                        props.className,
                      )}
                    >
                      <TabsTrigger
                        value="quiz"
                        disabled
                        className="pointer-events-none gap-1.5 opacity-40"
                      >
                        <ListChecks className="h-3.5 w-3.5" />
                        Quiz
                      </TabsTrigger>
                    </span>
                  )}
                />
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
        ) : null}

        {showReviewTab ? (
          <TabsContent value="review" className="flex flex-1 flex-col">
            <FlashcardStudy
              cards={cards}
              deckId={deckId}
              deckName={deckName}
              deckGradient={deckGradient ?? null}
              hasAiReading={hasAiReading}
            />
          </TabsContent>
        ) : null}

        {showQuizTab ? (
          <TabsContent value="quiz" className="flex flex-1 flex-col">
            <QuizStudy
              cards={cards}
              deckId={deckId}
              deckName={deckName}
              teamId={teamId}
              deckGradient={deckGradient ?? null}
              autoSaveQuizResult={autoSaveQuizResult}
              quizDurationSeconds={quizDurationSeconds}
              hasAiReading={hasAiReading}
              exitHref={exitHref}
              exitLabel={exitLabel}
              ownerInboxAvailable={ownerInboxAvailable}
              quizSchedule={quizSchedule}
              quizSecurity={quizSecurity}
              quizFormats={quizFormats}
              quizFormatAssignmentPlan={quizFormatAssignmentPlan}
              isEducationTeamPlan={isEducationTeamPlan}
              quizFormatEditorSnapshot={quizFormatEditorSnapshot}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </TooltipProvider>
  );
}
