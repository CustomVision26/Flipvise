"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function inboxNavLabel(unreadCount: number): string {
  const clamped = Math.min(unreadCount, 99);
  if (clamped === 0) return "Inbox";
  return `Inbox (${clamped} pending)`;
}

/** Header icon that links to `/dashboard/inbox` (team invitations). */
export function InboxNavIconButton({
  unreadCount = 0,
}: {
  unreadCount?: number;
}) {
  const label = inboxNavLabel(unreadCount);
  const clampedCount = Math.min(unreadCount, 99);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/inbox" />}
            variant="ghost"
            size="icon"
            className="relative h-8 w-8 rounded-full"
            aria-label={label}
          />
        }
      >
        <Inbox className="size-[18px]" aria-hidden />
        {clampedCount > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-[3px] text-[10px] font-semibold leading-none text-destructive-foreground ring-2 ring-background"
          >
            {clampedCount > 9 ? "9+" : clampedCount}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
