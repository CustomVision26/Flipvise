"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { CheckCircle2, Loader2, RotateCcw, SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type {
  SerializedTicketMessage,
  SupportTicketThreadTicket,
} from "@/lib/support-ticket-dto";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type Props = {
  ticket: SupportTicketThreadTicket;
  messages: SerializedTicketMessage[];
  viewerRole: "admin" | "user";
  onSendReply: (message: string) => Promise<void>;
  onMarkResolved: () => Promise<void>;
  onReopen?: () => Promise<void>;
  disabled?: boolean;
};

export function SupportTicketThread({
  ticket,
  messages,
  viewerRole,
  onSendReply,
  onMarkResolved,
  onReopen,
  disabled = false,
}: Props) {
  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isPendingReply, startReply] = useTransition();
  const [isPendingResolve, startResolve] = useTransition();
  const [isPendingReopen, startReopen] = useTransition();
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(messages.length);

  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      messagesScrollRef.current?.scrollTo({
        top: messagesScrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages]);

  const isClosed = ticket.status === "closed";
  const isResolved = ticket.status === "resolved";
  const canReply = !disabled && !isClosed && !isResolved;

  function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setReplyError(null);
    const text = replyText.trim();
    startReply(async () => {
      try {
        await onSendReply(text);
        setReplyText("");
      } catch (err) {
        setReplyError(err instanceof Error ? err.message : "Failed to send reply");
      }
    });
  }

  function handleResolve() {
    startResolve(async () => {
      try {
        await onMarkResolved();
      } catch (err) {
        setReplyError(err instanceof Error ? err.message : "Failed to update ticket");
      }
    });
  }

  function handleReopen() {
    if (!onReopen) return;
    startReopen(async () => {
      try {
        await onReopen();
      } catch (err) {
        setReplyError(err instanceof Error ? err.message : "Failed to reopen ticket");
      }
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs capitalize">
          {STATUS_LABELS[ticket.status] ?? ticket.status}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Opened {formatDateTime(ticket.createdAt)}
        </span>
      </div>

      <div ref={messagesScrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <div
          className={cn(
            "rounded-lg border px-4 py-3",
            viewerRole === "user"
              ? "border-border/70 bg-muted/20"
              : "border-border/70 bg-muted/20",
          )}
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">
              {ticket.userName || "You"} · original message
            </span>
            <span className="text-xs text-muted-foreground">{formatDateTime(ticket.createdAt)}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>
          {ticket.attachmentUrl ? (
            <a
              href={ticket.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs text-primary underline-offset-4 hover:underline"
            >
              View attachment
            </a>
          ) : null}
        </div>

        {messages.map((msg) => {
          const isAdmin = msg.authorRole === "admin";
          return (
            <div
              key={msg.id}
              className={cn(
                "rounded-lg border px-4 py-3",
                isAdmin
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/70 bg-muted/15",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">
                  {msg.authorName}
                  {isAdmin ? " · Support" : ""}
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(msg.createdAt)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 space-y-3 border-t border-border/60 pt-4">
        {!isResolved && !isClosed ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10 sm:w-auto"
            disabled={isPendingResolve}
            onClick={handleResolve}
          >
            {isPendingResolve ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Mark issue as resolved
          </Button>
        ) : null}

        {isResolved && onReopen ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            disabled={isPendingReopen}
            onClick={handleReopen}
          >
            {isPendingReopen ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Reopen ticket
          </Button>
        ) : null}

        {canReply ? (
          <form onSubmit={handleReply} className="space-y-2">
            <Label className="text-xs">
              {viewerRole === "admin" ? "Reply to user" : "Reply to support"}
            </Label>
            <Textarea
              placeholder="Type your message…"
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              disabled={isPendingReply}
            />
            {replyError ? <p className="text-xs text-destructive">{replyError}</p> : null}
            <Button type="submit" size="sm" disabled={isPendingReply || !replyText.trim()}>
              {isPendingReply ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SendHorizonal className="mr-2 h-4 w-4" />
              )}
              Send reply
            </Button>
          </form>
        ) : isClosed ? (
          <p className="text-xs text-muted-foreground">This ticket is closed and cannot receive new replies.</p>
        ) : null}
      </div>
    </div>
  );
}
