"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getLiveClassroomRealtimeStateAction } from "@/actions/live-classroom";

export type LiveClassroomRealtimeState = Awaited<
  ReturnType<typeof getLiveClassroomRealtimeStateAction>
>;

const DEFAULT_INTERVAL_MS = 2000;

export function useLiveClassroomRealtime(sessionId: number, intervalMs = DEFAULT_INTERVAL_MS) {
  const [state, setState] = useState<LiveClassroomRealtimeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;

    async function tick() {
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
      }
    }

    void tick();
    const id = window.setInterval(() => {
      startTransition(() => {
        void tick();
      });
    }, intervalMs);

    return () => {
      cancelled = true;
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [sessionId, intervalMs]);

  return { state, error, isPending, setState };
}
