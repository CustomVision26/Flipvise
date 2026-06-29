"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { CheckCircle2, Loader2, RotateCcw, SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SupportTicketChatImageUpload } from "@/components/support-ticket-chat-image-upload";
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

function ReplyImage({ imageUrl }: { imageUrl: string }) {
  return (
    <a
      href={imageUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block overflow-hidden rounded-lg border border-border/50 bg-background/40"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="Attached image" className="max-h-64 w-full object-contain" />
    </a>
  );
}

type Props = {
  ticket: SupportTicketThreadTicket;
  messages: SerializedTicketMessage[];
  viewerRole: "admin" | "user";
  onSendReply: (payload: { message: string; imageUrl?: string | null }) => Promise<void>;
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
  const [replyImageUrl, setReplyImageUrl] = useState<string | null>(null);
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
  const canSend = replyText.trim().length > 0 || Boolean(replyImageUrl);

  function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setReplyError(null);
    const text = replyText.trim();
    const imageUrl = replyImageUrl;
    startReply(async () => {
      try {
        await onSendReply({ message: text, imageUrl });
        setReplyText("");
        setReplyImageUrl(null);
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
        <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">
              {ticket.userName || "You"} · original message
            </span>
            <span className="text-xs text-muted-foreground">{formatDateTime(ticket.createdAt)}</span>
          </div>
          {ticket.message.trim() ? (
            <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>
          ) : null}
          {ticket.attachmentUrl ? (
            /\.(jpe?g|png|gif|webp)(\?|$)/i.test(ticket.attachmentUrl) ? (
              <ReplyImage imageUrl={ticket.attachmentUrl} />
            ) : (
              <a
                href={ticket.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs text-primary underline-offset-4 hover:underline"
              >
                View attachment
              </a>
            )
          ) : null}
        </div>

        {messages.map((msg) => {
          const isAdmin = msg.authorRole === "admin";
          return (
            <div
              key={msg.id}
              className={cn(
                "rounded-lg border px-4 py-3",
                isAdmin ? "border-primary/30 bg-primary/5" : "border-border/70 bg-muted/15",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">
                  {msg.authorName}
                  {isAdmin ? " · Support" : ""}
                </span>
                <span className="text-xs text-muted-foreground">{formatDateTime(msg.createdAt)}</span>
              </div>
              {msg.message.trim() ? (
                <p className={cn("text-sm whitespace-pre-wrap", msg.imageUrl && "mb-0")}>{msg.message}</p>
              ) : null}
              {msg.imageUrl ? <ReplyImage imageUrl={msg.imageUrl} /> : null}
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
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card/50 shadow-sm">
              {replyImageUrl ? (
                <div className="border-b border-border/40 px-3 pt-3">
                  <SupportTicketChatImageUpload
                    ticketId={ticket.id}
                    value={replyImageUrl}
                    onChange={setReplyImageUrl}
                    disabled={isPendingReply}
                  />
                </div>
              ) : null}
              <Textarea
                placeholder="Type your message…"
                rows={3}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={isPendingReply}
                className="max-h-32 min-h-[72px] resize-y border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 bg-muted/15 px-3 py-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  {!replyImageUrl ? (
                    <SupportTicketChatImageUpload
                      ticketId={ticket.id}
                      value={replyImageUrl}
                      onChange={setReplyImageUrl}
                      disabled={isPendingReply}
                    />
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Image attached</p>
                  )}
                </div>
                <Button type="submit" size="sm" className="shrink-0 gap-1.5" disabled={isPendingReply || !canSend}>
                  {isPendingReply ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <SendHorizonal className="h-4 w-4" aria-hidden />
                  )}
                  Send reply
                </Button>
              </div>
            </div>
            {replyError ? <p className="text-xs text-destructive">{replyError}</p> : null}
          </form>
        ) : isClosed ? (
          <p className="text-xs text-muted-foreground">This ticket is closed and cannot receive new replies.</p>
        ) : null}
      </div>
    </div>
  );
}
