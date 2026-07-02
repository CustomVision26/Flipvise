"use client";

import { useState, useTransition } from "react";
import { Save, Check } from "lucide-react";
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
import type { PlanConfig } from "@/lib/plan-config-types";
import { updatePlanTrialAction } from "@/actions/admin-plans";
import { normalizePlanTrialConfig } from "@/lib/plan-trial";

export function AdminPlanTrialSettings({
  initialPlans,
}: {
  initialPlans: PlanConfig[];
}) {
  const paidPlans = initialPlans.filter((p) => p.id !== "free");
  const [plans, setPlans] = useState(paidPlans);
  const [isPending, startTransition] = useTransition();
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function updateDraft(planId: string, patch: { days?: number; published?: boolean }) {
    setPlans((prev) =>
      prev.map((p) => {
        if (p.id !== planId) return p;
        const trial = normalizePlanTrialConfig(p.trial);
        return {
          ...p,
          trial: normalizePlanTrialConfig({
            days: patch.days ?? trial.days,
            published: patch.published ?? trial.published,
          }),
        };
      }),
    );
    setSavedPlanId(null);
    setError(null);
  }

  function savePlan(plan: PlanConfig) {
    const trial = normalizePlanTrialConfig(plan.trial);
    startTransition(async () => {
      try {
        await updatePlanTrialAction({
          planId: plan.id,
          trial,
        });
        setSavedPlanId(plan.id);
        setTimeout(() => setSavedPlanId(null), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save trial settings");
      }
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Configure free-trial length per plan and whether it appears on the public pricing page.
        Each user may start a published trial only once. Trials apply to monthly checkout only.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plan</TableHead>
            <TableHead>Trial days</TableHead>
            <TableHead>Published on pricing</TableHead>
            <TableHead className="text-right">Save</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plans.map((plan) => {
            const trial = normalizePlanTrialConfig(plan.trial);
            return (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`trial-days-${plan.id}`} className="sr-only">
                      Trial days for {plan.name}
                    </Label>
                    <Input
                      id={`trial-days-${plan.id}`}
                      type="number"
                      min={0}
                      max={90}
                      className="w-24"
                      value={trial.days}
                      onChange={(e) =>
                        updateDraft(plan.id, {
                          days: Number.parseInt(e.target.value, 10) || 0,
                        })
                      }
                    />
                    <span className="text-xs text-muted-foreground">days</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={trial.published}
                      disabled={trial.days <= 0}
                      onCheckedChange={(checked) =>
                        updateDraft(plan.id, { published: checked })
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      {trial.published && trial.days > 0 ? "Visible" : "Hidden"}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => savePlan(plan)}
                  >
                    {savedPlanId === plan.id ? (
                      <>
                        <Check className="mr-1.5 h-4 w-4" />
                        Saved
                      </>
                    ) : (
                      <>
                        <Save className="mr-1.5 h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
