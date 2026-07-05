"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, LayoutGrid, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TeamAdminWorkspaceDeckCardTotals,
  type TeamAdminWorkspaceDeckCardTotalsRow,
} from "@/components/team-admin-workspace-deck-card-totals";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import {
  limitsForPlan,
  workspaceCardsCapacityForPlan,
} from "@/lib/team-plans";
import { cn } from "@/lib/utils";

type TeamAdminWorkspaceStatsPanelProps = {
  teamDecksWithCardCounts: ReadonlyArray<TeamAdminWorkspaceDeckCardTotalsRow>;
  planSlug: string;
  className?: string;
  /** When false, only decks and cards are shown (e.g. deck manager). */
  showWorkspacesAndMembers?: boolean;
  workspacesCount?: number;
  maxWorkspaces?: number;
  memberCount?: number;
  maxMembersPerTeam?: number;
  defaultOpen?: boolean;
};

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "bigint") return Number(v);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function TeamAdminWorkspaceStatsPanel({
  workspacesCount = 0,
  maxWorkspaces = 0,
  memberCount = 0,
  maxMembersPerTeam = 0,
  teamDecksWithCardCounts,
  planSlug,
  className,
  showWorkspacesAndMembers = true,
  defaultOpen = false,
}: TeamAdminWorkspaceStatsPanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  const limits = limitsForPlan(planSlug);
  const deckCount = teamDecksWithCardCounts.length;
  const cardCount = teamDecksWithCardCounts.reduce((sum, d) => sum + toNumber(d.cardCount), 0);
  const cardsCapacity = workspaceCardsCapacityForPlan(planSlug);

  const collapsedSummary = showWorkspacesAndMembers
    ? `${workspacesCount} / ${maxWorkspaces} workspaces · ${memberCount} / ${maxMembersPerTeam} members · ${deckCount}${limits.maxDecksPerWorkspace > 0 ? ` / ${limits.maxDecksPerWorkspace}` : ""} decks · ${cardCount}${cardsCapacity > 0 ? ` / ${cardsCapacity}` : ""} cards`
    : `${deckCount}${limits.maxDecksPerWorkspace > 0 ? ` / ${limits.maxDecksPerWorkspace}` : ""} decks · ${cardCount}${cardsCapacity > 0 ? ` / ${cardsCapacity}` : ""} cards`;

  return (
    <Card className={cn(teamAdminCardClass, className)}>
      <CardHeader className="space-y-0 p-0">
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-between gap-3 rounded-xl px-4 py-3 text-left sm:px-5 sm:py-4"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
        >
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Workspace overview
            </CardTitle>
            {!open ? (
              <p className="text-xs text-muted-foreground">{collapsedSummary}</p>
            ) : null}
          </div>
          {open ? (
            <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
        </Button>
      </CardHeader>

      {open ? (
        <CardContent className="border-t border-border/60 px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          <div
            className={cn(
              "grid gap-4",
              showWorkspacesAndMembers ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2",
            )}
          >
            {showWorkspacesAndMembers ? (
              <>
                <Card className="border-border/80 bg-card/60 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Workspaces
                      </CardTitle>
                      <LayoutGrid className="size-4 text-muted-foreground" aria-hidden />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight">
                      {workspacesCount}
                      <span className="text-base font-normal text-muted-foreground">
                        {" "}
                        / {maxWorkspaces}
                      </span>
                    </p>
                    <CardDescription className="mt-1 text-xs sm:text-sm">
                      Active subscriber-owned workspaces
                    </CardDescription>
                  </CardContent>
                </Card>
                <Card className="border-border/80 bg-card/60 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        Members
                      </CardTitle>
                      <Users className="size-4 text-muted-foreground" aria-hidden />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-semibold tabular-nums tracking-tight">
                      {memberCount}
                      <span className="text-base font-normal text-muted-foreground">
                        {" "}
                        / {maxMembersPerTeam}
                      </span>
                    </p>
                    <CardDescription className="mt-1 text-xs sm:text-sm">
                      Members in this workspace
                    </CardDescription>
                  </CardContent>
                </Card>
              </>
            ) : null}
            <TeamAdminWorkspaceDeckCardTotals
              teamDecksWithCardCounts={teamDecksWithCardCounts}
              planSlug={planSlug}
            />
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
