"use client";

import { useRouter } from "next/navigation";
import { Bell, LifeBuoy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SerializedSupportNotification } from "@/lib/support-ticket-dto";

type Props = {
  unreadCount: number;
  notifications: SerializedSupportNotification[];
};

export function AdminSupportNotificationsMenu({ unreadCount, notifications }: Props) {
  const router = useRouter();

  function openTicket(ticketId: number) {
    router.push(`/admin/support-center?ticket=${ticketId}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="relative h-8 gap-1.5 px-2.5 text-xs"
            aria-label="Support ticket notifications"
          />
        }
      >
        <Bell className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Support alerts</span>
        {unreadCount > 0 ? (
          <Badge className="h-5 min-w-5 rounded-full px-1 text-[10px] tabular-nums" variant="destructive">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(22rem,calc(100vw-2rem))]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Support ticket notifications
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {notifications.length === 0 ? (
            <div className="px-2 py-6 text-center text-sm text-muted-foreground">
              No support notifications yet.
            </div>
          ) : (
            notifications.slice(0, 12).map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex cursor-pointer flex-col items-start gap-1 py-2"
                onClick={() => openTicket(n.ticketId)}
              >
                <span className="text-sm font-medium leading-snug">{n.title}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{n.preview}</span>
                {!n.readAt ? (
                  <Badge variant="secondary" className="mt-0.5 text-[10px]">
                    New
                  </Badge>
                ) : null}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2"
          onClick={() => router.push("/admin/support-center")}
        >
          <LifeBuoy className="h-4 w-4" />
          Open Support Center
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
