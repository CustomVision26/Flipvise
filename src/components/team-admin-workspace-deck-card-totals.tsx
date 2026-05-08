import { Layers, SquareStack } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  isTeamPlanId,
  limitsForPlan,
  workspaceCardsCapacityForPlan,
} from "@/lib/team-plans";

function toNumber(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "bigint") return Number(v);
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export type TeamAdminWorkspaceDeckCardTotalsRow = {
  cardCount?: unknown;
};

/**
 * Deck count and total flashcard count for the current subscriber workspace (same scope as
 * getDecksForTeamWithCardCount in db/queries/teams).
 */
export function TeamAdminWorkspaceDeckCardTotals({
  teamDecksWithCardCounts,
  planSlug,
}: {
  teamDecksWithCardCounts: ReadonlyArray<TeamAdminWorkspaceDeckCardTotalsRow>;
  planSlug: string;
}) {
  const limits = isTeamPlanId(planSlug)
    ? limitsForPlan(planSlug)
    : { maxDecksPerWorkspace: 0 };

  const workspaceCardRecordCount = teamDecksWithCardCounts.reduce(
    (sum, d) => sum + toNumber(d.cardCount),
    0,
  );
  const workspaceCardsCapacity = workspaceCardsCapacityForPlan(planSlug);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Decks
            </CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            {teamDecksWithCardCounts.length}
            {limits.maxDecksPerWorkspace > 0 ? (
              <span className="text-lg font-normal text-muted-foreground">
                {" "}
                / {limits.maxDecksPerWorkspace}
              </span>
            ) : null}
          </p>
          <CardDescription className="mt-0.5">Flashcard decks in this workspace</CardDescription>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Cards
            </CardTitle>
            <SquareStack className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">
            {workspaceCardRecordCount}
            {workspaceCardsCapacity > 0 ? (
              <span className="text-lg font-normal text-muted-foreground">
                {" "}
                / {workspaceCardsCapacity}
              </span>
            ) : null}
          </p>
          <CardDescription className="mt-0.5">Flashcard records in this workspace</CardDescription>
        </CardContent>
      </Card>
    </>
  );
}
