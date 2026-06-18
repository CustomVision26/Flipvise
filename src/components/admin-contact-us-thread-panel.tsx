"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  adminReplyToContactUsAction,
  getAdminContactUsThreadAction,
} from "@/actions/contact-us";
import { ContactUsThreadClient } from "@/components/contact-us-thread-client";
import type { ContactUsThread } from "@/lib/contact-us-thread-dto";

export function AdminContactUsThreadPanel({
  messageId,
  stickyFooterExtra,
}: {
  messageId: number;
  stickyFooterExtra?: ReactNode;
}) {
  const [initialThread, setInitialThread] = useState<ContactUsThread | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    setInitialThread(null);
    getAdminContactUsThreadAction({ messageId })
      .then((thread) => {
        if (!cancelled) setInitialThread(thread);
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load conversation");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [messageId]);

  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>;
  }

  if (!initialThread) {
    return (
      <div className="flex min-h-[200px] flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <ContactUsThreadClient
      messageId={messageId}
      viewerRole="admin"
      initialThread={initialThread}
      fetchThread={() => getAdminContactUsThreadAction({ messageId })}
      sendReply={async (payload) => {
        const result = await adminReplyToContactUsAction({
          messageId,
          message: payload.message,
          imageUrl: payload.imageUrl,
        });
        return result.thread;
      }}
      stickyFooterExtra={stickyFooterExtra}
    />
    </div>
  );
}
