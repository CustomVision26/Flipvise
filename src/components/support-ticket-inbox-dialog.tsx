"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SupportTicketThread } from "@/components/support-ticket-thread";
import {
  getMySupportTicketThreadAction,
  markMySupportTicketResolvedAction,
  reopenMySupportTicketAction,
  replyToMySupportTicketAction,
} from "@/actions/support";
import type { UnifiedInboxItem } from "@/lib/inbox-item-types";
import type {
  SerializedTicketMessage,
  SupportTicketThreadTicket,
} from "@/lib/support-ticket-dto";

export function SupportTicketInboxDialog({
  item,
  triggerLabel = "View thread",
}: {
  item: UnifiedInboxItem & { type: "support_ticket" };
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [threadTicket, setThreadTicket] = useState<SupportTicketThreadTicket | null>(null);
  const [messages, setMessages] = useState<SerializedTicketMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, startLoad] = useTransition();

  useEffect(() => {
    if (!open) return;
    startLoad(async () => {
      try {
        setError(null);
        const thread = await getMySupportTicketThreadAction(item.payload.ticketId);
        setThreadTicket(thread.ticket);
        setMessages(thread.messages);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load ticket");
      }
    });
  }, [open, item.payload.ticketId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" />}>
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(85vh,40rem)] flex-col gap-0 overflow-hidden sm:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-left text-base leading-snug">
            {item.payload.subject}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden px-1 py-2">
          {isLoading && !threadTicket ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : threadTicket ? (
            <SupportTicketThread
              ticket={threadTicket}
              messages={messages}
              viewerRole="user"
              onSendReply={async (message) => {
                const res = await replyToMySupportTicketAction({
                  ticketId: threadTicket.id,
                  message,
                });
                setThreadTicket(res.ticket);
                setMessages((prev) => [...prev, res.message]);
              }}
              onMarkResolved={async () => {
                const updated = await markMySupportTicketResolvedAction(threadTicket.id);
                setThreadTicket(updated);
              }}
              onReopen={async () => {
                const updated = await reopenMySupportTicketAction(threadTicket.id);
                setThreadTicket(updated);
              }}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
