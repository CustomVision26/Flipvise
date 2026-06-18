"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Loader2, SendHorizonal } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ContactUsChatImageUpload } from "@/components/contact-us-chat-image-upload";
import type { ContactUsThread } from "@/lib/contact-us-thread-dto";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<ContactUsThread["status"], string> = {
  open: "Open",
  read: "In progress",
  archived: "Resolved",
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

function initialsFromName(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

function statusBadgeClass(status: ContactUsThread["status"]): string {
  if (status === "open") return "border-sky-500/40 bg-sky-500/10 text-sky-300";
  if (status === "read") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  return "border-border/60 bg-muted/30 text-muted-foreground";
}

type Props = {
  thread: ContactUsThread;
  messageId: number;
  accessToken?: string;
  viewerRole: "admin" | "user";
  onSendReply: (payload: { message: string; imageUrl?: string | null }) => Promise<void>;
  disabled?: boolean;
  /** Hide the top meta row when the parent shell already shows status (e.g. admin sheet header). */
  showMeta?: boolean;
  /** Extra actions pinned below the reply composer (e.g. Resolved). */
  stickyFooterExtra?: ReactNode;
};

function ThreadMessageBubble({
  authorName,
  authorSubtitle,
  createdAt,
  body,
  imageUrl,
  subject,
  isSupport,
  isThreadStarter = false,
}: {
  authorName: string;
  authorSubtitle?: string;
  createdAt: string;
  body: string;
  imageUrl?: string | null;
  subject?: string;
  isSupport: boolean;
  isThreadStarter?: boolean;
}) {
  const bubbleTone = isSupport
    ? "border-primary/25 bg-primary/10"
    : isThreadStarter
      ? "border-border/60 bg-card/80"
      : "border-border/50 bg-muted/25";

  return (
    <div className={cn("flex w-full", isSupport && "justify-end")}>
      <div className={cn("flex max-w-[92%] gap-2.5 sm:max-w-[85%]", isSupport && "flex-row-reverse")}>
      <Avatar size="sm" className="mt-0.5 shrink-0">
        <AvatarFallback
          className={cn(
            "text-[10px] font-semibold",
            isSupport ? "bg-primary/20 text-primary" : "bg-muted text-foreground",
          )}
        >
          {initialsFromName(authorName)}
        </AvatarFallback>
      </Avatar>
      <div className={cn("min-w-0 flex-1 rounded-xl border px-3.5 py-3 shadow-sm", bubbleTone)}>
        <div
          className={cn(
            "mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5",
            isSupport && "justify-end text-right",
          )}
        >
          <span className="text-xs font-semibold text-foreground">{authorName}</span>
          {authorSubtitle ? (
            <span className="text-[11px] text-muted-foreground">{authorSubtitle}</span>
          ) : null}
          <span className="text-[11px] text-muted-foreground">{formatDateTime(createdAt)}</span>
        </div>
        {subject ? (
          <p className="text-sm font-medium leading-snug text-foreground">{subject}</p>
        ) : null}
        {body.trim() ? (
          <p
            className={cn(
              "text-sm leading-relaxed whitespace-pre-wrap text-foreground/90",
              subject && "mt-2",
              imageUrl && "mb-2",
            )}
          >
            {body}
          </p>
        ) : null}
        {imageUrl ? (
          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-lg border border-border/50 bg-background/40"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Attached image"
              className="max-h-64 w-full object-contain"
            />
          </a>
        ) : null}
      </div>
      </div>
    </div>
  );
}

export function ContactUsThreadView({
  thread,
  messageId,
  accessToken,
  viewerRole,
  onSendReply,
  disabled = false,
  showMeta = true,
  stickyFooterExtra,
}: Props) {
  const [replyText, setReplyText] = useState("");
  const [replyImageUrl, setReplyImageUrl] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isPendingReply, startReply] = useTransition();

  const isArchived = thread.status === "archived";
  const canReply = !disabled && !isArchived;
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

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {showMeta ? (
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn("text-[11px] font-medium capitalize", statusBadgeClass(thread.status))}
          >
            {STATUS_LABELS[thread.status]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Started {formatDateTime(thread.createdAt)}
          </span>
        </div>
      ) : null}

      <div
        className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain rounded-xl border border-border/40 bg-muted/10 p-3 sm:p-4"
        aria-label="Conversation messages"
      >
        <ThreadMessageBubble
          authorName={thread.name}
          authorSubtitle="Original message"
          createdAt={thread.createdAt}
          subject={thread.subject}
          body={thread.message}
          isSupport={false}
          isThreadStarter
        />

        {thread.replies.map((msg) => {
          const isAdmin = msg.authorRole === "admin";
          return (
            <ThreadMessageBubble
              key={msg.id}
              authorName={msg.authorName}
              authorSubtitle={isAdmin ? "Support team" : undefined}
              createdAt={msg.createdAt}
              body={msg.message}
              imageUrl={msg.imageUrl}
              isSupport={isAdmin}
            />
          );
        })}
      </div>

      <div className="mt-3 shrink-0 space-y-3 border-t border-border/50 bg-popover pt-3">
        {canReply ? (
          <form onSubmit={handleReply} className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              {viewerRole === "admin" ? "Reply to user" : "Reply to support"}
            </Label>
            <div className="overflow-hidden rounded-xl border border-border/60 bg-card/50 shadow-sm">
              {replyImageUrl ? (
                <div className="border-b border-border/40 px-3 pt-3">
                  <ContactUsChatImageUpload
                    messageId={messageId}
                    accessToken={accessToken}
                    value={replyImageUrl}
                    onChange={setReplyImageUrl}
                    disabled={isPendingReply}
                  />
                </div>
              ) : null}
              <Textarea
                placeholder="Type your message…"
                rows={2}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                disabled={isPendingReply}
                className="max-h-28 min-h-[72px] resize-none border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 bg-muted/15 px-3 py-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  {!replyImageUrl ? (
                    <ContactUsChatImageUpload
                      messageId={messageId}
                      accessToken={accessToken}
                      value={replyImageUrl}
                      onChange={setReplyImageUrl}
                      disabled={isPendingReply}
                    />
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Image attached</p>
                  )}
                </div>
                <Button
                  type="submit"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={isPendingReply || !canSend}
                >
                  {isPendingReply ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <SendHorizonal className="h-4 w-4" aria-hidden />
                  )}
                  Send message
                </Button>
              </div>
            </div>
            {replyError ? (
              <p className="text-xs text-destructive" role="alert">
                {replyError}
              </p>
            ) : null}
          </form>
        ) : isArchived ? (
          <p className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground">
            This issue has been marked as resolved. New messages are not accepted unless support reopens the
            conversation.
          </p>
        ) : null}
        {stickyFooterExtra}
      </div>
    </div>
  );
}
