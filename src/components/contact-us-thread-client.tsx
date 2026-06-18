"use client";

import { useCallback, useEffect, useState, useTransition, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { ContactUsThreadView } from "@/components/contact-us-thread-view";
import { pingContactUsGuestChatActiveAction } from "@/actions/contact-us";
import type { ContactUsThread } from "@/lib/contact-us-thread-dto";

type ContactUsThreadClientProps = {
  messageId: number;
  accessToken?: string;
  viewerRole: "admin" | "user";
  initialThread: ContactUsThread;
  fetchThread: () => Promise<ContactUsThread>;
  sendReply: (payload: { message: string; imageUrl?: string | null }) => Promise<ContactUsThread>;
  pollMs?: number;
  stickyFooterExtra?: ReactNode;
};

export function ContactUsThreadClient({
  messageId,
  accessToken,
  viewerRole,
  initialThread,
  fetchThread,
  sendReply,
  pollMs = 5000,
  stickyFooterExtra,
}: ContactUsThreadClientProps) {
  const [thread, setThread] = useState(initialThread);
  const [isRefreshing, startRefresh] = useTransition();

  const refreshThread = useCallback(() => {
    startRefresh(async () => {
      try {
        const next = await fetchThread();
        setThread(next);
      } catch {
        // Keep last good thread on transient poll failures.
      }
    });
  }, [fetchThread]);

  useEffect(() => {
    setThread(initialThread);
  }, [initialThread]);

  useEffect(() => {
    const timer = window.setInterval(refreshThread, pollMs);
    return () => window.clearInterval(timer);
  }, [messageId, accessToken, pollMs, refreshThread]);

  useEffect(() => {
    if (viewerRole !== "user" || thread.status === "archived") return;

    let cancelled = false;

    const pingPresence = () => {
      if (cancelled || document.visibilityState === "hidden") return;
      void pingContactUsGuestChatActiveAction({ messageId, token: accessToken });
    };

    pingPresence();
    const timer = window.setInterval(pingPresence, 20_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") pingPresence();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [viewerRole, messageId, accessToken, thread.status]);

  async function handleSendReply(payload: { message: string; imageUrl?: string | null }) {
    const next = await sendReply(payload);
    setThread(next);
  }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {isRefreshing ? (
        <div className="absolute right-0 top-0 z-10 flex items-center gap-1 rounded-full border border-border/50 bg-background/90 px-2 py-0.5 text-[11px] text-muted-foreground shadow-sm">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          Updating…
        </div>
      ) : null}
      <ContactUsThreadView
        thread={thread}
        messageId={messageId}
        accessToken={accessToken}
        viewerRole={viewerRole}
        onSendReply={handleSendReply}
        disabled={thread.status === "archived"}
        showMeta={viewerRole !== "admin"}
        stickyFooterExtra={stickyFooterExtra}
      />
    </div>
  );
}
