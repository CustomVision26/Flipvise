"use client";

import { useEffect, useState } from "react";
import { clampBackgroundChangeHours } from "@/lib/illustrated-appearance";

const LOCAL_ROTATION_START_KEY = "flipvise-background-rotation-started";

/** Server start time when it exists. Otherwise the first time this browser saw the schedule. */
export function useEffectiveRotationStart(
  serverStartedAt: string | null,
  enabled: boolean,
): string | null {
  const [localStartedAt, setLocalStartedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || serverStartedAt) return;
    try {
      const existing = window.localStorage.getItem(LOCAL_ROTATION_START_KEY);
      if (existing && Number.isFinite(Date.parse(existing))) {
        setLocalStartedAt(new Date(existing).toISOString());
        return;
      }
      const now = new Date().toISOString();
      window.localStorage.setItem(LOCAL_ROTATION_START_KEY, now);
      setLocalStartedAt(now);
    } catch {
      setLocalStartedAt(new Date().toISOString());
    }
  }, [enabled, serverStartedAt]);

  return serverStartedAt ?? (enabled ? localStartedAt : null);
}

/**
 * Wall clock that wakes when the saved background interval elapses.
 * Null until after mount so server and client render the same first scene.
 */
export function useBackgroundRotationNow(
  enabled: boolean,
  hours: number,
  startedAt: string | null,
): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    const arm = () => {
      if (cancelled) return;
      setNow(Date.now());
      if (!enabled || !startedAt) return;
      const start = Date.parse(startedAt);
      const interval = clampBackgroundChangeHours(hours) * 60 * 60 * 1000;
      let delay = interval;
      if (Number.isFinite(start)) {
        const elapsed = Date.now() - start;
        const into = ((elapsed % interval) + interval) % interval;
        delay = Math.max(60_000, interval - into);
      }
      timer = window.setTimeout(arm, delay);
    };

    arm();
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, hours, startedAt]);

  return now;
}
