"use client";

import { useState, useTransition } from "react";
import { Loader2, SendHorizonal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { ContactUsThread } from "@/lib/contact-us-thread-dto";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<ContactUsThread["status"], string> = {
  open: "Open",
  read: "In progress",
  archived: "Archived",
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
  thread: ContactUsThread;
  viewerRole: "admin" | "user";
  onSendReply: (message: string) => Promise<void>;
  disabled?: boolean;
};

export function ContactUsThreadView({
  thread,
  viewerRole,
  onSendReply,
  disabled = false,
}: Props) {
  const [replyText, setReplyText] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isPendingReply, startReply] = useTransition();

  const isArchived = thread.status === "archived";
  const canReply = !disabled && !isArchived;

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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-xs capitalize">
          {STATUS_LABELS[thread.status]}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Started {formatDateTime(thread.createdAt)}
        </span>
      </div>

      <div className="min-h-[280px] flex-1 space-y-3 overflow-y-auto rounded-xl border border-border/50 bg-muted/10 p-3 sm:min-h-[360px]">
        <div className="rounded-lg border border-border/70 bg-muted/20 px-4 py-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold">
              {thread.name} · original message
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(thread.createdAt)}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground">{thread.subject}</p>
          <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
            {thread.message}
          </p>
        </div>

        {thread.replies.map((msg) => {
          const isAdmin = msg.authorRole === "admin";
          return (
            <div
              key={msg.id}
              className={cn(
                "rounded-lg border px-4 py-3",
                isAdmin
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/70 bg-background/40",
              )}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">
                  {msg.authorName}
                  {isAdmin ? " · Support team" : ""}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(msg.createdAt)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 space-y-2 border-t border-border/60 pt-4">
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
              Send message
            </Button>
          </form>
        ) : isArchived ? (
          <p className="text-xs text-muted-foreground">
            This conversation has been archived and no longer accepts new messages.
          </p>
        ) : null}
      </div>
    </div>
  );
}
