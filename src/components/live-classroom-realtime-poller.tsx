"use client";

import { useEffect, useRef, useState } from "react";
import { getLiveClassroomRealtimeStateAction } from "@/actions/live-classroom";

export type LiveClassroomRealtimeState = Awaited<
  ReturnType<typeof getLiveClassroomRealtimeStateAction>
>;

/** Lobby polls were 2s and each call was multi-second — that starved page navigations. */
const DEFAULT_INTERVAL_MS = 5000;

export function useLiveClassroomRealtime(
  sessionId: number,
  intervalMs = DEFAULT_INTERVAL_MS,
  enabled = true,
) {
  const [state, setState] = useState<LiveClassroomRealtimeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const mounted = useRef(true);
  const inFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    if (!enabled) {
      return () => {
        mounted.current = false;
      };
    }

    let cancelled = false;

    async function tick() {
      if (inFlight.current) return;
      inFlight.current = true;
      if (mounted.current) setIsPending(true);
      try {
        const next = await getLiveClassroomRealtimeStateAction(sessionId);
        if (!cancelled && mounted.current) {
          setState(next);
          setError(null);
        }
      } catch (e) {
        if (!cancelled && mounted.current) {
          setError(e instanceof Error ? e.message : "Failed to refresh");
        }
      } finally {
        inFlight.current = false;
        if (!cancelled && mounted.current) setIsPending(false);
      }
    }

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, intervalMs);

    return () => {
      cancelled = true;
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [sessionId, intervalMs, enabled]);

  return { state, error, isPending, setState };
}
