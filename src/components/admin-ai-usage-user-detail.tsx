"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import {
  clearAiUsageFlagAction,
  clearAiUsageUserAllowanceAction,
  resetAiUsageCounterAction,
  setAiAccessEnabledAction,
  setAiUsageUserAllowanceAction,
  setAiUsageWarningThresholdsAction,
} from "@/actions/ai-usage-admin";
import { AdminUserIdentityBlock } from "@/components/admin-user-identity-block";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  adminSupportChartCardClass,
  adminSupportEmptyStateClass,
  adminSupportKpiCardClass,
  adminSupportKpiGridClass,
  adminSupportSectionLabelClass,
} from "@/components/admin-panel-styles";
import { formatMicrosAsUsd } from "@/lib/ai-usage/pricing";
import { cn } from "@/lib/utils";

export type AdminAiUsageUserDetailProps = {
  timezone: string;
  user: { userId: string; name: string; email: string | null };
  planLabel: string;
  teamLabel: string;
  range: { start: string; end: string; preset: string };
  context: {
    allowance:
      | { kind: "limited"; generations: number }
      | { kind: "unlimited" };
    source: string;
    aiAccessEnabled: boolean;
    blockAtLimit: boolean;
    allowOverage: boolean;
    subscriptionPlan: string | null;
    teamId: number | null;
    periodStart: string;
    periodEnd: string;
    flagged: boolean;
    flagReason: string | null;
    snapshot: {
      usedGenerations: number;
      remainingGenerations: number | null;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      estimatedCostMicros: number;
      percentUsed: number | null;
      usageStatus: string;
    };
    userLimit: {
      monthlyAllowance: number | null;
      unlimited: boolean;
      aiAccessEnabled: boolean;
      warningThreshold80: boolean;
      warningThreshold90: boolean;
      warningThreshold100: boolean;
      flagged: boolean;
      flagReason: string | null;
      notes: string | null;
    } | null;
  };
  daily: Array<{
    day: string;
    generations: number;
    totalTokens: number;
    estimatedCostMicros: number;
  }>;
  byFeature: Array<{
    feature: string;
    generations: number;
    failed: number;
    totalTokens: number;
    estimatedCostMicros: number;
  }>;
  byModel: Array<{
    model: string;
    generations: number;
    totalTokens: number;
    estimatedCostMicros: number;
  }>;
  outcomes: {
    successful: number;
    failed: number;
    blocked: number;
    timedOut: number;
  };
  recent: Array<{
    id: number;
    feature: string;
    model: string;
    status: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostMicros: number;
    responseTimeMs: number | null;
    errorCode: string | null;
    errorCategory: string | null;
    createdAt: string;
  }>;
};

type ConfirmKind =
  | "disable"
  | "restore"
  | "reset"
  | "clearOverride"
  | "clearFlag"
  | null;

