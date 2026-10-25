"use client";

import type { ReactNode } from "react";
import { Building2, Layers, SquareStack, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { TeamAdminWorkspaceDeckCardTotalsRow } from "@/components/team-admin-workspace-deck-card-totals";
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

function usagePercent(used: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

function MetricTile({
  label,
  icon,
  iconClass,
  used,
  max,
}: {
  label: string;
  icon: ReactNode;
  iconClass: string;
  used: number;
  max: number;
}) {
  const percent = usagePercent(used, max);
  return (
    <div className="team-admin-metric rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <span className={cn("flex size-10 items-center justify-center rounded-xl", iconClass)}>
          {icon}
        </span>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
        {used}
        {max > 0 ? (
          <span className="text-base font-medium text-slate-400"> / {max}</span>
        ) : null}
      </p>
      <Progress value={percent} className="mt-3" />
      <p className="mt-1.5 text-xs font-medium text-slate-500">{percent}%</p>
    </div>
  );
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
}: TeamAdminWorkspaceStatsPanelProps) {
  const limits = limitsForPlan(planSlug);
  const deckCount = teamDecksWithCardCounts.length;
  const cardCount = teamDecksWithCardCounts.reduce((sum, d) => sum + toNumber(d.cardCount), 0);
  const cardsCapacity = workspaceCardsCapacityForPlan(planSlug);

  return (
    <Card className={cn(teamAdminCardClass, className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          Workspace overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "grid gap-3",
            showWorkspacesAndMembers ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2",
          )}
        >
          {showWorkspacesAndMembers ? (
            <>
              <MetricTile
                label="Workspaces"
                icon={<Building2 className="size-5" aria-hidden />}
                iconClass="bg-violet-100 text-violet-600"
                used={workspacesCount}
                max={maxWorkspaces}
              />
              <MetricTile
                label="Members"
                icon={<Users className="size-5" aria-hidden />}
                iconClass="bg-sky-100 text-sky-600"
                used={memberCount}
                max={maxMembersPerTeam}
              />
            </>
          ) : null}
          <MetricTile
            label="Decks"
            icon={<Layers className="size-5" aria-hidden />}
            iconClass="bg-violet-100 text-violet-600"
            used={deckCount}
            max={limits.maxDecksPerWorkspace}
          />
          <MetricTile
            label="Cards"
            icon={<SquareStack className="size-5" aria-hidden />}
            iconClass="bg-amber-100 text-amber-600"
            used={cardCount}
            max={cardsCapacity}
          />
        </div>
      </CardContent>
    </Card>
  );
}
