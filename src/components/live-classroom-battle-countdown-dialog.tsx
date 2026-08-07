"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { liveClassroomTeamTone } from "@/lib/live-classroom-types";
import { liveClassroomDeckStudyPath } from "@/lib/live-classroom-url";
import { cn } from "@/lib/utils";

export type LiveClassroomCountdownMatchupTeam = {
  name: string;
  colorKey: string;
};

type LiveClassroomBattleCountdownDialogProps = {
  open: boolean;
  battleStartsAt: string | null;
  onComplete: () => void;
  onCancel?: () => void;
  deckId?: number | null;
  deckName?: string | null;
  /** Workspace team id — used for deck study deep links. */
  teamId?: number | null;
  /** Player's battle team name (e.g. "Blue Team"). */
  liveTeamName?: string | null;
  /** Player's battle team color key (blue | red | green | yellow). */
  liveTeamColorKey?: string | null;
  /**
   * Owner / team admin matchup — teams entering the battle.
   * Shown as "Blue Team VS Red Team".
   */
  matchupTeams?: LiveClassroomCountdownMatchupTeam[] | null;
  title?: string;
  description?: string;
};

export function LiveClassroomBattleCountdownDialog({
  open,
  battleStartsAt,
  onComplete,
  onCancel,
  deckId = null,
  deckName = null,
  teamId = null,
  liveTeamName = null,
  liveTeamColorKey = null,
  matchupTeams = null,
  title = "Battle starting soon",
  description = "Get ready — the battle begins when the timer hits zero.",
}: LiveClassroomBattleCountdownDialogProps) {
  const [remainingSec, setRemainingSec] = useState(0);
  const completedForRef = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const showMatchup = Boolean(matchupTeams && matchupTeams.length > 0);
  const tone = !showMatchup && liveTeamColorKey
    ? liveClassroomTeamTone(liveTeamColorKey)
    : null;

  useEffect(() => {
    if (!open || !battleStartsAt) {
      setRemainingSec(0);
      completedForRef.current = null;
      return;
    }

    function tick() {
      const starts = new Date(battleStartsAt!).getTime();
      const left = Math.max(0, Math.ceil((starts - Date.now()) / 1000));
      setRemainingSec(left);
      if (left <= 0 && completedForRef.current !== battleStartsAt) {
        completedForRef.current = battleStartsAt;
        onCompleteRef.current();
      }
    }

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [open, battleStartsAt]);

  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  const display =
    mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}`;

  const deckHref =
    deckId != null ? liveClassroomDeckStudyPath(deckId, teamId) : null;

  return (
    <Dialog open={open} disablePointerDismissal onOpenChange={() => undefined}>
      <DialogContent
        className={cn("sm:max-w-md", tone?.surface)}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-6">
          {showMatchup ? (
            <div
              className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 text-center"
              aria-label="Teams entering battle"
            >
              {matchupTeams!.map((team, index) => {
                const teamTone = liveClassroomTeamTone(team.colorKey);
                return (
                  <span key={`${team.name}-${index}`} className="inline-flex items-center gap-2">
                    {index > 0 ? (
                      <span className="text-xs font-bold tracking-[0.2em] text-muted-foreground">
                        VS
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "text-base font-semibold tracking-tight sm:text-lg",
                        teamTone.accent,
                      )}
                    >
                      {team.name}
                    </span>
                  </span>
                );
              })}
            </div>
          ) : liveTeamName ? (
            <p className="text-center text-sm text-muted-foreground">
              Your team:{" "}
              <span
                className={cn(
                  "font-semibold tracking-tight",
                  tone?.accent ?? "text-foreground",
                )}
              >
                {liveTeamName}
              </span>
            </p>
          ) : null}
          {deckHref && deckName ? (
            <p className="text-center text-sm text-muted-foreground">
              Deck:{" "}
              <a
                href={deckHref}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
              >
                {deckName}
              </a>
            </p>
          ) : deckName ? (
            <p className="text-center text-sm text-muted-foreground">
              Deck:{" "}
              <span className="font-medium text-foreground">{deckName}</span>
            </p>
          ) : null}
          {remainingSec > 0 ? (
            <p
              className={cn(
                "font-mono text-5xl font-semibold tabular-nums tracking-tight",
                tone?.accent ?? "text-foreground",
              )}
            >
              {display}
            </p>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Starting battle…
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {remainingSec > 0
              ? "Stay on this page — the battle opens automatically."
              : "Opening battle now."}
          </p>
          {onCancel ? (
            <Button type="button" variant="outline" size="sm" onClick={onCancel}>
              {remainingSec > 0 ? "Cancel countdown" : "Cancel"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
