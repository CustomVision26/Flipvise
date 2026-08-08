"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** True when there is no schedule, or the scheduled start time has passed. */
export function useLiveClassroomScheduleReady(
  scheduledFor: string | null | undefined,
): boolean {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!scheduledFor) return;
    const target = new Date(scheduledFor).getTime();
    if (!Number.isFinite(target) || target <= Date.now()) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [scheduledFor]);

  if (!scheduledFor) return true;
  const target = new Date(scheduledFor).getTime();
  if (!Number.isFinite(target)) return true;
  return now >= target;
}

/** Live countdown to a scheduled Live Classroom session start. */
export function LiveClassroomScheduledCountdown({
  scheduledFor,
  showDate = false,
}: {
  scheduledFor: string;
  /** When true, also show the absolute local date/time. */
  showDate?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const targetDate = new Date(scheduledFor);
  const target = targetDate.getTime();
  if (!Number.isFinite(target)) return null;

  const remaining = target - now;
  const dateLabel = targetDate.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  if (remaining <= 0) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {showDate ? (
          <span className="text-sm text-muted-foreground">{dateLabel}</span>
        ) : null}
        <Badge variant="secondary" className="tabular-nums">
          Starts now
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showDate ? (
        <span className="text-sm text-muted-foreground">
          Scheduled {dateLabel}
        </span>
      ) : null}
      <Badge variant="outline" className="gap-1 font-mono tabular-nums">
        Starts in {formatCountdown(remaining)}
      </Badge>
    </div>
  );
}
