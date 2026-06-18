"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  SerializedTicketMessage,
  SupportTicketThreadTicket,
} from "@/lib/support-ticket-dto";

export const SUPPORT_TICKET_THREAD_POLL_MS = 5000;

export type SupportTicketThreadData = {
  ticket: SupportTicketThreadTicket;
  messages: SerializedTicketMessage[];
};

/** Polls an open support ticket thread so new replies appear without a full page refresh. */
export function useSupportTicketThreadPoll({
  ticketId,
  enabled,
  fetchThread,
  onThread,
  pollMs = SUPPORT_TICKET_THREAD_POLL_MS,
}: {
  ticketId: number;
  enabled: boolean;
  fetchThread: () => Promise<SupportTicketThreadData>;
  onThread: (data: SupportTicketThreadData) => void;
  pollMs?: number;
}) {
  const onThreadRef = useRef(onThread);
  onThreadRef.current = onThread;

  const refreshThread = useCallback(async () => {
    if (document.visibilityState === "hidden") return;
    try {
      const next = await fetchThread();
      onThreadRef.current(next);
    } catch {
      // Keep last good thread on transient poll failures.
    }
  }, [fetchThread]);

  useEffect(() => {
    if (!enabled) return;

    const timer = window.setInterval(() => {
      void refreshThread();
    }, pollMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshThread();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, ticketId, pollMs, refreshThread]);
}
