"use client";

import Link from "next/link";
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
