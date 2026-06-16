"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { ContactUsThreadView } from "@/components/contact-us-thread-view";
import type { ContactUsThread } from "@/lib/contact-us-thread-dto";

type ContactUsThreadClientProps = {
  messageId: number;
  accessToken?: string;
  viewerRole: "admin" | "user";
  initialThread: ContactUsThread;
  fetchThread: () => Promise<ContactUsThread>;
  sendReply: (message: string) => Promise<ContactUsThread>;
  pollMs?: number;
};

export function ContactUsThreadClient({
  messageId,
  accessToken,
  viewerRole,
  initialThread,
  fetchThread,
  sendReply,
  pollMs = 5000,
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

  async function handleSendReply(message: string) {
    const next = await sendReply(message);
    setThread(next);
  }

  return (
    <div className="relative">
      {isRefreshing ? (
        <div className="absolute right-0 top-0 z-10 flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" aria-hidden />
          Updating…
        </div>
      ) : null}
      <ContactUsThreadView
        thread={thread}
        viewerRole={viewerRole}
        onSendReply={handleSendReply}
        disabled={thread.status === "archived"}
      />
    </div>
  );
}
