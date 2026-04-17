"use client";

import { useState } from "react";
import Image from "next/image";
import { Sparkles, ArrowUpDown, CheckCircle2, ListChecks } from "lucide-react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditCardDialog } from "./edit-card-dialog";
import { DeleteCardDialog } from "./delete-card-dialog";

type CardData = {
  id: number;
  deckId: number;
  front: string | null;
  frontImageUrl: string | null;
  back: string | null;
  backImageUrl: string | null;
  aiGenerated: boolean;
  cardType: "standard" | "multiple_choice";
  choices: string[] | null;
  correctChoiceIndex: number | null;
  createdAt: Date;
  updatedAt: Date;
};

type SortOption = "newest" | "oldest" | "front-asc" | "front-desc" | "ai-first";

function sortCards(cards: CardData[], sort: SortOption): CardData[] {
  const sorted = [...cards];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => b.id - a.id);
    case "oldest":
      return sorted.sort((a, b) => a.id - b.id);
    case "front-asc":
      return sorted.sort((a, b) =>
        (a.front ?? "").localeCompare(b.front ?? "")
      );
    case "front-desc":
      return sorted.sort((a, b) =>
        (b.front ?? "").localeCompare(a.front ?? "")
      );
    case "ai-first":
      return sorted.sort((a, b) => Number(b.aiGenerated) - Number(a.aiGenerated));
  }
}

interface CardGridProps {
  cards: CardData[];
  deckId: number;
  hasAI?: boolean;
}

export function CardGrid({ cards, deckId, hasAI = false }: CardGridProps) {
  const [sort, setSort] = useState<SortOption>("newest");
  const sorted = sortCards(cards, sort);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 self-end">
        <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
        <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
          <SelectTrigger className="w-36 sm:w-44 h-8 text-xs">
            <SelectValue placeholder="Sort by…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="front-asc">Front A → Z</SelectItem>
            <SelectItem value="front-desc">Front Z → A</SelectItem>
            <SelectItem value="ai-first">AI generated first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((card, i) => {
          const isMC = card.cardType === "multiple_choice";
          return (
            <Card
              key={card.id}
              className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300 fill-mode-both hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform]"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    {isMC ? "Question" : "Front"}
                  </p>
                  {isMC && (
                    <Badge
                      variant="outline"
                      className="gap-1 px-1.5 py-0 text-[10px] font-normal border-primary/40"
                    >
                      <ListChecks className="size-3 text-primary" />
                      MC
                    </Badge>
                  )}
                  {card.aiGenerated && (
                    <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px] font-normal">
                      <Sparkles className="size-3 text-primary" />
                      AI
                    </Badge>
                  )}
                </div>
                {card.front && (
                  <p className="text-foreground font-medium">{card.front}</p>
                )}
                {card.frontImageUrl && (
                  <div className="relative mt-2 h-24 sm:h-32 rounded-lg overflow-hidden border border-border bg-muted/30 shadow-sm">
                    <Image
                      src={card.frontImageUrl}
                      alt={isMC ? "Question image" : "Front image"}
                      fill
                      className="object-contain p-1"
                    />
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex-1 pb-2">
                {isMC && card.choices && card.choices.length > 0 ? (
                  // Only show the correct answer on the deck preview. The
                  // other choices (distractors) remain in the DB but are
                  // hidden here so the deck page looks like a clean Q&A
                  // list — same treatment as standard cards.
                  <>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Answer
                    </p>
                    {(() => {
                      const correctIdx = card.correctChoiceIndex ?? 0;
                      const correct = card.choices[correctIdx] ?? card.back ?? "";
                      if (!correct) return null;
                      return (
                        <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-sm text-foreground">
                          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                          <span className="break-words leading-snug">{correct}</span>
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      Back
                    </p>
                    {card.back && (
                      <p className="text-foreground mt-1 text-sm break-words">{card.back}</p>
                    )}
                    {card.backImageUrl && (
                      <div className="relative mt-2 h-24 sm:h-32 rounded-lg overflow-hidden border border-border bg-muted/30 shadow-sm">
                        <Image
                          src={card.backImageUrl}
                          alt="Back image"
                          fill
                          className="object-contain p-1"
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
              <CardFooter className="flex justify-end gap-2 pt-2">
                <EditCardDialog card={card} deckId={deckId} hasAI={hasAI} />
                <DeleteCardDialog cardId={card.id} deckId={deckId} />
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