function formatFeature(feature: string): string {
  return feature.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function AdminAiUsageUserDetail({
  user,
  planLabel,
  teamLabel,
  context,
  daily,
  byFeature,
  byModel,
  outcomes,
  recent,
}: AdminAiUsageUserDetailProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [reason, setReason] = useState("");
  const [allowanceReason, setAllowanceReason] = useState("");

  const [unlimited, setUnlimited] = useState(
    context.userLimit?.unlimited ?? context.allowance.kind === "unlimited",
  );
  const [allowanceInput, setAllowanceInput] = useState(
    String(
      context.userLimit?.monthlyAllowance ??
        (context.allowance.kind === "limited"
          ? context.allowance.generations
          : 100),
    ),
  );
  const [warn80, setWarn80] = useState(
    context.userLimit?.warningThreshold80 ?? true,
  );
  const [warn90, setWarn90] = useState(
    context.userLimit?.warningThreshold90 ?? true,
  );
  const [warn100, setWarn100] = useState(
    context.userLimit?.warningThreshold100 ?? true,
  );

  const dailyChart = daily.map((d) => ({
    ...d,
    label: formatDay(d.day),
    costUsd: d.estimatedCostMicros / 1_000_000,
  }));

  function runAction(action: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        setConfirm(null);
        setReason("");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  const confirmCopy: Record<
    Exclude<ConfirmKind, null>,
    { title: string; description: string; requireReason: boolean }
  > = {
    disable: {
      title: "Disable AI access?",
      description:
        "This user will be blocked from AI generations until access is restored.",
      requireReason: true,
    },
    restore: {
      title: "Restore AI access?",
      description: "AI generations will be allowed again for this user.",
      requireReason: false,
    },
    reset: {
      title: "Reset usage counter?",
      description:
        "Resets the current period generation count via an adjustment. Historical events are kept.",
      requireReason: true,
    },
    clearOverride: {
      title: "Remove custom allowance override?",
      description:
        "The user will fall back to team or plan default allowance rules.",
      requireReason: true,
    },
    clearFlag: {
      title: "Clear abuse flag?",
      description: "Removes the suspicious-usage flag and reason on this account.",
      requireReason: true,
    },
  };

  async function executeConfirmed() {
    if (!confirm) return;
    const trimmed = reason.trim();
    if (confirmCopy[confirm].requireReason && !trimmed) {
      setError("A reason is required for this action.");
      return;
    }

    if (confirm === "disable") {
      runAction(() =>
        setAiAccessEnabledAction({
          userId: user.userId,
          enabled: false,
          reason: trimmed,
        }),
      );
      return;
    }
    if (confirm === "restore") {
      runAction(() =>
        setAiAccessEnabledAction({
          userId: user.userId,
          enabled: true,
          reason: trimmed || undefined,
        }),
      );
      return;
    }
    if (confirm === "reset") {
      runAction(() =>
        resetAiUsageCounterAction({
          userId: user.userId,
          reason: trimmed,
        }),
      );
      return;
    }
    if (confirm === "clearOverride") {
      runAction(() =>
        clearAiUsageUserAllowanceAction({
          userId: user.userId,
          reason: trimmed,
        }),
      );
      return;
    }
    if (confirm === "clearFlag") {
      runAction(() =>
        clearAiUsageFlagAction({
          userId: user.userId,
          reason: trimmed,
        }),
      );
    }
  }

  const hasCustomOverride =
    context.userLimit != null &&
    (context.userLimit.unlimited ||
      context.userLimit.monthlyAllowance != null);

  return (
    <div className="space-y-6">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
            <CardDescription>Clerk account and workspace context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <AdminUserIdentityBlock
              name={user.name}
              email={user.email}
              userId={user.userId}
            />
            <div className="space-y-1.5">
              <p>
                <span className="text-muted-foreground">Plan: </span>
                <span className="text-foreground">{planLabel}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Team: </span>
                <span className="text-foreground">{teamLabel}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Period: </span>
                <span className="text-foreground">
                  {new Date(context.periodStart).toLocaleString()} –{" "}
                  {new Date(context.periodEnd).toLocaleString()}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Resets: </span>
                <span className="text-foreground">
                  {new Date(context.periodEnd).toLocaleString()}
                </span>
              </p>
              <p className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">AI access:</span>
                {context.aiAccessEnabled ? (
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="destructive">Disabled</Badge>
                )}
                {context.flagged ? (
                  <Badge className="bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30">
                    Flagged
                  </Badge>
                ) : null}
              </p>
              {context.flagReason ? (
                <p className="text-xs text-muted-foreground">
                  Flag reason: {context.flagReason}
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className={cn(adminSupportKpiGridClass, "lg:col-span-2 sm:grid-cols-2 lg:grid-cols-3")}>
          <Card className={adminSupportKpiCardClass}>
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Used / allowance</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {context.snapshot.usedGenerations.toLocaleString()}
                {context.allowance.kind === "unlimited"
                  ? " / ∞"
                  : ` / ${context.allowance.generations.toLocaleString()}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 text-xs text-muted-foreground">
              Source: {context.source.replace(/_/g, " ")} · status{" "}
              {context.snapshot.usageStatus.replace(/_/g, " ")}
            </CardContent>
          </Card>
          <Card className={adminSupportKpiCardClass}>
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Remaining</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {context.snapshot.remainingGenerations == null
                  ? "Unlimited"
                  : context.snapshot.remainingGenerations.toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className={adminSupportKpiCardClass}>
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Tokens</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {context.snapshot.totalTokens.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 text-xs text-muted-foreground">
              In {context.snapshot.inputTokens.toLocaleString()} · Out{" "}
              {context.snapshot.outputTokens.toLocaleString()}
            </CardContent>
          </Card>
          <Card className={adminSupportKpiCardClass}>
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Estimated cost</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {formatMicrosAsUsd(context.snapshot.estimatedCostMicros)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className={adminSupportKpiCardClass}>
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Success / fail</CardDescription>
              <CardTitle className="text-xl tabular-nums">
                {outcomes.successful.toLocaleString()} /{" "}
                {outcomes.failed.toLocaleString()}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 text-xs text-muted-foreground">
              Blocked {outcomes.blocked} · Timed out {outcomes.timedOut}
            </CardContent>
          </Card>
          <Card className={adminSupportKpiCardClass}>
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Custom override</CardDescription>
              <CardTitle className="text-base">
                {hasCustomOverride
                  ? context.userLimit?.unlimited
                    ? "Unlimited"
                    : `${context.userLimit?.monthlyAllowance ?? "—"} / period`
                  : "None"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className={adminSupportChartCardClass}>
          <CardHeader>
            <CardTitle className="text-base">Daily history</CardTitle>
            <CardDescription>Successful generations in the selected range.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {dailyChart.length === 0 ? (
              <div className={adminSupportEmptyStateClass}>
                <p className="text-sm text-muted-foreground">No daily usage yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyChart}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Area
                    type="monotone"
                    dataKey="generations"
                    name="Generations"
                    stroke="#38bdf8"
                    fill="#38bdf8"
                    fillOpacity={0.25}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className={adminSupportChartCardClass}>
          <CardHeader>
            <CardTitle className="text-base">By feature</CardTitle>
            <CardDescription>Generations and failures by feature.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {byFeature.length === 0 ? (
              <div className={adminSupportEmptyStateClass}>
                <p className="text-sm text-muted-foreground">No feature activity.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byFeature.map((f) => ({
                    ...f,
                    label: formatFeature(f.feature),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Bar dataKey="generations" name="Success" fill="#34d399" />
                  <Bar dataKey="failed" name="Failed" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Models</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">Gens</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byModel.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No model usage.
                    </TableCell>
                  </TableRow>
                ) : (
                  byModel.map((m) => (
                    <TableRow key={m.model}>
                      <TableCell className="font-mono text-xs">{m.model}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.generations.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {m.totalTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMicrosAsUsd(m.estimatedCostMicros)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Recent requests</CardTitle>
            <CardDescription>
              Metadata only — prompts are never stored or shown.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Feature</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">ms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No recent requests.
                    </TableCell>
                  </TableRow>
                ) : (
                  recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatFeature(r.feature)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.model}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {r.totalTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {r.responseTimeMs ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="ai-usage-admin-actions">
        <p id="ai-usage-admin-actions" className={adminSupportSectionLabelClass}>
          Admin actions
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Custom allowance</CardTitle>
              <CardDescription>
                Override plan/team defaults for this user.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Checkbox
                  id="unlimited-gens"
                  checked={unlimited}
                  onCheckedChange={(c) => setUnlimited(c === true)}
                />
                <Label htmlFor="unlimited-gens" className="font-normal">
                  Unlimited generations
                </Label>
              </div>
              {!unlimited ? (
                <div className="space-y-1.5">
                  <Label htmlFor="allowance">Monthly allowance</Label>
                  <Input
                    id="allowance"
                    type="number"
                    min={0}
                    value={allowanceInput}
                    onChange={(e) => setAllowanceInput(e.target.value)}
                    className="max-w-xs"
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="allowance-reason">Reason</Label>
                <Textarea
                  id="allowance-reason"
                  value={allowanceReason}
                  onChange={(e) => setAllowanceReason(e.target.value)}
                  placeholder="Why is this override needed?"
                  rows={2}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    const trimmed = allowanceReason.trim();
                    if (!trimmed) {
                      setError("Reason is required when setting an allowance.");
                      return;
                    }
                    const n = Number(allowanceInput);
                    runAction(async () => {
                      await setAiUsageUserAllowanceAction({
                        userId: user.userId,
                        unlimited,
                        monthlyAllowance: unlimited
                          ? null
                          : Number.isFinite(n)
                            ? Math.floor(n)
                            : null,
                        reason: trimmed,
                      });
                      setAllowanceReason("");
                    });
                  }}
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                  Save allowance
                </Button>
                {hasCustomOverride ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => {
                      setReason("");
                      setConfirm("clearOverride");
                    }}
                  >
                    Remove override
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Access, flags &amp; reset</CardTitle>
              <CardDescription>
                Disable AI, clear flags, or reset the period counter.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {context.aiAccessEnabled ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => {
                      setReason("");
                      setConfirm("disable");
                    }}
                  >
                    Disable AI access
                  </Button>
                ) : (
                  <Button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      setReason("");
                      setConfirm("restore");
                    }}
                  >
                    Restore AI access
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => {
                    setReason("");
                    setConfirm("reset");
                  }}
                >
                  Reset usage counter
                </Button>
                {context.flagged ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => {
                      setReason("");
                      setConfirm("clearFlag");
                    }}
                  >
                    Clear flag
                  </Button>
                ) : null}
              </div>

              <div className="space-y-2 rounded-md border border-border/60 p-3">
                <p className="text-sm font-medium text-foreground">
                  Warning thresholds
                </p>
                {(
                  [
                    ["80%", "warn-80", warn80, setWarn80],
                    ["90%", "warn-90", warn90, setWarn90],
                    ["100%", "warn-100", warn100, setWarn100],
                  ] as const
                ).map(([label, id, checked, setter]) => (
                  <div
                    key={id}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(c) => setter(c === true)}
                    />
                    <Label htmlFor={id} className="font-normal text-muted-foreground">
                      Notify at {label}
                    </Label>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={isPending}
                  onClick={() =>
                    runAction(() =>
                      setAiUsageWarningThresholdsAction({
                        userId: user.userId,
                        warningThreshold80: warn80,
                        warningThreshold90: warn90,
                        warningThreshold100: warn100,
                        reason: reason.trim() || undefined,
                      }),
                    )
                  }
                >
                  Save thresholds
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <AlertDialog
        open={confirm != null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirm(null);
            setError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm ? confirmCopy[confirm].title : "Confirm"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm ? confirmCopy[confirm].description : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AdminUserIdentityBlock
            name={user.name}
            email={user.email}
            userId={user.userId}
          />
          {confirm && confirmCopy[confirm].requireReason ? (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-reason">Reason</Label>
              <Textarea
                id="confirm-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Required for audit log"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="confirm-reason-optional">Reason (optional)</Label>
              <Textarea
                id="confirm-reason-optional"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(e) => {
                e.preventDefault();
                void executeConfirmed();
              }}
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Confirm"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
