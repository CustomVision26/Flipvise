"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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

interface StudySessionProps {
  cards: CardData[];
  deckId: number;
  deckName: string;
}

export function StudySession({ cards, deckId, deckName }: StudySessionProps) {
  return (
    <Tabs defaultValue="review" className="flex-1 flex flex-col gap-4 sm:gap-6">
      <TabsList className="self-center">
        <TabsTrigger value="review" className="gap-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          Standard Review
        </TabsTrigger>
        <TabsTrigger value="quiz" className="gap-1.5">
          <ListChecks className="h-3.5 w-3.5" />
          Quiz
        </TabsTrigger>
      </TabsList>
      <TabsContent value="review" className="flex-1 flex flex-col">
        <FlashcardStudy cards={cards} deckId={deckId} deckName={deckName} />
      </TabsContent>
      <TabsContent value="quiz" className="flex-1 flex flex-col">
        <QuizStudy cards={cards} deckId={deckId} deckName={deckName} />
      </TabsContent>
    </Tabs>
  );
}
