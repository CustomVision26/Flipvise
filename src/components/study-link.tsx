"use client";

import Link from "next/link";
import { Brain } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { withTeamWorkspaceQuery } from "@/lib/team-workspace-url";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function StudyLink({
  deckId,
  workspaceQueryString,
}: {
  deckId: number;
  workspaceQueryString?: string;
}) {
  const href = workspaceQueryString
    ? withTeamWorkspaceQuery(`/decks/${deckId}/study`, workspaceQueryString)
    : `/decks/${deckId}/study`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          render={(props) => (
            <Link
              href={href}
              {...props}
              className={cn(
                buttonVariants({ variant: "default", size: "sm" }),
                "h-9 gap-2 font-bold",
                props.className,
              )}
            >
              <Brain className="size-4" />
              Study deck
            </Link>
          )}
        />
        <TooltipContent>
          <p>Open flashcard study mode for this deck.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
