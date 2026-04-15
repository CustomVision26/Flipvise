"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
        <TooltipTrigger
          render={(props) => (
            <Link
              href={`/decks/${deckId}/study`}
              {...props}
              className={cn(
                buttonVariants({ variant: "default" }),
                "text-xs sm:text-sm h-9 sm:h-10 px-3 sm:px-4",
                props.className
              )}
            >
              🧠 Brain Challenge
            </Link>
          )}
        />
        <TooltipContent>
          <p>Lets go! and test my memory bank</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
