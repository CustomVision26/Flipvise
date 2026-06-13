"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SupportTicketThread } from "@/components/support-ticket-thread";
import {
  getMySupportTicketThreadAction,
  getMyTicketsAction,
  markMySupportTicketResolvedAction,
  reopenMySupportTicketAction,
  replyToMySupportTicketAction,
} from "@/actions/support";
import type {
  SerializedTicketMessage,
  SupportTicketThreadTicket,
} from "@/lib/support-ticket-dto";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

type TicketRow = Awaited<ReturnType<typeof getMyTicketsAction>>[number];

export function HelpCenterMyTickets() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, startLoad] = useTransition();
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const [threadTicket, setThreadTicket] = useState<SupportTicketThreadTicket | null>(null);
  const [messages, setMessages] = useState<SerializedTicketMessage[]>([]);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [isThreadLoading, startThreadLoad] = useTransition();

  useEffect(() => {
    startLoad(async () => {
      try {
        setLoadError(null);
        const rows = await getMyTicketsAction();
        setTickets(rows);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Failed to load tickets");
      }
    });
  }, []);

  function openTicket(ticketId: number) {
    setActiveTicketId(ticketId);
    setThreadTicket(null);
    setMessages([]);
    setThreadError(null);
    startThreadLoad(async () => {
      try {
        const thread = await getMySupportTicketThreadAction(ticketId);
        setThreadTicket(thread.ticket);
        setMessages(thread.messages);
      } catch (err) {
        setThreadError(err instanceof Error ? err.message : "Failed to load ticket");
      }
    });
  }

  function closeDialog(open: boolean) {
    if (!open) {
      setActiveTicketId(null);
      setThreadTicket(null);
      setMessages([]);
    }
  }

  async function refreshTicketList() {
    const rows = await getMyTicketsAction();
    setTickets(rows);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        View your submitted requests and continue the conversation with support.
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : loadError ? (
        <p className="text-sm text-destructive">{loadError}</p>
      ) : tickets.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          You have not submitted any support tickets yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <button
                type="button"
                onClick={() => openTicket(ticket.id)}
                className="flex w-full items-start gap-3 rounded-lg border border-border/70 bg-muted/20 px-4 py-3 text-left transition-colors hover:bg-muted/40"
              >
                <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{ticket.subject}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ticket.message}</p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                  {STATUS_LABELS[ticket.status] ?? ticket.status}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={activeTicketId != null} onOpenChange={closeDialog}>
        <DialogContent className="flex max-h-[min(85vh,40rem)] flex-col gap-0 overflow-hidden sm:max-w-lg">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-left text-base leading-snug">
              {threadTicket ? `#${threadTicket.id} — ${threadTicket.subject}` : "Support ticket"}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden px-1 py-2">
            {isThreadLoading && !threadTicket ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : threadError ? (
              <p className="text-sm text-destructive">{threadError}</p>
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
                  await refreshTicketList();
                }}
                onMarkResolved={async () => {
                  const updated = await markMySupportTicketResolvedAction(threadTicket.id);
                  setThreadTicket(updated);
                  await refreshTicketList();
                }}
                onReopen={async () => {
                  const updated = await reopenMySupportTicketAction(threadTicket.id);
                  setThreadTicket(updated);
                  await refreshTicketList();
                }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
