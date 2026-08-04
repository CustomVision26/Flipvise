import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  BookOpen,
  BrainCircuit,
  Clock3,
  Layers,
  Target,
  Trophy,
  TrendingDown,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TeamAiRecallDashboardStats } from "@/db/queries/ai-recall";
import { teamAdminCardClass } from "@/components/team-admin-panel-styles";
import { cn } from "@/lib/utils";

function formatMs(ms: number | null): string {
  if (ms == null || ms <= 0) return "—";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const rem = sec % 60;
  return rem ? `${min}m ${rem}s` : `${min}m`;
}

function formatPercent(value: number | null): string {
  return value != null ? `${value}%` : "—";
}

export function AiRecallTeamStatsPanel({
  stats,
  workspaceName,
  className,
}: {
  stats: TeamAiRecallDashboardStats;
  workspaceName?: string;
  className?: string;
}) {
  const hasData = stats.sessionCount > 0;

  return (
    <div className={cn("space-y-6", className)}>
      <Card className={cn(teamAdminCardClass)}>
        <CardHeader className="space-y-3 border-b border-border/50 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-muted/30">
                <BrainCircuit
                  className="size-5 text-muted-foreground"
                  aria-hidden
                />
              </span>
              <div className="min-w-0 space-y-1">
                <CardTitle className="text-lg font-semibold tracking-tight">
                  Team AI Recall™
                </CardTitle>
                <CardDescription className="max-w-2xl leading-relaxed">
                  Workspace analytics for Active Recall study sessions
                  {workspaceName ? (
                    <>
                      {" "}
                      in <span className="text-foreground/90">{workspaceName}</span>
                    </>
                  ) : null}
                  . Metrics update when members save a completed AI Recall™
                  session.
                </CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              {stats.sessionCount.toLocaleString()}{" "}
              {stats.sessionCount === 1 ? "saved session" : "saved sessions"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Use this page to monitor how well the organization retains material
            under Active Recall, identify cards and decks that need reteaching,
            and recognize strong performers.
          </p>
        </CardContent>
      </Card>

      {!hasData ? (
        <Alert>
          <AlertCircle className="size-4" aria-hidden />
          <AlertTitle>No saved AI Recall™ sessions yet</AlertTitle>
          <AlertDescription className="leading-relaxed">
            When members complete and save an AI Recall™ session on an assigned
            deck, summary accuracy, session length, missed items, and learner
            rankings will appear here. On-screen results that are not saved are
            not included.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-3" aria-labelledby="active-recall-kpis">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Performance overview
          </p>
          <h2
            id="active-recall-kpis"
            className="text-base font-semibold tracking-tight text-foreground"
          >
            Key indicators
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <KpiCard
            label="Team recall accuracy"
            value={formatPercent(stats.teamRecallAccuracy)}
            description="Correct answers ÷ cards reviewed across saved sessions."
            icon={Target}
          />
          <KpiCard
            label="Average AI score"
            value={formatPercent(stats.averageAiScore)}
            description="Mean AI evaluation score from saved sessions with a score."
            icon={BrainCircuit}
          />
          <KpiCard
            label="Average session time"
            value={formatMs(stats.averageSessionTimeMs)}
            description="Typical duration of a saved Active Recall session."
            icon={Clock3}
          />
        </div>
      </section>

      <Separator className="bg-border/60" />

      <section className="space-y-3" aria-labelledby="active-recall-insights">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Instructional insights
          </p>
          <h2
            id="active-recall-insights"
            className="text-base font-semibold tracking-tight text-foreground"
          >
            Where to focus next
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Missed items and weaker subjects help prioritize review. Top learners
            highlight members with the strongest saved-session scores.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <InsightTableCard
            title="Most missed cards"
            description="Cards answered incorrectly or force-unlocked most often."
            icon={BookOpen}
            empty="No missed cards recorded in saved sessions."
            columns={["Card prompt", "Misses"]}
            rows={stats.mostMissedCards.map((c) => [
              c.question,
              String(c.misses),
            ])}
          />
          <InsightTableCard
            title="Most missed decks"
            description="Decks with the highest combined incorrect and forced-unlock counts."
            icon={Layers}
            empty="No missed decks recorded in saved sessions."
            columns={["Deck", "Misses"]}
            rows={stats.mostMissedDecks.map((d) => [
              d.deckName,
              String(d.misses),
            ])}
          />
          <InsightTableCard
            title="Top learners"
            description="Members ranked by average AI score across their saved sessions."
            icon={Trophy}
            empty="No learner scores available yet."
            columns={["Member", "Avg. score", "Sessions"]}
            rows={stats.topLearners.map((l) => [
              l.userId,
              `${l.averageScore}%`,
              String(l.sessions),
            ])}
          />
          <InsightTableCard
            title="Weakest subjects"
            description="Decks with the lowest average AI scores among frequently missed material."
            icon={TrendingDown}
            empty="No subject performance data yet."
            columns={["Deck", "Avg. score"]}
            rows={stats.weakestSubjects.map((s) => [
              s.deckName,
              `${s.averageScore}%`,
            ])}
          />
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  description,
  icon: Icon,
}: {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Card className={cn(teamAdminCardClass)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium leading-snug text-muted-foreground sm:text-sm">
          {label}
        </CardTitle>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/30">
          <Icon className="size-3.5 text-muted-foreground" aria-hidden />
        </span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
          {value}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </CardContent>
    </Card>
  );
}

function InsightTableCard({
  title,
  description,
  icon: Icon,
  empty,
  columns,
  rows,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  empty: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <Card className={cn(teamAdminCardClass)}>
      <CardHeader className="space-y-1.5 border-b border-border/40 pb-4">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-border/50 bg-muted/25">
            <Icon className="size-3.5 text-muted-foreground" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-sm font-semibold tracking-tight">
              {title}
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            {empty}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {columns.map((col, index) => (
                    <TableHead
                      key={col}
                      className={cn(
                        "h-9 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                        index === 0 ? "pl-5" : null,
                        index === columns.length - 1 ? "pr-5 text-right" : null,
                      )}
                    >
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 8).map((row, rowIndex) => (
                  <TableRow key={`${title}-${row[0]}-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <TableCell
                        key={`${title}-${rowIndex}-${cellIndex}`}
                        className={cn(
                          "py-2.5 text-sm",
                          cellIndex === 0
                            ? "max-w-[14rem] truncate pl-5 font-medium text-foreground sm:max-w-xs"
                            : "text-muted-foreground tabular-nums",
                          cellIndex === row.length - 1 ? "pr-5 text-right" : null,
                        )}
                        title={cellIndex === 0 ? cell : undefined}
                      >
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
