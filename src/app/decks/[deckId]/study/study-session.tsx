"use client";

import { useState, useEffect } from "react";
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
};

export interface StudySessionProps {
  cards: CardData[];
  deckId: number;
  deckName: string;
  teamId: number | null;
  /** Pro personal (75 cards / deck) — Free users cannot open Quiz mode in the UI. */
  allowsQuizStudy?: boolean;
  deckGradient?: string | null;
  /** Team workspace study URL — quiz results are saved automatically after submit. */
  autoSaveQuizResult?: boolean;
}

export function StudySession({
  cards,
  deckId,
  deckName,
  teamId,
  allowsQuizStudy = true,
  deckGradient,
  autoSaveQuizResult = false,
}: StudySessionProps) {
  const [tab, setTab] = useState<"review" | "quiz">("review");
  const effectiveTab = allowsQuizStudy ? tab : "review";

  useEffect(() => {
    if (!allowsQuizStudy) setTab("review");
  }, [allowsQuizStudy]);

  return (
    <TooltipProvider>
      <Tabs
        value={effectiveTab}
        onValueChange={(v) => {
          if (!allowsQuizStudy) return;
          setTab(v as "review" | "quiz");
        }}
        className="flex flex-1 flex-col gap-4 sm:gap-6"
      >
        <TabsList className="self-center">
          <TabsTrigger value="review" className="gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Standard Review
          </TabsTrigger>
          {allowsQuizStudy ? (
            <TabsTrigger value="quiz" className="gap-1.5">
              <ListChecks className="h-3.5 w-3.5" />
              Quiz
            </TabsTrigger>
          ) : (
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
          )}
        </TabsList>
        <TabsContent value="review" className="flex flex-1 flex-col">
          <FlashcardStudy cards={cards} deckId={deckId} deckName={deckName} deckGradient={deckGradient ?? null} />
        </TabsContent>
        <TabsContent value="quiz" className="flex flex-1 flex-col">
          <QuizStudy
            cards={cards}
            deckId={deckId}
            deckName={deckName}
            teamId={teamId}
            deckGradient={deckGradient ?? null}
            autoSaveQuizResult={autoSaveQuizResult}
          />
        </TabsContent>
      </Tabs>
    </TooltipProvider>
  );
}
