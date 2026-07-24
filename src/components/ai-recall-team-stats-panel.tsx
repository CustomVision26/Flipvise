import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function AiRecallTeamStatsPanel({
  stats,
  className,
}: {
  stats: TeamAiRecallDashboardStats;
  className?: string;
}) {
  return (
    <Card className={cn(teamAdminCardClass, className)}>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Team AI Recall™</CardTitle>
        <CardDescription>
          Organization-wide Active Recall accuracy, missed cards, and top learners.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Team Recall Accuracy"
          value={
            stats.teamRecallAccuracy != null ? `${stats.teamRecallAccuracy}%` : "—"
          }
        />
        <Metric
          label="Average AI Score"
          value={stats.averageAiScore != null ? `${stats.averageAiScore}%` : "—"}
        />
        <Metric
          label="Average Session Time"
          value={formatMs(stats.averageSessionTimeMs)}
        />

        <ListBlock
          title="Most missed cards"
          empty="No misses recorded yet."
          items={stats.mostMissedCards.map((c) => ({
            label: c.question,
            value: String(c.misses),
          }))}
        />
        <ListBlock
          title="Most missed decks"
          empty="No misses recorded yet."
          items={stats.mostMissedDecks.map((d) => ({
            label: d.deckName,
            value: String(d.misses),
          }))}
        />
        <ListBlock
          title="Top learners"
          empty="No learner scores yet."
          items={stats.topLearners.map((l) => ({
            label: l.userId,
            value: `${l.averageScore}% · ${l.sessions} sess.`,
          }))}
        />
        <ListBlock
          title="Weakest subjects"
          empty="No subject data yet."
          className="sm:col-span-2 lg:col-span-3"
          items={stats.weakestSubjects.map((s) => ({
            label: s.deckName,
            value: `${s.averageScore}%`,
          }))}
        />
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

function ListBlock({
  title,
  empty,
  items,
  className,
}: {
  title: string;
  empty: string;
  items: { label: string; value: string }[];
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.slice(0, 6).map((item) => (
            <li key={`${title}-${item.label}`} className="flex justify-between gap-2">
              <span className="truncate" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 text-muted-foreground">{item.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
