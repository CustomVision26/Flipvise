"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Target } from "lucide-react";
import { updateAffiliateQuotaSettingsAction } from "@/actions/affiliate-quota";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminPlansSubTabPanelClass } from "@/components/admin-panel-styles";
import type { SerializedAffiliate } from "@/lib/admin-dashboard-types";
import { cn } from "@/lib/utils";

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function quotaStatusLabel(a: SerializedAffiliate): {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
} {
  if (!a.referralQuotaEnabled || !a.referralQuotaTarget) {
    return { label: "Quota off", variant: "secondary" };
  }
  const now = Date.now();
  const periodEnded = new Date(a.endsAt).getTime() <= now;
  const met = a.periodPaidReferrals >= a.referralQuotaTarget;
  if (periodEnded && !met) {
    return { label: "Expired — extend period", variant: "destructive" };
  }
  if (met) {
    return { label: "Quota met", variant: "default" };
  }
  return { label: "In progress", variant: "outline" };
}

type QuotaDraft = {
  enabled: boolean;
  target: string;
};

export function AdminAffiliateQuotaPanel({
  affiliates,
}: {
  affiliates: SerializedAffiliate[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<number | null>(null);

  const activeAffiliates = useMemo(
    () => affiliates.filter((a) => a.status === "active"),
    [affiliates],
  );

  const [drafts, setDrafts] = useState<Record<number, QuotaDraft>>(() => {
    const initial: Record<number, QuotaDraft> = {};
    for (const a of activeAffiliates) {
      initial[a.id] = {
        enabled: a.referralQuotaEnabled,
        target:
          a.referralQuotaTarget != null ? String(a.referralQuotaTarget) : "1",
      };
    }
    return initial;
  });

  function patchDraft(id: number, patch: Partial<QuotaDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  function saveQuota(a: SerializedAffiliate, resetPeriod: boolean) {
    const draft = drafts[a.id];
    if (!draft) return;
    const target = Number.parseInt(draft.target, 10);

    setSavingId(a.id);
    startTransition(async () => {
      try {
        await updateAffiliateQuotaSettingsAction({
          affiliateId: a.id,
          enabled: draft.enabled,
          quotaTarget: draft.enabled ? target : undefined,
          resetPeriod,
        });
        toast.success(
          resetPeriod ? "Quota saved and period reset" : "Quota settings saved",
        );
        router.refresh();
      } catch (error) {
        toast.error("Could not save quota", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      } finally {
        setSavingId(null);
      }
    });
  }

  return (
    <div className={cn(adminPlansSubTabPanelClass, "space-y-4")}>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Referral quotas</p>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          Set how many paid subscriptions each affiliate must drive during their
          current plan period. When the period ends, meeting the quota
          automatically renews the arrangement for the same length; otherwise
          access expires until you extend the end date in the directory tab.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border-2 border-border/70">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Affiliate</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Progress</TableHead>
              <TableHead>Quota enabled</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeAffiliates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-10 text-center text-muted-foreground"
                >
                  No active affiliates. Accept an invite in the directory tab
                  first.
                </TableCell>
              </TableRow>
            ) : (
              activeAffiliates.map((a) => {
                const draft = drafts[a.id] ?? {
                  enabled: false,
                  target: "1",
                };
                const status = quotaStatusLabel(a);
                const saving = isPending && savingId === a.id;
                const targetNum = Number.parseInt(draft.target, 10);
                const displayTarget =
                  a.referralQuotaEnabled && a.referralQuotaTarget
                    ? a.referralQuotaTarget
                    : 0;

                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">{a.affiliateName}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.invitedEmail}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      <div>{formatDate(a.quotaPeriodStartedAt ?? a.startedAt)}</div>
                      <div className="text-xs text-muted-foreground">
                        → {formatDate(a.endsAt)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className="font-medium">{a.periodPaidReferrals}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        / {displayTarget || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`quota-enabled-${a.id}`}
                          checked={draft.enabled}
                          onCheckedChange={(checked) =>
                            patchDraft(a.id, { enabled: checked })
                          }
                        />
                        <Label
                          htmlFor={`quota-enabled-${a.id}`}
                          className="text-xs text-muted-foreground"
                        >
                          {draft.enabled ? "On" : "Off"}
                        </Label>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={10000}
                        disabled={!draft.enabled}
                        value={draft.target}
                        onChange={(e) =>
                          patchDraft(a.id, { target: e.target.value })
                        }
                        className="h-8 w-24 tabular-nums"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={saving || (draft.enabled && targetNum < 1)}
                          onClick={() => saveQuota(a, false)}
                        >
                          {saving ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Target className="size-3.5" />
                          )}
                          <span className="ml-1.5">Save</span>
                        </Button>
                        {draft.enabled && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            disabled={saving}
                            onClick={() => saveQuota(a, true)}
                          >
                            Reset period
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
