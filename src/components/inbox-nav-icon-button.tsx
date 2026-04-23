"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Header icon that links to `/dashboard/inbox` (team invitations). */
export function InboxNavIconButton() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/inbox" />}
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            aria-label="Inbox"
          />
        }
      >
        <Inbox className="size-[18px]" aria-hidden />
      </TooltipTrigger>
      <TooltipContent side="bottom">Inbox</TooltipContent>
    </Tooltip>
  );
}
