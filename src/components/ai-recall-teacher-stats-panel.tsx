import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TeacherAiRecallDashboardStats } from "@/db/queries/ai-recall";
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

export function AiRecallTeacherStatsPanel({
  stats,
  className,
}: {
  stats: TeacherAiRecallDashboardStats;
  className?: string;
}) {
  return (
    <Card className={cn(teamAdminCardClass, className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">AI Recall™ insights</CardTitle>
        <CardDescription>
          Active Recall session analytics for your students and classes.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Average AI Recall Score"
          value={stats.averageAiScore != null ? `${stats.averageAiScore}%` : "—"}
        />
        <Metric
          label="Average Recall Time"
          value={formatMs(stats.averageRecallTimeMs)}
        />
        <Metric label="Forced Unlock Count" value={String(stats.forcedUnlockCount)} />
        <Metric label="Sessions" value={String(stats.sessionCount)} />
        <div className="sm:col-span-2">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Lowest performing decks
          </p>
          {stats.lowestPerformingDecks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scored sessions yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {stats.lowestPerformingDecks.map((d) => (
                <li key={d.deckName} className="flex justify-between gap-2">
                  <span className="truncate">{d.deckName}</span>
                  <span className="shrink-0 text-muted-foreground">{d.averageScore}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="sm:col-span-2">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Highest performing decks
          </p>
          {stats.highestPerformingDecks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scored sessions yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {stats.highestPerformingDecks.map((d) => (
                <li key={d.deckName} className="flex justify-between gap-2">
                  <span className="truncate">{d.deckName}</span>
                  <span className="shrink-0 text-muted-foreground">{d.averageScore}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
