"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function StudyLink({ deckId }: { deckId: number }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={`/decks/${deckId}/study`}
            className={buttonVariants({ variant: "default" })}
          >
            🧠 Brain Challenge
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p>Lets go! and test my memory bank</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
